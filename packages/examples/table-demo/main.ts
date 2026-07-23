/**
 * DataGrid walkthrough (RD-16) — a narrated, headless console demo of `@jsvision/ui`'s `DataGrid`
 * (TV `TListViewer`-derived): a typed `Person` table rendered, navigated (↓↓), sorted by a header
 * click (▲/▼), and horizontally scrolled (→) — all driven by synthetic `dispatch()` (no TTY),
 * printing a composed ASCII frame after each step. The faithful `│` column dividers + sticky header
 * render exactly as on a real terminal.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:table
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Group, DataGrid, createEventLoop, signal, cover } from '@jsvision/ui';
import type { Column, SortState } from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false };
}
/** A synthetic 1-based mouse report (as the terminal sends them). */
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

interface Person {
  readonly name: string;
  readonly age: number;
  readonly role: string;
  readonly city: string;
}

const PEOPLE: Person[] = [
  { name: 'Alice Johnson', age: 30, role: 'Engineer', city: 'New York' },
  { name: 'Bob Smith', age: 25, role: 'Designer', city: 'Los Angeles' },
  { name: 'Carol White', age: 42, role: 'Manager', city: 'San Francisco' },
  { name: 'Dave Brown', age: 28, role: 'Engineer', city: 'Seattle' },
  { name: 'Eve Davis', age: 35, role: 'Analyst', city: 'Chicago' },
  { name: 'Frank Miller', age: 51, role: 'Director', city: 'Boston' },
  { name: 'Grace Lee', age: 23, role: 'Intern', city: 'Austin' },
  { name: 'Heidi Clark', age: 39, role: 'Engineer', city: 'Denver' },
  { name: 'Ivan Petrov', age: 46, role: 'Architect', city: 'Portland' },
  { name: 'Judy Nguyen', age: 33, role: 'Designer', city: 'Miami' },
];

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const WIDTH = 40;
const HEIGHT = 10;

/** Walk the grid: render → navigate → sort → horizontal-scroll. */
function main(): void {
  const rows = signal([...PEOPLE]);
  const focused = signal(0);
  const selected = signal(-1);
  const sort = signal<SortState>(null);

  // Fixed-wide columns that overflow the 39-cell data area (→ H-scroll enabled).
  const columns: Column<Person>[] = [
    { title: 'Name', accessor: (p) => p.name, width: 14 },
    { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
    { title: 'Role', accessor: (p) => p.role, width: 10 },
    { title: 'City', accessor: (p) => p.city, width: 10 },
  ];
  const grid = new DataGrid<Person>({ rows, columns, focused, selected, sort, zebra: true });
  cover(grid);

  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  const frame = (title: string): void => printFrame(title, loop.renderRoot.buffer().rows());

  // Step 1 — the rendered grid: sticky header (row 0) + the first data window, focused row 0.
  frame('Frame 1 — render: header + rows, focused #0');

  // Step 2 — ↓↓ moves focus down two rows.
  loop.dispatch(key('down'));
  loop.dispatch(key('down'));
  frame('Frame 2 — ↓↓ focus row #2');
  console.log(`  focused: #${focused()} = ${PEOPLE[focused()]?.name}`);

  // Step 3 — click the Age header (content x 15..19 → 1-based mouse x=16, header row → y=1): sort asc.
  loop.dispatch(mouse('down', 16, 1));
  loop.dispatch(mouse('up', 16, 1));
  frame('Frame 3 — click Age header → sort ascending (▲)');
  console.log(`  sort: col ${sort()?.col} ${sort()?.dir}`);

  // Step 4 — → horizontally scrolls the overflowing columns left (the whole grid pans in lockstep).
  loop.dispatch(key('right'));
  loop.dispatch(key('right'));
  frame('Frame 4 — →→ horizontal scroll (columns pan left; header in lockstep)');

  console.log('\nDone — a DataGrid rendered, navigated (↓↓), sorted (header click), and H-scrolled (→).');
}

main();
