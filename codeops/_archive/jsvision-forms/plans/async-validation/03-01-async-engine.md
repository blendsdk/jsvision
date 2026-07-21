# 03-01 — Async Engine

> **Document**: 03-01-async-engine.md
> **Parent**: [Index](00-index.md)
> **Owns**: the `asyncValidators` surface, the `async.ts` orchestration module, and the additive
>   edits to `types.ts` / `create-form.ts` / `validation.ts` / `index.ts`.
> **CodeOps Skills Version**: 3.7.0

All decisions here trace to the register (AR-33…45, AR-P1…P10). This document specifies *how*; the
*why* lives in the RD and register.

---

## A. Public surface (`types.ts` + `index.ts`)

```ts
// types.ts — NEW exported type
/**
 * An async field validator: resolves an error message string, or `null` for "no async error".
 * Receives the field's RAW editing value (coerce inside if you need a typed value) and an
 * `AbortSignal` that is aborted when a newer change supersedes this run or the form is disposed.
 * A rejected promise is treated as "no async error" — catch inside and return a message to surface
 * a failure (AR-P4).
 */
export type AsyncValidator<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<string | null>;

// types.ts — Field<T> gains:
validating(): boolean;         // an async validation for this field is in flight (AR-39)
asyncError(): string | null;   // the latest non-superseded async message, or null (AR-40)

// types.ts — Form<S,I> gains:
validating(): boolean;         // any field validating (AR-39)
dispose(): void;               // idempotent whole-scope teardown (AR-44)

// types.ts — CreateFormOptions<S,I> gains (both optional):
asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };  // AR-34
asyncDebounceMs?: number;      // default 300 (AR-37)

// index.ts — add AsyncValidator to the type barrel (AR-P5):
export type { Form, Field, CreateFormOptions, AsyncValidator } from './types.js';
```

`error(): ZodIssue | null` is **unchanged** — the async message is never fabricated into a
`ZodIssue` (AR-40). The runtime barrel surface is unchanged (still 5 values) → `surface.impl.test.ts`
needs no edit.

---

## B. `async.ts` — the orchestration module (AR-P2, CREATE)

A single factory `createAsyncValidation(...)` owns every async signal and effect. It is called from
**inside** `buildForm` (which already runs inside `createRoot`), so every effect it creates is owned
by the form's scope and torn down by `dispose()`.

### B.1 Inputs

```ts
interface AsyncConfig<I> {
  names: string[];                               // all field names (Object.keys(initial))
  asyncValidators: Partial<Record<string, AsyncValidator<unknown>>>; // the opt-in map (may be empty)
  debounceMs: number;                            // asyncDebounceMs ?? 300
  valueSignal(name: string): Signal<unknown>;    // the store's raw value signal getter
  fieldSyncClean(name: string): boolean;         // () => validation.fieldError(name) === null  (READ UNTRACKED by caller)
}
```

### B.2 State (eager, async-fields-only — AR-P3 / PF-004)

For each `name` where `asyncValidators[name]` is defined, eagerly create:

```ts
const validating = signal(false);      // field.validating()
const asyncError = signal<string|null>(null);  // field.asyncError()
let gen = 0;                           // monotonic generation counter (AR-38)
let timer: ReturnType<typeof setTimeout> | undefined;   // pending debounce
let controller: AbortController | undefined;            // in-flight run's controller
let firstRun = true;                   // mount-run guard (AR-P7)
```

Store these in `Map`s keyed by name (only async fields present). A non-async field has no entry;
its accessors return the constants `false` / `null`.

### B.3 Per-field run (shared by the debounced and force paths)

```ts
async function run(name: string): Promise<void> {
  const s = state.get(name)!;
  const g = ++s.gen;                                  // claim this generation
  s.controller?.abort();                              // cancel any run this one supersedes (a submit
  s.controller = new AbortController();               //   force-run has no effect-cleanup to do it)
  s.validating.set(true);
  let msg: string | null = null;
  try {
    msg = await s.validator(valueSignal(name)(), { signal: s.controller.signal });
  } catch {
    msg = null;                                        // AR-P4: rejection ⇒ no async error
  }
  if (g !== s.gen) return;                             // superseded — drop result, leave newer run's state
  s.asyncError.set(msg);
  s.validating.set(false);
}
```

- The stale-guard is the `g !== s.gen` check (AR-38): a slow answer for an old value never
  overwrites a newer result. The generation is bumped on **every supersede** — both at run-start
  here AND in the effect the moment the value changes (§B.4) — so an in-flight run for the old value
  is dropped even if its validator ignored the `AbortSignal` and resolved during the new value's
  debounce window (before the new run starts). `controller.abort()` (here and in §B.4) is the
  best-effort cancel layered on top of that guarantee, not the guarantee itself.
- Reading `valueSignal(name)()` here is **untracked** by construction — `run` executes inside a
  `setTimeout`/`submit` callback, not inside a reactive computation, so it subscribes nothing.

### B.4 The per-field trigger effect (AR-36 / AR-P7 / AR-P8 / PF-002)

One `effect` per async field, created in a `for (const name of asyncNames)` loop (fresh `const`
binding per iteration):

```ts
effect(() => {
  const _v = valueSignal(name)();          // SUBSCRIBE to this field's value ONLY (tracked)

  if (s.firstRun) { s.firstRun = false; return; }   // AR-P7: skip the mount run

  // Supersede the previous value's async work as a TOTAL no-op — regardless of whether the
  // validator honours its AbortSignal. Bumping the generation HERE (not only at run-start) is the
  // load-bearing step: an in-flight run for the OLD value that resolves during THIS value's debounce
  // window sees g !== s.gen and is dropped, so it can never write a stale verdict. abort() is the
  // best-effort cancel on top; validating→false because no run is in flight for the new value yet;
  // asyncError→null because a changed value invalidates the prior verdict (AR-P8). (AR-38 / AR-P10)
  s.gen += 1;
  s.controller?.abort();
  s.validating.set(false);
  s.asyncError.set(null);

  // PF-002: read the sync-clean gate UNTRACKED so unrelated fields' parses don't subscribe us.
  if (!untrack(() => fieldSyncClean(name))) return;  // AR-36: don't check a malformed value

  s.timer = setTimeout(() => { void run(name); }, debounceMs);   // AR-37: debounce

  onCleanup(() => {                          // fires before the next re-run and at dispose()
    if (s.timer !== undefined) clearTimeout(s.timer);
    s.controller?.abort();                   // AR-38: cancel superseded / disposed work
  });
});
```

**Cleanup semantics (AR-P10).** `onCleanup` registered inside the effect body fires *before the
next run of this effect* (i.e. on the next value change) and *once at `dispose()`*
(`owner.ts:141`). So a new keystroke tears down the previous run's timer/controller before
re-scheduling — coalescing (debounce) and supersession (abort) both fall out of this. A completed
run's `controller.abort()` is a harmless no-op. **Correctness does not rest on the abort**, though:
the generation bump in the effect body (above) is what drops a superseded run's result, so a
validator that ignores its `signal` — a pure in-memory check, or one that simply forgot to thread
`signal` into `fetch` — is still safe.

> **Why the mount-run guard is correct (AR-P7).** `effect` runs its body once immediately
> (`effect.ts:47`). Reading `valueSignal(name)()` on that first pass is what *subscribes* the effect
> to the field; the `firstRun` early-return skips only the *scheduling*, so the subscription is
> established but no async check fires for the pre-filled initial value. Every subsequent run is a
> genuine value change.

### B.5 Force-run + cancel (for `submit`)

```ts
function cancelPendingDebounces(): void {           // PF-003
  for (const s of state.values()) if (s.timer !== undefined) { clearTimeout(s.timer); s.timer = undefined; }
}

async function runAllForced(): Promise<void> {      // AR-41: bypass debounce, await all, stale-guarded
  await Promise.all([...state.keys()].map((name) => run(name)));
}
```

`run` bumps the generation **and** aborts the prior controller (§B.3), so a force-run supersedes any
just-cancelled debounced run that had already started — its result is dropped by the `g !== s.gen`
guard and its in-flight request is aborted (a submit force-run has no effect-`onCleanup` between it
and the in-flight run to do the abort, so `run` itself must).

### B.6 Aggregates (AR-39 / AR-41 / AR-P6)

```ts
const anyValidating = computed(() => [...state.values()].some((s) => s.validating()));
function allAsyncClean(): boolean { return [...state.values()].every((s) => s.asyncError() === null); }
```

Reads only the eager async-field signals → aggregation never depends on `field()` (PF-004). Both are
reactive, so `form.validating()`/`isValid()` repaint through the existing path.

### B.7 Returned handle

```ts
return {
  fieldValidating: (name) => state.get(name)?.validating() ?? false,   // constant false for non-async
  fieldAsyncError: (name) => state.get(name)?.asyncError() ?? null,    // constant null for non-async
  anyValidating: () => anyValidating(),
  allAsyncClean,
  cancelPendingDebounces,
  runAllForced,
};
```

When `asyncValidators` is empty, `state` is empty: no effects, `anyValidating()` is `false`,
`allAsyncClean()` is `true`, the force/cancel helpers are no-ops — a sync-only form is behaviourally
identical to the first slice (AC-1).

---

## C. `create-form.ts` edits

### C.1 Expose the disposer (AR-44)

```ts
export function createForm<…>(options): Form<S, I> {
  return createRoot((disposeScope) => buildForm(options, disposeScope));   // was: createRoot(() => buildForm(options))
}
function buildForm<…>(options, disposeScope: () => void): Form<S, I> { … }
```

`disposeScope` is the idempotent `() => dispose(scope)` callback (`owner.ts:78`, guarded at
`owner.ts:164`). `form.dispose = disposeScope`. Update the JSDoc at `create-form.ts:61-63` (drop
"No public dispose is exposed…") and the class `@example` (see §E).

### C.2 Wire the async layer

Inside `buildForm`, after `const validation = createValidation(schema, rawValues);`:

```ts
const async = createAsyncValidation({
  names,
  asyncValidators: (options.asyncValidators ?? {}) as Partial<Record<string, AsyncValidator<unknown>>>,
  debounceMs: options.asyncDebounceMs ?? 300,
  valueSignal,
  fieldSyncClean: (name) => validation.fieldError(name) === null,
});
```

The `field()` handle (create-form.ts:119-125) gains two accessors:

```ts
validating: () => async.fieldValidating(key),
asyncError: () => async.fieldAsyncError(key),
```

### C.3 `isValid()` + `form.validating()` (AR-41 / AR-P6)

The returned form (create-form.ts:157-166):

```ts
isValid: () => validation.isValid() && async.allAsyncClean(),   // sync AND no async error (optimistic re pending)
validating: () => async.anyValidating(),
dispose: disposeScope,
```

`isValid()` adds **no** `safeParse` call — it ANDs signal reads — so ST-11 stays green (PF-006).

### C.4 Async-aware `submit()` (AR-41 / AR-P9 / PF-003)

```ts
const submit = async (onValid) => {
  batch(() => { for (const name of names) touchedSignal(name).set(true); submitAttempted.set(true); });

  if (!validation.isValid()) return false;          // AR-P9: sync-invalid ⇒ no async calls, fail fast

  async.cancelPendingDebounces();                   // PF-003: no queued run can supersede the force-run
  await async.runAllForced();                       // AR-41: force-run + await every async field (all sync-clean here)

  if (!isValid()) return false;                      // now also reflects async errors
  const coerced = validation.values();
  if (coerced === null) return false;                // guard (isValid() true implies non-null)
  await onValid(coerced);
  return true;
};
```

`isValid` referenced in the re-check is the wrapped form-level one (§C.3). Reads outside a reactive
context just return current values — correct for an `async` function body.

---

## D. `validation.ts` — schema-async guard (AR-42)

Wrap the memoized parse; **no** extra `safeParse` call (PF-006):

```ts
const result = computed(() => {
  try {
    return schema.safeParse(rawValues());
  } catch (cause) {
    // Zod throws (e.g. $ZodAsyncError) from a synchronous safeParse when the schema holds an async
    // refinement — safeParse returns { success:false } for ordinary failures, so a throw
    // unambiguously means an in-schema async refinement, which this engine does not support.
    throw new Error(
      'jsvision-forms: the schema contains an async refinement, which is not supported by the ' +
      'synchronous validator. Use the `asyncValidators` option for per-field async checks instead.',
      { cause },
    );
  }
});
```

Also correct the stale doc-comment at `validation.ts:19-20` ("would surface as an error rather than
a promise" → it throws; the engine now guards and rethrows a named error).

> **Named error.** A plain `Error` with a message that names `asyncValidators` satisfies AC-10 ("the
> engine's **named** async-schema error (message names `asyncValidators`)"). No new exported error
> class is required; `cause` preserves the original `$ZodAsyncError` for debugging. (If a dedicated
> class is preferred at execution, that is a runtime refinement — record it as `(runtime)`.)

---

## E. JSDoc / `@example` (AC-16, `check:docs`)

`createForm`'s class-level `@example` (create-form.ts:37-56) is extended to demonstrate the new
surface — an `asyncValidators` entry (with an in-validator `try/catch` per AR-P4), reading
`field.validating()`/`asyncError()`, and `form.dispose()` — exactly the Quick-Reference snippet in
`00-index.md`. `check:docs` requires an `@example` on every public export; `AsyncValidator` is a type
re-export (covered by the `createForm` example that uses it). No banned CodeOps/TV references in any
shipped comment.

---

## F. File-size check

`create-form.ts` gains ~25 lines (async wiring + submit rewrite + dispose) → ~195; `async.ts` is a
new ~120-line module; `validation.ts` +~10. All comfortably within the 200–500 target — the AR-P2
module split is what keeps `create-form.ts` focused (there is no forms-specific ≤500 oracle, but the
split honours the codebase norm). Confirm sizes at green.
