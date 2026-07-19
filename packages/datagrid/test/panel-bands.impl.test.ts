/**
 * Implementation tests — the band structure `buildGridBody` assembles beneath a fully-featured grid.
 *
 * The grid body is a column of up to eight horizontal bands (header, quick filter, pinned rows, body,
 * footer aggregates, footer widgets, validation message, scroll bar), each in turn a row of
 * per-segment panels split by the freeze boundaries. `golden-screen.spec` guards what that structure
 * *renders*; nothing guarded the structure itself, so a band that moved, collapsed, or flowed the
 * wrong way could only be caught as a pixel diff — if at all.
 *
 * `GridBodyParts` exposes `inner`, `panels`, `headers` and `center`, but no handle for any individual
 * band, so these tests walk the tree and name each band by the child type that distinguishes it.
 * Every assertion message carries that name: a failure says *which* band moved rather than which
 * index chain broke.
 *
 * This is an implementation test by intent — it captures internal structure, which later layout work
 * may legitimately change.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { EditableDataGrid } from '../src/grid.js';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Row {
  id: number;
  name: string;
  city: string;
  dept: string;
  amount: number;
}

const ROWS: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `N${i + 1}`,
  city: `C${i + 1}`,
  dept: `D${i + 1}`,
  amount: (i + 1) * 10,
}));

const COLS = () => [
  column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 4 }),
  column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 6 }),
  column<Row, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 6 }),
  column<Row, string>({
    id: 'dept',
    title: 'Dept',
    value: (r) => r.dept,
    width: 6,
    parse: (t) => t,
    set: (r, v) => {
      r.dept = v;
    },
    validate: (v: string) => (v.length > 0 ? null : 'required'),
  }),
  column<Row, number>({ id: 'amount', title: 'Amount', value: (r) => r.amount, width: 8 }),
];

const W = 40;
const H = 16;

/**
 * A grid with every optional band configured: left/right freeze (so each band row splits into three
 * segments), pinned rows, a quick filter, footer aggregates, a footer widget row, and column
 * validation (which is what materializes the message band).
 */
function buildFullGrid(): { grid: EditableDataGrid<Row>; inner: Group } {
  const widget = new Group();
  widget.layout = { size: { kind: 'fr', weight: 1 } };

  const grid = new EditableDataGrid<Row>({
    columns: COLS(),
    source: fromRows(signal(ROWS.slice()), { rowKey: (r) => r.id }),
    freezeLeft: ['id'],
    freezeRight: ['amount'],
    freezeRows: 2,
    quickFilter: true,
    footer: { aggregates: { amount: { fn: 'sum' } }, widgets: [widget] },
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  // The grid's own child is the band column the body builder returned.
  const inner = grid.children[0] as Group;
  return { grid, inner };
}

/** True when `view` or any descendant is an instance whose constructor is named `name`. */
function containsType(view: View, name: string): boolean {
  if (view.constructor.name === name) return true;
  const children = (view as Group).children;
  if (children === undefined) return false;
  return children.some((c) => containsType(c, name));
}

/**
 * Name each band by the child type that only it contains, so a failure reads as "the footer band
 * moved" rather than "children[4] moved". Bands are matched in the order they were added.
 */
function nameBand(band: View, index: number): string {
  if (containsType(band, 'SortHeader')) return `header(${index})`;
  if (containsType(band, 'QuickFilterRow')) return `quickFilter(${index})`;
  if (containsType(band, 'FooterBand')) return `footer(${index})`;
  if (containsType(band, 'ScrollBar')) return `scrollBar(${index})`;
  return `band(${index})`;
}

test('the grid body is a single column of full-width, non-overlapping bands', () => {
  const { inner } = buildFullGrid();

  const bands = inner.children.filter((c) => c.state.visible);
  // header, quick filter, pinned rows, body, footer aggregates, footer widgets, message, scroll bar
  expect(bands.length).toBe(8);

  const named = bands.map((b, i) => `${nameBand(b, i)} ${JSON.stringify(b.bounds)}`);

  // Every band spans the full grid width and has real height — non-vacuity for everything below.
  for (const [i, band] of bands.entries()) {
    expect(`${nameBand(band, i)} width=${band.bounds.width}`).toBe(`${nameBand(band, i)} width=${W}`);
    expect(`${nameBand(band, i)} height>0=${band.bounds.height > 0}`).toBe(`${nameBand(band, i)} height>0=true`);
    expect(`${nameBand(band, i)} x=${band.bounds.x}`).toBe(`${nameBand(band, i)} x=0`);
  }

  // The bands stack top-to-bottom with no gap and no overlap; the whole stack fills the grid.
  for (let i = 1; i < bands.length; i += 1) {
    const expectedY = bands[i - 1].bounds.y + bands[i - 1].bounds.height;
    expect(`${nameBand(bands[i], i)} y=${bands[i].bounds.y} (stack: ${named.join(', ')})`).toBe(
      `${nameBand(bands[i], i)} y=${expectedY} (stack: ${named.join(', ')})`,
    );
  }
  expect(bands[0].bounds.y).toBe(0);
  const last = bands[bands.length - 1];
  expect(last.bounds.y + last.bounds.height).toBe(H);
});

test('the one-row chrome bands are exactly one cell tall and the body absorbs the slack', () => {
  const { inner } = buildFullGrid();
  const bands = inner.children.filter((c) => c.state.visible);

  const header = bands[0];
  const quick = bands[1];
  const pinned = bands[2];
  const body = bands[3];
  const scrollBar = bands[bands.length - 1];

  expect(`header height=${header.bounds.height}`).toBe('header height=1');
  expect(`quickFilter height=${quick.bounds.height}`).toBe('quickFilter height=1');
  expect(`pinnedRows height=${pinned.bounds.height}`).toBe('pinnedRows height=2'); // freezeRows: 2
  expect(`scrollBar height=${scrollBar.bounds.height}`).toBe('scrollBar height=1');
  expect(body.bounds.height).toBeGreaterThan(1); // the scrolling body takes what is left
});

/** The direct children of `band` whose constructor is named `name`, in tree order. */
function segmentsOf(band: View, name: string): View[] {
  return ((band as Group).children ?? []).filter((c) => c.constructor.name === name);
}

test('each band row splits into left / center / right segments at the same x boundaries', () => {
  const { grid, inner } = buildFullGrid();

  const bands = inner.children.filter((c) => c.state.visible);
  const headerSegs = segmentsOf(bands[0], 'SortHeader');
  const bodySegs = segmentsOf(bands[3], 'EditableGridRows');

  // Three segments per band — one per freeze region (non-vacuity for the boundaries below).
  expect(`headerSegs=${headerSegs.length}`).toBe('headerSegs=3');
  expect(`bodySegs=${bodySegs.length}`).toBe('bodySegs=3');

  const [leftHeader, centerHeader, rightHeader] = headerSegs;
  const [leftPanel, centerPanel, rightPanel] = bodySegs;

  // A frozen segment is a fixed band; the center absorbs the remaining width.
  for (const [name, seg] of [
    ['left', leftHeader],
    ['center', centerHeader],
    ['right', rightHeader],
  ] as const) {
    expect(`${name}Header width>0=${seg.bounds.width > 0}`).toBe(`${name}Header width>0=true`);
  }

  // The header row and the body row split at the same columns — that alignment is the whole point of
  // driving both from one segment list.
  expect(`left x=${leftPanel.bounds.x}`).toBe(`left x=${leftHeader.bounds.x}`);
  expect(`center x=${centerPanel.bounds.x}`).toBe(`center x=${centerHeader.bounds.x}`);
  expect(`right x=${rightPanel.bounds.x}`).toBe(`right x=${rightHeader.bounds.x}`);
  expect(`left width=${leftPanel.bounds.width}`).toBe(`left width=${leftHeader.bounds.width}`);
  expect(`right width=${rightPanel.bounds.width}`).toBe(`right width=${rightHeader.bounds.width}`);

  // Segments run left → center → right with a one-cell freeze divider between each pair.
  expect(centerPanel.bounds.x).toBe(leftPanel.bounds.x + leftPanel.bounds.width + 1);
  expect(rightPanel.bounds.x).toBe(centerPanel.bounds.x + centerPanel.bounds.width + 1);

  // The center segment is the grid's primary body — the one the container exposes and scrolls.
  expect(grid.rows).toBe(centerPanel);
});

test('an unfrozen grid with no optional bands is a header, body and scroll-bar column', () => {
  // Plain read-only columns: no `validate`, so no validation message band is materialized either.
  const grid = new EditableDataGrid<Row>({
    columns: [
      column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 4 }),
      column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 6 }),
    ],
    source: fromRows(signal(ROWS.slice()), { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  const inner = grid.children[0] as Group;
  const bands = inner.children.filter((c) => c.state.visible);
  expect(bands.length).toBe(3);
  expect(nameBand(bands[0], 0)).toBe('header(0)');
  expect(nameBand(bands[2], 2)).toBe('scrollBar(2)');

  expect(bands[0].bounds.height).toBe(1);
  expect(bands[2].bounds.height).toBe(1);
  expect(bands[1].bounds.height).toBe(H - 2);
  // One body segment, and it is the focusable one — no freeze split, no passive mirrors.
  const bodySegs = segmentsOf(bands[1], 'EditableGridRows');
  expect(`bodySegs=${bodySegs.length}`).toBe('bodySegs=1');
  expect(grid.rows).toBe(bodySegs[0]);
});
