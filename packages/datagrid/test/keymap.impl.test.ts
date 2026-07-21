/**
 * Implementation tests — internals and edges of the pure grid keymap model `keymap.ts`.
 *
 * These cover behaviour the spec oracle does not pin down: reuse of the core chord grammar (case
 * normalisation of letter keys, modifier-order independence), merge idempotence, and the one-warning-
 * per-bad-entry contract. They may evolve with the implementation, unlike the spec oracle.
 */
import { test, expect, vi } from 'vitest';
import { DEFAULT_KEYMAP, resolveGridAction, mergeKeymap } from '../src/keymap.js';
import type { KeymapKeyEvent } from '../src/keymap.js';

function key(k: string, mods: Partial<Pick<KeymapKeyEvent, 'ctrl' | 'alt' | 'shift'>> = {}): KeymapKeyEvent {
  return { key: k, ctrl: mods.ctrl ?? false, alt: mods.alt ?? false, shift: mods.shift ?? false };
}

test('chord canonicalization: modifier order in the caller chord is irrelevant', () => {
  const merged = mergeKeymap({ 'shift+ctrl+e': 'beginEdit' });
  expect(resolveGridAction(key('e', { ctrl: true, shift: true }), merged)).toBe('beginEdit');
});

test('chord canonicalization: an uppercase letter chord matches the lowercase event key', () => {
  const merged = mergeKeymap({ 'ctrl+E': 'beginEdit' });
  expect(resolveGridAction(key('e', { ctrl: true }), merged)).toBe('beginEdit');
  expect(resolveGridAction(key('E', { ctrl: true }), merged)).toBe('beginEdit');
});

test('resolution distinguishes a modified chord from its unmodified base', () => {
  // ctrl+home (gridStart) must not fire for a plain home (rowStart), and vice versa.
  expect(resolveGridAction(key('home', { ctrl: true }), DEFAULT_KEYMAP)).toBe('gridStart');
  expect(resolveGridAction(key('home'), DEFAULT_KEYMAP)).toBe('rowStart');
});

test('merge idempotence: an empty override reproduces the default resolutions', () => {
  const a = mergeKeymap();
  const b = mergeKeymap({});
  for (const chord of ['left', 'f2', 'alt+down'] as const) {
    // Compare against the default table for a handful of representative chords.
    const evByChord: Record<string, KeymapKeyEvent> = {
      left: key('left'),
      f2: key('f2'),
      'alt+down': key('down', { alt: true }),
    };
    const ev = evByChord[chord];
    expect(resolveGridAction(ev, a)).toBe(DEFAULT_KEYMAP[chord]);
    expect(resolveGridAction(ev, b)).toBe(DEFAULT_KEYMAP[chord]);
  }
});

test('each merged map is a fresh frozen object (identity differs per call)', () => {
  const a = mergeKeymap();
  const b = mergeKeymap();
  expect(a).not.toBe(b);
  expect(Object.isFrozen(a)).toBe(true);
  expect(Object.isFrozen(b)).toBe(true);
});

test('one dev warning is emitted per bad entry, none for a clean map', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  mergeKeymap({ 'ctrl+e': 'beginEdit' }); // clean → no warning
  expect(warn).not.toHaveBeenCalled();

  mergeKeymap({ 'ctrl+x': 'nope' as never }); // one unknown action → one warning
  expect(warn).toHaveBeenCalledTimes(1);

  warn.mockClear();
  mergeKeymap({ 'bad+chord+here': 'beginEdit', another: 'beginEdit' }); // two malformed chords
  expect(warn).toHaveBeenCalledTimes(2);

  warn.mockRestore();
});
