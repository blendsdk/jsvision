# Current State: Split Panes

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Every claim below was verified against the working tree at plan time. Issue #10's own "Substrate"
section is **wrong in four places**; those corrections are called out inline, because the issue's
"why this is low-risk" argument rests on them.

## Existing Implementation

### What Exists

Nothing named split/pane/splitter exists in any package — this is a greenfield component. What
exists is the substrate it builds on, in three parts.

**1. The integer flex solver — exists, but has no min support.**
`packages/ui/src/layout/apportion.ts` provides `apportion(total, weights)` (largest-remainder
integer apportionment, sums to `total` exactly) and `solveTrack(total, items, gap)` built on it.
Both are barrel-exported (`layout/index.ts:16-17`), as is `TrackItem`.

> **Issue claim corrected.** Issue #10 implies `fr` sizing supplies `minSize` clamping ("a split is
> two `fr` tracks whose ratio the drag mutates"). It supplies the *ratio*, not the *clamp*.
> `TrackItem` is `fixed | flex` only (`apportion.ts:18-20`), `Size` is `fixed | fr | auto`
> (`layout/types.ts:36-39`), and `LayoutProps` (`layout/types.ts:56-81`) has no min/max field.
> **There is no minimum-size support anywhere in the layout engine.**

**2. The pointer-capture seam — exists and is genuinely generic.**
Optional fields on the `DispatchEvent` envelope: `setCapture?(view)`, `releaseCapture?()`,
`hasCapture?(view)` (`view/types.ts:145-153`), backed by `EventLoop`'s `captureTarget`
(`event/event-loop.ts:137`, `:462-467`, wired `:511-516`). Already reused by five non-desktop
widgets: `scroll/scroll-bar.ts:228,234,258`, `controls/slider.ts:228,236`,
`controls/input.ts:475,489`, `color/color-swatch.ts:232,246`, `editor/editor-mouse.ts:49,74`.
`hitTestRoute` short-circuits to the capture target, bypassing hit-test and focus-on-click
(`event/hit-test.ts:144-149`).

> **Issue claim corrected.** Issue #10 points at the Desktop WM's `beginMove`/`beginResize` and
> `applyResize` as the reusable drag substrate. The *capture seam* is reusable; the *gesture math is
> not*. Every `Gesture` variant is hard-typed `target: Window` (`desktop/gestures.ts:17-20`), and
> `applyResize` (`gestures.ts:57`) reads `w.minWidth`/`w.minHeight` and writes `w.layout.rect` /
> calls `w.onResized()`. A splitter cannot call it.

**3. Two container patterns — one of which does not generalize to this component.**
`View.layout` is a **data field** (`LayoutProps`), not a method; there is no `layout()` hook to
override (`view/view.ts:69`). `bounds: Rect` is written by the layout pass (`view/view.ts:65`).
`measure?(available)` is optional and only affects `auto` sizing (`view/view.ts:71`). Reactive
resync uses `View.bind(reader, apply, { relayout: true })` (`view/view.ts:228-240` → `markRelayout`),
which throws outside `onMount`.

- **Declarative** — `TabView` (`tabs/tab-view.ts:207-276`): an inner `Group` with `direction:'col'`,
  a fixed 1-cell strip, `{kind:'fr',weight:1}` pages, reactive resync via `bind(…, {relayout:true})`
  at `:271-276`. The inner `Group` exists so a caller assigning `view.layout = {position, rect}` (a
  whole-object write) cannot clobber the container's `direction` (`:263-267`).
- **Imperative** — `Scroller` (`scroll/scroller.ts:143-164`): writes child `.bounds` directly inside
  `draw()`, which runs each compose before the walker descends.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/layout/apportion.ts` | `apportion` + `solveTrack` | Add `TrackItem.min`; add the no-min fast path to `solveTrack`; add internal `apportionMin` (03-01) |
| `packages/ui/src/layout/types.ts` | `Size`, `LayoutProps`, `normalizeSize` | Add `min?` to the `fr` variant (`:38`); clamp it in `normalizeSize` (`:168-169`) (03-01) |
| `packages/ui/src/layout/layout.ts` | The layout pass + `fr`→`TrackItem` bridge | Pass `min` through at the bridge (`:168-169`) (03-01) |
| `packages/ui/src/layout/measure.ts` | Natural-size measurement | An `fr` item contributes `min ?? 0` instead of `0` (`:82-84`) (03-01) |
| `packages/ui/src/layout/index.ts` | Layout barrel | No change — `apportionMin` stays module-private (AR-7) |
| `packages/core/src/engine/color/theme.ts` | `Theme` interface + `defaultTheme` | Add `splitter` + `splitterDragging` (03-02) |
| `packages/core/src/engine/color/presets.ts` | `monochromeTheme` (the only hand-authored preset) | Add both roles (03-02) |
| `packages/core/src/engine/color/roles.ts` | `rolesFromAliases` | Derive both roles (03-02) |
| `packages/ui/src/split/` | The new component | Create (03-03) |
| `packages/ui/src/index.ts` | Package barrel | Re-export `split/` (03-03) |
| `packages/examples/kitchen-sink/stories/` | Showcase | Add + register the story (03-04) |

### Code Analysis

**The apportion identity — why cell-unit weights give exact drag fidelity.** In `apportion`
(`apportion.ts:56-63`), `remainder = (total * w_i) % weightSum` and
`quotient = (total * w_i − remainder) / weightSum`. When `total === weightSum`, `total * w_i` is a
multiple of `total`, so every `remainder` is 0, every `quotient` is `w_i`, `leftover` is 0, and the
function returns its input verbatim. So in the steady state (`Σ paneCells === free`) the solve is
the **identity** — a 1-cell drag moves the divider exactly 1 cell. Off the steady state (after a
container resize) it rescales proportionally, integer-exact and deterministic. (AR-6)

**Why the imperative pattern is disqualified here.** `layout.ts:118-120`:

```ts
const childRect = assembleRect(content, mainOffsets[flowIndex], crossOffset, main, cross, direction);
result.set(child, childRect);
layoutContainer(child, { width: childRect.width, height: childRect.height }, result);
```

The layout pass **recurses into each child with the rect it just computed** — a pane's entire
interior subtree is solved against that rect. Overwriting `pane.bounds` in `draw()` afterwards
leaves every descendant sized against the stale rect, with nothing to re-solve them. `Scroller` is
exempt only because its content is caller-laid-out to a fixed `extent` independent of the viewport
(`scroller.ts:11-12`) and its documented usage places children with `position:'absolute'` rects
(`scroller.ts:55`), which `layout.ts:94-102` places from `props.rect` regardless of parent size.
Split panes hold arbitrary caller subtrees that must reflow to the pane.
**Governing rule: pane size is an INPUT to the reflow, not an output of the draw.** (AR-5)

**The capture-target subtlety.** `ScrollBar` captures on *itself* (`scroll-bar.ts:228`) because the
bar is stationary and only its thumb moves. A **splitter moves under the pointer**, so capturing on
the splitter yields a self-referential coordinate frame. The correct precedent is `Desktop`, which
captures on itself — `desktop.ts:216` `this.loop?.setCapture(this)` — after which "mouse events
arrive here directly with desktop-local coordinates" (`desktop.ts:244`), with a `hasCapture`
staleness guard at `:252`.

## Gaps Identified

### Gap 1: No minimum-size support in the layout engine

**Current Behavior:** `solveTrack` apportions flex items purely by weight; a flex item can be
solved to 0 cells. `Size`/`LayoutProps` cannot express a minimum.
**Required Behavior:** A flex track item may declare a minimum it is never solved below; when the
minimums cannot all be honoured, items squeeze proportionally and still sum to the total exactly.
**Fix Required:** `TrackItem.min` + `Size.min` (`fr` only) + internal `apportionMin` + a no-min fast
path in `solveTrack`. See [03-01](03-01-layout-engine-min.md). (AR-8)

### Gap 2: No splitter theme roles

**Current Behavior:** 68 roles on `Theme` (`core/src/engine/color/theme.ts:30-256`); no role
expresses a draggable divider. There is **no** role named `frame` — border/title/icon are structural
extras on `window`/`windowInactive`/`dialog`.
**Required Behavior:** A `splitter` / `splitterDragging` pair, so themes style dividers directly and
the drag state is visible.
**Fix Required:** 4 compiler-enforced edits. See [03-02](03-02-theme-roles.md). (AR-15)

### Gap 3: No split container

**Current Behavior:** Nothing. Authors hand-place panes with absolute rects and cannot resize them.
**Required Behavior:** `SplitView` per [03-03](03-03-splitview-component.md).

### Gap 4: No hover — the issue's affordance is unbuildable

**Current Behavior:** `MouseEvent.kind` includes `'move'` (`core/src/engine/input/events.ts:25-31`)
and the parser emits it (`input/mouse.ts:104-105`), but the host only enables **mode 1002**
(button-event/drag) at `core/src/engine/host/modes.ts:47`. **Mode 1003 (any-event tracking) is never
enabled anywhere in the repo** — bare motion is never reported. No hover state, no `hovered` flag,
no enter/leave events exist. Widgets defensively write `kind === 'move' || kind === 'drag'`
(`scroll-bar.ts:212`), but the `'move'` arm is dead under 1002.
**Required Behavior:** v1 needs no hover — a static `▓` grab mark carries discoverability at rest,
and the highlight fires while dragging.
**Fix Required:** None in this plan. Deferred (AR-4, AR-20).

## Dependencies

### Internal Dependencies

- `@jsvision/ui` → `layout/` (`apportion`, `solveTrack`, `Size`, `LayoutProps`), `view/`
  (`View`, `Group`, `DispatchEvent`, the capture seam), `reactive/` (`signal`, `bind`).
- `@jsvision/ui` → `@jsvision/core` for `Theme` / `ThemeRoleName` (`view/types.ts:30` is
  `keyof Theme`), so the theme-role work (03-02) must land before the component draws (03-03).
- `@jsvision/examples` → `@jsvision/ui` by package name, for the story.

### External Dependencies

None. Zero runtime dependencies is a hard project constraint (`yarn check:deps`).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The `min` change regresses the shared layout solver, which the entire UI depends on | Low | High | The no-min fast path means every existing call site runs the identical current code path; ST-1 pins the existing `solveTrack` `@example` output byte-for-byte as a regression oracle (AR-8) |
| `min` becomes permanent public API shaped by one component's needs | Medium | Medium | Scope is deliberately minimal: one optional field on two existing types, `fr`-only, no `max`. Accepted knowingly at AR-8; the alternative (drag-time-only clamping) was presented and rejected |
| Theme-role count bump conflicts with the in-flight datagrid branch | **High** | Low | Known recurring friction. Roles are additive and the conflict is mechanical (a union + a count assertion); resolve at merge, don't pre-negotiate |
| Drag computed from the stale `sizes` signal after a resize, causing ≠1-cell divider movement | Medium | Medium | The drag handler reads resolved `pane.bounds`, not the signal, and writes the whole array back — restoring `Σ === free` and re-arming the identity. Pinned by ST-14 (AR-6) |
| Capturing on the splitter instead of the container yields a self-referential frame mid-drag | Medium | Medium | Capture on `SplitView` per the `Desktop` precedent; pinned by ST-17 |
| A pane solved outside its container becomes a wrong click target (hit-testing reads `bounds`) | Low | High | Every apportion path sums exactly; the infeasible case squeezes proportionally rather than overflowing. Pinned by ST-3 |
| Scope creep from "layout engine min" into a general constraints system | Medium | Medium | `max`, `basis`, and `shrink` are explicitly out of scope (01-requirements §Won't Have) |
</content>
