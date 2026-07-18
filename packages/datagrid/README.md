# @jsvision/datagrid

An editable, enterprise-class data grid for [jsvision](https://github.com/blendsdk/jsvision) terminal
apps, built on `@jsvision/ui`. Think SAP ALV / MS-Access / Paradox in a text-mode terminal: typed
columns with per-cell display formatting, immediate in-cell editing, row selection, virtual scrolling,
and a column/sort/filter/footer surface.

This package is the growing foundation. Today it ships the load-bearing contracts that everything else
builds on:

- **Typed columns** — a `value` / `format` / `parse` column model where the typed `value` is the
  sort/filter key, `format` is the display string, and `parse` is the edit round-trip. Author columns
  with the `column()` helper (it infers each column's value type).
- **Data source** — a `GridDataSource<T>` seam (in-memory `fromRows`, plus a windowed shape for
  server/large data) with a required `rowKey` for stable row identity.
- **Commit sink** — an `onCommit` veto callback and a `commitCell` primitive that applies an edit
  immediately and reverts it if the commit is rejected.
- **Cell overlay** — `mountCellOverlay`, a cell-aligned mount helper for editor views.
- **Read-only grid** — `EditableDataGrid<T>`, a self-drawing table over the column model and data
  source. It renders read-only today; interactive editing lands in a later release.

Zero runtime dependencies. ESM only. Node 22+.

## Quick start

```ts
import { signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Person {
  id: number;
  name: string;
  balance: number;
}

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

const columns = [
  column({ id: 'name', title: 'Name', value: (r: Person) => r.name }),
  column({
    id: 'balance',
    title: 'Balance',
    value: (r: Person) => r.balance, // the numeric sort/filter key
    format: (v) => eur.format(v), // "€ 1.000,00" — display only
    align: 'right',
  }),
];

const rows = signal<Person[]>([
  { id: 1, name: 'Ada', balance: 1000 },
  { id: 2, name: 'Bo', balance: 9 },
]);

const source = fromRows(rows, { rowKey: (r) => r.id });
const grid = new EditableDataGrid<Person>({ columns, source });
// A numeric sort orders 9 before 1000 — never the "€ 9,00" / "€ 1.000,00" display strings.
```
