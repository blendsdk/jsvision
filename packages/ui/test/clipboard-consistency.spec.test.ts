/**
 * Specification tests for the canonical plain-text clipboard shared by editable controls.
 *
 * These tests describe observable behavior only: host synchronization is an optional mirror,
 * while paste received from either JSVision or the host always uses the same canonical value.
 */
import { expect, test, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, PasteEvent } from '@jsvision/core';
import { Input } from '../src/controls/index.js';
import { Editor } from '../src/editor/index.js';
import { buildKeymap, createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Commands } from '../src/status/index.js';
import { Group } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Creates a decoded key event with explicit modifier defaults. */
function key(value: string, modifiers: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: value, ctrl: false, alt: false, shift: false, ...modifiers };
}

/** Creates an untruncated external paste event. */
function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false };
}

test('the modern keymap treats delivered Ctrl+Shift+C as the copy alias', () => {
  const keymap = buildKeymap('modern');

  expect(keymap?.lookup(key('c', { ctrl: true, shift: true }))).toBe(Commands.copy);
});

test('an external paste into Input becomes the value repeated by Ctrl+V', () => {
  const value = signal('');
  const input = new Input({ value });
  const root = new Group();
  root.add(input);
  const loop = createEventLoop({ width: 30, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);

  loop.dispatch(paste('Zażółć 🧪'));
  expect(value()).toBe('Zażółć 🧪');

  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('backspace'));
  expect(value()).toBe('');
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('Zażółć 🧪');
});

test('an external multiline paste into Editor becomes the value repeated by Ctrl+V', () => {
  const editor = new Editor();
  const root = new Group();
  root.add(editor);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(editor);

  loop.dispatch(paste('first\r\n第二'));
  expect(editor.getText()).toBe('first\n第二');

  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('backspace'));
  expect(editor.getText()).toBe('');
  loop.dispatch(key('v', { ctrl: true }));
  expect(editor.getText()).toBe('first\n第二');
});

test('copy commits raw text locally before an asynchronous host mirror can reject', async () => {
  const value = signal('host-independent');
  const input = new Input({ value });
  const root = new Group();
  root.add(input);
  const loop = createEventLoop({ width: 30, height: 3 }, { caps });
  const writeClipboardText = vi.fn(() => Promise.reject(new Error('permission denied')));
  Object.assign(loop, { writeClipboardText });
  loop.mount(root);
  loop.focusView(input);

  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true }));
  await Promise.resolve();

  expect(writeClipboardText).toHaveBeenCalledOnce();
  expect(writeClipboardText).toHaveBeenCalledWith('host-independent');

  loop.dispatch(key('backspace'));
  expect(value()).toBe('');
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('host-independent');
});
