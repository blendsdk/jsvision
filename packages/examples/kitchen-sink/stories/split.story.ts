/**
 * Story: `SplitView` — a resizable split-pane container (a documented new component; Turbo Vision had
 * no split panes). A nested split (row → [ explorer | col: [ editor / terminal ] ]) shows grids by
 * composition, a live `sizes()` echo proves the two-way signal binding, and a `minSize` makes the
 * clamp visible when a divider is dragged to it.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, SplitView, Text, signal } from '@jsvision/ui';
import type { View, ThemeRoleName, DispatchEvent } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** A themed, labelled pane — a background Group carrying a top-left label (the layout-story pattern). */
function pane(label: string, role: ThemeRoleName): View {
  const g = new Group();
  g.background = role;
  g.add(at(new Text(label), 1, 0, 18, 1));
  return g;
}

/**
 * The story root. `preProcess` lets it see `g` before the focused splitter, so the key toggles the
 * grab mark on every divider while the resize arrows still reach the splitter (they bubble untouched).
 */
class SplitStoryRoot extends Group {
  /** Catch `g` ahead of the focused splitter; every other key falls through to focus/resize. */
  override preProcess = true;

  constructor(private readonly splits: SplitView[]) {
    super();
  }

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key' && ev.event.key === 'g') {
      for (const s of this.splits) s.grabMark.set(!s.grabMark.peek());
      ev.handled = true;
    }
  }
}

export const splitStory: Story = {
  id: 'layout/split',
  category: 'Layout',
  title: 'Split panes',
  blurb:
    'SplitView: resizable panes — drag a divider, or focus it (Tab) and use the arrows; ‹g› toggles the grab mark.',
  // `rd` is deliberately omitted: the field is optional and this plan implements no RD.
  build(ctx: StoryContext) {
    const w = ctx.width;
    const h = ctx.height;
    // Two caller-owned signals — one per split. A drag rewrites them in cells; the echo below reads them.
    const outer = signal([1, 2]);
    const inner = signal([2, 1]);

    // A grid by composition: the outer row's second pane is itself a column split.
    const editorTerminal = new SplitView({
      direction: 'col',
      children: [pane('Editor', 'clusterNormal'), pane('Terminal', 'buttonDefault')],
      sizes: inner,
      minSize: 3,
    });
    const split = new SplitView({
      direction: 'row',
      children: [pane('Explorer', 'window'), editorTerminal],
      sizes: outer,
      minSize: 12,
    });

    // The root sees `g` first (preProcess) to toggle the grab mark on both splits; arrows still resize.
    const g = new SplitStoryRoot([split, editorTerminal]);
    g.add(at(new Text('Drag a divider, or Tab to it and use the arrows. ‹g› toggles the grab mark.'), 1, 0, w, 1));
    g.add(at(split, 1, 2, w - 2, h - 4));

    // A live echo of both size signals — proof the two-way binding writes cell counts back as you drag.
    g.add(
      at(
        new Text(() => `sizes  →  outer ${JSON.stringify(outer())}   ·   inner ${JSON.stringify(inner())}`),
        1,
        h - 1,
        w,
        1,
      ),
    );
    return g;
  },
};
