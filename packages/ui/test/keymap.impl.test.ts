/**
 * Implementation tests — RD-08 Phase-3 keymap modifier corners (after green).
 *
 * Modifier-exactness of the table match, shift-transparency for motion keys, prefix corners with
 * special keys, and the alt fall-throughs.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveKey } from '../src/editor/keymap.js';

function k(key: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
  return { key, ctrl: mods.ctrl ?? false, shift: mods.shift ?? false, alt: mods.alt ?? false };
}

test('shift is transparent for motion keys (TV smExtend rides the shift STATE)', () => {
  expect(resolveKey(0, k('left', { shift: true })).action).toBe('charLeft');
  expect(resolveKey(0, k('home', { shift: true })).action).toBe('lineStart');
  expect(resolveKey(0, k('s', { ctrl: true, shift: true })).action).toBe('charLeft');
});

test('modifier exactness: alt+letter and ctrl+alt combos fall through unconsumed', () => {
  expect(resolveKey(0, k('a', { alt: true })).consumed).toBe(false);
  expect(resolveKey(0, k('s', { ctrl: true, alt: true })).consumed).toBe(false);
  expect(resolveKey(0, k('left', { alt: true })).consumed).toBe(false);
});

test('shift-exact entries: shift+ctrl+delete matches nothing (kbShiftDel/kbCtrlDel are distinct codes)', () => {
  expect(resolveKey(0, k('delete', { ctrl: true, shift: true })).consumed).toBe(false);
});

test('a special key after a prefix clears it, consumed, no action', () => {
  const res = resolveKey('ctrlK', k('left'));
  expect(res.action).toBeUndefined();
  expect(res.nextState).toBe(0);
  expect(res.consumed).toBe(true);
});

test('uppercase and ctrl-held follow-ups resolve in the block table too', () => {
  expect(resolveKey('ctrlK', k('K', { shift: true })).action).toBe('copy');
  expect(resolveKey('ctrlK', k('y', { ctrl: true })).action).toBe('cut');
});

test('a prefix key inside a prefix is just an unknown follow-up (clears, no re-arm)', () => {
  const res = resolveKey('ctrlQ', k('q', { ctrl: true }));
  expect(res.nextState).toBe(0); // Q is not in quickKeys → cleared
  expect(res.consumed).toBe(true);
});

test('ctrl-p (the sanctioned cmEncoding omission) falls through unconsumed', () => {
  expect(resolveKey(0, k('p', { ctrl: true })).consumed).toBe(false);
});
