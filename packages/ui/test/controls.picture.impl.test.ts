/**
 * Implementation tests — RD-07 `picture(mask)` internals + edges (P3.4): each special char, `;`
 * escape, alternation, nested groups, empty/malformed masks, the PA-2 DoS-termination bounds, and the
 * autoFill delivery through `Input` (PA-17).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, picture } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// --- Special characters ----------------------------------------------------------------------------
test('# requires a digit; ? a letter (stored as typed)', () => {
  expect(picture('#').isValid('5')).toBe(true);
  expect(picture('#').isValid('a')).toBe(false);
  expect(picture('?').isValid('a')).toBe(true);
  expect(picture('?').fill?.('a')).toBe('a'); // ? stores as-typed
  expect(picture('?').isValid('5')).toBe(false);
});

test('& forces uppercase; ! forces uppercase for any char; @ stores any as-typed', () => {
  expect(picture('&').fill?.('a')).toBe('A');
  expect(picture('!').fill?.('a')).toBe('A'); // ! = any char, uppercased
  expect(picture('!').isValid('5')).toBe(true); // any char (not just letters)
  expect(picture('@').fill?.('a')).toBe('a'); // @ = any, as-typed
  expect(picture('@').isValid('%')).toBe(true);
});

test('a literal matches case-insensitively; ";" escapes a special into a literal', () => {
  expect(picture('A#').isValid('a5')).toBe(true); // literal 'A' matches 'a'
  expect(picture(';#5').isValid('#5')).toBe(true); // ';#' → literal '#'
  expect(picture(';#5').isValid('45')).toBe(false); // must be a literal '#'
});

test('alternation "," tries each branch', () => {
  const v = picture('##,&&'); // two digits OR two letters
  expect(v.isValid('12')).toBe(true);
  expect(v.isValid('ab')).toBe(true);
  expect(v.isValid('1a')).toBe(false);
});

test('nested + required groups {…} and optional [ ]', () => {
  expect(picture('{##}').isValid('12')).toBe(true); // required group
  expect(picture('{##}').isValid('1')).toBe(false); // incomplete
  // Optional `[##]` is greedy, so a skippable example needs the group to mismatch: `[##]&&`.
  expect(picture('[##]&&').isValid('ab')).toBe(true); // [##] skipped (mismatch) → && matches "ab"
  expect(picture('[##]&&').isValid('12ab')).toBe(true); // [##] present, then &&
});

// --- Malformed masks -------------------------------------------------------------------------------
test('empty / trailing-";" / unbalanced masks are rejected with an error, never throwing', () => {
  for (const bad of ['', ';', '{##', '[##', '##}']) {
    const v = picture(bad);
    expect(v.error, bad).toBeDefined();
    expect(v.isValid('12'), bad).toBe(false);
    expect(v.isValidInput('12'), bad).toBe(false); // allowlist: reject everything
    expect(() => v.isValidInput('12'), bad).not.toThrow();
  }
});

// --- PA-2 bounds -----------------------------------------------------------------------------------
test('*N at the MAX_REPEAT boundary: 1024 ok, 1025 rejected', () => {
  expect(picture('*1024#').error).toBeUndefined();
  expect(picture('*1025#').error).toBeDefined();
});

test('a hostile input against an unbounded "*" mask terminates (no hang)', () => {
  const star = picture('*#');
  const huge = '9'.repeat(20000);
  expect(() => star.isValid(huge)).not.toThrow();
});

test('a pathological many-group mask over a long input terminates within the step budget', () => {
  const v = picture('*{#},'.repeat(1)); // an unbounded repeat of a group + trailing alternation
  expect(() => v.isValidInput('1'.repeat(5000))).not.toThrow();
});

// --- autoFill delivery through Input (PA-17) -------------------------------------------------------
function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}
function mountInput(opts: ConstructorParameters<typeof Input>[0]) {
  const input = new Input(opts);
  const stub = new FocusStub();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  stub.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: 20, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  return { loop, input };
}

test('typing into a picture("###-##") Input auto-inserts the "-" literal (PA-17)', () => {
  const value = signal('');
  const { loop } = mountInput({ value, validator: picture('###-##') });
  for (const ch of '123') loop.dispatch(key(ch));
  expect(value()).toBe('123-'); // the '-' auto-appended after the 3rd digit
  loop.dispatch(key('4'));
  loop.dispatch(key('5'));
  expect(value()).toBe('123-45'); // typing continues past the auto-inserted literal
});

test('typing lowercase into a picture("&&&") Input stores uppercase (PA-17)', () => {
  const value = signal('');
  const { loop } = mountInput({ value, validator: picture('&&&') });
  for (const ch of 'abc') loop.dispatch(key(ch));
  expect(value()).toBe('ABC');
});
