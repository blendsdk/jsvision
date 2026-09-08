/**
 * Specification coverage for every control that uses the shared anchored-popup input boundary.
 *
 * Each control is exercised inside a real `createApplication()` desktop modal so a passing result
 * proves that the shared fix is not limited to one ComboBox mode or one popup content type.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { Color, KeyEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { ColorPicker } from '../src/color/index.js';
import { Input } from '../src/controls/index.js';
import { DatePicker } from '../src/date/index.js';
import type { CalendarDate } from '../src/date/index.js';
import { Dialog } from '../src/dialog/index.js';
import { ComboBox, History } from '../src/dropdown/index.js';
import { signal } from '../src/reactive/index.js';
import { View } from '../src/view/index.js';
import { at } from '../src/view/dsl/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const TODAY: CalendarDate = { year: 2026, month: 9, day: 8 };

/** Build an unmodified key event for headless dispatch. */
function key(keyName: string): KeyEvent {
  return { type: 'key', key: keyName, ctrl: false, alt: false, shift: false };
}

interface ModalViewHarness {
  readonly app: ReturnType<typeof createApplication>;
  readonly dialog: Dialog;
  readonly result: Promise<string | undefined>;
}

/** Mount one control in a centered desktop dialog and open that dialog modally. */
function modalView(view: View): ModalViewHarness {
  const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
  const dialog = new Dialog({ title: 'Popup consumer', width: 50, height: 14 });
  dialog.add(at(view, 2, 2, 40, 1));
  app.desktop.addWindow(dialog);
  const result = app.loop.execView<string>(dialog);
  return { app, dialog, result };
}

/** Close a still-active test modal after its behavioral assertion. */
function closeModal(harness: ModalViewHarness): void {
  harness.app.loop.endModal('cleanup');
}

test('should keep editable ComboBox filtering and commit functional inside a modal', () => {
  const value = signal<string | null>(null);
  const combo = new ComboBox<string>({
    items: signal(['Red', 'Green', 'Blue']),
    value,
    getText: (item) => item,
    editable: true,
  });
  const h = modalView(combo);
  h.app.loop.focusView(combo.input);

  h.app.loop.dispatch(key('g'));
  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('enter'));

  expect(value()).toBe('Green');
  expect(combo.text()).toBe('Green');
  expect(h.app.loop.getFocused()).toBe(combo.input);
  closeModal(h);
});

test('should commit a History entry from a modal popup', () => {
  const value = signal('current');
  const input = new Input({ value });
  const history = new History({ link: input, history: signal(['first', 'second']) });
  const h = modalView(history);
  h.dialog.add(at(input, 2, 4, 36, 1));
  h.app.loop.renderRoot.flush();
  h.app.loop.focusView(input);

  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('enter'));

  expect(value()).toBe('second');
  expect(h.app.loop.getFocused()).toBe(input);
  closeModal(h);
});

test('should commit a DatePicker calendar choice from a modal popup', () => {
  const value = signal<CalendarDate | null>(null);
  const picker = new DatePicker({ value, today: TODAY });
  const h = modalView(picker);
  h.app.loop.focusView(picker.input);

  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('enter'));

  expect(value()).toStrictEqual(TODAY);
  expect(h.app.loop.getFocused()).toBe(picker.input);
  closeModal(h);
});

test('should navigate and commit a ColorPicker swatch from a modal popup', () => {
  const value = signal<Color>('black');
  const picker = new ColorPicker({ value });
  const h = modalView(picker);
  h.app.loop.focusView(picker);

  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('right'));
  h.app.loop.dispatch(key('tab'));

  expect(h.app.loop.getFocused()).toBeInstanceOf(Input);
  h.app.loop.dispatch(key('enter'));

  expect(value()).toBe('red');
  expect(h.app.loop.getFocused()).toBe(picker);
  closeModal(h);
});

test('should dismiss an outer popup before routing an inner modal popup', async () => {
  const outerValue = signal<string | null>('outer-a');
  const outerCombo = new ComboBox<string>({
    items: signal(['outer-a', 'outer-b']),
    value: outerValue,
    getText: (item) => item,
    editable: false,
  });
  const h = modalView(outerCombo);
  h.app.loop.focusView(outerCombo.input);
  h.app.loop.dispatch(key('down'));

  const innerValue = signal<string | null>('inner-a');
  const innerCombo = new ComboBox<string>({
    items: signal(['inner-a', 'inner-b']),
    value: innerValue,
    getText: (item) => item,
    editable: false,
  });
  const inner = new Dialog({ title: 'Inner', width: 40, height: 10 });
  inner.add(at(innerCombo, 2, 2, 30, 1));
  h.app.desktop.addWindow(inner);
  const innerResult = h.app.loop.execView(inner);
  h.app.loop.focusView(innerCombo.input);

  expect(h.app.loop.popupHost?.overlay.children).toHaveLength(0);
  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('down'));
  h.app.loop.dispatch(key('enter'));

  expect(innerValue()).toBe('inner-b');
  expect(outerValue()).toBe('outer-a');
  h.app.loop.endModal('inner-done');
  await expect(innerResult).resolves.toBe('inner-done');
  expect(h.app.loop.getFocused()).toBe(outerCombo.input);

  closeModal(h);
  await expect(h.result).resolves.toBe('cleanup');
});
