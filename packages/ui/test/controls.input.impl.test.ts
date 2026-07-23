/**
 * Implementation tests — RD-06 `Input` edge cases (03-05).
 *
 * Scroll-keeps-cursor-visible math, click-to-position, arrow-click scroll, and the no-validator path.
 * Driven through the real loop; geometry verified from the pre-serialize buffer + the bound signal.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import type { InputOptions } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}
function mouseDown(x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

function mountInput(opts: InputOptions, w: number): { loop: ReturnType<typeof createEventLoop>; input: Input } {
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
  return { loop, input };
}

function cell(loop: ReturnType<typeof createEventLoop>, x: number): string | undefined {
  return loop.renderRoot.buffer().get(x, 0)?.char;
}

test('scroll keeps the cursor visible: typing past the field scrolls and shows the tail + ◄', () => {
  const value = signal('');
  const { loop } = mountInput({ value }, 6); // field width 6
  for (const ch of 'abcdefgh') loop.dispatch(key(ch));
  expect(value()).toBe('abcdefgh');
  // firstPos = curPos - w + 2 = 8 - 6 + 2 = 4 → window shows v.slice(4,9) = 'efgh' at cols 1..4.
  expect(cell(loop, 0)).toBe('◄'); // scrolled → left arrow shown
  expect(cell(loop, 1)).toBe('e');
  expect(cell(loop, 4)).toBe('h'); // the just-typed last char stays visible
});

test('click-to-position sets the cursor at the clicked column (idx = local.x + firstPos - 1)', () => {
  const value = signal('abcdef');
  const { loop } = mountInput({ value }, 10);
  loop.dispatch(mouseDown(4, 1)); // 1-based (4,1) → local.x 3 → curPos = 3 + 0 - 1 = 2
  loop.dispatch(key('Z')); // insert at index 2
  expect(value()).toBe('abZcdef');
});

test('clicking the ► arrow scrolls the field right (◄ then appears)', () => {
  const value = signal('123456789');
  const { loop } = mountInput({ value }, 6);
  expect(cell(loop, 5)).toBe('►'); // right arrow at the last column initially
  expect(cell(loop, 0)).not.toBe('◄'); // not scrolled yet
  loop.dispatch(mouseDown(6, 1)); // click the ► (1-based col 6 → local.x 5)
  expect(cell(loop, 0)).toBe('◄'); // firstPos advanced → left arrow now shown
});

test('no-validator path: every keystroke is accepted and valid() is true', () => {
  const value = signal('');
  const { loop, input } = mountInput({ value }, 10);
  for (const ch of 'a1!') loop.dispatch(key(ch));
  expect(value()).toBe('a1!');
  expect(input.valid()).toBe(true);
  expect(input.invalid).toBe(false);
});
