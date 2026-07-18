/**
 * Specification tests (immutable oracle) — the pure grid keymap model `keymap.ts`.
 *
 * The model is view-free: a `GridAction` vocabulary, a frozen `DEFAULT_KEYMAP` chord→action table, a
 * `resolveGridAction(ev, keymap)` lookup, and a `mergeKeymap(user)` that layers a caller map over the
 * default. Merge validates BOTH axes — an unknown action and a malformed chord are each dropped with a
 * dev warning, never thrown — so grid construction cannot blow up on a typo'd keymap. Resolution reuses
 * the core chord grammar (`ctrl+alt+shift+key`) and never throws on an unmapped chord.
 *
 * Expectations derive from the requirements/spec docs, never from the implementation. The `.js` import
 * specifier is required by NodeNext ESM.
 */
import { test, expect, vi } from 'vitest';
import { DEFAULT_KEYMAP, resolveGridAction, mergeKeymap } from '../src/keymap.js';
import type { GridAction, GridKeymap, KeymapKeyEvent } from '../src/keymap.js';

/** Build a structural key event with all modifiers defaulting to false. */
function key(k: string, mods: Partial<Pick<KeymapKeyEvent, 'ctrl' | 'alt' | 'shift'>> = {}): KeymapKeyEvent {
  return { key: k, ctrl: mods.ctrl ?? false, alt: mods.alt ?? false, shift: mods.shift ?? false };
}

// ST-1 — every documented DEFAULT_KEYMAP chord resolves to its documented GridAction.
test('ST-1: each default chord resolves to its documented action', () => {
  const cases: readonly (readonly [KeymapKeyEvent, GridAction])[] = [
    [key('left'), 'moveLeft'],
    [key('right'), 'moveRight'],
    [key('up'), 'moveUp'],
    [key('down'), 'moveDown'],
    [key('home'), 'rowStart'],
    [key('end'), 'rowEnd'],
    [key('home', { ctrl: true }), 'gridStart'],
    [key('end', { ctrl: true }), 'gridEnd'],
    [key('pageup'), 'pageUp'],
    [key('pagedown'), 'pageDown'],
    [key('f2'), 'beginEdit'],
    [key('enter'), 'beginEdit'],
    [key('f4'), 'valueHelp'],
    [key('space'), 'toggleSelect'],
    [key('up', { shift: true }), 'extendUp'],
    [key('down', { shift: true }), 'extendDown'],
    [key('down', { alt: true }), 'openFilter'],
  ];
  for (const [ev, action] of cases) {
    expect(resolveGridAction(ev, DEFAULT_KEYMAP)).toBe(action);
  }
});

// ST-2 — a caller remap adds its chord AND the original default binding survives.
test('ST-2: a caller remap merges over the default, original still works', () => {
  const merged = mergeKeymap({ 'ctrl+e': 'beginEdit' });
  expect(resolveGridAction(key('e', { ctrl: true }), merged)).toBe('beginEdit');
  expect(resolveGridAction(key('f2'), merged)).toBe('beginEdit'); // original survives
});

// ST-3 — a caller entry on the same chord wins the conflict.
test('ST-3: caller wins on a chord conflict', () => {
  const merged = mergeKeymap({ f2: 'valueHelp' });
  expect(resolveGridAction(key('f2'), merged)).toBe('valueHelp');
});

// ST-4 — an unmapped-but-valid chord resolves to undefined without throwing.
test('ST-4: an unmapped chord resolves to undefined, no throw', () => {
  const merged = mergeKeymap();
  expect(() => resolveGridAction(key('j', { ctrl: true }), merged)).not.toThrow();
  expect(resolveGridAction(key('j', { ctrl: true }), merged)).toBeUndefined();
});

// ST-5 — an unknown ACTION is skipped with a dev warning; no throw; the chord resolves to undefined.
test('ST-5: an unknown action is skipped + warned, never thrown', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  let merged: GridKeymap | undefined;
  expect(() => {
    merged = mergeKeymap({ 'ctrl+e': 'frobnicate' as GridAction });
  }).not.toThrow();
  expect(warn).toHaveBeenCalled();
  expect(resolveGridAction(key('e', { ctrl: true }), merged!)).toBeUndefined();
  warn.mockRestore();
});

// ST-5b — a malformed CHORD is skipped + warned, never thrown (createKeymap would throw); defaults intact.
test('ST-5b: a malformed chord is skipped + warned, never thrown', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  let merged: GridKeymap | undefined;
  expect(() => {
    merged = mergeKeymap({ 'ktrl+e': 'beginEdit', 'ctrl+notakey': 'beginEdit' });
  }).not.toThrow();
  expect(warn).toHaveBeenCalledTimes(2);
  expect(resolveGridAction(key('f2'), merged!)).toBe('beginEdit'); // untouched defaults survive
  warn.mockRestore();
});

// ST-6 — the shared default table is frozen and a caller merge never mutates it.
test('ST-6: DEFAULT_KEYMAP is frozen and immune to a caller merge', () => {
  expect(Object.isFrozen(DEFAULT_KEYMAP)).toBe(true);
  expect(() => {
    (DEFAULT_KEYMAP as Record<string, GridAction>).left = 'moveRight';
  }).toThrow();
  mergeKeymap({ left: 'moveRight' });
  expect(DEFAULT_KEYMAP.left).toBe('moveLeft'); // the caller merge left the shared default untouched
});
