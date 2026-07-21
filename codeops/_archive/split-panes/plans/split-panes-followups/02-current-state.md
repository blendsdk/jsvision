# Current State

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

The shipped code these follow-ups build on (branch `feat/split-panes`).

## Item 1 — the splitter and its owner

`packages/ui/src/split/splitter.ts` — `Splitter extends View`:

- `focusable = true`; `readonly dragging = signal(false)`.
- `onMount(() => this.bind(() => this.dragging()))` (lines 37–43) — the comment states **`draw()` is
  NOT auto-tracked**, so the `dragging` flip is bound explicitly to force a repaint. The `grabMark`
  flip needs the **same** treatment (F4).
- `draw(ctx)` (lines 46–52): fills `│`/`─` in the `splitter`/`splitterDragging` role, then
  **unconditionally** paints the `▓` grab mark at the midpoint:
  ```ts
  if (row) ctx.text(0, Math.floor(ctx.size.height / 2), '▓', style);
  else ctx.text(Math.floor(ctx.size.width / 2), 0, '▓', style);
  ```
  Item 1 gates these two lines behind `this.owner.grabMark()`.
- `SplitOwner` interface (lines 16–21): the narrowed slice of `SplitView` the splitter drives —
  currently `{ beginDrag, resizeBy }`. Item 1 adds `grabMark: Signal<boolean>`.

`packages/ui/src/split/split-view.ts` — `SplitView extends Group implements SplitOwner`:

- Options are `{ direction, children, sizes, minSize?, onResize?, onResizeEnd? }` (lines 52–78).
- Splitters are created in the constructor: `new Splitter(this, i, this.direction)` (line 139). Item 1
  passes nothing new to the constructor — the splitter reads `owner.grabMark()` instead.
- The constructor already establishes the `onMount(() => this.bind(...))` pattern (lines 149–155).
- Each pane's layout is set to `{ size: { kind: 'fr', weight, min } }` at construction (line 136) and
  on every `sizes` write (`applyWeights`, line 168) — this is the layout replacement AR-6 relies on.

## Item 2 — panes, ListBox, and the story model

- `SplitViewOptions.children: View[]` (line 57) — a pane is any `View`.
- `ListBox extends ListView<string>` (`packages/ui/src/list/list-box.ts:33`) — construct with
  `new ListBox({ items: signal([...]), focused: signal(0) })`. The focus target is `list.rows`
  (a `Group` is not a focus leaf); `firstFocusable` in the story model finds it.
- `ListView.layout = { direction: 'row' }` (`list-view.ts:83`) arranges `[rows fr | bar 1]`. The
  engine defaults `direction` to `'row'` (`packages/ui/src/layout/types.ts:213`,
  `direction: props.direction ?? 'row'`), so replacing `list.layout` with `{ size: fr }` (no
  `direction`) keeps the arrangement — the same thing `at()` already does in `listview.story.ts`.
- The story contract (`packages/examples/kitchen-sink/story.ts`): a `Story` is
  `{ id, category, title, blurb, rd?, build(ctx) }`; `build` returns a `Group` of absolutely-placed
  children within `ctx.width × ctx.height`. Registration = add the file to
  `packages/examples/kitchen-sink/stories/index.ts`.
- The smoke oracle (`packages/examples/test/kitchen-sink.smoke.spec.test.ts`): a generic loop mounts
  every story and asserts it paints; targeted `ST-*` tests additionally assert story-specific content
  (e.g. `ST-26` for `layout/split`). New stories are picked up by the generic loop automatically.

## Item 3 — the amiga-clock demo

`packages/examples/amiga-clock/main.ts`:

- Builds a `createApplication` desktop, adds three `Window`s (Analog/Digital/Boing), each
  `window.add(new XxxClock(...))` (lines 102–123).
- The clocks bind to closures over two shared signals a timer drives:
  `new AnalogClock(() => now())`, `new DigitalClock(() => now())`,
  `new BoingClock(() => frame(), () => now())` (lines 102–122). **Fresh** instances bound to the same
  closures repaint independently — so the split window can hold its own three clock instances.
- `Window extends Group` with `layout = { position:'absolute', padding: 1 }`
  (`packages/ui/src/window/window.ts:80`); a `SplitView` with `layout = { position: 'fill' }` fills
  the padded interior.

## The story key-handling precedent (F5)

`packages/examples/kitchen-sink/stories/drill-down.story.ts:20-48` — `DetailScreen extends Group`
sets `override preProcess = true` and handles `Esc` in `onEvent` before the focused child sees it.
Item 1's `g` toggle uses the same seam, handling only `g` so the splitter's arrows still bubble.

## Constraints carried in

- Shipped-source JSDoc bans (CodeOps/RD/plan IDs, TV/C++ provenance) apply to `packages/ui/src/**`
  only; `packages/examples/**` follows the spirit. Enforced by `scripts/check-jsdoc.mjs`.
- `grabMark` adds public surface → the committed plugin API reference (`tools/claude-plugin/skills/
  jsvision/references/api/*.md`) drifts → `check-plugin` fails until regenerated with
  `yarn plugin:sync --fix`.
