/**
 * Story: `Input` (RD-06 + RD-07) — `TInputLine`s with live validators, two-way binding, text
 * selection + clipboard, a `picture(mask)` auto-fill field, and the visible logical caret.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Input, Label, Text, signal, filter, range, picture } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const inputStory: Story = {
  id: 'controls/input',
  category: 'Controls',
  title: 'Input',
  rd: 'RD-07',
  blurb: 'TInputLine: two-way bound, selection + clipboard, picture(mask) auto-fill, visible caret.',
  build(ctx: StoryContext) {
    const name = signal('');
    const age = signal('');
    const phone = signal('');
    const fullName = signal('');
    const nameInput = new Input({ value: name, validator: filter('A-Za-z ') });
    // A muted placeholder advertises what belongs in the field; it disappears as soon as you type and
    // never becomes part of the bound value.
    const fullInput = new Input({ value: fullName, placeholder: 'e.g. Ada Lovelace' });
    const ageInput = new Input({ value: age, validator: range(0, 150) });
    // A picture field: the `-` literals auto-fill as you type, `#` requires a digit (tvalidat.cpp).
    // No leading literal — TV rejects a keystroke that mismatches a leading literal (faithful).
    const phoneInput = new Input({ value: phone, validator: picture('###-###-####') });
    const width = Math.max(40, ctx.width - 2);
    const g = new Group();
    g.add(at(new Label('~N~ame', nameInput), 1, 0, 6, 1));
    g.add(at(nameInput, 8, 0, 24, 1));
    g.add(at(new Label('~A~ge', ageInput), 34, 0, 5, 1));
    g.add(at(ageInput, 40, 0, 10, 1));
    g.add(at(new Label('~P~hone', phoneInput), 1, 2, 7, 1));
    g.add(at(phoneInput, 9, 2, 20, 1));
    g.add(at(new Text(() => `Name="${name()}"  Age="${age()}"  Phone="${phone()}"`), 1, 4, width, 1));
    g.add(
      at(
        new Text('Name: letters+space (filter). Age: 0–150 (range). Phone: ###-###-#### auto-fills dashes.'),
        1,
        6,
        width,
        1,
      ),
    );
    g.add(
      at(
        new Text('Shift+←/→ select · Ctrl+Ins copy · Shift+Ins paste · Shift+Del cut · the caret shows.'),
        1,
        7,
        width,
        1,
      ),
    );
    g.add(at(new Text('Type past the edge to see the ◄ / ► scroll arrows. Tab moves between fields.'), 1, 8, width, 1));
    g.add(at(new Text('Placeholder (muted, shown only while empty):'), 1, 10, width, 1));
    g.add(at(fullInput, 1, 11, 26, 1));
    return g;
  },
};
