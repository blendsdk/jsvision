/**
 * Implementation tests — internals of the column resize gesture that the spec oracles (ST-20/21)
 * don't pin down:
 *  - a resize is **visually live**: the rendered column boundary moves, not just the `columnWidth`
 *    readout (the panel columns read the width override through a reactive getter);
 *  - resizing an `auto`/`fr` column **pins** it to a fixed width (an explicit override apportions fixed);
 *  - a **lost capture** aborts a half-finished resize cleanly (mirrors `Desktop.beginResize`).
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column, DispatchEvent } from '@jsvision/ui';
import { EditableDataGrid } from '../src/grid.js';
import { SortHeader } from '../src/sort-header.js';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Emp {
  id: number;
  name: string;
  city: string;
}
const EMPS: Emp[] = [
  { id: 1, name: 'Ada', city: 'NYC' },
  { id: 2, name: 'Bo', city: 'LA' },
];

const W = 30;
const H = 6;

function buildGrid(cols: ReturnType<typeof makeCols>, extra: { freeze?: number } = {}) {
  const grid = new EditableDataGrid<Emp>({
    columns: cols,
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const headerLine = (): string => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, 0)?.char ?? ' ';
    return s;
  };
  const mouse = (kind: 'down' | 'drag' | 'up', x0: number) =>
    loop.dispatch({ type: 'mouse', kind, button: 0, x: x0 + 1, y: 1 } as never);
  return { grid, loop, headerLine, mouse };
}

const makeCols = (idWidth: '5' | 'auto') => [
  idWidth === 'auto'
    ? column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id }) // width 'auto'
    : column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5, minWidth: 3 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 5 }),
  column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 8 }),
];

// The rendered layout reflows on a resize — the id|name divider moves right when id widens.
test('a resize moves the rendered column boundary, not just the width readout', () => {
  const { grid, headerLine, mouse } = buildGrid(makeCols('5'));
  expect(headerLine().indexOf('│')).toBe(5); // id grip at x=5 initially
  mouse('down', 5);
  mouse('drag', 9); // +4 → id width 9
  mouse('up', 9);
  expect(grid.columnWidth('id')).toBe(9);
  expect(headerLine().indexOf('│')).toBe(9); // the boundary moved right — the render reflowed live
});

// Resizing an 'auto' column pins it: it apportions as a fixed width afterward.
test("resizing an 'auto' column pins it to a fixed width", () => {
  const { grid, headerLine, mouse } = buildGrid(makeCols('auto'));
  const gripBefore = headerLine().indexOf('│'); // the id auto-width grip position
  mouse('down', gripBefore);
  mouse('drag', gripBefore + 6); // widen the auto column
  mouse('up', gripBefore + 6);
  expect(grid.columnWidth('id')).toBe(gripBefore + 6); // pinned to the dragged width
  expect(headerLine().indexOf('│')).toBe(gripBefore + 6); // renders at the pinned width, not auto
});

// A captured resize whose capture is lost mid-drag aborts cleanly — no further width reports.
test('a lost capture aborts the resize cleanly', () => {
  const onResize = vi.fn<(id: string, w: number) => void>();
  const header = new SortHeader<Emp>({
    columns: [
      { title: 'ID', accessor: (r) => String(r.id), width: 5 },
      { title: 'Name', accessor: (r) => r.name, width: 8 },
    ] as Column<Emp>[],
    columnIds: ['id', 'name'],
    autoWidths: () => [null, null],
    indent: signal(0),
    sort: signal([]),
    onHeaderClick: () => undefined,
    filterModel: signal(new Map()),
    onFunnelClick: () => undefined,
    onColumnResize: onResize,
  });
  header.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: 1 } };
  const root = new Group();
  root.add(header);
  const loop = createEventLoop({ width: W, height: 1 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  let captured = true;
  const envelope = (kind: 'down' | 'drag', x: number): DispatchEvent =>
    ({
      event: { type: 'mouse', kind, button: 0, x, y: 0 },
      local: { x, y: 0 },
      handled: false,
      setCapture: () => undefined,
      releaseCapture: () => undefined,
      hasCapture: () => captured,
    }) as unknown as DispatchEvent;

  header.onEvent(envelope('down', 5)); // grab the id grip (starts[0]+widths[0] = 5)
  header.onEvent(envelope('drag', 8)); // a normal captured drag reports a resize
  expect(onResize).toHaveBeenCalledTimes(1);
  captured = false; // the loop steals the capture (e.g. a modal opened)
  header.onEvent(envelope('drag', 12)); // this drag must be ignored, not reported
  expect(onResize).toHaveBeenCalledTimes(1); // still 1 — the stale drag aborted cleanly
});

// ---------------------------------------------------------------------------
// Reorder gesture internals (beyond the ST-22/23 oracles)
// ---------------------------------------------------------------------------

// A drag that wanders off and returns to its own slot commits nothing — but it still counted as a
// drag, so the sort the press applied on mouse-down is reverted (a drag never leaves a net sort).
test('a reorder drag that drops on its own slot is a no-op (order unchanged, sort reverted)', () => {
  const { grid, headerLine, mouse } = buildGrid(makeCols('5'));
  const nameX = headerLine().indexOf('Name');
  const cityX = headerLine().indexOf('City');
  mouse('down', nameX); // press 'name' (sorts on down + arms a reorder)
  mouse('drag', cityX); // drag away to the city slot…
  mouse('drag', nameX); // …then back onto name's own slot
  mouse('up', nameX);
  expect(grid.columnOrder()).toEqual(['id', 'name', 'city']); // dropped on its own slot → nothing moved
  expect(grid.sort()).toEqual([]); // the drag still reverted the on-down sort
});

// Dragging a center-panel column past the freeze boundary clamps the drop indicator to the panel's
// own left edge — it never renders in (or drops into) the frozen panel.
test('the drop indicator pins to the panel edge when a column is dragged past it', () => {
  const { headerLine, mouse } = buildGrid(makeCols('5'), { freeze: 1 }); // id frozen; name+city center
  const centerOrigin = headerLine().indexOf('Name'); // the center panel's first slot (its left edge)
  const cityX = headerLine().indexOf('City');
  mouse('down', cityX); // press 'city' in the center panel
  mouse('drag', 0); // drag hard left, past the freeze boundary into the frozen panel's screen area
  const line = headerLine();
  expect(line[centerOrigin]).toBe('▏'); // indicator pinned at the center panel's left edge (slot 0)
  expect(line[0]).not.toBe('▏'); // and never painted into the frozen (id) panel at x=0
  mouse('up', 0); // release the captured gesture
});
