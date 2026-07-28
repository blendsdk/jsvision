/**
 * Lifecycle hardening for empty paste delivery.
 *
 * Empty events can arrive after focus or mount transitions. They remain handled by the active
 * editable target without becoming an edit or damaging state retained across a remount.
 */
import type { KeyEvent, PasteEvent } from '@jsvision/core';
import { resolveCapabilities } from '@jsvision/core';
import { expect, test } from 'vitest';

import { Input } from '../src/controls/index.js';
import { Editor } from '../src/editor/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Group } from '../src/view/index.js';
import type { DispatchEvent } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const emptyPaste: PasteEvent = { type: 'paste', text: '', truncated: false };

function selectAll(): KeyEvent {
  return { type: 'key', key: 'a', ctrl: true, alt: false, shift: false };
}

test('Input preserves its selected value after removal and remount before empty paste', () => {
  const value = signal('remount-safe');
  const input = new Input({ value });
  const root = new Group();
  root.add(input);
  const loop = createEventLoop({ width: 24, height: 4 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  loop.dispatch(selectAll());

  root.remove(input);
  root.add(input);
  loop.focusView(input);
  loop.dispatch(emptyPaste);

  expect(value()).toBe('remount-safe');
  expect(input.selection).toEqual({ start: 0, end: 12 });
});

test('an unfocused Editor observes empty paste without creating an edit', () => {
  const editor = new Editor();
  editor.setText('unchanged');
  const event: DispatchEvent = { event: emptyPaste, handled: false };

  editor.onEvent(event);

  expect(event.handled).toBe(false);
  expect(editor.getText()).toBe('unchanged');
  expect(editor.canUndo()).toBe(false);
  expect(editor.modified()).toBe(false);
});
