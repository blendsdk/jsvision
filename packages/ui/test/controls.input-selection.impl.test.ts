/**
 * Implementation tests — RD-07 `Input` selection internals + edges (P1.4). Boundaries the ST-01…04
 * oracles don't pin: caret at the value ends, maxLength on a selection-replace, firstPos scroll with
 * a selection, word-nav edges, selectAll(false), and the code-unit (DEF-21) treatment of a wide glyph.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, filter } from '../src/controls/index.js';
import { prevWord, nextWord, selectionBlock, mousePos } from '../src/controls/input-selection.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}
function mountInput(opts: ConstructorParameters<typeof Input>[0], w = 15) {
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

// --- Pure helpers (input-selection.ts) --------------------------------------------------------------
test('selectionBlock orders caret + anchor into [start, end]', () => {
  expect(selectionBlock(5, 2)).toEqual({ start: 2, end: 5 });
  expect(selectionBlock(2, 5)).toEqual({ start: 2, end: 5 });
  expect(selectionBlock(3, 3)).toEqual({ start: 3, end: 3 });
});

test('prevWord/nextWord are space-delimited (PA-12) with clamped ends', () => {
  const s = 'aa bb cc';
  expect(nextWord(s, 0)).toBe(3); // start of "bb"
  expect(nextWord(s, 3)).toBe(6); // start of "cc"
  expect(nextWord(s, 6)).toBe(s.length); // none right → length
  expect(prevWord(s, 8)).toBe(6); // start of "cc"
  expect(prevWord(s, 6)).toBe(3); // start of "bb"
  expect(prevWord(s, 2)).toBe(0); // none left → 0
});

test('mousePos clamps col 0 to the gutter and the result to the value bounds', () => {
  expect(mousePos(0, 0, 10)).toBe(0); // col 0 → max(0,1)+0-1 = 0
  expect(mousePos(3, 0, 10)).toBe(2); // col 3 → offset 2
  expect(mousePos(3, 4, 10)).toBe(6); // + firstPos 4
  expect(mousePos(99, 0, 5)).toBe(5); // clamped to length
});

// --- Edges ------------------------------------------------------------------------------------------
test('Shift+Left at curPos 0 leaves an empty selection (caret clamps at the start)', () => {
  const value = signal('abc');
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('left', { shift: true })); // already at 0
  expect(input.caretPos).toBe(0);
  expect(input.selection.start).toBe(input.selection.end);
});

test('Shift+End then Shift+Right at the end does not overrun the value length', () => {
  const value = signal('abc');
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('end', { shift: true }));
  loop.dispatch(key('right', { shift: true })); // at end → no-op
  expect(input.selection).toEqual({ start: 0, end: 3 });
});

test('typing over a full selection respects maxLength measured AFTER the delete', () => {
  const value = signal('abc');
  const { loop, input } = mountInput({ value, maxLength: 3 });
  loop.dispatch(key('a', { ctrl: true })); // select all "abc"
  loop.dispatch(key('X')); // deleteSelect → "" then insert → "X" (1 ≤ 3)
  expect(value()).toBe('X');
  expect(input.caretPos).toBe(1);
});

test('a live filter still rejects an invalid char typed over a selection (selection deleted first)', () => {
  const value = signal('12');
  const { loop } = mountInput({ value, validator: filter('0-9') });
  loop.dispatch(key('a', { ctrl: true })); // select "12"
  loop.dispatch(key('x')); // not a digit → deleteSelect makes "", insert rejected → stays ""
  expect(value()).toBe('');
});

test('Delete with an empty selection removes the code point under the caret', () => {
  const value = signal('abc');
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('delete')); // caret 0 → remove 'a'
  expect(value()).toBe('bc');
  expect(input.caretPos).toBe(0);
});

test('firstPos scroll is preserved while extending a selection past the right edge', () => {
  const value = signal('abcdefghij');
  const { loop, input } = mountInput({ value }, 6); // narrow field
  loop.dispatch(key('end', { shift: true })); // select to end; firstPos scrolls
  expect(input.selection).toEqual({ start: 0, end: 10 });
  // The right edge is visible: no ► (caret is at the end, nothing beyond).
  expect(loop.renderRoot.buffer().get(0, 0)?.char).toBe('◄'); // ◄ shown (scrolled)
});

test('mouse press collapses any prior selection before starting a new drag', () => {
  const value = signal('hello world');
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true })); // select all
  loop.dispatch(mouse('down', 3, 0)); // press → collapse + anchor at offset 2
  expect(input.selection.start).toBe(input.selection.end); // collapsed on press
  expect(input.caretPos).toBe(2);
});

test('a wide glyph counts as one code-unit caret step (v1 code-unit; width-awareness is DEF-21)', () => {
  const value = signal('世界'); // 世界 — each display-width 2, but code-unit indexed
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('right')); // one code-unit step
  expect(input.caretPos).toBe(1);
  loop.dispatch(key('right'));
  expect(input.caretPos).toBe(2); // at end after two steps (not 4 display columns)
});
