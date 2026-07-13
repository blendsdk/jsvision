/**
 * Specification tests (immutable oracles) — global clipboard default keymap (`buildKeymap`).
 *
 * Source: global-clipboard 03-01 + 07 ST-1…ST-6 · AR-3/AR-4/AR-9. These oracles derive from the
 * requirement, never the implementation: `buildKeymap(mode, userKeymap?)` compiles the framework's
 * default clipboard bindings for the selected mode and composes the caller's keymap on top (the
 * caller wins on any conflicting chord). `'modern'` binds Ctrl+A/C/X/V; `'classic'` binds the Turbo
 * Vision chords Ctrl+Insert/Shift+Insert/Shift+Delete; `'both'` binds both; `'none'` binds nothing
 * (returning `undefined` when there is also no user keymap). `.js` per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { createKeymap } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { buildKeymap } from '../src/event/index.js';

/** Build a `KeyEvent` for a chord, defaulting every unset modifier to `false`. */
function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: !!mods.ctrl, alt: !!mods.alt, shift: !!mods.shift };
}

// ST-1 — modern binds the four modern chords to their commands.
test('ST-1: buildKeymap(modern) maps Ctrl+A/C/X/V to selectAll/copy/cut/paste', () => {
  const km = buildKeymap('modern');
  expect(km).toBeDefined();
  expect(km?.lookup(key('a', { ctrl: true }))).toBe('selectAll');
  expect(km?.lookup(key('c', { ctrl: true }))).toBe('copy');
  expect(km?.lookup(key('x', { ctrl: true }))).toBe('cut');
  expect(km?.lookup(key('v', { ctrl: true }))).toBe('paste');
});

// ST-2 — modern does NOT bind the classic chords.
test('ST-2: buildKeymap(modern) leaves the classic chords unbound', () => {
  const km = buildKeymap('modern');
  expect(km?.lookup(key('insert', { ctrl: true }))).toBeUndefined();
  expect(km?.lookup(key('insert', { shift: true }))).toBeUndefined();
  expect(km?.lookup(key('delete', { shift: true }))).toBeUndefined();
});

// ST-3 — classic binds the Turbo Vision chords and does NOT bind Ctrl+C.
test('ST-3: buildKeymap(classic) maps Ctrl+Insert/Shift+Insert/Shift+Delete; Ctrl+C is unbound', () => {
  const km = buildKeymap('classic');
  expect(km?.lookup(key('insert', { ctrl: true }))).toBe('copy');
  expect(km?.lookup(key('insert', { shift: true }))).toBe('paste');
  expect(km?.lookup(key('delete', { shift: true }))).toBe('cut');
  expect(km?.lookup(key('c', { ctrl: true }))).toBeUndefined();
});

// ST-4 — both binds the modern chords AND the classic aliases; both Ctrl+C and Ctrl+Insert copy.
test('ST-4: buildKeymap(both) binds modern and classic aliases together', () => {
  const km = buildKeymap('both');
  expect(km?.lookup(key('c', { ctrl: true }))).toBe('copy');
  expect(km?.lookup(key('insert', { ctrl: true }))).toBe('copy');
});

// ST-5 — a user keymap wins on a conflicting chord; the untouched defaults remain.
test('ST-5: a user keymap overrides a default chord (user wins), other defaults remain', () => {
  const km = buildKeymap('both', createKeymap({ 'ctrl+c': 'save' }));
  expect(km?.lookup(key('c', { ctrl: true }))).toBe('save');
  expect(km?.lookup(key('x', { ctrl: true }))).toBe('cut');
});

// ST-6 — none binds nothing: undefined with no user keymap; only user chords resolve with one.
test('ST-6: buildKeymap(none) binds no clipboard chords', () => {
  expect(buildKeymap('none')).toBeUndefined();

  const km = buildKeymap('none', createKeymap({ 'ctrl+s': 'save' }));
  expect(km?.lookup(key('c', { ctrl: true }))).toBeUndefined();
  expect(km?.lookup(key('s', { ctrl: true }))).toBe('save');
});
