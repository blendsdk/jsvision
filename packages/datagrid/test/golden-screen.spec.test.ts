/**
 * Specification tests (immutable oracles) — golden-screen colour-depth coverage (ST-1). Renders one
 * representative grid, pre-seeded into all four theme role states, through a real terminal emulator
 * (`@xterm/headless`, reusing core's golden harness) and asserts that the cell bearing each role
 * (`gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`) reads back with the depth-correct colour
 * MODE at each depth: truecolor → rgb, 256 → palette, 16 → palette index 0–15, mono → default. This
 * proves the RD-05 downsample chain against a live emulator, not just as a stored byte string.
 *
 * Expectations derive from the render/depth contract, never from running `serialize` first. The
 * `gridDirty` marker is a fg-only `•` over the cell's own background, so its role colour is read on the
 * FG channel; the three band roles are read on the BG channel. The four cells never overlap, so no
 * overpaint precedence masks one (see the golden-grid fixture).
 *
 * This spec imports core's cross-package golden harness by workspace-relative path; that resolves at
 * run time (vitest/tsx, NodeNext) but is excluded from datagrid's typecheck (see tsconfig.typecheck).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, serialize } from '@jsvision/core';
import type { ColorDepth, RenderOptions } from '@jsvision/core';
import { feed, makeTerm, readCell } from '../../core/test/golden-screen-helpers.js';
import type { CellColor } from '../../core/test/golden-screen-helpers.js';
import { buildGoldenGrid } from './fixtures/golden-grid.js';

/** Build `RenderOptions` pinned to a colour depth (with optional further capability overrides). */
function optsFor(depth: ColorDepth, override: Record<string, unknown> = {}): RenderOptions {
  const profile = resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: depth, ...override },
  }).profile;
  return { caps: profile };
}

/** The colour mode the render contract requires of a styled cell at each depth (mirrors core). */
const COLOR_CONTRACT: Record<ColorDepth, (c: CellColor, label: string) => void> = {
  truecolor: (c, label) => expect(c.mode, label).toBe('rgb'),
  '256': (c, label) => expect(c.mode, label).toBe('palette'),
  '16': (c, label) => {
    expect(c.mode, label).toBe('palette');
    expect(c.value >= 0 && c.value <= 15, label).toBeTruthy();
  },
  mono: (c, label) => expect(c.mode, label).toBe('default'),
};

const DEPTHS: readonly ColorDepth[] = ['truecolor', '256', '16', 'mono'];

for (const depth of DEPTHS) {
  test(`ST-1: each grid role renders the depth-correct colour mode at ${depth}`, async () => {
    const g = buildGoldenGrid();
    const term = makeTerm(g.width, g.height);
    await feed(term, serialize(g.buffer, null, optsFor(depth))); // first serialize after mount == full paint

    // Band roles → read the background; the fg-only dirty marker → read the foreground.
    COLOR_CONTRACT[depth](readCell(term, g.cells.cursor.x, g.cells.cursor.y).bg, `${depth} gridCursor bg`);
    COLOR_CONTRACT[depth](readCell(term, g.cells.dirty.x, g.cells.dirty.y).fg, `${depth} gridDirty fg`);
    COLOR_CONTRACT[depth](readCell(term, g.cells.selected.x, g.cells.selected.y).bg, `${depth} gridSelectedRow bg`);
    COLOR_CONTRACT[depth](readCell(term, g.cells.invalid.x, g.cells.invalid.y).bg, `${depth} gridInvalid bg`);
  });
}

// A single-depth guard that the fixture actually placed each role on its own cell — i.e. the truecolor
// read-back distinguishes the four role colours from one another (a masked/overlapping fixture would
// collapse two of them and quietly weaken every depth case above).
test('ST-1: the four role colours are mutually distinct on the emulator (non-overlapping fixture)', async () => {
  const g = buildGoldenGrid();
  const term = makeTerm(g.width, g.height);
  await feed(term, serialize(g.buffer, null, optsFor('truecolor')));

  const cursorBg = readCell(term, g.cells.cursor.x, g.cells.cursor.y).bg.value;
  const dirtyFg = readCell(term, g.cells.dirty.x, g.cells.dirty.y).fg.value;
  const selectedBg = readCell(term, g.cells.selected.x, g.cells.selected.y).bg.value;
  const invalidBg = readCell(term, g.cells.invalid.x, g.cells.invalid.y).bg.value;

  const values = [cursorBg, dirtyFg, selectedBg, invalidBg];
  expect(new Set(values).size, `role colours ${JSON.stringify(values)} must be distinct`).toBe(4);
});
