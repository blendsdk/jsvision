# SplitView Component

> **Document**: 03-03-splitview-component.md
> **Parent**: [Index](00-index.md)
> **Governs**: `packages/ui/src/split/` · `packages/ui/src/index.ts`

## Overview

`SplitView` is the widget: N panes, N−1 draggable 1-cell splitters, along a `row` or `col` axis.
It is a **class**, not the `createSplit()` factory issue #10 sketches — every widget in
`@jsvision/ui` is a class, and `createX` is reserved for non-widget infrastructure (AR-11).

## Architecture

### Proposed Changes

```
packages/ui/src/split/
├── index.ts        — subsystem barrel (SplitView, SplitViewOptions)
├── split-view.ts   — the container: structure, gesture ownership, resize
├── splitter.ts     — the 1-cell divider view: drawing, focus, keyboard
└── resize.ts       — pure resize math (module-private, like layout/pack-row.ts)
```

**Structure — the `TabView` shape.** `SplitView extends Group` and owns an **inner `Group`**
(`track`) carrying the real layout:

```
SplitView (Group)
└── track (Group)         layout: { position: 'fill', direction, gap: 0 }
    ├── pane[0]           layout: { size: { kind: 'fr', weight: w0, min: m0 } }
    ├── splitter[0]       layout: { size: { kind: 'fixed', cells: 1 } }
    ├── pane[1]           layout: { size: { kind: 'fr', weight: w1, min: m1 } }
    └── …
```

> **Decision per AR-5:** Declarative. Panes are `fr` tracks and the existing reflow pass places
> everything, so a pane's interior reflows correctly against its rect. The imperative alternative —
> solving in `draw()` and writing child `bounds`, the `Scroller` trick — is **defective here**:
> `layout.ts:118-120` recurses into each child with the rect it computed, so overwriting
> `pane.bounds` afterwards leaves every descendant sized against a stale rect. Pane size is an
> **input** to the reflow, never an output of the draw. Full reasoning: 02-current-state §Code Analysis.

The inner `track` exists for the same reason as `TabView`'s (`tabs/tab-view.ts:263-267`): a caller
assigning `split.layout = { position: 'absolute', rect }` — a whole-object write — would otherwise
clobber the container's own `direction`.

**Cross axis needs no work.** `normalizeProps` defaults `align` to `'stretch'`
(`layout/types.ts:203`), so a row split's panes already fill the height.

## Implementation Details

### New Types/Interfaces

```ts
/** Construction options for {@link SplitView}. */
export interface SplitViewOptions {
  /** Split axis: `'row'` = side-by-side panes, `'col'` = stacked panes. */
  direction: Direction;
  /** The pane views, in order. N children produce N−1 splitters. */
  children: View[];
  /**
   * Two-way pane sizing as `fr` weights. Seed it with ratios (`signal([1, 1])` = equal,
   * `[2, 1]` = 2:1); a drag rewrites it with the resolved cell counts. Restoring saved
   * weights into a differently-sized container rescales them proportionally.
   */
  sizes: Signal<number[]>;
  /** Minimum pane size in cells — a scalar applies to every pane, an array is per-pane. */
  minSize?: number | number[];
  /**
   * Fired on every **live** change: each drag move that actually changes the sizes, and each
   * keyboard step. Never fires when the sizes are unchanged — a drag held against a minimum is a
   * no-op, and a no-op is silent. Use this to mirror the layout live; use {@link onResizeEnd} to
   * persist it.
   */
  onResize?: (sizes: number[]) => void;
  /**
   * Fired once per **commit**: the pointer-up that ends a drag, and each discrete keyboard step.
   * One drag gesture fires this exactly once, however far the pointer travelled — so this, not
   * {@link onResize}, is the hook to persist a layout from.
   */
  onResizeEnd?: (sizes: number[]) => void;
}
```

> **Decision per AR-9:** `sizes` is a **required, caller-owned** `Signal<number[]>` plus callbacks —
> the `Slider` contract (`controls/slider.ts:33-49`), the closest precedent (a draggable widget
> mutating a value). It makes persisting a layout trivial: read the signal, save it, seed it next
> launch.
>
> **The callback pair follows `Slider` in full** (a preflight correction — AR-9 chose the
> *controlled-signal* shape and never adjudicated live-vs-commit). `Slider` splits `onInput` (live)
> from `onChange` (commit) precisely because persistence must not run per mouse-event, and it fires
> neither on a clamped no-op (`slider.ts:14-15`, `:150-155`, `:215-217`: "one drag gesture fires
> exactly one `onChange`"). `SplitView` mirrors that as `onResize` / `onResizeEnd`. The dedupe is
> not a nicety — R7 requires the callback fire **on change**, so firing on an unchanged array
> violates the requirement outright.

### New Functions/Methods

**The pure resize helper** (`split/resize.ts`, module-private — the `layout/pack-row.ts` precedent):

```ts
/**
 * Move the divider at `index` by `delta` cells, conserving the two adjacent panes' combined
 * size and clamping so neither falls below its minimum.
 */
export function applySplitResize(
  cells: readonly number[],
  index: number,
  delta: number,
  mins: readonly number[],
): number[];
```

Given panes `a = index` and `b = index + 1`:

```
// Read these as effective minimums: a pane can never be pushed *further* below wherever the
// engine has already had to put it. Equivalently — and this is why they are written this way —
// the bounds always straddle 0, so a zero delta is always a no-op and the result never depends
// on how `clamp` orders its arguments.
lo = min(0, mins[a] − cells[a])      // ≡ min(mins[a], cells[a]) − cells[a]
hi = max(0, cells[b] − mins[b])      // ≡ cells[b] − min(mins[b], cells[b])
effective = clamp(delta, lo, hi)
next[a] = cells[a] + effective
next[b] = cells[b] − effective
```

`cells[a] + cells[b]` is **conserved**, so `Σ next === Σ cells === free` — which keeps the
apportion identity armed (see below) and means only two panes ever move. This is the whole of the
resize math, and it is pure, so it carries the spec + impl tests (ST-12 … ST-14, ST-24, ST-28).

> 🚨 **The `min(0, …)` / `max(0, …)` are load-bearing — do not "simplify" them away.** `cells`
> comes from live resolved bounds, and the engine is *specified* to place panes **below** their
> minimums whenever `Σmin > free` (the infeasible squeeze — ST-3, ST-6). In that regime the naive
> bounds inverts: `lo = mins[a] − cells[a] > 0` while `hi = cells[b] − mins[b] < 0`, i.e. `lo > hi`.
> An inverted range makes `clamp` return an endpoint instead of the delta, so **a zero-movement
> mouse-down would rewrite the sizes**. This is not exotic: two panes at `minSize: 12` need 25
> columns, and any narrower terminal is in it.
>
> The damage would be **invisible and therefore worse**: in the infeasible branch `apportionMin`
> returns `apportion(free, mins)` and never reads the weights, so the corrupted array renders
> identically — it silently poisons the caller-owned signal that AR-9 makes the thing callers
> persist, and only surfaces on the next launch at a feasible size. Pinned by ST-28.
>
> **Consequence, accepted deliberately:** while the container is too small to honour the minimums,
> both bounds collapse to 0 and the divider is **frozen**. That is the correct answer — there is no
> space to trade, and the engine already owns the geometry — but it is a decision, not an accident:
> document it in the `SplitView` JSDoc so a caller understands why a drag does nothing at tiny sizes.

**`clamp` contract.** The repo's only `clamp` is `desktop/gestures.ts:22-24` —
`Math.max(lo, Math.min(hi, n))`, documented "*`lo` wins if the range is empty*". Reuse it (hoist it
to a shared internal helper) rather than re-implementing, so the argument order is pinned by one
definition instead of assumed at each call site. The bounds above are correct under **either**
order, but an unpinned contract is what let this defect through in the first place.

**`SplitView`:**

```ts
export class SplitView extends Group {
  constructor(opts: SplitViewOptions);

  /** Begin a captured splitter drag. Called by a {@link Splitter} on mouse-down. */
  beginDrag(index: number, ev: DispatchEvent): void;

  /** Resize by `delta` cells from the live geometry — the keyboard path. */
  resizeBy(index: number, delta: number): void;

  override onEvent(ev: DispatchEvent): void; // the captured drag
}
```

**Reading live geometry (the AR-6 trap).** Both resize paths base off the **resolved bounds**,
never the `sizes` signal:

```ts
private resolvedCells(): number[] {
  return this.panes.map((p) => (this.direction === 'row' ? p.bounds.width : p.bounds.height));
}
```

After a container resize the signal holds stale counts; computing `desired ± delta` from them would
rescale the delta through `apportion` and move the divider by ≠1 cell. Reading resolved bounds and
writing the whole array back restores `Σ === free` and re-arms the identity — the same discipline as
`Scroller`, where the signal holds *desired* and the clamp is applied against live geometry at read
(`scroll/scroller.ts:158-159`). This is safe because the loop paints one coalesced frame per tick,
so a handler always sees the geometry the user is looking at.

**Reactive resync.** In `onMount`:
`this.bind(() => this.sizes(), (w) => this.applyWeights(w), { relayout: true })` — the `TabView`
precedent (`tabs/tab-view.ts:271-276`). `bind` throws outside `onMount` (`view/view.ts:230`).

### The drag gesture

> **Decision per AR-5 notes / AR-13:** capture on the **`SplitView`**, not on the splitter. A
> splitter *moves under the pointer*, so capturing on it yields a self-referential coordinate frame.
> `ScrollBar` captures on itself only because the bar is stationary. The correct precedent is
> `Desktop`, which captures on itself (`desktop/desktop.ts:216`) while the moving `Window` merely
> *asks* it to (`window/window.ts:285`: `this.manager.beginMove(this, local)`). `Splitter` →
> `SplitView.beginDrag(index, ev)` mirrors that exactly.

```ts
// Splitter.onEvent — mouse-down
this.owner.beginDrag(this.index, ev);

// SplitView.beginDrag
this.gesture = {
  index,
  startMain: mainOf(ev.event),      // raw terminal coord (1-based, as sent)
  startCells: this.resolvedCells(),
};
this.splitters[index].dragging.set(true);
ev.setCapture?.(this);
ev.handled = true;

// SplitView.onEvent — while captured
const inner = ev.event;
if (this.gesture === null || inner.type !== 'mouse') return;
if (ev.hasCapture !== undefined && !ev.hasCapture(this)) { this.endDrag(); return; } // staleness guard
if (inner.kind === 'up') { this.endDrag({ commit: true }); ev.releaseCapture?.(); ev.handled = true; return; }
if (inner.kind === 'move' || inner.kind === 'drag') {
  const totalDelta = mainOf(inner) - this.gesture.startMain;
  this.commit(applySplitResize(this.gesture.startCells, this.gesture.index, totalDelta, this.mins()));
  ev.handled = true;
}

// SplitView.commit — the single write path. Deduped: an unchanged array is silent (R7 says the
// callback fires *on change*, and a drag held against a minimum produces the same array every event).
private commit(next: number[]): void {
  if (arraysEqual(next, this.sizes.peek())) return;
  this.sizes.set(next);        // → the onMount bind re-solves the track
  this.onResize?.(next);       // live
}
```

**Callback timing.** `commit()` fires `onResize` only; `endDrag({ commit: true })` fires
`onResizeEnd` once, with the final sizes — so one drag gesture produces exactly one `onResizeEnd`
however far the pointer travelled, matching `slider.ts:215-217`. The keyboard path is a discrete
step, so `resizeBy` fires **both** (`onResize` then `onResizeEnd`), mirroring `slider.ts:158-164`.
A drag abandoned by the staleness guard calls `endDrag()` **without** `commit`, so a lost gesture
never reports a phantom commit.

Two deliberate choices here:

- **Deltas come from the raw terminal coordinates** (`inner.x`/`inner.y`, 1-based as sent —
  `core/src/engine/input/events.ts:25-31`), not from `ev.local`. Only the *difference* matters, and
  the raw coords are one consistent frame throughout the drag, so no coordinate conversion between
  the splitter, the track, and the `SplitView` is needed at all.
- **Recompute from `startCells` + total delta each event**, never accumulate incrementally. Applying
  a clamped delta step-by-step causes the classic rubber-band bug: drag 10 cells past the minimum,
  come back 1, and the divider moves immediately instead of staying pinned until the pointer returns
  past the clamp point. Recomputing from the gesture's start is idempotent and clamps correctly.

`endDrag(opts?)` clears `gesture` and sets `dragging` false, and fires `onResizeEnd` when
`opts.commit` is set; it must be safe to call twice (the staleness guard and the mouse-up path can
both reach it), and the second call must fire nothing.

### The `Splitter` view

```ts
class Splitter extends View {
  override focusable = true;                 // AR-12: a tab stop, so arrows can resize it
  readonly dragging = signal(false);
  constructor(owner: SplitView, index: number, direction: Direction);

  override onMount(): void {
    // draw() is NOT auto-tracked — a bare dragging.set() schedules no frame. Bind it so the
    // role flip actually repaints. (`editor/indicator.ts:56-61` does exactly this, for exactly
    // this reason; copying its draw() line without its bind is the trap.)
    this.bind(() => this.dragging());
  }
}
```

> 🚨 **The `bind` is required, not decorative.** Without it, `dragging.set(true)` on mouse-down and
> `.set(false)` in `endDrag()` schedule **nothing**: `endDrag` does not resize, so no relayout
> follows, and **the splitter stays painted `splitterDragging` after the drag ends** until some
> unrelated frame repaints it. Mid-drag it only *appears* to work, because each `commit()`
> relayouts and repaints everything incidentally — which is also why ST-22 alone cannot catch this
> and why ST-29 asserts the role **after mouse-up**.
>
> `Splitter extends **View**` — `View` is the exported abstract base (`view/view.ts:63`); it is
> abstract, so `draw()` must be implemented. (There is no `BaseView` in this codebase: that name is
> only a file-local `import { View as BaseView }` alias inside `scroll/scroller.ts:14`.)
>
> `dragging` stays a `Signal<boolean>` — the framework's idiom for state one view owns and another
> sets, exactly as `Window.dragging` (`window/window.ts:89,130`) is set by `Desktop`
> (`desktop.ts:215`). `Slider` keeps its `dragging` as a plain field only because `Slider.draw`
> never reads it (`slider.ts:92`, `:137-147`); it is not a precedent for *drawn* drag state. The
> rule the codebase actually follows: **the view that draws the signal is the view that binds it.**

**Drawing** (AR-14, AR-15) — `ctx.fill(glyph, ctx.color(role))` then the grab mark via
`ctx.text(x, y, '▓', style)`:

| Split `direction` | Splitter shape | Glyph | `▓` grab mark at |
| ----------------- | -------------- | ----- | ---------------- |
| `'row'` | 1 cell wide, full height | `│` | `y = floor(ctx.size.height / 2)`, `x = 0` |
| `'col'` | full width, 1 cell tall | `─` | `x = floor(ctx.size.width / 2)`, `y = 0` |

Role: `splitterDragging` when `dragging()`, else `splitter` — the `indicatorNormal`/`indicatorDragging`
selection pattern (`editor/indicator.ts:72`). Single-line glyphs match the framework's existing
frames; the static `▓` carries the discoverability that the absent hover state cannot (AR-4).

**Keyboard** (AR-3) — mirror `Slider`'s axis idiom (`controls/slider.ts:188-189`):

```ts
const inc = this.direction === 'row' ? 'right' : 'down';
const dec = this.direction === 'row' ? 'left'  : 'up';
```

`inc` → `owner.resizeBy(index, +1)`, `dec` → `owner.resizeBy(index, -1)`, each setting
`ev.handled = true`.

> ⚠️ **Check the modifiers.** Only handle the **unmodified** arrow. A known trap in this codebase:
> the base `GridRows` binds arrows while ignoring modifiers, so `Alt`/`Ctrl`+arrow gets swallowed
> and never reaches the handlers that want it. Leave modified arrows, and the cross-axis arrows,
> unhandled so they bubble to focus navigation.

### Integration Points

- `packages/ui/src/index.ts` — re-export `SplitView` + `SplitViewOptions` from `./split/index.js`,
  alongside the other subsystems. `applySplitResize` stays **module-private** (AR-7).
- Consumes from `layout/`: `Direction`, `Size` (with the new `min` from 03-01).
- Consumes from `view/`: `Group`, `View`, `DispatchEvent`, `DrawContext`, the capture seam
  (`setCapture`/`releaseCapture`/`hasCapture`, `view/types.ts:145-153`).
- Consumes from `reactive/`: `signal`, and `View.bind`.
- Consumes from `@jsvision/core`: the `splitter`/`splitterDragging` roles (03-02) — **03-02 must
  land before this component draws**.

### Normalization (AR-16)

Documented in the JSDoc. **Where each rule runs matters** — `children` and `minSize` are
constructor-only inputs, but `sizes` is a caller-owned reactive signal that *any* writer can
rewrite at *any* time, so its normalization cannot live in the constructor:

| Input | Normalized to | Runs where |
| ----- | ------------- | ---------- |
| 1 child | Renders the child, no splitter. Legal, not an error | constructor |
| 0 children | An empty `track`; draws nothing. Legal | constructor |
| `sizes` length ≠ child count | Padded with `1` / truncated to the child count | **`applyWeights`** (the bind path) — see below |
| Zero or negative weight | Clamped to 0 by `apportion` (`apportion.ts:48`) — no extra code | engine |
| `minSize` scalar | Expanded to a per-pane array (AR-10) | constructor |
| `minSize` array length ≠ child count | Padded with `0` / truncated | constructor |
| Negative `minSize` | Floored to 0 by `toCells` in `normalizeSize` | engine |

**`sizes` normalizes in the bind, not the constructor — with a guarded write-back.**

```ts
private applyWeights(w: number[]): void {
  const fixed = fitToPaneCount(w, this.panes.length);   // pad with 1 / truncate
  // Self-correct the caller's signal, but ONLY on a real length mismatch: after this write the
  // length matches, so the effect cannot re-fire. See the loop warning below.
  if (fixed.length !== w.length) this.sizes.set(fixed);
  this.panes.forEach((p, i) => { /* write fixed[i] into the pane's fr weight */ });
}
```

> **Why not the constructor.** R11 states the padding/truncation guarantee **unconditionally**, and
> AR-16 says a layout container must never crash a running app over a sizes array. Normalizing once
> at construction honours neither: `bind(() => this.sizes(), (w) => this.applyWeights(w), …)`
> re-runs on every write, so a later `sizes.set(loadSavedLayout())` — a 3-pane layout restored into
> a 2-pane split, precisely the persistence flow AR-9 is built around — arrives unnormalized. The
> failure is not graceful: `w[i]` is `undefined` → `normalizeSize`'s `Math.max(0, undefined)`
> (`types.ts:169`) → `NaN` → `apportion` propagates it through `weightSum` (`apportion.ts:48-49`)
> → **every pane sized `NaN`**. The cited precedent already does the right thing: `TabView`
> normalizes inside its bind (`syncActive` — "correct a drifted `active`"), documented as re-running
> "on any `active` or `tabs` change, **from any writer**".
>
> 🚨 **The `if (fixed.length !== w.length)` guard is what makes the write-back safe — never make it
> unconditional.** Signals compare with `Object.is` (`reactive/signal.ts:41,53`), so
> `sizes.set(freshArray)` **always** writes a new reference, **always** notifies, and an
> unconditional write-back inside the effect is an **infinite loop**. `TabView` gets away with its
> corrective write only because `active` is a *number*, where `Object.is` makes a no-op write a
> genuine no-op ("*a no-op write when already valid (so the effect converges)*"). That reasoning
> does **not** transfer to an array. Guarding on length keeps the correction self-terminating —
> after it, the length matches — while keeping the persisted signal truthful, which is the whole
> point of AR-9. Pinned by ST-30.

## Code Examples

### Example 1: an explorer beside an editor

```ts
import { SplitView, signal } from '@jsvision/ui';

const sizes = signal([1, 3]);                    // 1:3 to start; the drag rewrites in cells
const split = new SplitView({
  direction: 'row',
  children: [explorer, editor],
  sizes,
  minSize: 12,                                   // neither pane below 12 cells
  onResizeEnd: (next) => savePaneLayout(next),   // persist once per gesture; reseed next launch
});
split.layout = { position: 'fill' };
```

Persist from `onResizeEnd`, not `onResize`: a drag fires `onResizeEnd` exactly once, whereas
`onResize` fires on every pointer move that changes the layout. Reach for `onResize` only when you
genuinely need live feedback (a size readout, a linked preview) — and note the caller-owned `sizes`
signal is already written live, so binding it is usually the better way to observe.

### Example 2: nesting produces a grid (AR-17)

```ts
// A sidebar beside a stacked preview/terminal — composition only, no grid affordance.
const outer = new SplitView({
  direction: 'row',
  children: [
    sidebar,
    new SplitView({ direction: 'col', children: [preview, terminal], sizes: signal([2, 1]) }),
  ],
  sizes: signal([1, 4]),
  minSize: [12, 20],
});
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Degenerate inputs (<2 children, length mismatches, negative sizes) | Normalize per the table above; document in JSDoc. **Never throw** — a layout container that throws mid-render takes down a running app | AR-16 |
| A wrong-length `sizes` array written **after** construction | `applyWeights` pads/truncates on every write (never the constructor alone), with a length-guarded write-back; otherwise `undefined` → `NaN` poisons every pane's geometry | AR-16 · PF-004 |
| Drag would push a pane below its minimum | `applySplitResize` clamps; the divider pins and the signal stays truthful | AR-8 |
| Container shrinks below the minimums | The **engine** clamps (`min` on the `fr` track, 03-01); if the minimums are collectively unsatisfiable, panes squeeze proportionally and still fill exactly — never overflow | AR-8 |
| Dragging **while** the minimums are unsatisfiable (panes already below `min`) | Both clamp bounds collapse to 0 → the divider freezes; the sizes are never rewritten. Without the `min(0,…)`/`max(0,…)` bounds the range inverts and a zero-delta mouse-down silently corrupts the persisted signal | AR-8 · PF-001 |
| Pointer capture lost mid-drag (a modal opens, the view is removed) | `hasCapture` staleness guard abandons the gesture, mirroring `desktop.ts:252`; `endDrag()` **without** commit, so no phantom `onResizeEnd` | AR-5 |
| Mouse-up arrives with no active gesture | `endDrag()` is idempotent — the second call fires nothing | AR-5 |

> **Why the clamp appears in two places, deliberately.** They cover **disjoint** cases and neither
> is redundant. The engine's `min` handles the *container shrink*, which no drag handler can see.
> `applySplitResize` clamps the *drag*, which keeps the caller-owned signal and `onResize` truthful
> — without it the signal would record an infeasible value (say `2`) while the engine rendered the
> clamped one (`12`), and AR-9 makes that signal the thing callers persist.
>
> **The two clamps meet in one place, and it is the sharp edge.** When the minimums are
> collectively unsatisfiable the engine's clamp *loses* — it squeezes panes below their minimums —
> and the drag clamp then finds `cells < mins`, the state its naive form cannot express. That
> intersection is the whole of PF-001; the `min(0,…)`/`max(0,…)` bounds are what make the two
> clamps compose instead of fight.

> **Traceability:** every strategy above references the Ambiguity Register entry that resolved it.
> See [`00-ambiguity-register.md`](00-ambiguity-register.md).

## Testing Requirements

- Specification tests: ST-10 … ST-24, ST-27 … ST-31 (07-testing-strategy.md).
- `applySplitResize` is pure and carries the heaviest coverage — it is where the clamp and the
  conservation invariant live. **ST-28 covers the infeasible regime** (`cells < mins`), which
  ST-12…ST-14 do not reach.
- Implementation tests: `endDrag` idempotency, the staleness guard, normalization edges, modified
  arrows falling through, the grab-mark position at even/odd extents, and a 1-cell splitter extent.
- The drag must be exercised through the **capture seam** (an issue #10 acceptance criterion), not
  by calling `resizeBy` directly.

> ⚠️ **Three of these oracles are mask-prone — write them to the stated scenario, not the happy
> path.** ST-29 must assert the splitter's role **after mouse-up** (during a drag the incidental
> relayout repaints it, so a drag-only assertion passes even with the `bind` missing). ST-30 must
> write `sizes` **after mount** (construction is already normalized). ST-31 must assert callback
> **call counts**, not just payloads (a per-event `onResize` produces the right final array).
</content>
