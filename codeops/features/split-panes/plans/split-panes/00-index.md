# Split Panes Implementation Plan

> **Feature**: A resizable split-pane layout container for `@jsvision/ui` — N panes divided by N−1 draggable splitters, row or column, nestable for grids.
> **Status**: Planning Complete
> **Created**: 2026-07-17
> **Source issue**: [GH #10](https://github.com/blendsdk/jsvision/issues/10)
> **CodeOps Skills Version**: 3.8.0

## Overview

`SplitView` divides a region into N panes separated by N−1 draggable 1-cell splitters — the
IDE/tmux layout (an explorer beside an editor; a preview above a terminal). Splits nest, so a
row containing a column produces a grid. Turbo Vision has no counterpart, so this is a documented
new component with no fidelity obligation (issue #10 GATE-1).

The component is thinner than it looks because the framework already supplies the two hard parts:
the generic pointer-capture seam on the dispatch envelope (`setCapture`/`releaseCapture`, already
reused by five widgets) and the integer flex solver (`solveTrack`/`apportion`). What the framework
does **not** supply is a minimum-size clamp — the layout engine has no min support of any kind.
That gap is the one piece of shared machinery this plan adds: an optional `min` on the flex track
item, behind a no-min fast path so every existing call site runs byte-identical code.

The plan's governing insight, established during the Zero-Ambiguity Gate, is that **pane size must
be an input to the reflow, not an output of the draw** (AR-5). A split holds arbitrary caller
subtrees whose interiors are laid out by the reflow pass against the rect it computes for each
pane; a container that overwrites `bounds` during `draw()` — the `Scroller` trick — would leave
every descendant sized against a stale rect. `SplitView` is therefore declarative: panes are `fr`
tracks whose weights a drag mutates, and the existing reflow does the placement.

## Document Index

| #   | Document                                                     | Description                                       |
| --- | ------------------------------------------------------------ | ------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Zero-Ambiguity Gate decisions (audit trail)       |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation           |
| 01  | [Requirements](01-requirements.md)                           | Feature requirements and scope                    |
| 02  | [Current State](02-current-state.md)                         | Analysis of the current implementation            |
| 03-01 | [Layout Engine: min support](03-01-layout-engine-min.md)   | `TrackItem.min`, `Size.min`, `apportionMin`       |
| 03-02 | [Theme Roles](03-02-theme-roles.md)                        | `splitter` + `splitterDragging` in `@jsvision/core` |
| 03-03 | [SplitView Component](03-03-splitview-component.md)        | The widget: layout, drag, keyboard, drawing       |
| 03-04 | [Kitchen-Sink Story](03-04-kitchen-sink-story.md)          | The mandatory showcase story + smoke test         |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | ST-cases and verification                         |
| 99  | [Execution Plan](99-execution-plan.md)                       | Phases, sessions, and task checklist              |

## Quick Reference

### Usage Examples

```ts
import { SplitView, Group, Text, signal } from '@jsvision/ui';

// An explorer beside an editor; the divider is draggable, neither pane below 12 cells.
const sizes = signal([1, 3]); // fr weights — 1:3; the drag rewrites these in cell units
const split = new SplitView({
  direction: 'row',
  children: [explorerPane, editorPane],
  sizes,
  minSize: 12,
});
split.layout = { position: 'fill' };

// Nesting produces a grid: a column split as one pane of a row split.
const outer = new SplitView({
  direction: 'row',
  children: [sidebar, new SplitView({ direction: 'col', children: [preview, terminal], sizes: signal([2, 1]) })],
  sizes: signal([1, 4]),
  minSize: [12, 20], // per-pane minimums
});
```

### Key Decisions

| Decision | Outcome | AR Ref |
| -------- | ------- | ------ |
| Pane count | N panes + N−1 splitters; nest for grids | AR-1 |
| Layout mechanism | Declarative `fr` tracks — pane size is an input to the reflow | AR-5 |
| Sizes state | Integer cell counts used directly as `fr` weights, in a caller-owned `Signal<number[]>` | AR-6, AR-9 |
| Resize callbacks | `onResize` (live, deduped) + `onResizeEnd` (once per commit); persist from `onResizeEnd` | AR-9, PF-003 |
| `minSize` clamp | Optional `min` added to the layout engine, behind a no-min fast path | AR-8 |
| Public surface | `SplitView` class (not the issue's `createSplit()` factory) | AR-11 |
| Keyboard resize | Arrows resize the focused splitter; the splitter is a tab stop | AR-3, AR-12 |
| Hover affordance | Not buildable — static `▓` grab mark + drag-only highlight instead | AR-4, AR-14 |
| Theme roles | Add the `splitter` + `splitterDragging` pair | AR-15 |
| Collapse/snap | Fast-follow, not v1 | AR-2 |
| Framework-wide hover (mode 1003) | ⏸ Deferred — owner: gevik · revisit: when a second widget needs hover | AR-20 |

## Related Files

**Created**
- `packages/ui/src/split/split-view.ts` — the `SplitView` container
- `packages/ui/src/split/splitter.ts` — the 1-cell divider view
- `packages/ui/src/split/index.ts` — subsystem barrel
- `packages/ui/test/split.spec.test.ts` · `packages/ui/test/split.impl.test.ts`
- `packages/ui/test/apportion-min.spec.test.ts` · `packages/ui/test/apportion-min.impl.test.ts`
- `packages/examples/kitchen-sink/stories/split.story.ts`

**Modified**
- `packages/ui/src/layout/apportion.ts` — `TrackItem.min`, `solveTrack` fast path, internal `apportionMin`
- `packages/ui/src/layout/types.ts` — `Size.min` on the `fr` variant, clamped in `normalizeSize`
- `packages/ui/src/layout/layout.ts` — pass `min` through to the track item
- `packages/ui/src/layout/measure.ts` — an `fr` item contributes `min ?? 0` to natural size
- `packages/ui/src/index.ts` — re-export the `split/` subsystem
- `packages/core/src/engine/color/theme.ts` — `Theme` interface + `defaultTheme`
- `packages/core/src/engine/color/presets.ts` — `monochromeTheme`
- `packages/core/src/engine/color/roles.ts` — `rolesFromAliases`
- `packages/examples/kitchen-sink/stories/index.ts` — register the story
- `packages/examples/test/kitchen-sink.smoke.spec.test.ts` — per-story smoke test
</content>
