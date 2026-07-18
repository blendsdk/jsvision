/**
 * Specification tests (immutable oracles) — accessibility & degradation golden coverage (ST-2, ST-3),
 * proven end-to-end through a real terminal emulator (`@xterm/headless`, reusing core's golden harness).
 *
 *  - ST-2 (NO_COLOR / mono, default theme): every role cell emits NO colour (fg + bg both resolve to the
 *    terminal default) and the render path stays intact (glyphs present, no crash). There is deliberately
 *    NO `reverseState()` assertion: the default grid roles convey state by COLOUR, not by the inverse
 *    attribute, so under mono they collapse to default — that is the expected, correct behaviour, and
 *    AC-3 requires only "render correctly" under NO_COLOR. (Distinguishing state without colour is the
 *    job of the separate `monochromeTheme` producer, an optional follow-on, not this closeout.)
 *  - ST-3 (ASCII floor, `glyphs:{ boxDrawing:false, ambiguousWide:true }`): the grid's own non-ASCII
 *    chrome degrades to ASCII — box-drawing (`┌→'+'`, `─→'-'`, `│→'|'`), the fg-only dirty marker
 *    (`•→'*'`), and the ambiguous-width sort arrows (`▲→'^'`, `▼→'v'`) — and no chrome cell survives
 *    holding a non-ASCII glyph. The fixture excludes the funnel `▽` and the unloaded `…`, which have no
 *    core ASCII fallback today (a known limitation); user data text is out of the ASCII-floor scope and
 *    is kept ASCII here so any surviving non-ASCII cell is a real chrome-fallback gap.
 *
 * Expectations derive from the RD-05 mono / glyph-fallback contracts, never from the rendered output.
 * This spec imports core's cross-package golden harness by workspace-relative path; that resolves at
 * run time (vitest/tsx, NodeNext) but is excluded from datagrid's typecheck (see tsconfig.typecheck).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, serialize } from '@jsvision/core';
import type { ColorDepth, RenderOptions } from '@jsvision/core';
import { feed, makeTerm, readCell } from '../../core/test/golden-screen-helpers.js';
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

// ST-2 — NO_COLOR / mono under the default theme: no colour emitted, render intact.
test('ST-2: under mono/NO_COLOR every role cell emits no colour and the render stays intact', async () => {
  const g = buildGoldenGrid();
  const term = makeTerm(g.width, g.height);
  // NO_COLOR resolves to the mono depth; pinning colorDepth:'mono' selects the same path deterministically.
  await feed(term, serialize(g.buffer, null, optsFor('mono')));

  for (const [name, c] of Object.entries(g.cells)) {
    const cell = readCell(term, c.x, c.y);
    expect(cell.fg.mode, `${name} fg is uncoloured under mono`).toBe('default');
    expect(cell.bg.mode, `${name} bg is uncoloured under mono`).toBe('default');
  }

  // Render intact: the scene still paints (not blank, no crash). The mono profile drops colour AND,
  // on this capability, box-drawing glyphs (`┌`→`+`) — so "intact" is a painted-cell count, not a
  // specific glyph. The frame + header + body together fill well over 20 non-blank cells.
  let painted = 0;
  for (let y = 0; y < g.height; y += 1) {
    for (let x = 0; x < g.width; x += 1) {
      const ch = readCell(term, x, y).char;
      if (ch !== '' && ch !== ' ') painted += 1;
    }
  }
  expect(painted, 'the scene renders (not blank) under mono').toBeGreaterThan(20);
});

// ST-3 — the ASCII floor: box-drawing + ambiguous-width decorative glyphs degrade, nothing non-ASCII survives.
test('ST-3: under the ASCII floor the grid chrome degrades to legible ASCII', async () => {
  const g = buildGoldenGrid();
  const opts = optsFor('truecolor', { glyphs: { boxDrawing: false, ambiguousWide: true } });
  const term = makeTerm(g.width, g.height);
  await feed(term, serialize(g.buffer, null, opts));

  // Box-drawing frame chrome.
  expect(readCell(term, g.frame.corner.x, g.frame.corner.y).char).toBe('+');
  expect(readCell(term, g.frame.topEdge.x, g.frame.topEdge.y).char).toBe('-');
  expect(readCell(term, g.frame.leftEdge.x, g.frame.leftEdge.y).char).toBe('|');

  // The fg-only dirty marker (`•`) degrades.
  expect(readCell(term, g.cells.dirty.x, g.cells.dirty.y).char).toBe('*');

  // The ambiguous-width sort arrows degrade to `^` / `v`. Positions come from the raw pre-serialize
  // buffer (robust to header layout), asserting each arrow reads its documented fallback.
  const arrows: { x: number; y: number; ascii: string }[] = [];
  for (let y = 0; y < g.height; y += 1) {
    for (let x = 0; x < g.width; x += 1) {
      const ch = g.buffer.get(x, y)?.char;
      if (ch === '▲') arrows.push({ x, y, ascii: '^' });
      if (ch === '▼') arrows.push({ x, y, ascii: 'v' });
    }
  }
  expect(arrows.length, 'the fixture must paint both sort arrows').toBeGreaterThanOrEqual(2);
  for (const a of arrows) {
    expect(readCell(term, a.x, a.y).char, `arrow at (${a.x},${a.y})`).toBe(a.ascii);
  }

  // Whole-frame scan: no cell holds a non-ASCII glyph (empty cells and wide continuations read '').
  for (let y = 0; y < g.height; y += 1) {
    for (let x = 0; x < g.width; x += 1) {
      const ch = readCell(term, x, y).char;
      if (ch === '') continue;
      const cp = ch.codePointAt(0) ?? 0;
      expect(cp <= 0x7f, `non-ASCII glyph ${JSON.stringify(ch)} survived at (${x},${y})`).toBeTruthy();
    }
  }
});
