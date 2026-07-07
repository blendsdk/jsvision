/**
 * Specification tests (immutable oracles) — RD-08 Phase-7 `Indicator` (ST-24/ST-25).
 *
 * Source: RD-08 AC-11 / PA-3 / PA-8 → ST-24/ST-25 (codeops/features/jsvision-ui/plans/
 * editor-family/07-testing-strategy.md; 03-04 §indicator.ts). TV decode (`tindictr.cpp:27-63`,
 * glyphs `tvtext1.cpp:83-84`): NOT dragging → `getColor(1)` `0x1F` white-on-blue + the
 * `dragFrame` `\xCD` **═** fill; dragging (`sfDragging`) → `getColor(2)` `0x1A`
 * brightGreen-on-blue + `normalFrame` `\xC4` **─**; `modified` ⇒ CP437 `\x0F` = **☼** at column
 * 0; the location `" line:col "` (1-based) right-aligned so the `:` sits at column 8
 * (`moveStr(8−…)`, `:63`). The drag source is the PA-3 reactive `Window.dragging` signal bound
 * via the window ancestor. Expectations derive from RD-08 + the decode, never the implementation.
 *
 * Trace: RD-08 03-04 · PA-3 / PA-8 · ST-24/ST-25.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Window } from '../src/window/index.js';
import { Indicator } from '../src/editor/indicator.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Mount a 14-wide indicator inside a (manager-less, active) Window on a loop. */
function mountIndicator() {
  const win = new Window('W');
  win.layout = { position: 'absolute', padding: 0, rect: { x: 0, y: 0, width: 20, height: 3 } };
  const ind = new Indicator();
  ind.layout = { position: 'absolute', rect: { x: 0, y: 1, width: 14, height: 1 } };
  win.add(ind);
  const root = new Group();
  root.add(win);
  const loop = createEventLoop({ width: 20, height: 3 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return { loop, win, ind };
}

function rowText(loop: ReturnType<typeof createEventLoop>, y: number, w: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = 0; x < w; x++) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

// ST-24 / AC-11 — location layout, the ☼ modified marker, the ═ resting fill + 0x1F colours.
test('ST-24: " 1:1 " and " 12:5 " sit right-aligned with the colon at column 8', () => {
  const { loop, ind } = mountIndicator();
  ind.setValue({ line: 1, col: 1 }, false);
  loop.renderRoot.flush();
  let row = rowText(loop, 1, 14);
  expect(row[8]).toBe(':'); // the colon column (decode :63)
  expect(row.slice(6, 11)).toBe(' 1:1 ');
  expect(row[0]).toBe('═'); // resting fill

  ind.setValue({ line: 12, col: 5 }, false);
  loop.renderRoot.flush();
  row = rowText(loop, 1, 14);
  expect(row[8]).toBe(':');
  expect(row.slice(5, 11)).toBe(' 12:5 ');
});

test('ST-24: the modified marker ☼ paints at column 0; colours are indicatorNormal 0x1F', () => {
  const { loop, ind } = mountIndicator();
  ind.setValue({ line: 3, col: 2 }, true);
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 1)?.char).toBe('☼'); // CP437 0x0F → U+263C (EAW-ambiguous: spans cols 0-1 here)
  expect(buf.get(2, 1)?.char).toBe('═'); // the fill resumes after the wide marker
  expect(buf.get(2, 1)?.fg).toBe(defaultTheme.indicatorNormal.fg);
  expect(buf.get(2, 1)?.bg).toBe(defaultTheme.indicatorNormal.bg);
});

// ST-25 / PA-3 — the ═↔─ drag swap bound to the window's reactive dragging signal.
test('ST-25: window.dragging flips the fill to ─ in indicatorDragging and back', () => {
  const { loop, win, ind } = mountIndicator();
  ind.setValue({ line: 1, col: 1 }, false);
  loop.renderRoot.flush();
  expect(rowText(loop, 1, 14)[0]).toBe('═');

  win.dragging.set(true);
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 1)?.char).toBe('─');
  expect(buf.get(0, 1)?.fg).toBe(defaultTheme.indicatorDragging.fg); // 0x1A brightGreen…
  expect(buf.get(0, 1)?.bg).toBe(defaultTheme.indicatorDragging.bg); // …on blue

  win.dragging.set(false);
  loop.renderRoot.flush();
  expect(rowText(loop, 1, 14)[0]).toBe('═');
});
