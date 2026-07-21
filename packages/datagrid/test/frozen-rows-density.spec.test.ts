/**
 * Specification tests (immutable oracles) — frozen rows + density mode (plan `03-05`,
 * `07 §Frozen rows & density`, ST-24/ST-25). Both features are additive and default-off/normal, so a
 * grid that sets neither renders exactly as the panels-only build.
 *
 * Expectations derive from the requirements — the *rendered buffer* and the public option surface —
 * never from the implementation. Frozen rows: a pinned band below the header holds the first N rows
 * and never scrolls; the scrolling body's window starts after them (no duplicate). Density compact:
 * the inter-column `│` divider is dropped (reclaiming its cell), header and body stay column-aligned.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Row {
  id: number;
  name: string;
  city: string;
}

// Distinctive per-row city values so a given row is identifiable in the rendered buffer.
const ROWS: Row[] = [
  { id: 1, name: 'Ann', city: 'AAA' },
  { id: 2, name: 'Bob', city: 'BBB' },
  { id: 3, name: 'Cy', city: 'CCC' },
  { id: 4, name: 'Di', city: 'DDD' },
  { id: 5, name: 'Ed', city: 'EEE' },
  { id: 6, name: 'Fi', city: 'FFF' },
  { id: 7, name: 'Gu', city: 'GGG' },
  { id: 8, name: 'Ho', city: 'HHH' },
];
const COLS = () => [
  column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 3 }),
  column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 4 }),
  column<Row, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 5 }),
];

function buildGrid(extra: Partial<EditableDataGridOptions<Row>>, width = 20, height = 6) {
  const grid = new EditableDataGrid<Row>({
    columns: COLS(),
    source: fromRows(signal(ROWS.slice()), { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const rowText = (y: number): string => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < width; x += 1) s += buf.get(x, y)?.char ?? ' ';
    return s;
  };
  const key = (k: string, mods: { ctrl?: boolean } = {}) =>
    loop.dispatch({ type: 'key', key: k, ctrl: mods.ctrl ?? false } as never);
  return { grid, loop, rowText, key };
}

// ---------------------------------------------------------------------------
// ST-24 — frozen rows
// ---------------------------------------------------------------------------

test('ST-24: freezeRows pins the first row below the header and the body window starts after it', () => {
  const { grid, loop, rowText } = buildGrid({ freezeRows: 1 });
  // Row 0 (city 'AAA') is pinned in the band at y=1 (header is y=0); the scrolling body starts at y=2
  // with row 1 (city 'BBB') — row 0 is NOT duplicated into the body.
  expect(rowText(1)).toContain('AAA'); // pinned band holds the first row
  expect(rowText(2)).toContain('BBB'); // the body's virtual window starts at row 1
  expect(rowText(2)).not.toContain('AAA'); // no duplicate of the pinned row in the body

  // Scroll the body to the bottom: the pinned band stays put; the pinned row never appears in the body.
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  loop.dispatch({ type: 'key', key: 'end', ctrl: true } as never); // Ctrl+End → jump to the last row
  loop.renderRoot.flush();
  expect(rowText(1)).toContain('AAA'); // the band did not scroll — the first row is still pinned
  const bodyBand = rowText(2) + rowText(3) + rowText(4);
  expect(bodyBand).not.toContain('AAA'); // the pinned row is never rendered inside the scrolling body
  expect(bodyBand).toContain('HHH'); // the last row scrolled into view in the body
});

// ---------------------------------------------------------------------------
// ST-25 — density / compact mode
// ---------------------------------------------------------------------------

test('ST-25: compact density drops the divider, widens content, and stays column-aligned', () => {
  const normal = buildGrid({}); // default density: 'normal'
  const compact = buildGrid({ density: 'compact' });

  // Normal mode draws the inter-column `│` divider in the header and the body; compact drops it.
  expect(normal.rowText(0)).toContain('│'); // header divider present
  expect(compact.rowText(0)).not.toContain('│'); // compact header has no divider
  expect(compact.rowText(1)).not.toContain('│'); // compact body has no divider either

  // Header and body stay column-aligned in BOTH modes: a column's title starts at the same x as its
  // rendered cell value.
  expect(normal.rowText(0).indexOf('City')).toBe(normal.rowText(1).indexOf('AAA'));
  expect(compact.rowText(0).indexOf('City')).toBe(compact.rowText(1).indexOf('AAA'));

  // Compact reclaims the divider cells, so downstream columns sit further left (denser / wider content):
  // the 'city' column (2 dividers before it in normal) starts 2 cells earlier in compact.
  expect(compact.rowText(1).indexOf('AAA')).toBe(normal.rowText(1).indexOf('AAA') - 2);
});
