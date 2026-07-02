/**
 * Specification tests (immutable oracles) — RD-06 `Input` (03-05).
 *
 * Source: jsvision-ui RD-06 AC-4/AC-5 → ST-08/ST-09 (essential-controls/07-testing-strategy.md).
 * TV source: `tinputli.cpp:134-160` (draw: text at col 1 width `size.x-1`, `◄`/`►` edge arrows,
 * `firstPos` scroll) + `:460-465` (cursor-keep-visible firstPos adjust) + `:341-468` (edit keys).
 * Real `View`/`EventLoop` over fixed `caps`; buffers read pre-serialize. Hardware caret deferred
 * (DEF-19) — the buffer text/arrows/roles are the oracle. Expectations derive from TV, not the impl.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, filter, range } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** A focusable stub, to prove Tab still moves focus (no trap). */
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

function row(loop: ReturnType<typeof createEventLoop>, width: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = 0; x < width; x++) s += buf.get(x, 0)?.char ?? ' ';
  return s;
}

/** Mount one focused Input (width `w`) plus a trailing FocusStub, focus the Input. */
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

// ST-08 / AC-4 — typing inserts at the cursor + writes the bound signal; edit keys behave; maxLength
// caps; focused ⇒ inputSelected.
test('ST-08: typing inserts at the cursor and writes the bound value (two-way)', () => {
  const value = signal('');
  const { loop } = mountInput({ value }, 10);
  for (const ch of 'abc') loop.dispatch(key(ch));
  expect(value()).toBe('abc');
  expect(row(loop, 10)).toBe(' abc      '); // text rendered from col 1 (tinputli.cpp:144)
});

test('ST-08: Backspace / Home / End / ←/→ move and edit correctly', () => {
  const value = signal('');
  const { loop } = mountInput({ value }, 10);
  for (const ch of 'abc') loop.dispatch(key(ch));
  loop.dispatch(key('backspace')); // 'ab', cursor 2
  expect(value()).toBe('ab');
  loop.dispatch(key('home')); // cursor 0
  loop.dispatch(key('X')); // insert at 0 → 'Xab'
  expect(value()).toBe('Xab');
  loop.dispatch(key('end')); // cursor 3
  loop.dispatch(key('Y')); // append → 'XabY'
  expect(value()).toBe('XabY');
  loop.dispatch(key('left'));
  loop.dispatch(key('left')); // cursor between 'a' and 'b' (index 2)
  loop.dispatch(key('delete')); // delete char at cursor ('b') → 'XaY'
  expect(value()).toBe('XaY');
});

test('ST-08: maxLength caps the stored value', () => {
  const value = signal('');
  const { loop } = mountInput({ value, maxLength: 3 }, 10);
  for (const ch of 'abcd') loop.dispatch(key(ch));
  expect(value()).toBe('abc'); // the 4th char is rejected
});

test('ST-08: a focused Input draws inputSelected; unfocused draws inputNormal', () => {
  const value = signal('hi');
  const { loop, stub } = mountInput({ value }, 10);
  // Col 1 is the RD-07 logical caret cell (curPos 0, reversed); probe col 2 for the field role.
  expect(loop.renderRoot.buffer().get(2, 0)?.bg).toBe(defaultTheme.inputSelected.bg); // focused
  loop.focusView(stub); // move focus to the stub (no caret when unfocused)
  expect(loop.renderRoot.buffer().get(1, 0)?.bg).toBe(defaultTheme.inputNormal.bg); // unfocused
});

// ST-09 / AC-5 — live filter reject; overflow scroll with ◄/► (inputArrows); valid() sets invalid;
// Tab still moves (no focus-trap).
test('ST-09: a filter validator rejects an invalid keystroke live (value unchanged)', () => {
  const value = signal('');
  const { loop } = mountInput({ value, validator: filter('0-9') }, 10);
  loop.dispatch(key('a')); // not a digit → rejected
  expect(value()).toBe('');
  loop.dispatch(key('5')); // digit → accepted
  expect(value()).toBe('5');
});

test('ST-09: overflow scrolls with ◄/► edge arrows in the inputArrows role', () => {
  const value = signal('123456789');
  const { loop } = mountInput({ value }, 6); // field narrower than the value
  const buf = loop.renderRoot.buffer();
  // cursor at 0, firstPos 0 → more text to the right → ► at the last column in inputArrows.
  expect(buf.get(5, 0)?.char).toBe('►');
  expect(buf.get(5, 0)?.fg).toBe(defaultTheme.inputArrows.fg);

  loop.dispatch(key('end')); // cursor → end → firstPos scrolls right → ◄ at col 0
  const buf2 = loop.renderRoot.buffer();
  expect(buf2.get(0, 0)?.char).toBe('◄');
  expect(buf2.get(0, 0)?.fg).toBe(defaultTheme.inputArrows.fg);
});

test('ST-09: valid() runs the blocking validator and sets invalid; Tab still moves (no trap)', () => {
  const value = signal('150');
  const { loop, input, stub } = mountInput({ value, validator: range(0, 100) }, 10);
  expect(input.valid()).toBe(false); // 150 is out of [0,100]
  expect(input.invalid).toBe(true);
  // No focus-trap: Tab advances focus off the invalid field.
  loop.dispatch(key('tab'));
  expect(loop.getFocused()).toBe(stub);
});
