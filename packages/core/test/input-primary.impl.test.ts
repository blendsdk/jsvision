import { describe, expect, it } from 'vitest';

import { createKeymap } from '../src/engine/input/keymap.js';
import type { KeyEvent } from '../src/engine/input/events.js';

/** Creates one fully normalized key event for implementation-edge coverage. */
function key(value: string, values: Partial<Omit<KeyEvent, 'type' | 'key'>> = {}): KeyEvent {
  return {
    type: 'key',
    key: value,
    ctrl: values.ctrl ?? false,
    alt: values.alt ?? false,
    shift: values.shift ?? false,
    ...values,
  };
}

describe('semantic Primary keymap implementation', () => {
  it('canonicalizes modifier order and case after host-specific Primary expansion', () => {
    const keymap = createKeymap({ 'SHIFT+PRIMARY+K': 'command' }, { primary: 'meta' });
    expect(keymap.lookup(key('K', { shift: true, meta: true, primary: true }))).toBe('command');
    expect(keymap.lookup(key('k', { shift: true, ctrl: true }))).toBeUndefined();
  });

  it('rejects incomplete semantic evidence and preserves explicit combined modifiers', () => {
    const keymap = createKeymap({ 'primary+x': 'primary', 'ctrl+meta+x': 'combined' }, { primary: 'meta' });
    expect(keymap.lookup(key('x', { primary: true }))).toBeUndefined();
    expect(keymap.lookup(key('x', { ctrl: true, meta: true }))).toBe('combined');
    expect(keymap.lookup(key('x', { ctrl: true, meta: true, primary: true }))).toBeUndefined();
  });

  it('rejects malformed Primary grammar without changing legacy key validation', () => {
    expect(() => createKeymap({ primary: 'missing-key' }, { primary: 'ctrl' })).toThrow();
    expect(() => createKeymap({ 'primary+unknown-key': 'invalid' }, { primary: 'ctrl' })).toThrow();
    expect(createKeymap({ 'ctrl+s': 'save' }).lookup(key('s', { ctrl: true }))).toBe('save');
  });
});
