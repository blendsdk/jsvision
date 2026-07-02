/**
 * Implementation tests — RD-07 logical caret internals + edges (P1.4). The ST-13 oracle pins the
 * caret position + reversed style; these cover the caret at the value end (space glyph), the
 * caret-vs-`►` right-edge overlap (PF-008 — the caret preserves the arrow glyph, reversing colours),
 * and `desiredCaret()` returning `null` off-screen / unfocused.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}
/** A subclass exposing `desiredCaret()` (already public via View) + mounting helper. */
function mountInput(opts: ConstructorParameters<typeof Input>[0], w = 10) {
  const input = new Input(opts);
  const stub = new FocusStub();
  const root = new Group();
  root.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  stub.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: w, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  return { loop, input, stub };
}

test('the caret at the value end paints a reversed space (no char beyond the end)', () => {
  const value = signal('ab');
  const { loop } = mountInput({ value }, 10);
  loop.dispatch(key('end')); // curPos 2 (== length) → caret col 3, no char there
  const buf = loop.renderRoot.buffer();
  expect(buf.get(3, 0)?.char).toBe(' ');
  expect(buf.get(3, 0)?.bg).toBe(defaultTheme.inputSelected.fg); // reversed → bg = field.fg
});

// PF-008 — caret coincides with the ► arrow column: the arrow glyph is preserved, colours reversed.
test('PF-008: the caret over the ► column preserves ► and reverses its colours', () => {
  const value = signal('123456789');
  const { loop } = mountInput({ value }, 6);
  for (let i = 0; i < 4; i++) loop.dispatch(key('right')); // curPos 4, firstPos 0 → caret col 5 (== w-1)
  const buf = loop.renderRoot.buffer();
  expect(buf.get(5, 0)?.char).toBe('►'); // arrow glyph kept (not erased by the caret)
  expect(buf.get(5, 0)?.bg).toBe(defaultTheme.inputSelected.fg); // reversed caret colours
});

test('desiredCaret() returns the view-local caret cell when focused, null when unfocused', () => {
  const value = signal('abcd');
  const { loop, input, stub } = mountInput({ value }, 10);
  loop.dispatch(key('right')); // curPos 1 → caret col 2
  expect(input.desiredCaret()).toEqual({ x: 2, y: 0 });
  loop.focusView(stub);
  expect(input.desiredCaret()).toBeNull();
});

test('desiredCaret() returns null when the caret scrolls out of the field width', () => {
  const value = signal('123456789');
  const { loop, input } = mountInput({ value }, 6);
  // Scroll right via ► clicks while the caret stays at 0 → caret col can leave [0, w). Simulate by
  // clicking the ► arrow twice (firstPos advances, curPos stays 0 → caret col 0-firstPos+1 goes < 0).
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 6, y: 1 }); // firstPos 1
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 6, y: 1 }); // firstPos 2 → caret col -1
  expect(input.desiredCaret()).toBeNull();
});
