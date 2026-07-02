/**
 * Specification tests (immutable oracles) — RD-07 `Input` text selection (ST-01…ST-04).
 *
 * Source: jsvision-ui RD-07 AC-1/AC-2/AC-3 → ST-01…ST-04 (essential-control-completions/07). TV
 * source: `tinputli.cpp` selection machine — `adjustSelectBlock` (:225-237), shift-extension
 * (:339-359,456-459), word nav (:64-82, space-delimited PA-12), mouse (:312-338), selectAll
 * (:496-508), edit-over-selection (:380-446), selection band draw (:152-157, `getColor(3)` =
 * `inputSelection` 0x2F white-on-green). Unit = code point (PA-1). Expectations derive from TV +
 * the RD ACs, never from the implementation. Double-click is encoded as two consecutive same-cell
 * `down`s (PA-15 — the core mouse model has no double-click flag).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** 0-based local coords; the loop converts to 1-based on the way in (matches the desktop-spec helper). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

/** Mount one focused Input (width `w`) plus a trailing FocusStub, focus the Input. */
function mountInput(
  opts: ConstructorParameters<typeof Input>[0],
  w = 15,
): { loop: ReturnType<typeof createEventLoop>; input: Input; stub: FocusStub } {
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

// ST-01 / AC-1 — keyboard extend/collapse. value "hello world", curPos 0. (tinputli.cpp:339-359,456-459,64-82)
test('ST-01: Shift+arrows / Ctrl+Shift word / Shift+End extend, plain motion collapses', () => {
  const value = signal('hello world');
  const { loop, input } = mountInput({ value }, 15);
  for (let i = 0; i < 3; i++) loop.dispatch(key('right', { shift: true }));
  expect(input.selection).toEqual({ start: 0, end: 3 }); // Shift+Right ×3

  loop.dispatch(key('right', { ctrl: true, shift: true })); // word: jump to start of "world" (index 6)
  expect(input.selection).toEqual({ start: 0, end: 6 });

  loop.dispatch(key('end', { shift: true }));
  expect(input.selection).toEqual({ start: 0, end: 11 }); // extend to end

  loop.dispatch(key('left')); // plain motion (no shift) → collapse
  const { start, end } = input.selection;
  expect(start).toBe(end); // selStart === selEnd (collapsed)
});

// ST-02 / AC-2 — mouse press-drag + double-click. (tinputli.cpp:312-338; PA-15)
test('ST-02: mouse press-drag selects a range; double-click selects all', () => {
  const value = signal('hello world');
  const { loop, input } = mountInput({ value }, 15);
  // press at local col 3 (offset 2), drag to local col 8 (offset 7). offset = max(x,1)+firstPos-1.
  loop.dispatch(mouse('down', 3, 0));
  loop.dispatch(mouse('drag', 8, 0));
  loop.dispatch(mouse('up', 8, 0));
  expect(input.selection).toEqual({ start: 2, end: 7 });

  // double-click (two consecutive downs at the same cell, PA-15) → select all.
  loop.dispatch(mouse('down', 4, 0));
  loop.dispatch(mouse('down', 4, 0));
  expect(input.selection).toEqual({ start: 0, end: value().length });
});

// ST-03 / AC-3 — select-all + edit-over-selection. (tinputli.cpp:418-446,380-405,496-508)
test('ST-03: Ctrl+A selects all; typing replaces the selection; Backspace deletes it', () => {
  const value = signal('abc');
  const { loop, input } = mountInput({ value }, 15);
  loop.dispatch(key('a', { ctrl: true })); // Ctrl+A → select all
  expect(input.selection).toEqual({ start: 0, end: 3 });

  loop.dispatch(key('X')); // type over the selection → deleteSelect then insert
  expect(value()).toBe('X');
  expect(input.caretPos).toBe(1);
  expect(input.selection.start).toBe(input.selection.end); // collapsed

  // Backspace over a selection deletes only the selection.
  const value2 = signal('abc');
  const { loop: loop2, input: input2 } = mountInput({ value: value2 }, 15);
  loop2.dispatch(key('a', { ctrl: true }));
  loop2.dispatch(key('backspace'));
  expect(value2()).toBe('');
  expect(input2.selection.start).toBe(input2.selection.end);
});

// ST-04 / AC-3 — selection render band in the `inputSelection` role. (tinputli.cpp:152-157; PA-4/PA-6)
test('ST-04: selected columns carry the inputSelection role; unselected keep the field role', () => {
  const value = signal('hello world');
  const { loop } = mountInput({ value }, 15);
  // Select the first two code points [0,2): Shift+Right ×2.
  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('right', { shift: true }));
  const buf = loop.renderRoot.buffer();
  // Text at col 1..; band fills cols [l+1, r+1) = [1, 3) → cols 1 and 2 carry inputSelection.
  expect(buf.get(1, 0)?.bg).toBe(defaultTheme.inputSelection.bg); // 'h' selected
  expect(buf.get(2, 0)?.bg).toBe(defaultTheme.inputSelection.bg); // 'e' selected
  // col 3 is the caret cell (curPos 2 → its own ST-13 concern); col 4 is a plain unselected field cell.
  expect(buf.get(4, 0)?.bg).toBe(defaultTheme.inputNormal.bg); // 'l' unselected → field role
});
