/**
 * Text inputs with live validators and two-way binding. The name field accepts
 * only letters and spaces (a filter validator), the age field is clamped to 0–150
 * (a range validator), and the phone field auto-fills its dashes as you type (a
 * picture mask). A live echo shows the bound values; Tab moves between fields and
 * the logical caret stays visible.
 */
import { Group, Input, Label, Text, signal, filter, range, picture, View } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
// #region example

const WIDTH = 56;
const HEIGHT = 8;

/** Absolutely place a view within the example's box. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };
  return view;
}

export default defineExample({
  title: 'Input',
  blurb: 'Text fields with live validators: a letters-only filter, a 0–150 range, and a picture mask.',
  build: () => {
    const name = signal('');
    const age = signal('');
    const phone = signal('');
    const nameInput = new Input({ value: name, validator: filter('A-Za-z ') });
    const ageInput = new Input({ value: age, validator: range(0, 150) });
    const phoneInput = new Input({ value: phone, validator: picture('###-###-####') });

    const group = at(new Group(), 0, 0, WIDTH, HEIGHT);
    group.add(at(new Label('~N~ame', nameInput), 0, 0, 6, 1));
    group.add(at(nameInput, 7, 0, 24, 1));
    group.add(at(new Label('~A~ge', ageInput), 33, 0, 5, 1));
    group.add(at(ageInput, 39, 0, 10, 1));
    group.add(at(new Label('~P~hone', phoneInput), 0, 2, 7, 1));
    group.add(at(phoneInput, 8, 2, 20, 1));
    group.add(at(new Text(() => `name="${name()}"  age="${age()}"  phone="${phone()}"`), 0, 4, WIDTH, 1));
    group.add(
      at(new Text('Tab moves between fields · Shift+←/→ selects · type past the edge to scroll.'), 0, 6, WIDTH, 1),
    );
    return group;
  },
});
// #endregion example
