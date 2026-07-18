/**
 * Specification tests (immutable oracle) — layout variants + runtime freeze. `saveVariant(name)`
 * captures the full column layout (order, widths, visibility, freeze, sort, filter) as a serializable
 * `GridVariant`; `applyVariant(variant)` reproduces it exactly, dropping unknown ids and appending
 * current-but-unnamed columns. The pure `buildVariant`/`resolveVariant` are the serialize/re-derive
 * core; `setFrozen(left, right)` is the runtime freeze mutation variants rely on. Expectations derive
 * from the requirements + the variant contract, never the implementation.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { buildVariant, resolveVariant } from '../src/variant.js';
import type { GridVariant } from '../src/variant.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const W = 50;
const H = 8;

interface Emp {
  id: number;
  name: string;
  dept: string;
  total: number;
  note: string;
}

const EMPS: Emp[] = [
  { id: 1, name: 'Ann', dept: 'Eng', total: 10, note: 'a' },
  { id: 2, name: 'Bob', dept: 'Ops', total: 30, note: 'b' },
  { id: 3, name: 'Cy', dept: 'Eng', total: 20, note: 'c' },
];

const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  column<Emp, number>({ id: 'total', title: 'Total', value: (r) => r.total, width: 6, minWidth: 4, maxWidth: 40 }),
  column<Emp, string>({ id: 'note', title: 'Note', value: (r) => r.note, width: 6 }),
];

/** Mount a fresh grid over the same columns; wide viewport so nothing over-pins. */
function buildGrid(): EditableDataGrid<Emp> {
  const grid = new EditableDataGrid<Emp>({
    columns: COLS(),
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

// ST-12 — a full round-trip: save a customized layout on one grid, apply it on a fresh grid, and the
// order / freeze / sort / filter / visibility all reproduce.
test('a saved variant, applied on a fresh grid, reproduces order/freeze/sort/filter/visibility', () => {
  const a = buildGrid();
  a.setColumnVisible('note', false); // hide note
  a.setFrozen(['id'], []); // freeze id left
  a.sortBy('total', 'desc'); // sort by total desc
  a.setFilter('dept', { kind: 'text', op: 'contains', value: 'Eng' }); // filter dept
  const variant = a.saveVariant('mine');

  const b = buildGrid();
  b.applyVariant(variant);
  expect(b.columnOrder()).toEqual(['id', 'name', 'dept', 'total']); // note hidden → excluded from visible order
  expect(b.frozen()).toEqual({ left: ['id'], right: [] });
  expect(b.sort()).toEqual([{ columnId: 'total', dir: 'desc' }]);
  expect(b.filterModel().get('dept')).toEqual({ kind: 'text', op: 'contains', value: 'Eng' });
});

// ST-13 — buildVariant serializes the full order (hidden interleaved) with correct visible flags, a
// width only where an override exists, and copies freeze/sort/filter.
test('buildVariant captures the full order, visibility, overridden widths, and freeze/sort/filter', () => {
  const variant = buildVariant('x', {
    order: ['id', 'name', 'dept'],
    hidden: new Set(['dept']),
    widthOf: (id) => (id === 'name' ? 25 : undefined),
    freeze: { left: ['id'], right: [] },
    sort: [{ columnId: 'name', dir: 'asc' }],
    filter: new Map([['dept', { kind: 'text', op: 'contains', value: 'x' }]]),
  });
  expect(variant.name).toBe('x');
  expect(variant.columns).toEqual([
    { id: 'id', visible: true }, // no width override → width omitted
    { id: 'name', visible: true, width: 25 }, // overridden width carried
    { id: 'dept', visible: false }, // hidden, still in the order
  ]);
  expect(variant.freeze).toEqual({ left: ['id'], right: [] });
  expect(variant.sort).toEqual([{ columnId: 'name', dir: 'asc' }]);
  expect(variant.filter).toEqual([{ columnId: 'dept', filter: { kind: 'text', op: 'contains', value: 'x' } }]);
});

// ST-14 — resolveVariant drops an id the current grid does not have, without throwing.
test('resolveVariant drops an unknown column id, no throw', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'id', visible: true },
      { id: 'legacy', visible: true },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['id', 'name']);
  expect(resolved.order).not.toContain('legacy'); // unknown id dropped
  expect(resolved.order).toEqual(['id', 'name']); // 'name' (current, unnamed) appended after
});

// ST-15 — a current column the variant omits is appended after the named columns, keeping its state.
test('resolveVariant appends a current-but-unnamed column after the named ones', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'b', visible: true },
      { id: 'a', visible: true },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['a', 'b', 'extra']);
  expect(resolved.order).toEqual(['b', 'a', 'extra']); // named order first, then the unnamed 'extra'
});

// ST-16 — a variant that reorders + hides + widths a column resolves to one deterministic layout.
test('resolveVariant yields one deterministic layout for a reordered + hidden + widthed column', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'dept', visible: false, width: 20 },
      { id: 'id', visible: true },
      { id: 'name', visible: true },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['id', 'name', 'dept']);
  expect(resolved.order).toEqual(['dept', 'id', 'name']); // the variant's order
  expect(resolved.visibleById.get('dept')).toBe(false); // hidden
  expect(resolved.widthById.get('dept')).toBe(20); // width carried
});

// ST-17 — a variant hides a column but keeps its filter; applying it retains the filter, which reveals
// itself when the column is shown again.
test('applyVariant retains a filter on a column it hides; showing the column reveals it filtered', () => {
  const grid = buildGrid();
  const variant: GridVariant = {
    name: 'x',
    columns: COLS().map((c) => ({ id: c.id, visible: c.id !== 'dept' })), // dept hidden
    freeze: { left: [], right: [] },
    sort: [],
    filter: [{ columnId: 'dept', filter: { kind: 'text', op: 'contains', value: 'Eng' } }],
  };
  grid.applyVariant(variant);
  expect(grid.columnOrder()).not.toContain('dept'); // dept is hidden
  expect(grid.filterModel().get('dept')).toEqual({ kind: 'text', op: 'contains', value: 'Eng' }); // filter retained
  grid.setColumnVisible('dept', true);
  expect(grid.columnOrder()).toContain('dept'); // dept back
  expect(grid.filterModel().get('dept')).toBeDefined(); // still filtered
});

// ST-18 — a variant width is clamped to the column's min/max on apply.
test('applyVariant sets a variant width, clamped to the column min/max', () => {
  const grid = buildGrid();
  const variant: GridVariant = {
    name: 'x',
    columns: COLS().map((c) => ({ id: c.id, visible: true, ...(c.id === 'total' ? { width: 25 } : {}) })),
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  grid.applyVariant(variant);
  expect(grid.columnWidth('total')).toBe(25); // within [4, 40] → unchanged

  const tooWide: GridVariant = {
    ...variant,
    columns: COLS().map((c) => ({ id: c.id, visible: true, ...(c.id === 'total' ? { width: 99 } : {}) })),
  };
  grid.applyVariant(tooWide);
  expect(grid.columnWidth('total')).toBe(40); // clamped to maxWidth
});

// ST-19 — setFrozen re-pins at runtime, clears, ignores an unknown id, and warns once when every
// column is frozen (the over-freeze guard).
test('setFrozen re-pins, clears, ignores unknown ids, and warns once when all columns are frozen', () => {
  const grid = buildGrid();
  grid.setFrozen(['id'], ['note']);
  expect(grid.frozen()).toEqual({ left: ['id'], right: ['note'] });
  grid.setFrozen([], []);
  expect(grid.frozen()).toEqual({ left: [], right: [] });
  grid.setFrozen(['id', 'nope'], []); // unknown id ignored by the partition
  expect(grid.frozen()).toEqual({ left: ['id'], right: [] });

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  grid.setFrozen(['id', 'name', 'dept', 'total', 'note'], []); // freeze everything → the guard fires
  expect(warn).toHaveBeenCalled(); // one dev warning for the over-freeze
  warn.mockRestore();
});

// A variant that NAMES a column but carries no width must, on apply, REMOVE that column's existing
// override (delete-then-set) — while a named column that carries a width has it set. This is the
// corrected width-restore: applying a layout can clear a width to auto, not only set one.
test('applyVariant clears an omitted-width override and sets a carried width (delete-then-set)', () => {
  const grid = buildGrid();
  grid.setColumnWidth('name', 30); // a prior override on the column the variant names WITHOUT a width
  expect(grid.columnWidth('name')).toBe(30);
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'id', visible: true },
      { id: 'name', visible: true }, // named, no width → the override must be cleared
      { id: 'dept', visible: true },
      { id: 'total', visible: true, width: 18 }, // named with a width in [4,40] → set
      { id: 'note', visible: true },
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  grid.applyVariant(variant);
  expect(grid.columnWidth('total')).toBe(18); // carried width applied
  expect(grid.columnWidth('name')).toBe(8); // override removed → back to the declared width (not 30)
});

// The latent round-trip bug: a variant saved AFTER a width was cleared must, on apply, remove a
// re-added override — not leave the stale value. Guards both the new personalization flow and the
// prior variant round-trip.
test('applyVariant restores no width override for a variant saved after the width was cleared', () => {
  const grid = buildGrid();
  grid.setColumnWidth('note', 30);
  grid.saveVariant('v'); // 'note' captured WITH width 30 (documents the round-trip start)
  grid.clearColumnWidth('note'); // pending state: no override
  const v2 = grid.saveVariant('v2'); // 'note' captured WITHOUT a width
  grid.setColumnWidth('note', 30); // re-add an override to prove apply clears it
  grid.applyVariant(v2);
  expect(grid.columnWidth('note')).toBe(6); // back to the declared width — the override is cleared
});

// resolveVariant reports the named-but-width-less ids in `clearWidths`; a current-but-unnamed column
// is left out (its override stays untouched on apply).
test('resolveVariant reports named-without-width ids as clearWidths, leaving unnamed columns alone', () => {
  const variant: GridVariant = {
    name: 'x',
    columns: [
      { id: 'id', visible: true, width: 10 }, // named WITH a width
      { id: 'name', visible: true }, // named WITHOUT a width → clearWidths
    ],
    freeze: { left: [], right: [] },
    sort: [],
    filter: [],
  };
  const resolved = resolveVariant(variant, ['id', 'name', 'dept']); // 'dept' is current-but-unnamed
  expect(resolved.clearWidths).toEqual(['name']); // named, width omitted
  expect([...resolved.widthById.entries()]).toEqual([['id', 10]]); // named, width carried
  expect(resolved.clearWidths).not.toContain('dept'); // unnamed → not a clear target
});
