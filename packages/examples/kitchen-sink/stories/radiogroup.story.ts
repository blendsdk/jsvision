/**
 * Story: `RadioGroup` (RD-06) — `TRadioButtons`, exclusive `(•)` selection bound to a `number`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, RadioGroup, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

const OPTIONS = ['Left', 'Center', 'Right'] as const;

export const radioGroupStory: Story = {
  id: 'controls/radiogroup',
  category: 'Controls',
  title: 'RadioGroup',
  rd: 'RD-06',
  blurb: 'TRadioButtons: exclusive (•) selection bound to a number.',
  build(ctx: StoryContext) {
    const w = ctx.width;
    const sel = signal(0);
    const radio = new RadioGroup(['~L~eft', '~C~enter', '~R~ight'], sel);
    const g = new Group();
    g.add(at(radio, 1, 0, 18, 3));
    g.add(at(new Text(() => `Selected: index ${sel()} (${OPTIONS[sel()]})`), 1, 4, w, 1));
    g.add(at(new Text('↑ / ↓ move + select · Space selects · Alt-L / Alt-C / Alt-R jump.'), 1, 6, w, 1));
    return g;
  },
};
