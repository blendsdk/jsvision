# Current State — the code Async Validation touches

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.7.0

Every claim below was verified against the working tree at plan time. Line numbers are anchors, not
contracts — re-confirm on execution.

## `@jsvision/forms` package layout (`packages/forms/src/`)

| File | Lines | Role | This plan |
|------|------:|------|-----------|
| `create-form.ts` | 168 | `createForm` → `createRoot(() => buildForm(options))`; value model, handles, dirty/reset/submit | **Modify** — wire the async layer, expose the disposer, async-aware submit |
| `validation.ts` | 45 | `createValidation` — one memoized `computed(() => schema.safeParse(rawValues()))` + accessors | **Modify** — guard the sync parse (AR-42) |
| `types.ts` | 73 | `Field<T>`, `Form<S,I>`, `CreateFormOptions<S,I>` | **Modify** — add async surface |
| `index.ts` | 5 | Barrel — 5 runtime values + 3 type exports | **Modify** — export `AsyncValidator` type |
| `internal.ts` | 15 | `touchedSinks` WeakMap seam (bind-field) | Untouched |
| `errors.ts` | — | `FormFieldError` | Untouched |
| `bind-field.ts`, `bind-choice.ts` | — | Widget binding | Untouched |
| `async.ts` | — | — | **Create** — `createAsyncValidation` orchestration (AR-P2) |

## `create-form.ts` — the seams

- **`createForm` (line 58-65)** wraps `buildForm` in `createRoot(() => buildForm(options))` and
  **discards the disposer** the root hands it (`create-form.ts:64`; the JSDoc at :61-63 says "No
  public dispose is exposed — there is nothing for a caller to tear down"). This is exactly the seam
  AR-44 opens: capture the disposer, expose it as `form.dispose()`.
- **Eager per-field loop (line 79-83)** seeds `baseline`, `valueSignals`, `touchedSignals` for every
  name. This is where the eager async signals belong (PF-004 / AR-P3) — created only for fields that
  have a validator.
- **`rawValues()` (line 101-105)** reads every value signal → the raw object; feeds `createValidation`.
- **`validation = createValidation(schema, rawValues)` (line 107)** — the sync layer. `fieldError` is
  reached via `validation.fieldError(name)` for the sync-clean gate.
- **`field()` (line 113-131)** memoizes one handle per name **lazily** on first call. Async
  accessors must **not** live only here — aggregation reads eager signals directly (AR-P3). The
  handle object gains `validating()` / `asyncError()`.
- **`submit()` (line 145-155)** currently: `batch` mark-touched + `submitAttempted`, then
  `if (!validation.isValid()) return false`, `validation.values()` null-guard, `await onValid`,
  `return true`. RD-06 rebuilds the middle: after the sync short-circuit (AR-P9), cancel pending
  debounces, force-run + await async, re-check `isValid()`, then gate.
- **The returned form object (line 157-166)** lists `field, values, rawValues, errors, isValid,
  dirty, submit, reset`. Add `validating` and `dispose`; `isValid` is wrapped to AND the async-clean
  check.

## `validation.ts` — the sync parse

- **Line 25**: `const result = computed(() => schema.safeParse(rawValues()));` — the single memoized
  parse. AR-42 wraps this body in `try/catch`: a throw (Zod's `$ZodAsyncError` on an async-refine
  schema) rethrows as a **named** developer error; `safeParse` returns `{ success:false }` for
  ordinary failures, so a throw unambiguously means an async refinement. **No extra `safeParse`
  call** is added (PF-006 / ST-11).
- **Stale doc-comment (line 19-20)**: "an async refinement would surface as an error rather than a
  promise" — factually wrong (it throws). Correct it while touching the file.
- **`fieldError(name)` (line 39-43)**: `result().success ? null : issues.find(path[0]===name)`. The
  async trigger reads this **untracked** for the sync-clean gate (PF-002).

## `types.ts` — the public surface

- `Field<T>` (line 10-21): `name`, `value: Signal<T>`, `error(): ZodIssue|null`, `touched()`,
  `dirty()`. **Add** `validating(): boolean` and `asyncError(): string | null`.
- `Form<S,I>` (line 31-52): `field`, `values`, `rawValues`, `errors`, `isValid`, `dirty`, `submit`,
  `reset`. **Add** `validating(): boolean` and `dispose(): void`.
- `CreateFormOptions<S,I>` (line 61-73): `schema`, `initial`. **Add** optional `asyncValidators?:
  { [K in keyof I]?: AsyncValidator<I[K]> }` and `asyncDebounceMs?: number`. **Add** the exported
  `AsyncValidator<T>` type.

## The reactive core actually available (`@jsvision/ui` re-exports `reactive/*`)

Verified in `packages/ui/src/reactive/{effect.ts,owner.ts,index.ts}` and re-exported at
`packages/ui/src/index.ts:42`:

| Primitive | Signature / behavior | Used for |
|-----------|----------------------|----------|
| `effect(fn: () => void): void` | **Runs once immediately** (`effect.ts:47`), re-runs on any dep read; deps **re-collected each run** (conditional branches subscribe only what they read); **no per-effect disposer** — torn down with the owner scope (`effect.ts:9-11`) | One standing trigger per async field; the mount-run is exactly this immediate first run (AR-P7) |
| `createRoot<T>(fn: (dispose)=>T): T` | Opens a scope; **passes `dispose` into `fn`**; returns `fn`'s value (`owner.ts:73-82`) | `createForm` already uses it (line 64) — capture the disposer for `form.dispose()` (AR-44) |
| `onCleanup(cb)` | Inside an effect body, fires **before each re-run and once at disposal** (`owner.ts:121-153`) | Clear the debounce `setTimeout` + `abort()` the in-flight controller on supersede/dispose (AR-P10) |
| `untrack(fn)` | Reads without subscribing (`scheduler.ts`, re-exported) | The sync-clean gate `untrack(() => fieldError(name) === null)` (PF-002) |
| `batch`, `signal`, `computed` | As used by the first slice | `computed` for `anyValidating()`/`allAsyncClean()`; `signal` for the per-field async state |
| `dispose(owner)` | **Idempotent** (`owner.disposed` guard, `owner.ts:163-165`); depth-first, fires cleanups once | Not exported directly — reached only via the `createRoot` disposer callback |

**Note:** `dispose` is *not* in the reactive barrel — only `createRoot`'s injected disposer callback
exposes it. `form.dispose()` = that callback (already idempotent via the owner guard).

## Test oracles that must stay green (first slice — immutable)

- `validation.spec.test.ts` **ST-11** (line 10-24): one `safeParse` recompute per raw change (via
  `vi.spyOn(Schema,'safeParse')`). RD-06 adds no `safeParse` call → stays green (PF-006).
- `validation.spec.test.ts` ST-12…17, `store.spec.test.ts`, `adapters.spec.test.ts`,
  `bind-field.spec.test.ts` — additive change must not regress any.
- `security.spec.test.ts` (line 21-41): renders a control-byte value through a bound `Input`, scans
  the buffer for C0/DEL/C1. The RD-06 security oracle **mirrors this pattern with a `Text` bound to
  `asyncError()`** (AC-15 / PF-005).
- `surface.impl.test.ts` (line 16-20): the barrel exports **exactly** `FormFieldError`, `bindCheck`,
  `bindField`, `bindRadio`, `createForm` (runtime). Adding the `AsyncValidator` **type** export does
  not change the runtime key set — **no edit needed** (AR-P5).

## Test idioms in play

- `vi` **fake timers** for the debounce (`vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync`);
  `vi.spyOn` for call-count assertions (established in `validation.spec.test.ts:13`).
- **Real zod** (`import { z } from 'zod'`) — never mocked (`fixtures.ts`, `security.spec.test.ts:14`).
- `createRenderRoot` + `Input`/`Text` + buffer scan for the render-path security oracle
  (`security.spec.test.ts:16,27-40`).
