/**
 * Implementation tests — RD-11 `ScrollBar` internals & edges (03-02).
 *
 * Covers `getPos` rounding at boundaries + mid, the `getSize` floor to 3, the wheel `±3·arrowStep`
 * step, proportional thumb-drag mapping (captured), disabled (`max==min`) hit-zones as no-ops, and
 * the security clamp (a forced out-of-range `value` can't push the thumb past the ends). Real
 * `View`/`RenderRoot`/`EventLoop`, buffers read pre-`serialize`. The `.js` extension is required by
 * NodeNext resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent as CoreMouseEvent, WheelEvent as CoreWheelEvent } from '@jsvision/core';
import { createRenderRoot } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ScrollBar } from '../src/scroll/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const THUMB = '■';

function mouse(kind: 'down' | 'up' | 'move', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}
function wheel(dir: 'up' | 'down' | 'left' | 'right', x: number, y: number): CoreWheelEvent {
  return { type: 'wheel', dir, x, y };
}

// getPos mid-range rounds via `+ r/2` (TV `tscrlbar.cpp:89`). H=10 ⇒ getSize=10; min0 max100 value33 ⇒
// pos = floor((33*7 + 50)/100) + 1 = 3.
test('getPos rounds a mid value with the +r/2 bias', () => {
  const value = signal(33);
  const bar = new ScrollBar({ value, min: 0, max: 100 });
  const rr = createRenderRoot({ width: 1, height: 10 }, { caps });
  rr.mount(bar);
  expect(rr.buffer().get(0, 3)?.char).toBe(THUMB);
});

// getSize() floors to 3: a height-3 bar has exactly one track cell; getPos clamps the thumb to row 1
// for any value (`getSize()-2 == 1`).
test('getSize floors to 3 — the thumb pins to row 1 on a height-3 bar', () => {
  const value = signal(10);
  const bar = new ScrollBar({ value, min: 0, max: 10 });
  const rr = createRenderRoot({ width: 1, height: 3 }, { caps });
  rr.mount(bar);
  expect(rr.buffer().get(0, 1)?.char).toBe(THUMB);
});

// Wheel steps 3·arrowStep on the matching axis (TV `:169`).
test('wheel-down steps +3·arrowStep on a vertical bar', () => {
  const value = signal(0);
  const bar = new ScrollBar({ value, min: 0, max: 100, arrowStep: 2 });
  const loop = createEventLoop({ width: 1, height: 8 }, { caps });
  loop.mount(bar);
  loop.dispatch(wheel('down', 1, 1));
  expect(value()).toBe(6); // 3 · 2
});

test('wheel on the cross axis is ignored (horizontal bar ignores up/down)', () => {
  const value = signal(10);
  const bar = new ScrollBar({ value, min: 0, max: 100, orientation: 'horizontal' });
  const loop = createEventLoop({ width: 8, height: 1 }, { caps });
  loop.mount(bar);
  loop.dispatch(wheel('down', 1, 1));
  expect(value()).toBe(10); // unchanged — horizontal consumes left/right only
});

// Thumb-drag maps the axis position back to a proportional value (TV `:200`), via pointer capture.
test('thumb-drag maps the axis position to a proportional value', () => {
  const value = signal(0);
  const bar = new ScrollBar({ value, min: 0, max: 10 }); // H=8 ⇒ s=7, thumb(min) @ row 1
  const loop = createEventLoop({ width: 1, height: 8 }, { caps });
  loop.mount(bar);
  // Grab the thumb (local row 1 ⇒ 1-based y=2), then drag to local row 4 (y=5).
  loop.dispatch(mouse('down', 1, 2));
  loop.dispatch(mouse('move', 1, 5));
  // ((4-1)*10 + ((7-2)>>1)) / (7-2) = (30+2)/5 = 6.
  expect(value()).toBe(6);
  loop.dispatch(mouse('up', 1, 5));
});

// Disabled bar (max==min): every click is a no-op (value stays pinned).
test('disabled bar (max==min) — clicks and drags are no-ops', () => {
  const value = signal(0);
  const bar = new ScrollBar({ value, min: 0, max: 0 });
  const loop = createEventLoop({ width: 1, height: 8 }, { caps });
  loop.mount(bar);
  loop.dispatch(mouse('down', 1, 1)); // top arrow
  loop.dispatch(mouse('up', 1, 1));
  loop.dispatch(mouse('down', 1, 4)); // page area
  loop.dispatch(mouse('up', 1, 4));
  expect(value()).toBe(0);
});

// Security: a forced out-of-range `value` is clamped on read — the thumb never leaves `[1,getSize-2]`.
test('security: an out-of-range value is clamped, thumb stays within the track', () => {
  const value = signal(9999);
  const bar = new ScrollBar({ value, min: 0, max: 10 });
  const rr = createRenderRoot({ width: 1, height: 8 }, { caps });
  rr.mount(bar);
  // value clamps to max=10 ⇒ thumb at getSize()-2 = 6 (not past the end arrow at row 7).
  expect(rr.buffer().get(0, 6)?.char).toBe(THUMB);
  expect(rr.buffer().get(0, 7)?.char).toBe('▼'); // end arrow intact
});
