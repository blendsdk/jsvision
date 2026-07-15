# 07 — Testing Strategy

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.7.0

Spec-first. Every spec oracle (`ST-A*`) derives from RD-06's acceptance criteria and the register —
never from imagined implementation behavior. A failing spec test means the code is wrong, not the
test. Test files:

- `packages/forms/test/async.spec.test.ts` — the store-level oracles **ST-A1…A16** (immutable).
- `packages/forms/test/async.impl.test.ts` — internals/edges (AR-P4 rejection, abort delivery,
  cleanup, force-run-supersedes-debounce).
- `packages/forms/test/async-security.spec.test.ts` — the render-path control-byte oracle for an
  async message (AC-15 / PF-005).
- `packages/examples/test/kitchen-sink.smoke.spec.test.ts` — **ST-AS1** (extend the existing file).

**Idioms** (from the first slice): `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(ms)` to
drive the debounce; `vi.spyOn` for call-count/`safeParse` assertions; **real zod** (never mocked); a
resolvable-deferred helper (`let resolve; new Promise(r => (resolve = r))`) to control when a
validator settles for the stale-guard/ordering oracles; `createRenderRoot` + buffer scan for the
security oracle.

---

## Spec oracles (ST-A*) → RD-06 acceptance criteria

| ST | Maps to | Scenario (input) | Expected (oracle) |
|----|---------|------------------|-------------------|
| **ST-A1** | AC-1 | `createForm({schema,initial})` with **no** `asyncValidators`; read everything; `dispose()` twice | `field.validating()===false`, `field.asyncError()===null`, `form.validating()===false`; `dispose()` is idempotent + safe; `isValid()`/`values()`/`submit()`/`reset()` identical to the first slice (a spy on the validator map is never constructed) |
| **ST-A2** | AC-2 | Validator resolves `null`; change a sync-clean field; `advanceTimersByTimeAsync(300)` | during the run `field.validating()===true`, then `false`; `field.asyncError()===null` after settle |
| **ST-A3** | AC-3 | Validator resolves `'Already in use'`; change; advance | `field.asyncError()==='Already in use'`; `field.error()` returns only the sync `ZodIssue \| null` — **never** the async string |
| **ST-A4** | AC-4 | Two rapid changes A then B (deferred validators); resolve **A last** (out of order) | only **B**'s result is applied (`asyncError` reflects B); A's result is dropped; **A's run received an `AbortSignal` that is now `aborted`** |
| **ST-A5** | AC-5 | 5 changes within `asyncDebounceMs`; advance once past the window; also a form with `asyncDebounceMs: 50` | validator invoked **once** with the **final** value; the custom 50 ms delay is honoured (invoked after 50, not 300) |
| **ST-A6** | AC-6 | Field sync-**invalid** (`fieldError!==null`), change it, advance | validator **not** invoked; after the value becomes sync-clean, a change + advance **does** invoke it |
| **ST-A7** | AC-7 | (a) validator resolves error → settle; (b) sync-valid + async-clean; (c) sync-valid, async **not yet run** | `isValid()` is (a) `false`, (b) `true`, (c) **`true`** (optimistic re pending — a not-yet-run check doesn't flip it false) |
| **ST-A8** | AC-8 | Two async fields both mid-flight, then both settle | `form.validating()===true` while any in flight; `false` once all settle |
| **ST-A9** | AC-9 | (a) sync-valid, validator resolves `'taken'`, `await submit(onValid)`; (b) sync-valid, async-clean, `await submit(onValid)` | (a) resolves **`false`**, `onValid` **not** called; (b) resolves **`true`**, `onValid` called once with the coerced `values()`; submit **force-runs** the validator even though no debounce had elapsed |
| **ST-A10** | AC-10 | Schema with an async `.refine`; read `isValid()`, `values()`, `errors()`, `field.error()` | each **throws** the engine's **named** async-schema error (message contains `asyncValidators`) — not a raw `$ZodAsyncError`, not a silent wrong result (verified against installed zod) |
| **ST-A11** | AC-11 | `form.dispose()`, then change a value + advance; call `dispose()` again | the validator is **not** invoked (the standing effect is gone); the second `dispose()` is a safe no-op |
| **ST-A12** | AC-12 (PF-002) | Fields A & B each with an async validator; B mid-flight; edit **A**; advance | B's in-flight run is **not** aborted or re-run (B's validator call count unchanged, B's `AbortSignal` not aborted); A runs independently |
| **ST-A13** | **AR-P7** | `createForm` with an async validator and a **sync-clean initial value**; advance timers **without any change** | the validator is **never** invoked (the mount run is skipped) |
| **ST-A14** | **AR-P8** | Field has `asyncError()==='taken'` for value `v1`; change to a sync-clean `v2` | `asyncError()` is `null` **immediately** (before the debounce elapses / before the next run); `isValid()` is not held `false` by the superseded verdict during the window |
| **ST-A15** | **AR-P9** | Sync-**invalid** form that also has an async validator; `await submit(onValid)` | resolves **`false`**; the async validator is **never invoked** (`spy` 0 calls); `onValid` not called |
| **ST-A16** | **AR-P11 / AC-4** | Validator that **ignores its `AbortSignal`** (resolves via a deferred, never reads `signal`): change to v1, advance past the debounce so v1's run is **in flight**; change to v2 (sync-clean) so v2 is now **debouncing**; resolve **v1** with `'stale'` while v2's run has **not yet started**; only then advance v2's debounce | v1's result is **dropped** — `asyncError()` is **not** `'stale'` (the effect's generation bump on the v2 change superseded v1); `validating()` is **not** stranded `true`; only v2's run writes the final verdict. Closes the abort-independent window the ST-A4 timing doesn't reach. |
| **ST-A-SEC** | AC-15 (PF-005) | Validator resolves the control-byte message `'a\x00b\x1b[31mc\x07\r\n\x9b'`; drive it; render a `Text` bound to `field.asyncError()`; scan the buffer | **no** painted cell has a code point `< 0x20`, `=== 0x7f`, or in `0x80–0x9f` (the existing `Text`/`ScreenBuffer.set` path sanitises; the engine stored the string as inert data) |
| **ST-AS1** | AC-14 | Build+mount the `forms/async` story headlessly | the painted buffer contains the async affordance (`Username` label + the literal `checking…` hint); the generic smoke loop also mounts it and asserts it paints |

> **`Text` binding note (ST-A-SEC + the story).** `Text`'s content getter is typed `() => string`, but
> `asyncError()` is `string | null`. Coerce at the boundary — `new Text(() => field.asyncError() ?? '')`
> — and gate any `severity: 'error'` `Text` on `asyncError() !== null` so an empty string never paints
> danger-red. (This is a typecheck/rendering detail, not a behavioral one.)

## Regression oracles (must stay green — not modified)

| Oracle | File | Guarantee |
|--------|------|-----------|
| **ST-11** (AC-13 / PF-006) | `validation.spec.test.ts:10` | one `safeParse` recompute per raw change — RD-06 adds **no** `safeParse` call (the guard reuses the one memoized parse; `isValid()` ANDs signal reads) |
| ST-12…17 | `validation.spec.test.ts` | sync validation/coercion/refine routing unchanged |
| store / adapters / bind-field spec | `*.spec.test.ts` | value model, choice lenses, touched wiring unchanged |
| security spec | `security.spec.test.ts` | the bound-`Input` render path oracle unchanged |
| surface-lock | `surface.impl.test.ts` | the **runtime** barrel is still exactly 5 values (the `AsyncValidator` **type** export adds no runtime key) |

## Implementation tests (`async.impl.test.ts`)

- **AR-P4 — validator rejection**: a validator that **rejects** (throws) → the run is caught,
  `validating()` returns to `false`, `asyncError()` is `null` (treated as no-error); no unhandled
  rejection escapes.
- **Abort delivery**: the `ctx.signal` handed to the validator is a live `AbortSignal`; superseding a
  run fires `abort` on the prior signal (an `addEventListener('abort', …)` inside the validator sees
  it) — the idiom RD-07's `load({signal})` will reuse.
- **onCleanup teardown**: `dispose()` while a debounce timer is pending clears it (no late invocation
  after dispose); `dispose()` while a run is in flight aborts its controller.
- **Force-run supersedes a just-cancelled debounce**: a debounced run that already started before
  `submit()` cancels timers is superseded by the force-run (its late result is dropped by the
  generation guard, and its in-flight controller is aborted by `run()`'s abort-before-reassign,
  PF-102) — `submit()` gates on the force-run's result.
- **Eager aggregation without `field()`**: `form.validating()` / `isValid()` are correct **before**
  `field(name)` is ever called (PF-004 / AR-P3).

## Verification (AC-16)

- Per phase (red/green): `yarn workspace @jsvision/forms test`; the story phase adds
  `yarn workspace @jsvision/examples test`.
- Final: **`yarn verify`** = `yarn lint` → `turbo run typecheck build test check:docs`.
  `check:docs` passes with the updated `createForm` class `@example` (covers `asyncValidators`,
  `validating()`, `asyncError()`, `dispose()`); no banned CodeOps/TV references in
  `packages/forms/src`. `yarn lint:fix` run + tree clean before the PR-bound push (Prime directive).
