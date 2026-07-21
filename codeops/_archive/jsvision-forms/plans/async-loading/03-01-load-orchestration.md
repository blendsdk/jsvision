# 03-01 — Load Orchestration

> **Document**: 03-01-load-orchestration.md
> **Parent**: [Index](00-index.md)
> **Covers**: the `load` flow + the `types.ts` / `create-form.ts` edits (all inline per AR-PL1).

## §A — Public surface (`types.ts`)

Add two members to `interface Form<S, I>` (`types.ts:59-98`), each with **prose JSDoc** (no per-member
`@example` — `check:docs` requires `@example` only on the exported `createForm` function, not on interface
members, and no existing `Form` member carries one; `check-jsdoc.mjs:164-194` / `:97`). §F updates the
`createForm` class-level `@example` to exercise the new surface, which is what the gate checks.

```ts
/**
 * Whether an async record load started by {@link Form.load} is currently in flight. Form-level and
 * atomic (a whole record loads at once — there is no per-field loading). It does NOT gate
 * `isValid()`/`submit()`; compose the busy state yourself (e.g. `disabled: () => form.loading()`).
 */
loading(): boolean;

/**
 * Load an existing record into the form: runs `loader` (given a fresh `AbortSignal`) and, on
 * success, replaces every field's value and rebases the whole baseline to the loaded record in one
 * batch, leaving the form pristine — `touched`/submit-attempted cleared and `dirty()` false, so
 * `reset()` now returns to the LOADED record. Resolves `true` on success, `false` if the loader
 * rejects (state untouched) — it never rejects. Re-invokable (a Reload button). A newer `load()`
 * supersedes an older in-flight one; `dispose()` aborts an in-flight load. Do NOT call while a
 * `submit()` is in flight (the two are independent; gate them in the app).
 *
 * The loader must resolve the full RAW editing record (`Promise<I>`, the same shape as `initial`) —
 * map your server/domain record to raw editing values inside it (there is no inverse of
 * `z.coerce`). A key missing from the resolved record sets that field (and its baseline) to
 * `undefined`.
 */
load(loader: (ctx: { signal: AbortSignal }) => Promise<I>): Promise<boolean>;
```

`CreateFormOptions` is unchanged (AR-46). No barrel change — these are `Form` methods (AR-PL7).

## §B — State (`create-form.ts`, in `buildForm`, beside `submitAttempted` `:110`)

```ts
const loading = signal(false);
let loadGen = 0;
let loadController: AbortController | undefined;
let disposed = false;
```

- `loading` — the form-level in-flight signal; exposed as `loading: () => loading()` (AR-52).
- `loadGen` — monotonic; each `load()` claims `++loadGen`; a settle whose `g !== loadGen` is stale
  (superseded by a newer load) and drops (AR-51).
- `loadController` — the in-flight load's `AbortController`; a new load aborts the prior one.
- `disposed` — set by the root-body teardown (§E). Guards the dispose path, which the generation
  counter cannot (dispose bumps no `loadGen`; `owner.ts:163`) — PF-001 / AR-51.

`load` also needs `onCleanup` added to the `@jsvision/ui` import (`create-form.ts:1`, beside `batch`/
`createRoot`/`signal`) for the §E teardown; otherwise it needs no new import beyond the platform
`AbortController`.

## §C — The `load` flow (the closure)

> **Shipped-code comments are already plain language here** — the reference block below is what an
> executor writes verbatim, so it carries **no** CodeOps IDs (a paste-clean block; the `check:docs`
> banned-ref scanner does not catch `AR-PL*`/`AC #n` forms, so the plan must not seed them). The
> AR-/PF-/AC- traceability lives in the prose Notes beneath the block, where it belongs.

```ts
const load = async (loader: (ctx: { signal: AbortSignal }) => Promise<I>): Promise<boolean> => {
  if (disposed) return false;                       // a stray call on a torn-down form is a no-op
  const g = ++loadGen;
  loadController?.abort();                           // supersede any in-flight load
  loadController = new AbortController();
  loading.set(true);                                // set synchronously, before the first await

  let record: I;
  try {
    record = await loader({ signal: loadController.signal });
  } catch {
    // Loader rejected → resolve false, leave state untouched. Clear loading only if this is still the
    // current run AND the form is live — a torn-down or superseded form must never be written.
    if (!disposed && g === loadGen) loading.set(false);
    return false;
  }

  // Drop the result if the form was torn down or a newer load has since superseded this one.
  if (disposed || g !== loadGen) return false;

  batch(() => {
    for (const name of names) {
      // Two independent copies: the baseline snapshot must never share an array reference with the
      // live value signal, so an in-place edit of one can never leak into the other.
      baseline[name] = clone(record[name]);         // rebase — the loaded record becomes the new baseline
      valueSignal(name).set(clone(record[name]));   // replace the value (a change re-runs async checks)
      touchedSignal(name).set(false);               // pristine — no error reveal on a freshly loaded record
    }
    submitAttempted.set(false);
    loading.set(false);
  });
  return true;
};
```

Notes:

- **Ordering (AC #6).** Everything after the `await` is synchronous, so the returned promise settles
  *after* the batch commits — a synchronous `form.dirty()` right after `await form.load(...)` reads
  `false`.
- **`loading()` transitions (AC #8).** `loading.set(true)` runs before the first `await` (so it is
  `true` synchronously once `load()` is called); it returns to `false` in the batch on success, in the
  catch on rejection — but never on a superseded/disposed settle (that path returns before touching
  `loading`), so the newest run owns `loading()`.
- **Concurrency (AC #9).** A newer `load` bumps `loadGen` and aborts the older controller; the older
  settle sees `g !== loadGen` and drops. Verified out-of-order in ST-L9.
- **Async re-validation (AC #11/#12).** Setting the value signal fires the field's async trigger
  effect for **changed** fields only (`signal.ts:52`); the effect clears `asyncError` and, if the
  loaded value is sync-clean, schedules a debounced run (AR-52 / AR-PL8). `load` calls nothing on the
  async layer.
- **Defensive copies (PF-203).** `baseline[name]` and the value signal each get their **own**
  `clone(record[name])` — the same two-clone discipline as the construction seed (`create-form.ts:103`
  and `:104`) and the RD's load-flow step 4. Sharing one clone would alias the baseline and the live
  value for an array-typed field, so an in-place edit of the value would silently mutate the baseline
  (`dirty()` false, `reset()` a no-op). `clone` copies arrays and passes scalars through (`:11`).
- **Missing key (AC-adjacent, PF-005).** `record[name]` for a key the loader omitted is `undefined`;
  the value and its baseline become `undefined`. The `Promise<I>` type enforces the full shape;
  documented in the `@example`.

## §D — The returned object (`create-form.ts:203-214`)

Add `loading` + `load`. `dispose` is **unchanged** — it stays `disposeScope`; the `disposed`-flag +
abort teardown now rides an `onCleanup` in the root body (§E), not a wrapper:

```ts
return {
  field,
  values: validation.values,
  rawValues,
  errors: validation.errors,
  isValid: isValidForm,
  dirty,
  validating: () => asyncLayer.anyValidating(),
  loading: () => loading(),        // NEW
  load,                            // NEW
  submit,
  reset,
  dispose: disposeScope,           // unchanged — teardown runs via onCleanup (§E)
};
```

## §E — Root-body teardown via `onCleanup` (AR-PL3)

Register the teardown in `buildForm`'s root body (near the §B state), **not** as a `dispose` wrapper:

```ts
onCleanup(() => {
  disposed = true;
  loadController?.abort();          // abort an in-flight load (its settle is then a no-op via §C)
});
```

**Why `onCleanup`, not a `dispose` wrapper.** `createForm` nests its `createRoot` under whatever owner
is active (`create-form.ts:86`), so the form's scope can be a **child** of an enclosing scope (the
kitchen-sink smoke test nests each story's form under its own root; a future RD-08 dialog owns its form
by nesting). A parent `dispose()` recurses into child scopes and fires their `owner.cleanups`
(`owner.ts:168,185`) — but it never calls a returned `dispose` **wrapper**. So a wrapper would set
`disposed`/abort **only** on an explicit `form.dispose()`; when an enclosing scope is torn down without
that call, an in-flight load would be left un-aborted and its late settle would fall through §C's guard
(`disposed` still `false`) and write to a torn-down form. `onCleanup` in the root body fires on **any**
disposal — direct `form.dispose()` **or** enclosing-scope teardown — which is exactly the guarantee AC
#10 needs, and it mirrors how the async layer already cleans up (`async.ts:138-143`).

Idempotency is preserved: `disposeScope()` is idempotent (`owner.ts:164`), the cleanup fires exactly
once at disposal (`owner.ts:185`), and re-aborting an already-aborted controller is harmless. A load in
flight at teardown has its signal aborted (AC #10 abort half); a load that resolves/rejects after
teardown hits the `disposed` guard in §C and writes nothing (AC #10 no-op half) — now regardless of
**how** the scope was disposed.

## §F — The class `@example` (`create-form.ts:40-78`, AC #15)

Extend the existing `@example` with a load → rebase → reset snippet (mirrors 00-index §Usage), so
`check:docs` sees the new surface exercised. Keep it copy-pasteable and correct (loader returns the
raw editing shape; `reset()` returns to the loaded record).

## Layering / non-functional (RD-07 §Reactive-core & layering)

- `loading()` is a plain `@jsvision/ui` signal; the "Loading…" swap is the app reading it through
  `Show` — no new framework primitive, no `createResource`/Suspense.
- `load` uses the platform `AbortController` — no new dependency; `@jsvision/core`/`@jsvision/ui`
  stay zero-dep; `zod` stays the only peer dep. The store performs no I/O — every network call lives
  in the author's loader.
- File size: `create-form.ts` grows ~215 → **~280** lines (state + the `load` closure + the `onCleanup`
  teardown + the returned-object additions + the extended `@example` + the "why" comments), within the
  200–500 target (AR-PL1). The impl-test size check (task 1.7/1.8) asserts a **range with headroom**
  (≤ 300 by true line count), not an exact value.
