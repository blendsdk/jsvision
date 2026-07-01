/**
 * Story: `Input` (RD-06) — two `TInputLine`s with live validators + two-way binding.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Input, Label, Text, signal, filter, range } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const inputStory: Story = {
  id: 'controls/input',
  category: 'Controls',
  title: 'Input',
  rd: 'RD-06',
  blurb: 'TInputLine: two-way bound, horizontal scroll (◄/►), live validators reject bad keystrokes.',
  build(ctx: StoryContext) {
    const name = signal('');
    const age = signal('');
    const nameInput = new Input({ value: name, validator: filter('A-Za-z ') });
    const ageInput = new Input({ value: age, validator: range(0, 150) });
    const width = Math.max(40, ctx.width - 2);
    const g = new Group();
    g.add(at(new Label('~N~ame', nameInput), 1, 0, 6, 1));
    g.add(at(nameInput, 8, 0, 24, 1));
    g.add(at(new Label('~A~ge', ageInput), 34, 0, 5, 1));
    g.add(at(ageInput, 40, 0, 10, 1));
    g.add(at(new Text(() => `Name="${name()}"   Age="${age()}"`), 1, 2, width, 1));
    g.add(
      at(new Text('Name: letters + space only (filter). Age: 0–150 only (range). Tab to move fields.'), 1, 4, width, 1),
    );
    g.add(at(new Text('Type past the edge to see the ◄ / ► scroll arrows.'), 1, 5, width, 1));
    return g;
  },
};
