/**
 * Story: Layout DSL — the declarative builders (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`), live.
 *
 * Composes a whole app frame in one nested expression: a fixed header over a growing body (a fixed
 * sidebar beside a growing `stack` whose base fills and whose badge pins to the top-right) over a
 * status footer that uses a `spacer` to push its right label to the edge. Because the builders only
 * set ordinary flex props, the frame resizes for free with the canvas.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, col, row, stack, grow, fixed, spacer, topRight } from '@jsvision/ui';
import type { ThemeRoleName } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** A labelled, themed panel: a background `Group` with a caption in its top-left. */
function panel(label: string, role: ThemeRoleName): Group {
  const p = new Group();
  p.background = role;
  p.add(at(new Text(label), 1, 0, 40, 1));
  return p;
}

export const layoutDslStory: Story = {
  id: 'layout/dsl',
  category: 'Foundations',
  title: 'Layout DSL',
  blurb: 'Declarative col/row/grow/fixed/spacer + a stack z-overlay — one expression, resizes for free.',
  build(ctx: StoryContext) {
    const w = ctx.width;
    const h = ctx.height;
    const g = new Group();
    g.add(
      at(
        new Text('Declarative layout — col / row / grow / fixed / spacer / stack. Resize to watch it re-flow.'),
        1,
        0,
        w,
        1,
      ),
    );

    // A growing main area with a base layer that fills and a badge pinned to the top-right corner.
    const main = stack(
      panel('grow(main) — stack base fills the pane', 'buttonDefault'),
      topRight(new Text(' ● live '), 8, 1),
    );

    // A fixed sidebar beside the growing main; the whole body grows to fill the height.
    const body = row({ gap: 1 }, fixed(panel('fixed(20) sidebar', 'clusterNormal'), 20), grow(main));

    // A footer whose spacer pushes the right label to the far edge.
    const footer = row(
      { background: 'statusBar' },
      fixed(new Text(' F1 Help '), 10),
      spacer(),
      fixed(new Text(' spacer → right edge '), 22),
    );

    // The whole frame: a fixed header, the growing body, a fixed footer — top to bottom.
    const frame = col({ gap: 0 }, fixed(panel('fixed(3) header', 'window'), 3), grow(body), fixed(footer, 1));

    // `setLayout` merges, so the frame keeps the `direction` the DSL gave it; `at()` would replace
    // the whole layout and lose it.
    frame.setLayout({ position: 'absolute', rect: { x: 1, y: 2, width: w - 2, height: h - 3 } });
    g.add(frame);
    return g;
  },
};
