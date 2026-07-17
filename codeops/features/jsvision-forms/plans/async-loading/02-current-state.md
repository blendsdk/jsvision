# Current State — async-loading

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

The exact code the plan touches, verified against the tree on `feat/form-remains`. Every `file:line`
below was read during planning; the plan is grounded in this reality, not an imagined shape.

## `packages/forms/src/create-form.ts` (215 lines) — the store

`createForm` wraps `createRoot((disposeScope) => buildForm(options, disposeScope))` (`:86`), so the
reactive graph is owned and the `createRoot` disposer is available. Inside `buildForm`:

- **Baseline** — `const baseline: Record<string, unknown> = {}` (`:99`), seeded once in the field
  loop at `:103` (`baseline[name] = clone(raw[name])`). This is the RD-07 rebase target (AR-50).
- **Signals** — `valueSignals` / `touchedSignals` maps (`:100-101`), seeded at `:104-105`; the
  `valueSignal(name)` / `touchedSignal(name)` getters throw `FormFieldError` on an unknown key
  (`:112-122`).
- **`submitAttempted`** — `const submitAttempted = signal(false)` (`:110`); `submit()` sets it, `reset()`
  clears it. The `load` state (`loading`/`loadGen`/`loadController`/`disposed`) seats beside it (AR-PL1).
- **`fieldDirty`** — `!eq(valueSignal(name)(), baseline[name])` (`:142`). **Unchanged** by this plan —
  rebasing `baseline` is all that's needed for `dirty()` to track the loaded record (AR-50).
- **`reset`** — writes `clone(baseline[name])` back + clears `touched` + `submitAttempted`, in one
  `batch()` (`:174-182`). **Unchanged** — after a rebase it already targets the loaded record (AR-50).
- **Helpers** — `clone` (arrays copied, scalars passed through, `:11`) and `eq` (element-wise for
  arrays, `:16`) already exist; `load` reuses `clone` for the defensive value/baseline copy.
- **Imports** — `batch, createRoot, signal` from `@jsvision/ui` (`:1`) are already imported; `load`
  adds **`onCleanup`** to that import (for the §E teardown) and otherwise needs no new import beyond the
  platform `AbortController` (a global).
- **Returned object** (`:203-214`) — `dispose: disposeScope` (`:213`) is the current teardown. The plan
  **leaves it unchanged** and attaches the `disposed`-set + loader-abort teardown via a root-body
  `onCleanup` (AR-PL3 / PF-201), then adds `loading` + `load` to this object.

The class `@example` (`:40-78`) currently shows sync + async validation; the plan extends it with a
load → rebase → reset snippet (RD-07 AC #15).

## `packages/forms/src/types.ts` (131 lines) — the interfaces

`interface Form<S extends z.ZodObject<z.ZodRawShape>, I>` (`:59-98`) is where `loading()` and `load()`
are added (with JSDoc + an `@example`). `I` is already a `Form` type parameter, so `load`'s
`Promise<I>` loader and `loading()` fit without a signature change elsewhere. `CreateFormOptions`
(`:107-130`) is **unchanged** (AR-46).

## `packages/forms/src/async.ts` (166 lines) — untouched, but load rides its effect

Each async field has one standing trigger effect subscribed to its own value (`:111-144`). When
`load` writes a `valueSignal`, that effect re-fires (the mount run was already consumed at
construction via `firstRun`, `:114`): it bumps the generation, aborts the prior controller, sets
`validating`→false and `asyncError`→**null** (`:125-128`), then — only if the field is sync-clean
(`untrack(() => fieldSyncClean(name))`, `:132`) — schedules a debounced run. So **re-validation on
load is automatic** (no call into the async layer, AR-PL7), and it fires **only for fields whose
value actually changed** (signals skip an equal write — see below; AR-PL8).

## `packages/ui/src/reactive/` — the primitives load relies on

- **`signal.ts:52`** — `setValue` is a **no-op on an equal value** (`Object.is` by default). This is why
  load re-validates only *changed* async fields (AR-PL8), and why the ST-L11/ST-L12 oracles load a
  **differing** value.
- **`owner.ts:163-194`** — `dispose(owner)` tears down owned **computations** and runs cleanups; it
  **bumps no counter**, and **signals are not owned** (a `signal.set` still executes after disposal,
  notifying no live observer). This is the mechanism behind PF-001: the generation guard can't protect
  the dispose path, so the plan uses a `disposed` flag. Crucially, `dispose` **recurses into child
  scopes** and fires their `owner.cleanups` (`:168`, `:185`) but never calls a returned `dispose`
  wrapper — so the plan sets `disposed` + aborts via an **`onCleanup` in the root body** (registers on
  `owner.cleanups`, fires once on any disposal — direct or enclosing-scope, `:141-153`), which a wrapper
  would miss (AR-PL3 / PF-201).

## Test + story precedent (mirrored, not modified)

- `test/store.spec.test.ts` (ST-01…10) — the dirty/reset/baseline oracle style ST-L2…L5 follow.
- `test/async.spec.test.ts` (ST-A1…A16) — the `deferredValidator()` controllable-loader helper (`:27`)
  + `vi.useFakeTimers()` / `advanceTimersByTimeAsync` idiom that ST-L9 (concurrency), ST-L10
  (disposal), ST-L11/L12 (async-on-load) reuse. **Real zod, never mocked.**
- `test/security.spec.test.ts` / `test/async-security.spec.test.ts` — the render-and-scan control-byte
  oracle ST-L-SEC copies (an `Input` bound to a loaded field; scan the `ScreenBuffer` for cp `< 0x20`,
  `=== 0x7f`, `0x80–0x9f`).
- `test/surface.impl.test.ts` — locks the barrel to exactly 5 runtime values; **stays green** (load/
  loading are `Form` methods, AR-PL7).
- `kitchen-sink/stories/forms-async.story.ts` + `stories/index.ts` + `test/kitchen-sink.smoke.spec.test.ts`
  — the story shape, registration line, and smoke assertion `forms-load.story.ts` / ST-LS1 mirror.
