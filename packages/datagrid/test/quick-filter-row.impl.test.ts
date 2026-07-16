/**
 * Implementation tests — `QuickFilterRow` geometry edges beyond the spec oracles: each input placed
 * under its column, re-positioning when the shared H-scroll `indent` changes, the one-cell divider
 * reserve, panning fully off the left edge (clipped by the band bounds), and the one-cell band height.
 *
 * The band is mounted bare in a render root at a viewport narrower than the column content, so the
 * indent is not clamped to zero and horizontal panning is observable. Each input's `layout.rect` is the
 * direct output of the band's reposition, so the tests read it. The `.js` specifier is NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { Group, Input, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column, Signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { QuickFilterRow } from '../src/quick-filter-row.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Sale {
  region: string;
  qty: number;
}
// Fixed widths (8, 6): starts [0, 9], totalWidth 16 (each column + a 1-cell divider).
const UNIT_COLS: Column<Sale>[] = [
  { title: 'Region', accessor: (r) => r.region, width: 8 },
  { title: 'Qty', accessor: (r) => String(r.qty), width: 6 },
];
const UNIT_IDS = ['region', 'qty'] as const;

/** Mount a bare `QuickFilterRow` at `width` (default 10 < content 16, so the indent pans). */
function buildBand(opts: { width?: number; indent?: Signal<number>; filterable?: boolean[] } = {}) {
  const width = opts.width ?? 10;
  const indent = opts.indent ?? signal(0);
  const band = new QuickFilterRow<Sale>({
    columns: UNIT_COLS,
    columnIds: [...UNIT_IDS],
    autoWidths: () => [null, null],
    indent,
    onQuickFilter: () => undefined,
    filterable: opts.filterable,
  });
  band.layout = { position: 'absolute', rect: { x: 0, y: 0, width, height: 1 } };
  const root = new Group();
  root.add(band);
  const render = createRenderRoot({ width, height: 1 }, { caps });
  render.mount(root);
  render.flush(); // reflow → onMount → initial reposition
  const inputs = band.children.filter((v): v is Input => v instanceof Input);
  return { band, inputs, indent, render };
}

test('each input sits under its column and re-positions when the indent changes', () => {
  const indent = signal(0);
  const { inputs, render } = buildBand({ indent });
  expect(inputs[0].layout.rect?.x).toBe(0); // region at starts[0]
  expect(inputs[1].layout.rect?.x).toBe(9); // qty at starts[1]

  indent.set(4); // scroll right by 4 (content 16 > viewport 10, so not clamped)
  render.flush();
  expect(inputs[0].layout.rect?.x).toBe(-4); // region panned 4 cells off the left edge
  expect(inputs[1].layout.rect?.x).toBe(5); // qty follows in lockstep
});

test('each input fills its full column width and pans fully off-screen at max indent', () => {
  const indent = signal(0);
  const { inputs, render } = buildBand({ indent });
  expect(inputs[0].layout.rect?.width).toBe(8); // region fills its full content width (divider has its own cell)
  expect(inputs[1].layout.rect?.width).toBe(6); // qty fills its full content width

  indent.set(6); // max indent = content 16 − viewport 10
  render.flush();
  expect(inputs[0].layout.rect?.x).toBe(-6); // region entirely left of the viewport → clipped away
  expect(inputs[1].layout.rect?.x).toBe(3);
});

test('the band is one cell tall with one input per column', () => {
  const { inputs } = buildBand({ width: 22 }); // wide viewport: indent clamps to 0
  expect(inputs.length).toBe(UNIT_COLS.length);
  for (const input of inputs) expect(input.layout.rect?.height).toBe(1);
  expect(inputs[0].layout.rect?.x).toBe(0); // no pan when the content fits
  expect(inputs[1].layout.rect?.x).toBe(9);
});

test('an undefined filterable config keeps every input; a false entry omits just that column', () => {
  const all = buildBand({ width: 22 }); // no filterable ⇒ default all-true
  expect(all.inputs.length).toBe(2);

  const one = buildBand({ width: 22, filterable: [true, false] }); // qty (index 1) opts out
  expect(one.inputs.length).toBe(1); // only region keeps an input
  expect(one.inputs[0].layout.rect?.x).toBe(0); // survivor stays under region (starts[0])
  expect(one.inputs[0].layout.rect?.width).toBe(8); // full region width — geometry unchanged
});

test('the band paints the inter-column │ divider (matching the header and body), in the muted tone', () => {
  // Widths 8,6 with the divider reserve → divider cells at x=8 (between region|qty) and x=15 (after the
  // last column). A wide viewport (22 > content 16) clamps the indent to 0, so the cells are on-screen.
  const { render } = buildBand({ width: 22 });
  const at = (x: number) => render.buffer().get(x, 0);
  expect(at(8)?.char).toBe('│'); // divider between the two columns — not a blank gap
  expect(at(15)?.char).toBe('│'); // trailing divider after the last column (as the header/body draw)
  expect(at(8)?.fg).toBe(defaultTheme.listDivider.fg); // same muted tone as the header/body dividers
  expect(at(8)?.bg).toBe(defaultTheme.listDivider.bg);
});

test('compact density paints no │ in the band (no reserved divider cell)', () => {
  const band = new QuickFilterRow<Sale>({
    columns: UNIT_COLS,
    columnIds: [...UNIT_IDS],
    autoWidths: () => [null, null],
    indent: signal(0),
    onQuickFilter: () => undefined,
    compact: true,
  });
  band.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 22, height: 1 } };
  const root = new Group();
  root.add(band);
  const render = createRenderRoot({ width: 22, height: 1 }, { caps });
  render.mount(root);
  render.flush();
  let row = '';
  for (let x = 0; x < 22; x += 1) row += render.buffer().get(x, 0)?.char ?? ' ';
  expect(row).not.toContain('│'); // compact reserves no divider cell, so the band draws none
});

test('multiple filterable:false columns each drop their input while survivors stay index-aligned', () => {
  // Three fixed columns (widths 8,6,8 → starts [0,9,16]); only the middle one filters. The survivor
  // must land at starts[1]=9 — proving the null slots keep the input array index-parallel to columns
  // (a compacted array would misplace it at starts[0]=0).
  const COLS3: Column<Sale>[] = [
    { title: 'A', accessor: (r) => r.region, width: 8 },
    { title: 'B', accessor: (r) => String(r.qty), width: 6 },
    { title: 'C', accessor: (r) => r.region, width: 8 },
  ];
  const band = new QuickFilterRow<Sale>({
    columns: COLS3,
    columnIds: ['a', 'b', 'c'],
    autoWidths: () => [null, null, null],
    indent: signal(0),
    onQuickFilter: () => undefined,
    filterable: [false, true, false],
  });
  band.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 25, height: 1 } };
  const root = new Group();
  root.add(band);
  const render = createRenderRoot({ width: 25, height: 1 }, { caps });
  render.mount(root);
  render.flush();
  const inputs = band.children.filter((v): v is Input => v instanceof Input);
  expect(inputs.length).toBe(1); // only column B has an input
  expect(inputs[0].layout.rect?.x).toBe(9); // under column B (starts[1]), not compacted to 0
  expect(inputs[0].layout.rect?.width).toBe(6); // column B's full width
});
