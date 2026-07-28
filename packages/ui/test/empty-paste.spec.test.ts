/**
 * Specification tests for empty external paste events in the UI event route.
 *
 * An empty paste still travels through the canonical clipboard route, but it is not an editing
 * transaction. Selected text, observable values, validation, history, and mutation-driven repaint
 * remain untouched.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, PasteEvent } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { Input } from '../src/controls/index.js';
import type { Validator } from '../src/controls/index.js';
import { Editor } from '../src/editor/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createRoot, effect, signal } from '../src/reactive/index.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

function key(value: string, modifiers: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: value, ctrl: false, alt: false, shift: false, ...modifiers };
}

function emptyPaste(): PasteEvent {
  return { type: 'paste', text: '', truncated: false };
}

class ClipboardRouteProbe extends View {
  override focusable = true;
  clipboardDuringPaste: string | undefined;

  draw(_ctx: DrawContext): void {}

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command' && ev.event.command === 'seed-clipboard') {
      ev.setClipboard?.('prior clipboard value');
      ev.handled = true;
      return;
    }
    if (ev.event.type === 'paste') {
      this.clipboardDuringPaste = ev.readClipboard?.();
      ev.handled = true;
    }
  }
}

function mountFocused<T extends View>(view: T, width = 24, height = 4) {
  const root = new Group();
  view.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(view);
  const loop = createEventLoop(
    { width, height },
    {
      caps,
      commands: ['seed-clipboard'],
      scheduleMicrotask: () => undefined,
    },
  );
  loop.mount(root);
  loop.focusView(view);
  return { loop, view };
}

// The event loop replaces its prior canonical value before the focused view handles an empty paste.
test('the canonical clipboard adopts empty host text before paste routing', () => {
  const probe = new ClipboardRouteProbe();
  const { loop } = mountFocused(probe);

  loop.emitCommand('seed-clipboard');
  loop.dispatch(emptyPaste());

  expect(probe.clipboardDuringPaste).toBe('');
});

// Empty paste over an Input selection preserves its value and selection without observable writes.
test('Input treats empty paste over a selection as a side-effect-free insertion no-op', () => {
  const value = signal('preserve me', { equals: false });
  let valueNotifications = 0;
  const disposeEffect = createRoot((dispose) => {
    effect(() => {
      value();
      valueNotifications += 1;
    });
    return dispose;
  });
  const validator: Validator = {
    isValidInput: vi.fn(() => true),
    isValid: vi.fn(() => true),
  };
  const input = new Input({ value, validator });
  const { loop } = mountFocused(input);
  loop.dispatch(key('a', { ctrl: true }));

  const selectionBefore = { ...input.selection };
  const notificationsBefore = valueNotifications;
  const invalidate = vi.spyOn(input, 'invalidate');
  vi.mocked(validator.isValidInput).mockClear();
  vi.mocked(validator.isValid).mockClear();

  loop.dispatch(emptyPaste());

  expect(value()).toBe('preserve me');
  expect(input.selection).toEqual(selectionBefore);
  expect(input.hasSelection()).toBe(true);
  expect(valueNotifications).toBe(notificationsBefore);
  expect(validator.isValidInput).not.toHaveBeenCalled();
  expect(validator.isValid).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  disposeEffect();
});

// Empty paste over an Editor selection preserves content, selection, history, and modified state.
test('Editor treats empty paste over a selection as a history-free insertion no-op', () => {
  const editor = new Editor();
  editor.setText('preserve\nthis');
  const { loop } = mountFocused(editor, 30, 6);
  loop.dispatch(key('a', { ctrl: true }));

  const selectedBefore = editor.selectionText();
  const invalidate = vi.spyOn(editor, 'invalidate');
  expect(editor.canUndo()).toBe(false);
  expect(editor.modified()).toBe(false);

  loop.dispatch(emptyPaste());

  expect(editor.getText()).toBe('preserve\nthis');
  expect(editor.selectionText()).toBe(selectedBefore);
  expect(editor.hasSelection()).toBe(true);
  expect(editor.canUndo()).toBe(false);
  expect(editor.canRedo()).toBe(false);
  expect(editor.modified()).toBe(false);
  expect(invalidate).not.toHaveBeenCalled();
});
