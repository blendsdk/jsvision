/**
 * Story: `CheckGroup` (RD-06) — `TCheckBoxes`, independent `[X]` toggles bound to a `boolean[]`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, CheckGroup, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const checkGroupStory: Story = {
  id: 'controls/checkgroup',
  category: 'Controls',
  title: 'CheckGroup',
  rd: 'RD-06',
  blurb: 'TCheckBoxes: independent [X] toggles bound to a boolean[].',
  build(ctx: StoryContext) {
    const w = ctx.width;
    const flags = signal([false, false, false]);
    const check = new CheckGroup({ labels: ['~B~old', '~I~talic', '~U~nderline'], value: flags });
    const g = new Group();
    g.add(at(check, 1, 0, 18, 3));
    g.add(
      at(
        new Text(
          () =>
            `Value: [ ${flags()
              .map((b) => (b ? 'X' : '·'))
              .join('  ')} ]`,
        ),
        1,
        4,
        w,
        1,
      ),
    );
    g.add(at(new Text('↑ / ↓ move · Space toggles the current box · Alt-B / Alt-I / Alt-U jump.'), 1, 6, w, 1));
    return g;
  },
};
