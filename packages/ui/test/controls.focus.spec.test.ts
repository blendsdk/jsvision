/**
 * Specification test (immutable oracle) — RD-06 focus traversal (03-07).
 *
 * Source: jsvision-ui RD-06 AC-8 → ST-12 (essential-controls/07-testing-strategy.md). A form of
 * Text/Input/CheckGroup/RadioGroup/Button: Tab/Shift-Tab cycle focus across the interactive controls,
 * skipping the non-focusable `Text`, and the focused control shows its `…Selected` role. Real loop +
 * the built-in Tab traversal; expectations derive from the acceptance criteria, not the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Text, Input, CheckGroup, RadioGroup, Button } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

test('ST-12: Tab/Shift-Tab cycle focus across the controls, skipping the non-focusable Text', () => {
  const text = new Text('label:');
  const input = new Input({ value: signal('') });
  const check = new CheckGroup(['~B~old'], signal([false]));
  const radio = new RadioGroup(['~L~eft'], signal(0));
  const button = new Button('~O~K');
  const form = new Group();
  form.layout = { direction: 'col' };
  for (const [view, rows] of [
    [text, 1],
    [input, 1],
    [check, 1],
    [radio, 1],
    [button, 2],
  ] as const) {
    view.layout = { size: { kind: 'fixed', cells: rows } };
    form.add(view);
  }
  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(form);
  loop.focusView(input);
  expect(loop.getFocused()).toBe(input);

  const tab = (): void => loop.dispatch(key('tab'));
  tab();
  expect(loop.getFocused()).toBe(check); // Text was skipped
  tab();
  expect(loop.getFocused()).toBe(radio);
  tab();
  expect(loop.getFocused()).toBe(button);
  tab();
  expect(loop.getFocused()).toBe(input); // wraps back past Text

  loop.dispatch(key('tab', { shift: true }));
  expect(loop.getFocused()).toBe(button); // Shift-Tab reverses

  // The focused control shows its …Selected role (Input on row 1 → inputSelected bg).
  loop.focusView(input);
  expect(loop.renderRoot.buffer().get(1, 1)?.bg).toBe(defaultTheme.inputSelected.bg);
});
