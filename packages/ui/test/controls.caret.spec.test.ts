/**
 * Specification tests (immutable oracles) — RD-07 logical caret (ST-13) + the hardware-caret seam
 * (ST-14).
 *
 * Source: jsvision-ui RD-07 AC-11/AC-12 → ST-13/ST-14 (essential-control-completions/07). TV:
 * `TInputLine::draw` `setCursor(displayedPos(curPos)-firstPos+1, 0)` (`tinputli.cpp:160`). The logical
 * caret is our addition (DEF-19a): the focused Input repaints that one buffer cell in a **reversed**
 * field style (fg/bg swapped) so the caret shows headless / on cursor-hidden terminals. The hardware
 * caret (ST-14) is the loop's `onCaret` seam: it reports the focused leaf's **absolute** cell (queried
 * post-flush from `desiredCaret()` + the render root's persisted origin — not collected during compose,
 * so it survives partial recomposes, PF-002). Unit = code point (PA-1), so `displayedPos(pos) == pos`
 * in v1 (wide-glyph width-awareness = DEF-21). Expectations derive from TV + the ACs, not the impl.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, Point } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, Text } from '../src/controls/index.js';

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
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  stub.setLayout({ size: { kind: 'fixed', cells: 1 } });
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

// ST-14 / AC-12 — the loop's `onCaret` seam reports the focused Input's ABSOLUTE caret cell each
// frame, and `null` once focus leaves the Input.
test('ST-14: onCaret reports the focused Input absolute caret cell; null when focus leaves', () => {
  const value = signal('abcd');
  const { loop, stub } = mountInput({ value }, 10);
  const carets: (Point | null)[] = [];
  loop.onCaret = (c) => carets.push(c);
  loop.dispatch(key('right')); // curPos 1 → local caret x=2; Input origin (0,0) → absolute {x:2,y:0}
  expect(carets.at(-1)).toEqual({ x: 2, y: 0 });
  loop.dispatch(key('right')); // curPos 2 → absolute {x:3,y:0}
  expect(carets.at(-1)).toEqual({ x: 3, y: 0 });
  loop.focusView(stub); // blur the Input → no caret requester
  expect(carets.at(-1)).toBeNull();
});

// The absolute cell folds in the Input's non-zero origin (a second row in the column layout).
test('ST-14: onCaret adds the focused view origin to the local caret cell', () => {
  const value = signal('abcd');
  const stub = new FocusStub();
  const input = new Input({ value });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  stub.setLayout({ size: { kind: 'fixed', cells: 1 } }); // row 0
  input.setLayout({ size: { kind: 'fixed', cells: 1 } }); // row 1 → origin y=1
  root.add(stub);
  root.add(input);
  const loop = createEventLoop({ width: 10, height: 3 }, { caps });
  loop.mount(root);
  const carets: (Point | null)[] = [];
  loop.onCaret = (c) => carets.push(c);
  loop.focusView(input); // curPos 0 → local {x:1,y:0}; origin (0,1) → absolute {x:1,y:1}
  expect(carets.at(-1)).toEqual({ x: 1, y: 1 });
});

// onFrame (buffer) and onCaret (cell) are INDEPENDENT additive seams — neither changes the other.
test('ST-14: onFrame and onCaret are independent additive seams', () => {
  const value = signal('ab');
  const { loop } = mountInput({ value }, 10);
  const frames: unknown[] = [];
  const carets: (Point | null)[] = [];
  loop.onFrame = (buf) => frames.push(buf);
  loop.onCaret = (c) => carets.push(c);
  loop.dispatch(key('right'));
  expect(frames.at(-1)).toBe(loop.renderRoot.buffer()); // the buffer seam is unchanged
  expect(carets.length).toBeGreaterThan(0); // the caret seam fires alongside, independently
});

// PF-002 — the caret is queried post-flush from the persisted origin, so a partial recompose that
// omits the Input still reports the Input's caret correctly.
test('ST-14: onCaret survives a partial recompose that omits the focused Input (PF-002)', () => {
  const value = signal('abcd');
  const label = signal('x');
  const input = new Input({ value });
  const text = new Text(() => label());
  const root = new Group();
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } }); // row 0
  text.setLayout({ size: { kind: 'fixed', cells: 1 } }); // row 1
  root.add(input);
  root.add(text);
  const loop = createEventLoop({ width: 10, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  loop.dispatch(key('right')); // caret at {x:2,y:0}
  const carets: (Point | null)[] = [];
  loop.onCaret = (c) => carets.push(c);
  label.set('y'); // marks only the sibling Text dirty (a partial-recompose target)
  loop.emitCommand('noop'); // one tick → partial recompose of Text only → re-queries the caret
  expect(carets.at(-1)).toEqual({ x: 2, y: 0 }); // still correct from the Input's persisted origin
});
