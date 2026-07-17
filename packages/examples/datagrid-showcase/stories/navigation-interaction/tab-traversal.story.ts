/**
 * Tab cell-traversal — Tab/Shift+Tab move the cursor cell-to-cell (wrapping at row ends, exiting to the
 * next widget at the grid edge, committing an open edit before advancing). Because the framework swallows
 * an unbound Tab for focus traversal, the app opts in at loop construction: merge `gridKeymap` into the
 * loop and call `installGridNavigation(loop, grid)`. The showcase wires exactly that for every grid demo,
 * so Tab is live here — the snippet below is the same two lines your own app writes.
 */
import { column } from '@jsvision/datagrid';
import { buildNavStory } from './nav-demo.js';

interface Person {
  id: number;
  first: string;
  last: string;
}
const ROWS: Person[] = [
  { id: 1, first: 'Ada', last: 'Lovelace' },
  { id: 2, first: 'Alan', last: 'Turing' },
  { id: 3, first: 'Grace', last: 'Hopper' },
];
const editable = (id: 'first' | 'last', title: string) =>
  column<Person, string>({
    id,
    title,
    value: (r) => r[id],
    parse: (t) => t,
    set: (r, v) => {
      r[id] = v;
    },
    width: 12,
  });

export const navTabTraversalStory = buildNavStory<Person>({
  slug: 'tab-traversal',
  title: 'Tab cell-traversal',
  blurb: 'Tab/Shift+Tab move cell-to-cell here (wrap, edge-exit, commit-then-advance); your app opts in at the loop.',
  hint: 'Tab moves cell-to-cell here. Your app enables it with two lines:',
  note: [
    '  const loop = createEventLoop(size, { caps, keymap: gridKeymap });',
    '  loop.focusView(grid.rows);',
    '  const uninstall = installGridNavigation(loop, grid);',
    '  //  Tab → next cell · Shift+Tab → prev · at the edge → next/prev widget',
  ],
  rows: ROWS,
  columns: [editable('first', 'First'), editable('last', 'Last')],
});
