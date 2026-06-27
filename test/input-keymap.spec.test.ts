/**
 * Specification tests — pluggable keymap (RD-06, Should-Have, PL-10).
 *
 * Immutable oracle: expectations derive from plan decision PL-10 (functional
 * `createKeymap(bindings) → lookup(KeyEvent)`, chord grammar, fail-fast on an
 * invalid binding) and 07-testing-strategy ST-13 — never from reading the
 * implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createKeymap } from '../src/engine/input/keymap.js';
import type { KeyEvent } from '../src/engine/input/events.js';

/** Build a KeyEvent for a chord under test. */
function key(k: string, mods: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

// ---------------------------------------------------------------------------
// ST-13 — chord lookup, unbound miss, invalid-binding fail-fast
// ---------------------------------------------------------------------------

test('ST-13: a bound chord resolves to its name', () => {
  const keymap = createKeymap({ 'ctrl+s': 'save', 'alt+x': 'exit' });
  assert.equal(keymap.lookup(key('s', { ctrl: true })), 'save');
  assert.equal(keymap.lookup(key('x', { alt: true })), 'exit');
});

test('ST-13: an unbound chord returns undefined', () => {
  const keymap = createKeymap({ 'ctrl+s': 'save' });
  assert.equal(keymap.lookup(key('s')), undefined); // no ctrl held
  assert.equal(keymap.lookup(key('q', { ctrl: true })), undefined);
});

test('ST-13: an invalid binding throws at build time', () => {
  assert.throws(() => createKeymap({ 'ctrl+': 'bad' }), 'a binding with no key must throw');
  assert.throws(() => createKeymap({ 'hyper+s': 'bad' }), 'an unknown modifier must throw');
});
