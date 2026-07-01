/**
 * Story: `Label` (RD-06) — `TLabel` linked to a control, with the focus-driven highlight.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Label, Input, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const labelStory: Story = {
  id: 'controls/label',
  category: 'Controls',
  title: 'Label',
  rd: 'RD-06',
  blurb: 'TLabel: linked to a control — the Alt-hotkey focuses it and the label brightens when it is focused.',
  build(ctx: StoryContext) {
    const w = ctx.width;
    const value = signal('');
    const input = new Input({ value });
    const label = new Label('~N~ame', input);
    const g = new Group();
    g.add(at(label, 1, 0, 6, 1));
    g.add(at(input, 8, 0, 24, 1));
    g.add(at(new Text('Press Alt-N (or click the label) to focus the field.'), 1, 2, w, 1));
    g.add(
      at(new Text('While the field is focused the label paints in labelSelected; Tab away to dim it.'), 1, 4, w, 1),
    );
    return g;
  },
};
