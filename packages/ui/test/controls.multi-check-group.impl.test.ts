/**
 * Implementation tests — RD-07 `MultiCheckGroup` internals + edges (P4.4): single-state cycle, hotkey
 * activation, ↑↓ wrap, short/normalized bound arrays, and out-of-range state clamping.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { MultiCheckGroup } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}
function mount(mcg: MultiCheckGroup, rows = 3) {
  const stub = new FocusStub();
  const root = new Group();
  root.layout = { direction: 'col' };
  mcg.layout = { size: { kind: 'fixed', cells: rows } };
  stub.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(mcg);
  root.add(stub);
  const loop = createEventLoop({ width: 20, height: rows + 1 }, { caps });
  loop.mount(root);
  loop.focusView(mcg);
  return { loop };
}

test('single-state (selRange 1): Space keeps state 0', () => {
  const value = signal([0, 0]);
  const mcg = new MultiCheckGroup({ items: ['A', 'B'], states: 'o', value }); // one state
  const { loop } = mount(mcg, 2);
  loop.dispatch(key('space'));
  expect(value()[0]).toBe(0); // (0+1) % 1 = 0
});

test('Alt-<hotkey> focuses + cycles the matching item', () => {
  const value = signal([0, 0, 0]);
  const mcg = new MultiCheckGroup({ items: ['~A~lpha', '~B~eta', '~C~harlie'], states: ' xX', value });
  const { loop } = mount(mcg);
  loop.dispatch(key('c', { alt: true })); // Alt-C → item 2
  expect(value()).toEqual([0, 0, 1]);
});

test('↑↓ wrap around the ends', () => {
  const value = signal([0, 0, 0]);
  const mcg = new MultiCheckGroup({ items: ['A', 'B', 'C'], states: ' xX', value });
  const { loop } = mount(mcg);
  loop.dispatch(key('up')); // from item 0 wraps to item 2
  loop.dispatch(key('space'));
  expect(value()).toEqual([0, 0, 1]);
});

test('a short bound array is normalized to full length on press', () => {
  const value = signal<number[]>([]); // shorter than items
  const mcg = new MultiCheckGroup({ items: ['A', 'B', 'C'], states: ' xX', value });
  const { loop } = mount(mcg);
  loop.dispatch(key('down')); // item 1
  loop.dispatch(key('space')); // cycle item 1
  expect(value()).toEqual([0, 1, 0]); // full-length array written
});

test('an out-of-range state index clamps to 0 when rendering the marker', () => {
  const value = signal([9, 0, 0]); // 9 is out of range for selRange 3
  const mcg = new MultiCheckGroup({ items: ['A', 'B', 'C'], states: ' xX', value });
  const { loop } = mount(mcg);
  const buf = loop.renderRoot.buffer();
  expect(buf.get(2, 0)?.char).toBe(' '); // clamped to states[0] = ' '
});
