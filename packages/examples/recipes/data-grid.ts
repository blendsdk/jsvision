// Recipe: a data-driven, master-detail table.
//
// A sortable `DataGrid<Person>` over a typed row signal, with a one-line detail bound to the focused
// row. Clicking a column header sorts; the detail follows the focused row across sorts. This is the
// pattern for any list/table screen: reactive data in a signal, a grid over it, and selection wired
// to a detail pane.

import { computed, DataGrid, Group, signal, Text } from '@jsvision/ui';
import type { Column, Signal, SortState } from '@jsvision/ui';

// #region example
/** A row in the people grid. */
export interface Person {
  name: string;
  age: number;
  city: string;
}

/** Handles for the people-grid recipe. */
export interface PeopleGrid {
  /** The mountable root (grid + detail line). */
  root: Group;
  /** The grid instance — call `grid.sortBy(col, dir)` or click a header to sort. */
  grid: DataGrid<Person>;
  /** The backing rows; mutate to add/remove/replace data. */
  rows: Signal<Person[]>;
  /** The rows in current display order (mirrors the grid's sort — the master-detail source). */
  sorted: () => Person[];
  /** The one-line detail string for the focused row. */
  detail: () => string;
}

/**
 * Build a data-driven, master-detail people grid: a {@link DataGrid} over a typed row signal with
 * sortable Name / Age / City columns, plus a detail `Text` bound to the focused row. Numeric columns
 * carry an explicit `compare` (the default is a lexical string compare).
 *
 * @returns The grid recipe handles (see {@link PeopleGrid}).
 * @example
 * const { root, grid } = buildPeopleGrid();
 * win.add(root);
 * grid.sortBy(1, 'asc'); // sort by Age ascending
 */
export function buildPeopleGrid(): PeopleGrid {
  const rows = signal<Person[]>([
    { name: 'Cy', age: 24, city: 'Oslo' },
    { name: 'Ada', age: 36, city: 'London' },
    { name: 'Bo', age: 12, city: 'Berlin' },
  ]);
  const focused = signal(0);
  const selected = signal(-1);
  const sort = signal<SortState>(null);

  const columns: Column<Person>[] = [
    { title: 'Name', accessor: (p) => p.name, width: 8 },
    { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
    { title: 'City', accessor: (p) => p.city, width: '1fr' },
  ];

  const grid = new DataGrid<Person>({ rows, columns, focused, selected, sort, zebra: true });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 9 } };

  // Mirror the grid's sort so the detail line reads the displayed order. The grid stably sorts a copy
  // of `rows` by the active column's compare; reproduce that here from the same signals.
  const sorted = computed<Person[]>(() => {
    const s = sort();
    if (s === null) return rows();
    const col = columns[s.col];
    if (col === undefined) return rows();
    const cmp = col.compare ?? ((a: Person, b: Person) => col.accessor(a).localeCompare(col.accessor(b)));
    const out = [...rows()].sort(cmp);
    return s.dir === 'desc' ? out.reverse() : out;
  });

  const detail = computed<string>(() => {
    const person = sorted()[focused()];
    return person === undefined ? 'No selection' : `${person.name} · age ${person.age} · ${person.city}`;
  });

  const detailView = new Text(() => detail());
  detailView.layout = { position: 'absolute', rect: { x: 0, y: 10, width: 40, height: 1 } };

  const root = new Group();
  root.add(grid);
  root.add(detailView);

  return { root, grid, rows, sorted, detail };
}
// #endregion example
