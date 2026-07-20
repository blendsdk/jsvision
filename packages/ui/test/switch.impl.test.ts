/**
 * Implementation tests (edges/internals, after the switch spec is green): `Enter` toggling, the
 * disabled control ignoring a click, wheel being ignored, `onLabel`/`offLabel` omission, the caption
 * `accelerators()` seam, and `select()` behaviour. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent, WheelEvent as CoreWheelEvent } from '@jsvision/core';
import { Switch } from '../src/controls/index.js';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}
function wheel(dir: 'up' | 'down', x: number, y: number): CoreWheelEvent {
  return { type: 'wheel', dir, x, y, shift: false, alt: false, ctrl: false };
}

function hosted(sw: Switch, _value: Signal<boolean>, w = 24, h = 1, focus = true) {
  sw.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(sw);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  if (focus) loop.focusView(sw);
  return { loop, buf: () => loop.renderRoot.buffer() };
}

test('Enter toggles while focused', () => {
  const value = signal(false);
  const { loop } = hosted(new Switch({ value }), value);
  loop.dispatch(key('enter'));
  expect(value()).toBe(true);
});

test('a disabled switch ignores a click (no toggle)', () => {
  const value = signal(false);
  const { loop } = hosted(new Switch({ value, disabled: true }), value);
  loop.dispatch(mouse('down', 2, 1));
  loop.dispatch(mouse('up', 2, 1));
  expect(value()).toBe(false);
});

test('the wheel is not a toggle gesture (unlike Slider)', () => {
  const value = signal(false);
  const { loop } = hosted(new Switch({ value }), value);
  loop.dispatch(wheel('up', 2, 1));
  loop.dispatch(wheel('down', 2, 1));
  expect(value()).toBe(false);
});

test("onLabel/offLabel = '' omit the word; measure() drops its width", () => {
  const value = signal(false);
  const sized = new Switch({ value, onLabel: '', offLabel: '' }).measure?.();
  expect(sized?.width).toBe(6); // just the track
  // A rendered switch with hidden words shows no On/Off text past the track.
  const { buf } = hosted(new Switch({ value, onLabel: '', offLabel: '' }), value, 24);
  const b = buf();
  let bracketEnd = -1;
  for (let x = 0; x < 24; x += 1) if (b.get(x, 0)?.char === ']') bracketEnd = x;
  for (let x = bracketEnd + 1; x < 24; x += 1) expect(b.get(x, 0)?.char).toBe(' ');
});

test('the caption accelerators() feeds the duplicate-accelerator check; unmarked reports none', () => {
  expect(new Switch({ value: signal(false), label: '~A~irplane' }).accelerators()).toEqual(['a']);
  expect(new Switch({ value: signal(false), label: 'Plain' }).accelerators()).toEqual([]);
  expect(new Switch({ value: signal(false) }).accelerators()).toEqual([]);
});

test('select() sets the value and is a no-op when disabled', () => {
  const on = signal(false);
  const sw = new Switch({ value: on });
  sw.select(true);
  expect(on()).toBe(true);

  const off = signal(false);
  const dis = new Switch({ value: off, disabled: true });
  dis.select(true);
  expect(off()).toBe(false); // disabled ignores programmatic select
});

test('an Alt-hotkey does nothing when the switch is disabled', () => {
  const value = signal(false);
  const { loop } = hosted(new Switch({ value, label: '~A~irplane', disabled: true }), value, 24, 1, false);
  loop.dispatch(key('a', { alt: true }));
  expect(value()).toBe(false);
});
