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
function buildBand(opts: { width?: number; indent?: Signal<number> } = {}) {
  const width = opts.width ?? 10;
  const indent = opts.indent ?? signal(0);
  const band = new QuickFilterRow<Sale>({
    columns: UNIT_COLS,
    columnIds: [...UNIT_IDS],
    autoWidths: () => [null, null],
    indent,
    onQuickFilter: () => undefined,
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

test('each input reserves one cell for the divider and pans fully off-screen at max indent', () => {
  const indent = signal(0);
  const { inputs, render } = buildBand({ indent });
  expect(inputs[0].layout.rect?.width).toBe(7); // region width 8 − 1 divider
  expect(inputs[1].layout.rect?.width).toBe(5); // qty width 6 − 1 divider

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
