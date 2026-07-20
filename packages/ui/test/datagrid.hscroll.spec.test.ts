/**
 * Specification tests (immutable oracles) — DataGrid horizontal-scroll render path.
 *
 * The docs `table/data-grid` example uses a `1fr` column, so it can never H-scroll — leaving the
 * `GridRows`/`GridHeader` negative-`x` cell-clip + divider-placement path (which panning an
 * overflowing grid exercises) untested. These oracles cover it directly: at `indent > 0`, each
 * column's visible tail lands at the right screen column, each `│` divider sits at its column's
 * right edge, a wide glyph whose lead scrolls off the left is dropped whole (no orphan
 * continuation cell), and the sticky header pans in lockstep with the body.
 *
 * Geometry (grid 24×12): body is `[rows 23 | vbar 1]`, header + rows width 23. Draw assertions read
 * the `ScreenBuffer` pre-`serialize`. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { DataGrid } from '../src/table/index.js';
import type { Column } from '../src/table/index.js';

void createRenderRoot; // (kept parallel to the sibling suites' imports; the loop owns the root here)
const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Row {
  readonly _: 0;
}
const ONE: Row[] = [{ _: 0 }];

/** Mount a DataGrid filling 24×12 at a fixed `indent`, return the render buffer accessor. */
function hostedAt(columns: Column<Row>[], indent: number) {
  const grid = new DataGrid<Row>({ rows: signal([...ONE]), columns, indent: signal(indent) });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 12 } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 24, height: 12 }, { caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  return (x: number, y: number) => buf.get(x, y)?.char;
}

// Three 10-wide fixed columns: content 30 + 3 dividers = totalWidth 33 > 23 → maxIndent 10.
// starts = [0, 11, 22]; at indent 5 the columns pan left by 5.
function threeWide(): Column<Row>[] {
  return [
    { title: 'C0', accessor: () => '0123456789', width: 10 },
    { title: 'C1', accessor: () => 'ABCDEFGHIJ', width: 10 },
    { title: 'C2', accessor: () => 'abcdefghij', width: 10 },
  ];
}

test('ST-A2: at indent>0 each column pans left and its divider lands at the column right edge', () => {
  const at = hostedAt(threeWide(), 5); // data row 0 is screen y=1
  // C0 (start 0 → x −5): only its tail chars 5..9 are visible at screen x 0..4; divider at x5.
  expect(at(0, 1), 'C0 char 5 (left-clipped tail)').toBe('5');
  expect(at(4, 1), 'C0 char 9').toBe('9');
  expect(at(5, 1), 'C0 divider at its right edge').toBe('│');
  // C1 (start 11 → x 6): fully visible A..J at x 6..15; divider at x16.
  expect(at(6, 1), 'C1 first char').toBe('A');
  expect(at(15, 1), 'C1 last char').toBe('J');
  expect(at(16, 1), 'C1 divider').toBe('│');
  // C2 (start 22 → x 17): visible a..f, clipped at the body right edge x22.
  expect(at(17, 1), 'C2 first char').toBe('a');
  expect(at(22, 1), 'C2 clipped at the body right edge').toBe('f');
});

test('ST-A3: a wide glyph whose lead scrolls off the left is dropped whole (no orphan continuation)', () => {
  // Two 20-wide columns overflow (maxIndent 19). Column W = "AB你CD…": 你 is a 2-cell glyph at cell
  // index 2. At indent 3 its lead lands at x −1 (off-screen) — the whole glyph must drop, leaving a
  // blank column 0, then C at x1.
  const columns: Column<Row>[] = [
    { title: 'W', accessor: () => 'AB你CD', width: 20 },
    { title: 'X', accessor: () => 'x'.repeat(20), width: 20 },
  ];
  const at = hostedAt(columns, 3);
  expect(at(0, 1), 'no orphan wide-glyph continuation at the clip boundary').toBe(' ');
  expect(at(1, 1), 'the glyph after the dropped wide char resumes correctly').toBe('C');
  expect(at(2, 1)).toBe('D');
});

test('ST-A4: the sticky header pans in lockstep with the body', () => {
  const at = hostedAt(threeWide(), 5); // header is screen y=0
  // C1 title starts at x6 (same start as the body's C1 cell); C0 divider at x5 on both rows.
  expect(at(6, 0), 'header C1 title at the same x as the body C1 cell').toBe('C');
  expect(at(5, 0), 'header C0 divider aligns with the body divider').toBe('│');
  expect(at(5, 1), 'body C0 divider at the same x').toBe('│');
});
