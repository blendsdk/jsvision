/**
 * Story: `MultiCheckGroup` (RD-07) — `TMultiCheckBoxes`, a column of multi-state `[ ]` boxes bound to
 * a `number[]` (one state index per item). Space cycles each box through the `states` glyphs.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, MultiCheckGroup, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** The ordered state glyphs: off · low · high (selRange 3). */
const STATES = ' ·X';
const LABELS = ['off', 'low', 'high'];

export const multiCheckGroupStory: Story = {
  id: 'controls/multicheckgroup',
  category: 'Controls',
  title: 'MultiCheckGroup',
  rd: 'RD-07',
  blurb: 'TMultiCheckBoxes: [ ] boxes that cycle through states (" ·X") — bound to a number[].',
  build(ctx: StoryContext) {
    const w = ctx.width;
    const value = signal([0, 1, 2]);
    const mcg = new MultiCheckGroup({ items: ['~V~olume', '~B~ass', '~T~reble'], states: STATES, value });
    const g = new Group();
    g.add(at(mcg, 1, 0, 18, 3));
    // A live bound-state echo: the state index + its glyph per item.
    g.add(
      at(
        new Text(
          () =>
            `Value: [ ${value()
              .map((s, i) => `${LABELS[i]}=${s}('${STATES[s] ?? ' '}')`)
              .join('  ')} ]`,
        ),
        1,
        4,
        w,
        1,
      ),
    );
    g.add(at(new Text('↑ / ↓ move · Space cycles the current box ( → · → X → blank ) · Alt-V/B/T jump.'), 1, 6, w, 1));
    return g;
  },
};
