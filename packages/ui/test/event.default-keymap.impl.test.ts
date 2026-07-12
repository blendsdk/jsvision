/**
 * Implementation tests — `buildKeymap` internals and edges: the default `'both'` argument, the
 * compose-at-lookup merge (caller wins, default fallback, non-mutation), key canonicalization, and
 * the `'none'` + user-keymap case. Complements the ST-1..ST-6 oracles in the spec file.
 */
import { test, expect } from 'vitest';
import { createKeymap } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { buildKeymap } from '../src/event/index.js';

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: !!mods.ctrl, alt: !!mods.alt, shift: !!mods.shift };
}

test('buildKeymap() with no arguments defaults to both (modern + classic)', () => {
  const km = buildKeymap();
  expect(km?.lookup(key('c', { ctrl: true }))).toBe('copy'); // modern
  expect(km?.lookup(key('insert', { ctrl: true }))).toBe('copy'); // classic alias
});

test('both binds all seven chords (four modern + three classic)', () => {
  const km = buildKeymap('both');
  const bound = [
    km?.lookup(key('a', { ctrl: true })),
    km?.lookup(key('c', { ctrl: true })),
    km?.lookup(key('x', { ctrl: true })),
    km?.lookup(key('v', { ctrl: true })),
    km?.lookup(key('insert', { ctrl: true })),
    km?.lookup(key('insert', { shift: true })),
    km?.lookup(key('delete', { shift: true })),
  ];
  expect(bound).toEqual(['selectAll', 'copy', 'cut', 'paste', 'copy', 'paste', 'cut']);
});

test('compose-at-lookup: caller wins on conflict, defaults fill the rest, and both keymaps still resolve', () => {
  const user = createKeymap({ 'ctrl+c': 'save', 'ctrl+p': 'print' });
  const km = buildKeymap('modern', user);
  expect(km?.lookup(key('c', { ctrl: true }))).toBe('save'); // caller overrides the default
  expect(km?.lookup(key('p', { ctrl: true }))).toBe('print'); // caller-only chord resolves
  expect(km?.lookup(key('a', { ctrl: true }))).toBe('selectAll'); // untouched default remains
  // The caller's keymap is not mutated by the merge — it still resolves its own chords standalone.
  expect(user.lookup(key('c', { ctrl: true }))).toBe('save');
});

test('a caller may override a classic alias too', () => {
  const km = buildKeymap('both', createKeymap({ 'ctrl+insert': 'help' }));
  expect(km?.lookup(key('insert', { ctrl: true }))).toBe('help');
  expect(km?.lookup(key('c', { ctrl: true }))).toBe('copy'); // the modern chord is untouched
});

test('lookup is case-insensitive on the key part', () => {
  const km = buildKeymap('modern');
  expect(km?.lookup(key('A', { ctrl: true }))).toBe('selectAll'); // uppercase key resolves the same
});

test("'none' returns the caller's keymap verbatim: only its chords resolve; undefined with no caller", () => {
  expect(buildKeymap('none')).toBeUndefined();

  const user = createKeymap({ 'ctrl+s': 'save' });
  const km = buildKeymap('none', user);
  expect(km).toBe(user); // no default layer to compose — the caller's keymap is the whole map
  expect(km?.lookup(key('s', { ctrl: true }))).toBe('save');
  expect(km?.lookup(key('c', { ctrl: true }))).toBeUndefined();
});
