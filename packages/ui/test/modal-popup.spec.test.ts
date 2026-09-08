/**
 * Specification tests for anchored popups opened from a modal dialog.
 *
 * A popup is painted in the application overlay, outside the dialog's retained subtree. While it is
 * open, input must reach that popup first without widening the modal boundary to background windows.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Button } from '../src/controls/index.js';
import { Dialog } from '../src/dialog/index.js';
import { ComboBox } from '../src/dropdown/index.js';
import { Group, View } from '../src/view/index.js';
import { at } from '../src/view/dsl/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Build an unmodified key event for headless dispatch. */
function key(keyName: string): KeyEvent {
  return { type: 'key', key: keyName, ctrl: false, alt: false, shift: false };
}

/** Build a primary-button mouse event at one-based terminal coordinates. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Return a mounted view's rectangle in zero-based application coordinates. */
function absoluteRect(view: View): { x: number; y: number; width: number; height: number } {
  let x = 0;
  let y = 0;
  let node: View | null = view;
  while (node !== null) {
    x += node.bounds.x;
    y += node.bounds.y;
    node = node.parent;
  }
  return { x, y, width: view.bounds.width, height: view.bounds.height };
}

/** Find the focused rows view hosted by the popup frame. */
function popupRows(overlay: Group): View {
  const frame = overlay.children.find((child): child is Group => child instanceof Group);
  const content = frame?.children.find((child): child is Group => child instanceof Group);
  const rows = content?.children.find((child) => child.focusable);
  if (rows === undefined) throw new Error('Expected the ComboBox popup to contain focusable rows.');
  return rows;
}

/** Whether the shared application overlay currently hosts an anchored popup. */
function popupOpen(overlay: Group): boolean {
  return overlay.state.visible && overlay.children.length > 0;
}

interface ModalComboHarness {
  readonly app: ReturnType<typeof createApplication>;
  readonly dialog: Dialog;
  readonly combo: ComboBox<string>;
  readonly value: Signal<string | null>;
  readonly modalResult: Promise<string | undefined>;
  readonly backgroundButton: Button;
  readonly backgroundActivations: () => number;
}

/** Build the real desktop/application composition that owns the modal-popup boundary. */
function modalCombo(): ModalComboHarness {
  const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
  let backgroundActivations = 0;
  const backgroundButton = at(
    new Button('Background', {
      onClick: () => {
        backgroundActivations += 1;
      },
    }),
    1,
    1,
    12,
    2,
  );
  const background = new Dialog({ title: 'Background', rect: { x: 0, y: 0, width: 16, height: 6 } });
  background.add(backgroundButton);
  app.desktop.addWindow(background);

  const value = signal<string | null>('Application A');
  const combo = new ComboBox<string>({
    items: signal(['Application A', 'Application B']),
    value,
    getText: (item) => item,
    editable: false,
  });
  const dialog = new Dialog({ title: 'Create client', width: 50, height: 18 });
  dialog.add(at(combo, 2, 2, 40, 1));
  app.desktop.addWindow(dialog);
  const modalResult = app.loop.execView<string>(dialog);
  app.loop.focusView(combo.input);
  return {
    app,
    dialog,
    combo,
    value,
    modalResult,
    backgroundButton,
    backgroundActivations: () => backgroundActivations,
  };
}

test('should commit a different ComboBox item by keyboard while its dialog is modal', () => {
  const h = modalCombo();
  const overlay = h.app.loop.popupHost?.overlay;
  if (overlay === undefined) throw new Error('createApplication() must provide the popup overlay.');

  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('enter'));

  expect(h.value()).toBe('Application B');
  expect(popupOpen(overlay)).toBe(false);
  expect(h.app.loop.getFocused()).toBe(h.combo.input);
  h.app.loop.endModal('cleanup');
});

test('should commit a different ComboBox item by mouse while its dialog is modal', () => {
  const h = modalCombo();
  const overlay = h.app.loop.popupHost?.overlay;
  if (overlay === undefined) throw new Error('createApplication() must provide the popup overlay.');
  h.app.loop.dispatch(key('down'));
  h.app.loop.renderRoot.flush();

  const rows = absoluteRect(popupRows(overlay));
  h.app.loop.dispatch(mouse('down', rows.x + 2, rows.y + 2));

  expect(h.value()).toBe('Application B');
  expect(popupOpen(overlay)).toBe(false);
  expect(h.app.loop.getFocused()).toBe(h.combo.input);
  h.app.loop.endModal('cleanup');
});

test('should dismiss the popup before Escape can close its parent modal', async () => {
  const h = modalCombo();
  const overlay = h.app.loop.popupHost?.overlay;
  if (overlay === undefined) throw new Error('createApplication() must provide the popup overlay.');
  let settled = false;
  void h.modalResult.then(() => {
    settled = true;
  });

  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('escape'));
  await Promise.resolve();

  expect(popupOpen(overlay)).toBe(false);
  expect(h.app.loop.getFocused()).toBe(h.combo.input);
  expect(settled).toBe(false);

  h.app.loop.dispatch(key('escape'));
  await expect(h.modalResult).resolves.toBe('cancel');
});

test('should consume an outside click without activating a dialog control behind the popup', () => {
  const h = modalCombo();
  const overlay = h.app.loop.popupHost?.overlay;
  if (overlay === undefined) throw new Error('createApplication() must provide the popup overlay.');
  let activations = 0;
  const behind = at(
    new Button('Behind popup', {
      onClick: () => {
        activations += 1;
      },
    }),
    2,
    13,
    20,
    2,
  );
  h.dialog.add(behind);
  h.app.loop.renderRoot.flush();
  h.app.loop.dispatch(key('down'));
  h.app.loop.renderRoot.flush();

  const button = absoluteRect(behind);
  const x = button.x + 3;
  const y = button.y + 1;
  h.app.loop.dispatch(mouse('down', x, y));
  h.app.loop.dispatch(mouse('up', x, y));

  expect(popupOpen(overlay)).toBe(false);
  expect(activations).toBe(0);
  h.app.loop.endModal('cleanup');
});

test('should dismiss on a click outside the modal while keeping background windows inert', () => {
  const h = modalCombo();
  const overlay = h.app.loop.popupHost?.overlay;
  if (overlay === undefined) throw new Error('createApplication() must provide the popup overlay.');
  h.app.loop.dispatch(key('down'));
  h.app.loop.renderRoot.flush();

  const backgroundButton = absoluteRect(h.backgroundButton);
  const x = backgroundButton.x + 3;
  const y = backgroundButton.y + 1;
  h.app.loop.dispatch(mouse('down', x, y));
  h.app.loop.dispatch(mouse('up', x, y));

  // Once the popup is gone, the same full click remains outside the active modal and stays inert.
  h.app.loop.dispatch(mouse('down', x, y));
  h.app.loop.dispatch(mouse('up', x, y));

  expect(popupOpen(overlay)).toBe(false);
  expect(h.app.loop.getFocused()).toBe(h.combo.input);
  expect(h.backgroundActivations()).toBe(0);
  h.app.loop.endModal('cleanup');
});
