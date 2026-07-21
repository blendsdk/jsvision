# Spec: Demos — scroll-in-a-pane + split-in-a-window (items 2 & 3)

> **Document**: 03-02-demos.md
> **Parent**: [Index](00-index.md) · **Requirements**: F7–F12

Both are `packages/examples/**` changes; no framework code changes.

## Item 2 — `layout/split-scroll` story (F7–F9)

New file `packages/examples/kitchen-sink/stories/split-scroll.story.ts` exporting
`splitScrollStory: Story`, registered in `stories/index.ts` (near `splitStory`, category order).

```ts
{
  id: 'layout/split-scroll',
  category: 'Layout',
  title: 'Split — scrolling pane',
  blurb: 'A ListBox inside a SplitView pane scrolls within its bounds — drag the divider to resize it.',
  // no `rd` (this plan implements no RD)
  build(ctx) { ... }
}
```

`build(ctx)`:

- `const items = signal(Array.from({ length: 100 }, (_, i) => \`Item ${String(i + 1).padStart(3, '0')}\`));`
  — 100 rows overflow any pane so the scroll bar + virtualization show.
- `const list = new ListBox({ items, focused: signal(0), typeAhead: true });` — a **direct** pane
  child (AR-6/F8): `SplitView` assigns it `{ size: fr }` and the default `direction:'row'` keeps its
  `[rows | bar]` arrangement.
- An `info` pane: a `Group` with `background: 'window'` carrying a `Text` (the layout-story `pane`
  pattern from `split.story.ts`) explaining "↑↓ scroll the list; drag the divider to resize."
- `const sizes = signal([1, 1]);`
- `const split = new SplitView({ direction: 'row', children: [list, info], sizes, minSize: 8 });`
  placed with `at(split, 1, 2, ctx.width - 2, ctx.height - 3)`.
- A top hint `Text` at row 0, like the other layout stories.

The shell auto-focuses the first focusable (`list.rows`), so ↑↓ scroll immediately; the split's own
splitter takes a later tab stop.

### Smoke oracle (F9) — `ST-1 (followups)`

Add a targeted test to `packages/examples/test/kitchen-sink.smoke.spec.test.ts` next to `ST-26`:
build the story, mount headlessly, assert it is registered with `category === 'Layout'` and that the
painted buffer contains a list item label (e.g. matches `/Item 0/`) — proving the `ListBox` rendered
**inside** the pane, not merely that some cell painted (the generic loop already covers that).

## Item 3 — amiga-clock "Clocks" split window (F10–F12)

Edit `packages/examples/amiga-clock/main.ts` only. After the three existing windows are added
(unchanged), add a 4th:

```ts
import { SplitView } from '@jsvision/ui'; // add to the existing @jsvision/ui import

const clocks = new Window('Clocks');
clocks.number = 4;
clocks.layout.rect = { x: 4, y: 4, width: 60, height: 20 };

// Nested grid: row → [ Analog | col:[ Digital / Boing ] ]. Fresh instances, same signals.
const rightSizes = signal([1, 1]);
const right = new SplitView({
  direction: 'col',
  children: [new DigitalClock(() => now()), new BoingClock(() => frame(), () => now())],
  sizes: rightSizes,
  minSize: [9, 9],
});
const gridSizes = signal([1, 1]);
const grid = new SplitView({
  direction: 'row',
  children: [new AnalogClock(() => now()), right],
  sizes: gridSizes,
  minSize: [24, 24],
});
grid.layout = { position: 'fill' };
clocks.add(grid);
app.desktop.addWindow(clocks);
```

- **Fresh** clock instances (not the ones already added to the standalone windows) bound to the same
  `now`/`frame` closures — they repaint off the same timer (F10, AR-7).
- The `Window`'s `padding: 1` insets the split past the border; `position:'fill'` fills the interior.
- `minSize`s keep each clock from collapsing when the window is small; exact values are cosmetic and
  may be tuned during the run so nothing clips at the default window size.
- Existing three windows and all window-management wiring are untouched (F11).
- Coverage: `yarn typecheck` + a manual `yarn workspace @jsvision/examples demo:amiga-clock` (F12,
  AR-8) — no automated test.

### Notes / watch-items for the run

- The clocks may assume roughly their natural sizes (Analog ~24×13, Digital ~33×9, Boing ~34×15).
  Pick the window size + `minSize`s so the default layout shows each clock without clipping; if a
  clock clips badly at the split's initial ratio, adjust the seed ratios (`gridSizes`/`rightSizes`)
  rather than the clocks.
- A mouse-down on an interior splitter hit-tests to the splitter (deepest view), not the window
  frame, so splitter drag and window move/resize do not collide.
