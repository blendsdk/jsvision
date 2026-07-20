/**
 * A scrolling list with keyboard navigation and type-ahead. Arrow keys / PgUp /
 * PgDn move the highlight, Enter or a click selects a row, and typing a prefix
 * jumps to the next match. The owned scroll bar tracks the focused row; a live
 * echo shows the focused and selected items.
 */
import { ListBox, Text, signal, cover, col, grow, fixed, spacer } from '@jsvision/ui';
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

    // The list takes every row the shell offers, a one-cell gap separates it from the echo, and the
    // echo keeps exactly one row. `spacer({ fixed: 1 })` is the hard gap -- a bare `spacer(1)` would
    // ask for a 1fr *share* and swallow half the column. `cover()` makes the column fill its host;
    // a column with no extent of its own would collapse to nothing.
    return cover(col(grow(list), spacer({ fixed: 1 }), fixed(echo, 1)));
  },
});
