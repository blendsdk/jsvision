/**
 * Specification tests (immutable oracles) — the read-only `EditableDataGrid<T>` container. It renders
 * `format(value)` cells over a `GridDataSource<T>` via the column adapter, renders identically from an
 * in-memory source and a windowed double (source-agnostic), and inherits the engine's sanitize
 * boundary so a control-byte cell value never reaches the frame as a raw escape.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { windowedSource } from './fixtures/windowed-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

interface Row {
  id: number;
  balance: number;
}
const data: Row[] = [
  { id: 1, balance: 1000 },
  { id: 2, balance: 9 },
];

const W = 22;
const H = 6;

/** Render a grid over `source` and return one string per screen row. */
function rowTexts(source: GridDataSource<Row>): string[] {
  const columns = [
    column({
      id: 'balance',
      title: 'Balance',
      value: (r: Row) => r.balance,
      format: (v) => eur.format(v),
      align: 'right',
    }),
  ];
  const grid = new EditableDataGrid<Row>({ columns, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const render = createRenderRoot({ width: W, height: H }, { caps });
  render.mount(root);
  const buf = render.buffer();
  const out: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    out.push(s);
  }
  return out;
}

// ST-10 — the container renders the formatted display string, and the header shows the column title.
test('should render the formatted value cells and the header title', () => {
  const texts = rowTexts(fromRows(signal(data), { rowKey: (r) => r.id }));
  expect(texts[0]).toContain('Balance'); // the header title
  const body = texts.slice(1).join('\n');
  expect(body).toContain('€'); // the euro sign proves format() ran
  expect(body).not.toContain('1000'); // the raw numeric value never appears
});

// ST-10 + ST-7 — the same container code path renders identically from a windowed double.
test('should render identically from a windowed double over the same rows', () => {
  const inMemory = rowTexts(fromRows(signal(data), { rowKey: (r) => r.id }));
  const windowed = rowTexts(windowedSource(data, (r) => r.id));
  expect(windowed).toEqual(inMemory);
});

// ST-11 — a control-byte cell value reaches the screen through the engine's sanitize path, so the
// frame carries no raw ESC/BEL.
test('should sanitize a control-byte cell value (no raw ESC/BEL in the frame)', () => {
  interface Labelled {
    id: number;
    label: string;
  }
  const rows = signal<Labelled[]>([{ id: 1, label: '\x1b[31mX\x07' }]);
  const columns = [column({ id: 'label', title: 'L', value: (r: Labelled) => r.label })];
  const grid = new EditableDataGrid<Labelled>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const render = createRenderRoot({ width: W, height: H }, { caps });
  render.mount(root);

  const buf = render.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(render.serialize()).not.toContain('\x07'); // BEL is never legitimately emitted
});
