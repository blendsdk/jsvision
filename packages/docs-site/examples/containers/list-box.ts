/**
 * A scrolling list with keyboard navigation and type-ahead. Arrow keys / PgUp /
 * PgDn move the highlight, Enter or a click selects a row, and typing a prefix
 * jumps to the next match. The owned scroll bar tracks the focused row; a live
 * echo shows the focused and selected items.
 */
import { ListBox, Text, signal, at, col, grow, fixed, spacer } from '@jsvision/ui';
import { defineExample } from '../_contract.js';

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

/** The example's box: nine list rows, a gap row, and the echo row. */
const WIDTH = 40;
const HEIGHT = 12;

export default defineExample({
  title: 'List box',
  blurb: 'A virtual-scroll list with type-ahead: arrows / PgDn move, Enter selects, type a prefix to jump.',
  build: () => {
    const items = signal([...FRUITS]);
    const focused = signal(0);
    const selected = signal(-1);
    const list = new ListBox({ items, focused, selected, typeAhead: true });

    const echo = new Text(() => {
      const focus = items()[focused()] ?? '-';
      const pick = selected() >= 0 ? (items()[selected()] ?? '-') : '(none)';
      return `focused: ${focus}   selected: ${pick}`;
    });

    // A column: the list takes whatever height is left over, a one-cell gap separates it from the
    // echo, and the echo keeps exactly one row however long its text is. `spacer({ fixed: 1 })` is
    // the hard one-cell gap -- a bare `spacer(1)` would ask for a 1fr *share* and swallow half the
    // column. The size is stated here rather than left to the shell's default, so changing it is a
    // deliberate edit to this file.
    return at(col(grow(list), spacer({ fixed: 1 }), fixed(echo, 1)), 0, 0, WIDTH, HEIGHT);
  },
});
