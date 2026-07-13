# Current State: Event Loop + Focus + Modality + Commands

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

RD-01 (reactive core), RD-02 (layout engine), and RD-03 (view/group spine) are **done and
verified** under `packages/ui/src/`. `@jsvision/core` (input decoder, render, host, color,
capability) is the published foundation. RD-04 is purely additive: a new `event/` module plus a
handful of additive fields on the RD-03 `View`/`Group`. **No** cross-package primitive is needed.

The RD-03 spine deliberately shipped the **complete `View` shape with deferred logic** (AR-30):
`onEvent` is an overridable stub, `state.focused`/`state.disabled` exist but are never driven, and
the `RenderRoot` exposes an injectable scheduler seam — all built "for exactly this" (RD-04).

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/ui/src/view/view.ts` | Abstract `View`: `bounds`, `state`, `onEvent` stub, `invalidate`/`invalidateLayout`, `parent`, scope wiring | **Additive**: `focusable`/`preProcess`/`postProcess` fields (default false); retype `onEvent(ev: DispatchEvent)` (PA-8) |
| `packages/ui/src/view/group.ts` | Concrete `Group`: `children`, `background`, add/remove/mount | **Additive**: internal `current: View \| null` focused-child pointer (AR-48) |
| `packages/ui/src/view/types.ts` | `ViewState`, `ThemeRoleName`, `DrawContext`, `RenderRootOptions` | **Additive**: declare `CommandEvent`/`AppEvent`/`DispatchEvent` here so `View.onEvent` references them with no `view/`→`event/` cycle (PA-8) |
| `packages/ui/src/view/render-root.ts` | `RenderRoot` (mount/resize/flush/serialize/buffer) + impl | **None** — consumed as-is; the loop constructs it with a deferring `schedule` |
| `packages/ui/src/index.ts` | `@jsvision/ui` public entry (explicit named re-exports for view/layout) | **Additive**: re-export the RD-04 public surface from `event/index.js` |
| `packages/core` (input/keymap) | `InputEvent`, `createKeymap`/`Keymap`, `TuiError`, `Logger`/`createLogger`, `CapabilityProfile`, `Theme` | **None** — imported by name |

### Code Analysis (grounded)

- **`View.onEvent` is a stub** (`view/view.ts:71`): `onEvent(_ev: unknown): void {}`. Retyping the
  parameter to `DispatchEvent` keeps existing subclass **overrides** valid (a wider/`unknown`
  override still satisfies the base — TS method-parameter bivariance; `view.tree.spec.test.ts:101`
  `override onEvent(ev: unknown)` compiles). **But narrowing the base param breaks the *direct
  call*** `v.onEvent({ type:'key', value:'x' })` at `view.tree.spec.test.ts:94` (`TestView`,
  `:18`, does not override `onEvent`, so the call binds to the now-`DispatchEvent`-typed base →
  TS2345). That spec-oracle call argument is type-adapted to a valid `DispatchEvent` with the ST-15
  assertion preserved (PF-008, 99 T1.3) — PA-8.
- **`View.state`** (`view/view.ts:38`) is `{ visible, disabled, focused }` with a fixed reference,
  fields mutate — RD-04 drives `focused`. `bounds: Rect` (`view/view.ts:36`) is **0-based**,
  parent-relative; `invalidate()` (`:76`) / `invalidateLayout()` (`:81`) delegate to the host;
  `parent: View | null` (`:48`) supports the ancestor walk for focus + clip.
- **`Group.children`** (`view/group.ts:23`) is the ordered z-order array (paint back-to-front);
  the compose walker recurses it (`render-root.ts:81-93`). RD-04's focus traversal + hit-test walk
  the same array (hit-test in **reverse** for top-most-first).
- **`RenderRoot`** (`view/render-root.ts:34-45`) exposes `mount`/`resize`/`flush`/`serialize`/
  `buffer`. The scheduler is **construct-time, private, `readonly`** (`render-root.ts:124,139`);
  `scheduleFlush()` coalesces via a `scheduled` flag (`:173-177`). So the loop cannot inject a
  scheduler post-construction — it must **build** the root (AR-61) with a deferring `schedule` that
  never self-flushes, and call `renderRoot.flush()` itself once per tick (AR-64).
- **Core mouse coords are 1-based** (`packages/core/src/engine/input/events.ts:28` — "1-based as the
  terminal sends them"); `InputEvent = KeyEvent | MouseEvent | WheelEvent | PasteEvent | FocusEvent`
  (`:58`). The loop normalizes to 0-based before hit-testing (AR-63).
- **Core already ships `createKeymap`/`Keymap`** (`packages/core/src/engine/input/keymap.ts:22,40`;
  exported `engine/index.ts:37,49`) with the `'ctrl+q'` lowercase `'+'` grammar + build-time
  validation. RD-04 reuses it (AR-62) — no bespoke chord parser.

## Gaps Identified

### Gap 1: No dispatch entry
**Current:** `View.onEvent` is inert; nothing routes decoded events. **Required:** a pure
`dispatch(event)` that wraps in a `DispatchEvent` envelope and routes 3-phase. **Fix:**
`event/dispatch.ts` + `event/event-loop.ts`.

### Gap 2: Focus flags never driven
**Current:** `state.focused` is always `false`; no `current` pointer on `Group`. **Required:** a
focus manager maintaining the per-group `current` chain and flipping `focused`. **Fix:**
`event/focus.ts` + additive `Group.current`.

### Gap 3: No command / keymap layer
**Current:** none. **Required:** a registry + `emitCommand`/`enable*` + core-`Keymap` glue. **Fix:**
`event/commands.ts`.

### Gap 4: No mouse routing
**Current:** decoded `MouseEvent`/`WheelEvent` are undispatched. **Required:** top-most-first
hit-test + focus-on-click. **Fix:** `event/hit-test.ts`.

### Gap 5: No modality
**Current:** none. **Required:** `execView`/`endModal` modal stack + input capture. **Fix:**
`event/modal.ts`.

### Gap 6: Render root self-flushes
**Current:** `RenderRoot` flushes via its own scheduler. **Required:** the loop owns frame timing
(one flush/tick). **Fix:** the loop builds the root with a deferring `schedule` and drives `flush()`
(AR-61/AR-64) — no RenderRoot change.

## Target file layout (PA-7)

```
packages/ui/src/event/
├── types.ts        # (also re-exports the contract types declared in ../view/types.ts) EventLoop, EventLoopOptions
├── dispatch.ts     # 3-phase routing (pre/focus/post) + handled short-circuit + cascade queue
├── commands.ts     # command registry + enable/disable + core-Keymap key→command (consume)
├── focus.ts        # per-group current chain, focusable predicate, Tab/Shift-Tab, focusView, save/restore
├── hit-test.ts     # 1-based→0-based normalize, top-most-first walk, focus-on-click
├── modal.ts        # modal stack, execView/endModal, input capture, nested LIFO
├── event-loop.ts   # createEventLoop — builds+owns RenderRoot, dispatch, resize, onIdle, error isolation
└── index.ts        # barrel
```
Contract types (`CommandEvent`/`AppEvent`/`DispatchEvent`) are declared in `../view/types.ts` and
re-exported through both `view/index.ts` and `event/index.ts` (PA-8). Additive edits:
`view/view.ts`, `view/group.ts`, `view/types.ts`, `src/index.ts`.

## Test file layout

`packages/ui/test/` (vitest `unit`, import by name from `../src/event/index.js`; packaging spec
imports `@jsvision/ui`; the demo is `e2e`). Real `View` subclasses + a real loop-built `RenderRoot`
(no mocks); the flush counter is read from an injected synchronous-style sequence (the loop drives
`flush()`, so tests assert call counts via a spy on the built root's `flush` or a frame counter).

```
event.loop.{spec,impl}.test.ts        # ST-01,16,17,18,19 — construct/dispatch/frame/resize/idle/error
event.dispatch.{spec,impl}.test.ts    # ST-02,09,10,11 — 3-phase, command dispatch, enable/disable, keymap
event.focus.{spec,impl}.test.ts       # ST-03,04,05,06 — current chain, Tab, predicate, repaint
event.mouse.{spec,impl}.test.ts       # ST-07,08 — hit-test, focus-on-click
event.modal.{spec,impl}.test.ts       # ST-12,13,14,15 — execView/endModal, capture, save/restore, nested
event.packaging.spec.test.ts          # ST-20 — re-export shape, check:deps, bounded/no-injection
packages/examples/test/event-demo.e2e.test.ts   # demo:events (PA-9)
```

## Dependencies

### Internal
- RD-03 `View`/`Group`/`RenderRoot`/`Point`/`intersect` (`packages/ui/src/view/`), RD-02 `Size2D`/
  `Rect` (`packages/ui/src/layout/`), RD-01 reactivity (for the loop's `bind`-driven repaints —
  unchanged; RD-04 adds no reactive layer, AR-58).

### External
- `@jsvision/core` (declared workspace dep): `InputEvent`/`KeyEvent`/`MouseEvent`/`WheelEvent`/
  `PasteEvent`/`FocusEvent`, `createKeymap`/`Keymap`, `TuiError`, `Logger`/`createLogger`,
  `CapabilityProfile`, `Theme`, `defaultTheme`. No third-party/native deps (`check:deps` guard).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `view/`↔`event/` import cycle (onEvent needs `DispatchEvent`) | Med | High | Declare contract types in `view/types.ts`; `event/` imports them (PA-8) — one-way edge |
| 3-phase × focus-chain × modal interplay correctness (TV's 30-yr bug surface) | Med | High | Spec-first ST oracles per AC; isolate focus/dispatch/modal in separate files; impl tests for nesting/restore |
| Off-by-one in hit-test (1-based vs 0-based) | Med | Med | Single normalization point at the dispatch boundary (AR-63); ST-07 asserts exact cells |
| Loop ↔ RenderRoot frame-timing (one flush/tick) | Low | Med | Deferring `schedule` + loop-driven `flush()`; ST-16 asserts exactly one flush per tick |
| `onEvent` retype breaks an RD-03 spec test at typecheck | High | Med | Subclass *overrides* stay compatible (TS bivariance), but **narrowing** the base param to `DispatchEvent` breaks the *direct call* `v.onEvent({type:'key',value:'x'})` in the spec oracle `view.tree.spec.test.ts:94` (TS2345). Mitigation: type-adapt that call argument to a valid `DispatchEvent` (assertion preserved), listed in 99 T1.3 (PF-008). `yarn verify` includes RD-03 suites |
