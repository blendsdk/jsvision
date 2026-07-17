/**
 * Tab cell-traversal — Tab/Shift+Tab move the cursor cell-to-cell (wrapping at row ends, exiting to the
 * next widget at the grid edge, committing an open edit before advancing). Because the framework swallows
 * an unbound Tab for focus traversal, the app opts in at loop construction: merge `gridKeymap` into the
 * loop and call `installGridNavigation(loop, grid)`. That wiring lives in the app, so this demo shows the
 * two lines rather than re-wiring the showcase's shared loop.
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
  blurb: 'Tab/Shift+Tab move cell-to-cell (wrap, edge-exit, commit-then-advance); the app opts in at the loop.',
  hint: 'App-side wiring (Tab is otherwise swallowed for focus traversal):',
  note: [
    '  const loop = createEventLoop(size, { caps, keymap: gridKeymap });',
    '  loop.focusView(grid.rows);',
    '  const uninstall = installGridNavigation(loop, grid);',
    '  //  Tab → next cell · Shift+Tab → prev · at the edge → next/prev widget',
  ],
  rows: ROWS,
  columns: [editable('first', 'First'), editable('last', 'Last')],
});
