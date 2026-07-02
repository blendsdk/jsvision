/**
 * Specification tests (immutable oracles) — RD-07 `MultiCheckGroup` (ST-11…ST-12).
 *
 * Source: jsvision-ui RD-07 AC-9/AC-10 → ST-11/ST-12 (essential-control-completions/07). TV source:
 * `TMultiCheckBoxes` (`tmulchkb.cpp:65-103`) + `TCluster::drawMultiBox` (`tcluster.cpp:87-129`): the
 * 5-cell `" [ ] "` box, marker `states[multiMark(i)]` at col 2, label at col 5, `press` cycles
 * `(state+1) % selRange`. Binding modernized to a `Signal<number[]>` (PA-10). Expectations derive from
 * TV + the RD ACs, never from the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
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

// ST-11 / AC-9 — Space cycles the item state through `states`, wrapping; the bound signal reflects it.
test('ST-11: Space cycles value[i] through states (0→1→2→0); ↑↓ move focus', () => {
  const value = signal([0, 0, 0]);
  const mcg = new MultiCheckGroup({ items: ['A', 'B', 'C'], states: ' xX', value });
  const { loop } = mount(mcg);

  loop.dispatch(key('space')); // focused item 0: 0 → 1
  expect(value()[0]).toBe(1);
  loop.dispatch(key('space')); // 1 → 2
  expect(value()[0]).toBe(2);
  loop.dispatch(key('space')); // 2 → 0 (wraps, selRange 3)
  expect(value()[0]).toBe(0);

  loop.dispatch(key('down')); // focus item 1
  loop.dispatch(key('space')); // item 1: 0 → 1
  expect(value()).toEqual([0, 1, 0]);
});

test('ST-11: disabled items are skipped by ↑↓ and inert to Space', () => {
  const value = signal([0, 0, 0]);
  const mcg = new MultiCheckGroup({ items: ['A', 'B', 'C'], states: ' xX', value });
  mcg.setItemEnabled(1, false); // disable the middle item
  const { loop } = mount(mcg);
  loop.dispatch(key('down')); // from item 0 → skips disabled 1 → item 2
  loop.dispatch(key('space')); // cycles item 2
  expect(value()).toEqual([0, 0, 1]);
});

// ST-12 / AC-10 — faithful visual: " [ ] " box, marker states[value[i]] at col 2, label at col 5.
test('ST-12: renders " [ ] " with states[value[i]] at col 2 and the label at col 5', () => {
  const value = signal([2, 1, 0]);
  const mcg = new MultiCheckGroup({ items: ['Ab', 'Cd', 'Ef'], states: ' xX', value });
  const { loop } = mount(mcg);
  const buf = loop.renderRoot.buffer();
  const at = (x: number, y: number) => buf.get(x, y)?.char;
  // Row 0 (value 2 → 'X'): " [ ] " with 'X' at col 2, label "Ab" from col 5.
  expect(at(1, 0)).toBe('[');
  expect(at(2, 0)).toBe('X'); // states[2]
  expect(at(3, 0)).toBe(']');
  expect(at(5, 0)).toBe('A');
  expect(at(6, 0)).toBe('b');
  // Row 1 (value 1 → 'x'); row 2 (value 0 → ' ').
  expect(at(2, 1)).toBe('x'); // states[1]
  expect(at(2, 2)).toBe(' '); // states[0]
});

test('ST-12: the focused item draws in the clusterSelected role', () => {
  const value = signal([0, 0, 0]);
  const mcg = new MultiCheckGroup({ items: ['A', 'B', 'C'], states: ' xX', value });
  const { loop } = mount(mcg);
  const buf = loop.renderRoot.buffer();
  expect(buf.get(1, 0)?.bg).toBe(defaultTheme.clusterSelected.bg); // focused item 0
  expect(buf.get(1, 1)?.bg).toBe(defaultTheme.clusterNormal.bg); // unfocused item 1
});
