/**
 * Implementation tests — `Slider` internals & edges.
 *
 * Covers vertical drag with pointer capture, the release ending a gesture with exactly one `onChange`,
 * the dragging flag clearing on release (a stray drag afterward is inert), `measure()` for both
 * orientations, the `pageStep` default and PgUp/PgDn, vertical arrow direction, and an out-of-range
 * external write clamped on render. Real `View`/`EventLoop`; the `.js` extension is required by
 * NodeNext resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Slider } from '../src/controls/slider.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

interface Harness {
  slider: Slider;
  loop: ReturnType<typeof createEventLoop>;
  value: Signal<number>;
  inputs: number[];
  commits: number[];
}

function make(opts: {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  pageStep?: number;
  orientation?: 'horizontal' | 'vertical';
  width: number;
  height: number;
  focus?: boolean;
}): Harness {
  const value = signal(opts.value ?? 0);
  const inputs: number[] = [];
  const commits: number[] = [];
  const slider = new Slider({
    value,
    min: opts.min ?? 0,
    max: opts.max ?? 100,
    step: opts.step,
    pageStep: opts.pageStep,
    orientation: opts.orientation ?? 'horizontal',
    onInput: (v) => inputs.push(v),
    onChange: (v) => commits.push(v),
  });
  slider.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: opts.width, height: opts.height } });
  const root = new Group();
  root.add(slider);
  const loop = createEventLoop({ width: opts.width, height: opts.height }, { caps });
  loop.mount(root);
  if (opts.focus) loop.focusView(slider);
  loop.renderRoot.flush();
  return { slider, loop, value, inputs, commits };
}

test('vertical drag maps the row to the value and tracks continuously', () => {
  const h = make({ value: 0, min: 0, max: 100, orientation: 'vertical', width: 1, height: 11, focus: true });
  h.loop.dispatch(mouse('down', 1, 11)); // 1-based row 11 → local y=10 (last) → max
  expect(h.value()).toBe(100);
  h.loop.dispatch(mouse('drag', 1, 6)); // local y=5 → centre → 50
  expect(h.value()).toBe(50);
  h.loop.dispatch(mouse('up', 1, 6));
  expect(h.commits, 'one commit for the whole gesture').toEqual([50]);
});

test('release clears the dragging flag — a later stray drag is inert', () => {
  const h = make({ value: 0, min: 0, max: 100, width: 11, height: 1, focus: true });
  h.loop.dispatch(mouse('down', 6, 1)); // → 50
  h.loop.dispatch(mouse('up', 6, 1));
  const commitsAfter = h.commits.length;
  h.loop.dispatch(mouse('drag', 11, 1)); // no active gesture → ignored
  expect(h.value(), 'stray drag after release does not move the value').toBe(50);
  expect(h.commits.length, 'no extra commit').toBe(commitsAfter);
});

test('measure() advertises a 1-cell cross axis for both orientations', () => {
  const hor = make({ width: 20, height: 1 });
  expect(hor.slider.measure().height).toBe(1);
  expect(hor.slider.measure().width).toBeGreaterThan(1);
  const ver = make({ orientation: 'vertical', width: 1, height: 20 });
  expect(ver.slider.measure().width).toBe(1);
  expect(ver.slider.measure().height).toBeGreaterThan(1);
});

test('the pageStep default is round((max-min)/10); PgDn/PgUp step by it', () => {
  const h = make({ value: 50, min: 0, max: 100, width: 11, height: 1, focus: true }); // default pageStep = 10
  h.loop.dispatch(keyEvent('pagedown'));
  expect(h.value(), 'PgDn +10').toBe(60);
  h.loop.dispatch(keyEvent('pageup'));
  h.loop.dispatch(keyEvent('pageup'));
  expect(h.value(), 'PgUp −10 twice').toBe(40);
});

test('vertical arrows: Down increases, Up decreases (toward the groove end = larger value)', () => {
  const h = make({ value: 50, min: 0, max: 100, step: 5, orientation: 'vertical', width: 1, height: 11, focus: true });
  h.loop.dispatch(keyEvent('down'));
  expect(h.value(), 'Down +step on a vertical slider').toBe(55);
  h.loop.dispatch(keyEvent('up'));
  h.loop.dispatch(keyEvent('up'));
  expect(h.value(), 'Up −step').toBe(45);
});

test('an out-of-range external write renders clamped (thumb stays on the groove)', () => {
  const h = make({ value: 0, min: 0, max: 100, width: 11, height: 1 });
  h.value.set(9999); // forced out of range
  h.loop.renderRoot.flush();
  // clamps to max → thumb at the last cell (offset 10), never past the groove.
  expect(h.loop.renderRoot.buffer().get(10, 0)?.char).toBe('█');
});

test('select(value) commits programmatically (onInput + onChange), clamped', () => {
  const h = make({ value: 0, min: 0, max: 100, width: 11, height: 1 });
  h.slider.select(250);
  expect(h.value()).toBe(100);
  expect(h.inputs.at(-1)).toBe(100);
  expect(h.commits.at(-1)).toBe(100);
});
