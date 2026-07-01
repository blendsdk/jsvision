/**
 * Specification tests (immutable oracles) — RD-11 `ScrollBar` (03-02).
 *
 * Source: jsvision-ui/RD-11 AC-1 → ST-01/ST-02 (containers-scrolling-lists/07-testing-strategy.md).
 * TV source of truth: `TScrollBar` — `source/tvision/tscrlbar.cpp` (`draw`/`drawPos:65`, `getPos:89`,
 * `getSize:97`, `getPartCode:114`, `scrollStep:283`, wheel `:148/:169`), glyphs `tvtext1.cpp:113-114`
 * (`vChars={▲,▼,▒,■,▓}`, `hChars={◄,►,▒,■,▓}`), palette `cpScrollBar="\x04\x05\x05"` (all → gray-dialog
 * `0x13` cyan-on-blue). Expectations derive from that decode + the ACs, NEVER from the implementation.
 *
 * Real `View`/`RenderRoot`/`EventLoop` over fixed truecolor `caps`; buffers read pre-`serialize`.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, PALETTE } from '@jsvision/core';
import type { MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { createRenderRoot } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ScrollBar } from '../src/scroll/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

// Glyphs (tvtext1.cpp:113-114), CP437 → unambiguous-narrow Unicode.
const UP = '▲';
const DOWN = '▼';
const LEFT = '◄';
const RIGHT = '►';
const TRACK = '▒';
const THUMB = '■';
const DISABLED = '▓';

// ST-01 / AC-1 — a vertical bar renders arrows at the two ends, a ▒ track between, and the ■ thumb at
// the exact TV `getPos()` for value = min / mid / max; `max==min` fills the whole track with ▓. All
// cells are cyan-on-blue (cpScrollBar → 0x13; controls == page in a gray dialog).
test('ST-01: vertical ScrollBar draws arrows + track + thumb at getPos()', () => {
  // H=8 ⇒ getSize()=8, s=7. min=0,max=10: getPos(min)= (0*5+5)/10+1 = 1; getPos(max)= (50+5)/10+1 = 6.
  const value = signal(0);
  const bar = new ScrollBar({ value, min: 0, max: 10 });
  const rr = createRenderRoot({ width: 1, height: 8 }, { caps });
  rr.mount(bar);
  let buf = rr.buffer();

  expect(buf.get(0, 0)?.char).toBe(UP); // start arrow @ row 0
  expect(buf.get(0, 7)?.char).toBe(DOWN); // end arrow @ row H-1
  expect(buf.get(0, 2)?.char).toBe(TRACK); // track between
  expect(buf.get(0, 1)?.char).toBe(THUMB); // thumb @ getPos(min)=1

  // Colours: cyan-on-blue everywhere (controls + page share 0x13).
  expect(buf.get(0, 0)?.fg).toBe(PALETTE.cyan);
  expect(buf.get(0, 0)?.bg).toBe(PALETTE.blue);
  expect(buf.get(0, 1)?.fg).toBe(defaultTheme.scrollBarControls.fg);
  expect(buf.get(0, 2)?.fg).toBe(defaultTheme.scrollBarPage.fg);

  // value = max ⇒ thumb at row 6 (getSize()-2).
  value.set(10);
  rr.flush();
  buf = rr.buffer();
  expect(buf.get(0, 6)?.char).toBe(THUMB);
  expect(buf.get(0, 1)?.char).toBe(TRACK);

  // mid value = 5 ⇒ getPos = (25+5)/10+1 = 4.
  value.set(5);
  rr.flush();
  expect(rr.buffer().get(0, 4)?.char).toBe(THUMB);
});

test('ST-01: max==min fills the track with the disabled ▓ glyph (no thumb)', () => {
  const value = signal(0);
  const bar = new ScrollBar({ value, min: 0, max: 0 });
  const rr = createRenderRoot({ width: 1, height: 8 }, { caps });
  rr.mount(bar);
  const buf = rr.buffer();
  expect(buf.get(0, 0)?.char).toBe(UP);
  expect(buf.get(0, 7)?.char).toBe(DOWN);
  for (let y = 1; y <= 6; y += 1) expect(buf.get(0, y)?.char, `row ${y}`).toBe(DISABLED);
});

// ST-02 / AC-1 — clicking the start arrow steps −arrowStep; clicking the page area past the thumb steps
// +pageStep; both clamp to [min,max]. A horizontal bar mirrors with ◄/►.
test('ST-02: arrow-click steps ±arrowStep, page-click steps ±pageStep, clamped', () => {
  const value = signal(5);
  const bar = new ScrollBar({ value, min: 0, max: 10, arrowStep: 1, pageStep: 3 });
  const loop = createEventLoop({ width: 1, height: 8 }, { caps });
  loop.mount(bar);

  // Click the top arrow (row 0, 1-based y=1) ⇒ value 5 → 4.
  loop.dispatch(mouse('down', 1, 1));
  loop.dispatch(mouse('up', 1, 1));
  expect(value()).toBe(4);

  // Click the page area below the thumb (row 6, 1-based y=7; thumb pos ~4, s=7) ⇒ +pageStep 3 → 7.
  loop.dispatch(mouse('down', 1, 7));
  loop.dispatch(mouse('up', 1, 7));
  expect(value()).toBe(7);

  // Repeated page-down clamps at max=10 (7 → 10, not 13).
  loop.dispatch(mouse('down', 1, 7));
  loop.dispatch(mouse('up', 1, 7));
  expect(value()).toBe(10);
});

test('ST-02: horizontal ScrollBar draws ◄/► and steps on the x axis', () => {
  const value = signal(5);
  const bar = new ScrollBar({ value, min: 0, max: 10, arrowStep: 1, orientation: 'horizontal' });
  const rr = createRenderRoot({ width: 8, height: 1 }, { caps });
  rr.mount(bar);
  const buf = rr.buffer();
  expect(buf.get(0, 0)?.char).toBe(LEFT); // ◄ start
  expect(buf.get(7, 0)?.char).toBe(RIGHT); // ► end

  // Click the left arrow (col 0, 1-based x=1) ⇒ value 5 → 4.
  const loop = createEventLoop({ width: 8, height: 1 }, { caps });
  loop.mount(bar);
  loop.dispatch(mouse('down', 1, 1));
  loop.dispatch(mouse('up', 1, 1));
  expect(value()).toBe(4);
});
