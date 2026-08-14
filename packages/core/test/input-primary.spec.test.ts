/** Specification oracle for additive semantic Primary/Meta input and keymap compatibility. */
import { describe, expect, it } from 'vitest';

import { createKeymap } from '../src/engine/input/keymap.js';
import type { KeyEvent, MouseEvent } from '../src/engine/input/events.js';

/** Builds one key event while retaining the legacy required modifier members. */
function key(value: string, modifiers: Partial<Omit<KeyEvent, 'type' | 'key'>> = {}): KeyEvent {
  return {
    type: 'key',
    key: value,
    ctrl: modifiers.ctrl ?? false,
    alt: modifiers.alt ?? false,
    shift: modifiers.shift ?? false,
    ...modifiers,
  };
}

describe('semantic Primary and Meta input', () => {
  it('keeps existing event literals and createKeymap calls source compatible', () => {
    const legacy: KeyEvent = { type: 'key', key: 's', ctrl: true, alt: false, shift: false };
    const legacyMouse: MouseEvent = { type: 'mouse', kind: 'down', button: 0, x: 3, y: 4 };
    const keymap = createKeymap({ 'ctrl+s': 'save' });

    expect(keymap.lookup(legacy)).toBe('save');
    expect(legacyMouse.meta).toBeUndefined();
    expect(legacyMouse.primary).toBeUndefined();
  });

  it('accepts an observable Meta modifier without folding it into Alt', () => {
    const keymap = createKeymap({ 'meta+f': 'meta-find', 'alt+f': 'alt-find' });

    expect(keymap.lookup(key('f', { meta: true }))).toBe('meta-find');
    expect(keymap.lookup(key('f', { alt: true }))).toBe('alt-find');
  });

  it('resolves semantic Primary per host while preserving explicit Ctrl and Meta chords', () => {
    const bindings = { 'primary+f': 'find', 'ctrl+k': 'ctrl-only', 'meta+k': 'meta-only' };
    const macBrowser = createKeymap(bindings, { primary: 'meta' });
    const terminal = createKeymap(bindings, { primary: 'ctrl' });

    expect(macBrowser.lookup(key('f', { meta: true, primary: true }))).toBe('find');
    expect(macBrowser.lookup(key('f', { ctrl: true }))).toBeUndefined();
    expect(terminal.lookup(key('f', { ctrl: true, primary: true }))).toBe('find');
    expect(terminal.lookup(key('f', { meta: true }))).toBeUndefined();
    expect(macBrowser.lookup(key('k', { ctrl: true }))).toBe('ctrl-only');
    expect(macBrowser.lookup(key('k', { meta: true }))).toBe('meta-only');
  });

  it('rejects a contradictory normalized event instead of routing twice', () => {
    const keymap = createKeymap({ 'primary+f': 'find' }, { primary: 'meta' });
    expect(keymap.lookup(key('f', { ctrl: true, meta: true, primary: true }))).toBeUndefined();
  });
});
