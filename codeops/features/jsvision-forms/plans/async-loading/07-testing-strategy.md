# Testing Strategy — async-loading

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

**Specification-first (non-negotiable):** the ST-L* oracles are written from RD-07's acceptance
criteria **only** — never from the implementation. A failing spec test means the code is wrong, not
the test. Order per phase: spec tests → red → implement → green → impl tests → verify.

**Idioms (from the first slice + RD-06):** **real zod** (never mocked); `vi.useFakeTimers()` +
`await vi.advanceTimersByTimeAsync(ms)` to drive debounces; a **controllable deferred loader** (below)
to pin exactly when a load settles for the ordering/concurrency/disposal oracles; the `.js` extension
in import specifiers (NodeNext). Fixtures from `test/fixtures.ts` (`Schema`, `makeInitial`).

### The controllable deferred loader (test helper, in `load.spec.test.ts`)

Mirrors `deferredValidator()` (`async.spec.test.ts:27`): each call records its `AbortSignal` and parks
on a fresh deferred the test resolves/rejects by index — so a test controls settle timing and order,
and (never reading `signal`) it doubles as the abort-ignoring loader the stale-guard oracle needs.

```ts
function deferredLoader<I>() {
  const signals: AbortSignal[] = [];
  const resolvers: Array<(r: I) => void> = [];
  const rejecters: Array<(e: unknown) => void> = [];
  const loader = ({ signal }: { signal: AbortSignal }) =>
    new Promise<I>((res, rej) => { const i = signals.length; signals.push(signal); resolvers[i] = res; rejecters[i] = rej; });
  return { loader, signals, resolve: (i: number, r: I) => resolvers[i]?.(r), reject: (i: number, e: unknown) => rejecters[i]?.(e) };
}
```

---

## Specification Test Cases (`load.spec.test.ts`) — ST-L1…ST-L12

| ST | AC | Input → Expected |
|----|----|------------------|
| **ST-L1** | 1 | **Regression.** A sync-only form that never calls `load()`: `rawValues()`/`dirty()`/`reset()`/`isValid()`/`submit()` behave exactly as the first slice + RD-06 (baseline stays `initial`). *(Asserts only the pre-existing surface — no `load`/`loading` reference — so it genuinely stays green through the red phase; the `loading()===false` default is asserted by ST-L8, not here — PF-205.)* |
| **ST-L2** | 2 | **Replace + rebase.** `initial {name:'', port:'8080'}`; `await form.load(async () => ({name:'Ada', port:'9090'}))` → `rawValues()` deep-equals `{name:'Ada', port:'9090'}`; `form.dirty()===false`; `field('name').dirty()===false` and `field('port').dirty()===false`. |
| **ST-L3** | 3 | **Reset targets loaded.** After ST-L2's load, `field('name').value.set('Zed')`; `form.reset()` → `field('name').value()==='Ada'` (the loaded value, not `''`); `form.dirty()===false`. |
| **ST-L4** | 4 | **Reload rebases again.** `await form.load(→{Ada,'9090'})` then `await form.load(→{Ben,'7070'})` → `rawValues()` deep-equals `{Ben,'7070'}`; after editing + `reset()` the target is `Ben`/`'7070'`; every `dirty()===false`. |
| **ST-L5** | 5 | **Pristine.** Invalid `initial`; `await form.submit(()=>{})` marks every field `touched` (returns `false`); assert `touched()===true`. Then `await form.load(→ a valid record)` → every `field.touched()===false` (including the field touched **before** the load). *(AC #5 also clears the submit-attempted flag, but that signal is write-only with no accessor (`create-form.ts:108-110`), so ST-L5 verifies only the observable `touched()` half — PF-207.)* |
| **ST-L6** | 6 | **Resolves `true` + settle ordering.** `const ok = await form.load(async () => ({name:'Ada', port:'9090'}))` → `ok===true`; a **synchronous** `form.dirty()` immediately after the `await` reads `false` (the promise settled after the batch applied). |
| **ST-L7** | 7 | **Rejection untouched.** Capture `rawValues()`; `await form.load(async () => { throw new Error('x'); })` → resolves `false`; `rawValues()`/baseline/`touched` unchanged; `loading()===false`; `'loadError' in form === false`. |
| **ST-L8** | 8 | **`loading()` transitions (both paths).** Fake timers + `deferredLoader`. `loading()===false`; call `load` (no await) → `loading()===true` synchronously; `resolve(0, rec)` + flush → `loading()===false`. Repeat with `reject(0, e)` → `loading()===false`. |
| **ST-L9** | 9 | **Concurrency / stale-guard.** Two overlapping loads via `deferredLoader`: call `load` (0) then `load` (1) → `loading()===true`. `signals[0].aborted===true` (superseded), `signals[1].aborted===false`. `resolve(1, {Ben})` → `rawValues()` is Ben's **and** `loading()===false`; `resolve(0, {Ada})` (out of order) → dropped, `rawValues()` **still** Ben's **and** `loading()` **still** `false` (the dropped older settle neither applies a value nor touches `loading()` — PF-206). |
| **ST-L10** | 10 · AR-PL2 | **Disposal.** (a) in-flight `load` via `deferredLoader`; `form.dispose()` → `signals[0].aborted===true`; `resolve(0, {Ada})` after dispose → `rawValues()` unchanged (no apply), baseline unchanged (a fresh `dirty()` read still reflects pre-load), `loading()` **not** cleared to reflect the dead run. Same for `reject(0, e)` after dispose. (b) **AR-PL2:** on an already-disposed form, `const ok = await form.load(spy)` → `ok===false`, `spy` **not** called. |
| **ST-L11** | 11 | **`asyncError` cleared on load (unconditional of sync-cleanness).** Form with an `asyncValidators` entry on `username`. Drive it to `asyncError()==='Already in use'` (set a taken value, advance the debounce, resolve). Then `await form.load(→ a **different** username value)`; `field('username').asyncError()===null` — **including** when the loaded value is itself sync-invalid (the clear is unconditional; the change fires the effect). |
| **ST-L12** | 12 | **Async re-validation on a sync-clean loaded value.** Form with an `asyncValidators` entry (a spy). `await form.load(→ a sync-**clean**, different value)`; `advanceTimersByTimeAsync(debounce)` → the validator was called **with the loaded value**. Negative: `await form.load(→ a sync-**invalid**, different value)`; after the debounce the validator was **not** called (the `fieldSyncClean` gate). |

## Security oracle (`load-security.spec.test.ts`) — ST-L-SEC

| ST | AC | Input → Expected |
|----|----|------------------|
| **ST-L-SEC** | 14 | A loaded **string** value `'a\x00b\x1b[31mc\x07\r\n\x9b'` applied via `await form.load(→ {text: nasty})`, bound to a real `Input`, rendered through `createRenderRoot`; scanning the buffer, **no** cell has a code point `< 0x20`, `=== 0x7f`, or in `0x80–0x9f`. Mirrors `security.spec.test.ts` / `async-security.spec.test.ts` — the forms engine never bypasses `@jsvision/ui`'s sanitisation; the C1 clause (`0x9b`) is load-bearing. |

## Smoke oracle (`kitchen-sink.smoke.spec.test.ts`) — ST-LS1

| ST | AC | Input → Expected |
|----|----|------------------|
| **ST-LS1** | 13 | Build + mount the `forms/load` story headlessly; the buffer contains a stable marker the story always paints (the interaction hint / `Load record` label). The generic smoke loop also checks unique id + required metadata + "paints something". |

## Implementation tests (`load.impl.test.ts`) — internals the spec oracles don't reach

- **`ctx.signal` is a live `AbortSignal`** handed to the loader, and it fires on supersede (a second
  `load`), on `form.dispose()`, and on **enclosing-scope disposal** (see the next bullet).
- **`disposed` guard on both settle paths** — a resolve-after-dispose and a reject-after-dispose each
  leave `loading` untouched and write no value/baseline (the internal half of ST-L10).
- **Enclosing-scope disposal fires the teardown (PF-201)** — build a form **inside an outer
  `createRoot`**, start an in-flight `load` via `deferredLoader`, then call the **outer** disposer
  (never `form.dispose()`): the loader's `signals[0].aborted===true`, and a `resolve(0, rec)` afterward
  writes no value/baseline and does not clear `loading()`. Proves the root-body `onCleanup` seam fires
  on parent teardown — the exact gap a returned `dispose` wrapper would leave open.
- **Array-field defensiveness (PF-203)** — load an **array-typed** field (the check-group shape from
  `fixtures.ts`); after the load, mutating the value array in place (`field.value().push(x)`) does **not**
  change `baseline[name]` (they are independent clones), so `dirty()` flips `true`. Guards the two-clone
  discipline the scalar oracles don't reach.
- **AR-PL8 changed-fields-only** — an `asyncValidators` field whose loaded value **equals** its current
  value does **not** have its `asyncError` cleared (the effect doesn't fire on an equal write,
  `signal.ts:52`); a changed field does. Documents the micro-edge.
- **Missing-key contract (PF-005)** — a loader resolving a record missing a key sets that field **and**
  its baseline to `undefined` (so `dirty()` is `false` for it — baseline matches).
- **File size** within the 200–500 target after the edits (`create-form.ts` ≈ **280**); the assertion
  checks a **range with headroom** (≤ 300 by true line count), not an exact value (PF-208).

## Coverage map — every RD-07 AC → ≥1 oracle

| RD-07 AC | Oracle |
|----------|--------|
| 1 regression | ST-L1 |
| 2 replace+rebase | ST-L2 |
| 3 reset→loaded | ST-L3 |
| 4 reload | ST-L4 |
| 5 pristine | ST-L5 |
| 6 resolves true / settle order | ST-L6 |
| 7 rejection untouched | ST-L7 |
| 8 loading() transitions | ST-L8 |
| 9 concurrency/stale-guard | ST-L9 |
| 10 disposal (+ AR-PL2) | ST-L10 |
| 11 asyncError cleared on load | ST-L11 |
| 12 async re-run (sync-clean) | ST-L12 |
| 13 kitchen-sink story | ST-LS1 |
| 14 security control-byte | ST-L-SEC |
| 15 verify / check:docs / @example / no banned refs | Phase-2 gate task |

**Verify:** `yarn verify` (per phase + final; AR-PL6).
