/**
 * Specification tests (immutable oracles) — RD-07 logical caret (ST-13). The hardware-caret seam
 * (ST-14) is added in Phase 5.
 *
 * Source: jsvision-ui RD-07 AC-11 → ST-13 (essential-control-completions/07). TV: `TInputLine::draw`
 * `setCursor(displayedPos(curPos)-firstPos+1, 0)` (`tinputli.cpp:160`). The logical caret is our
 * addition (DEF-19a): the focused Input repaints that one buffer cell in a **reversed** field style
 * (fg/bg swapped) so the caret shows headless / on cursor-hidden terminals. Unit = code point (PA-1),
 * so `displayedPos(pos) == pos` in v1 (wide-glyph width-awareness = DEF-21). Expectations derive from
 * TV, not the implementation.
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

function mountInput(
  opts: ConstructorParameters<typeof Input>[0],
  w = 10,
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

// ST-13 / AC-11 — the focused Input marks its edit cell (reversed field style) at
// displayedPos(curPos)-firstPos+1; it moves with the cursor. (tinputli.cpp:160)
test('ST-13: the logical caret cell (reversed field style) sits at displayedPos(curPos)-firstPos+1', () => {
  const value = signal('abcd');
  const { loop } = mountInput({ value }, 10);
  loop.dispatch(key('right'));
  loop.dispatch(key('right')); // curPos 2, firstPos 0 → caret col 3
  const buf = loop.renderRoot.buffer();
  // Reversed field style: the focused field is inputSelected (white-on-blue), so the caret cell
  // has fg == field.bg and bg == field.fg.
  expect(buf.get(3, 0)?.fg).toBe(defaultTheme.inputSelected.bg);
  expect(buf.get(3, 0)?.bg).toBe(defaultTheme.inputSelected.fg);
  // The cell to the left (col 2, curPos 1) is NOT the caret → plain field bg.
  expect(buf.get(2, 0)?.bg).toBe(defaultTheme.inputSelected.bg);
});

test('ST-13: the caret moves with the cursor and with horizontal scroll (firstPos>0)', () => {
  const value = signal('abcdefghij'); // longer than the 6-wide field
  const { loop } = mountInput({ value }, 6);
  loop.dispatch(key('end')); // curPos 10; firstPos scrolls so the caret stays visible
  const buf = loop.renderRoot.buffer();
  // adjustScroll: firstPos = curPos - w + 2 = 10 - 6 + 2 = 6 → caret col = 10 - 6 + 1 = 5 (== w-1).
  expect(buf.get(5, 0)?.fg).toBe(defaultTheme.inputSelected.bg);
  expect(buf.get(5, 0)?.bg).toBe(defaultTheme.inputSelected.fg);
});

// The caret is only painted for the focused Input — an unfocused field shows no reversed cell.
test('ST-13: an unfocused Input paints no caret cell', () => {
  const value = signal('abcd');
  const { loop, stub } = mountInput({ value }, 10);
  loop.dispatch(key('right'));
  loop.focusView(stub); // blur the Input
  const buf = loop.renderRoot.buffer();
  // No reversed cell anywhere on the field row: every text cell keeps the field bg.
  for (let x = 1; x < 5; x++) expect(buf.get(x, 0)?.bg).toBe(defaultTheme.inputNormal.bg);
});
