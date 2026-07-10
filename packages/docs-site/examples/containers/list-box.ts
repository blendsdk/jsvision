/**
 * A scrolling list with keyboard navigation and type-ahead. Arrow keys / PgUp /
 * PgDn move the highlight, Enter or a click selects a row, and typing a prefix
 * jumps to the next match. The owned scroll bar tracks the focused row; a live
 * echo shows the focused and selected items.
 */
import { Group, ListBox, Text, signal, View } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
// #region example

const FRUITS = [
  'Apple',
  'Apricot',
  'Avocado',
  'Banana',
  'Blackberry',
  'Blueberry',
  'Cantaloupe',
  'Cherry',
  'Coconut',
  'Cranberry',
  'Date',
  'Elderberry',
  'Fig',
  'Grape',
  'Guava',
  'Kiwi',
  'Lemon',
  'Lime',
  'Mango',
  'Nectarine',
  'Orange',
  'Papaya',
  'Peach',
  'Pear',
  'Pineapple',
  'Plum',
  'Raspberry',
  'Strawberry',
];

const WIDTH = 40;
const HEIGHT = 12;

/** Absolutely place a view within the example's box. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };
  return view;
}

export default defineExample({
  title: 'List box',
  blurb: 'A virtual-scroll list with type-ahead: arrows / PgDn move, Enter selects, type a prefix to jump.',
  build: () => {
    const items = signal([...FRUITS]);
    const focused = signal(0);
    const selected = signal(-1);
    const list = new ListBox({ items, focused, selected, typeAhead: true });

    const group = at(new Group(), 0, 0, WIDTH, HEIGHT);
    group.add(at(list, 0, 0, WIDTH, 9));
    group.add(
      at(
        new Text(() => {
          const focus = items()[focused()] ?? '-';
          const pick = selected() >= 0 ? (items()[selected()] ?? '-') : '(none)';
          return `focused: ${focus}   selected: ${pick}`;
        }),
        0,
        10,
        WIDTH,
        1,
      ),
    );
    return group;
  },
});
// #endregion example
