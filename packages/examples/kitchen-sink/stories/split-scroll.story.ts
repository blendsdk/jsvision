/**
 * Story: `SplitView` — a scrolling pane. A 100-item `ListBox` sits as a **direct** pane child of a row
 * split, beside an info pane. The list scrolls (↑↓ / wheel / type-ahead) within its pane bounds, and
 * dragging the divider resizes it against the info pane — proof that a scrollable widget composes
 * inside a `SplitView` with no wrapper. (`SplitView` assigns the pane `{ size: fr }`; the list's default
 * `direction:'row'` keeps its `[rows | bar]` arrangement, so it scrolls in place.)
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, SplitView, ListBox, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const splitScrollStory: Story = {
  id: 'layout/split-scroll',
  category: 'Layout',
  title: 'Split — scrolling pane',
  blurb: 'A ListBox inside a SplitView pane scrolls within its bounds — drag the divider to resize it.',
  // `rd` is deliberately omitted: the field is optional and this plan implements no RD.
  build(ctx: StoryContext) {
    const w = ctx.width;
    const h = ctx.height;

    // 100 rows overflow any pane, so the list's scroll bar + virtualization are visible.
    const items = signal(Array.from({ length: 100 }, (_, i) => `Item ${String(i + 1).padStart(3, '0')}`));
    // A direct pane child — no wrapper. SplitView replaces its layout with `{ size: fr }`; the list's
    // default `direction:'row'` still lays out `[rows | bar]`, so it keeps scrolling in place.
    const list = new ListBox({ items, focused: signal(0), typeAhead: true });

    // The info pane: a themed Group with a short explainer (the layout-story `pane` pattern).
    const info = new Group();
    info.background = 'window';
    info.add(at(new Text('Scrolling pane'), 1, 0, 28, 1));
    info.add(at(new Text('↑↓ scroll the list;'), 1, 2, 28, 1));
    info.add(at(new Text('drag the divider to resize.'), 1, 3, 28, 1));

    const sizes = signal([1, 1]);
    const split = new SplitView({ direction: 'row', children: [list, info], sizes, minSize: 8 });

    const g = new Group();
    g.add(
      at(new Text('A scrollable ListBox lives in the left pane. Focus it and use ↑↓; drag the divider.'), 1, 0, w, 1),
    );
    g.add(at(split, 1, 2, w - 2, h - 3));
    return g;
  },
};
