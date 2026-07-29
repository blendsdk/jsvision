/**
 * Specification tests for the live Input showcase.
 *
 * The example must expose Input's editing, validation, binding, selection, and overflow behavior in
 * one compact template1 application. It opens in a centered Classic dialog with a one-cell content
 * inset beyond the frame, while leaving the patterned desktop visible around it.
 */
import { test, expect } from 'vitest';
import { classicTheme } from '@jsvision/core';
import type { PasteEvent } from '@jsvision/core';
import { Button, Group, Input, createRoot } from '@jsvision/ui';
import inputExample from '../examples/controls/input.js';
import { EXAMPLES } from '../examples/index.js';
import { absoluteOrigin, buildLabExample, frameText, key, viewsIn } from './example-lab-harness.js';

/** Create a terminal paste event for exercising the real Input insertion path. */
function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false };
}

/** Build the Input example and collect its fields and actions in display order. */
function buildInputExample() {
  const { app, dialog } = buildLabExample('controls/input', inputExample);
  const views = viewsIn(dialog);
  return {
    app,
    dialog,
    inputs: views.filter((view): view is Input => view instanceof Input),
    buttons: views.filter((view): view is Button => view instanceof Button),
  };
}

// A template1 example owns its complete application instead of using the generic component stage.
test('the Input example is registered as a template1 application', () => {
  const entry = EXAMPLES.find((candidate) => candidate.id === 'controls/input');
  expect(entry?.kind).toBe('app');
});

// The showcase must retain the Classic shell, centered compact dialog, and one-cell inner padding.
test('the Input dialog is centered, padded, compact, and matches the Classic menu background', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildInputExample();
    const desktop = app.desktop;
    if (desktop === undefined) throw new Error('the Input example has no desktop');

    expect(dialog.bounds.width).toBeLessThan(desktop.bounds.width);
    expect(dialog.bounds.height).toBeLessThan(desktop.bounds.height);
    expect(dialog.bounds.x).toBe(Math.floor((desktop.bounds.width - dialog.bounds.width) / 2));
    expect(dialog.bounds.y).toBe(Math.floor((desktop.bounds.height - dialog.bounds.height) / 2));

    const content = dialog.children.find((child): child is Group => child instanceof Group);
    if (content === undefined) throw new Error('the Input dialog has no inset content group');
    expect(content.bounds.x).toBe(2);
    expect(content.bounds.y).toBe(2);
    expect(dialog.bounds.width - (content.bounds.x + content.bounds.width)).toBe(2);
    expect(dialog.bounds.height - (content.bounds.y + content.bounds.height)).toBe(2);

    const origin = absoluteOrigin(dialog);
    const menuCell = app.loop.renderRoot.buffer().get(10, 0);
    const dialogCell = app.loop.renderRoot.buffer().get(origin.x + 1, origin.y + 1);
    expect(menuCell?.bg).toBe(classicTheme.menuBar.bg);
    expect(dialogCell?.bg).toBe(menuCell?.bg);
    dispose();
  });
});

// The gallery must show placeholders, length limits, validators, live binding, and overflow at once.
test('the Input lab presents its complete state gallery without hiding the desktop', () => {
  createRoot((dispose) => {
    const { app, inputs, buttons } = buildInputExample();

    expect(inputs).toHaveLength(4);
    expect(inputs.map((input) => input.getMaxLength())).toEqual([24, 3, 12, 64]);
    expect(buttons.map((button) => button.activation.label)).toEqual(['Load sample', 'Check fields', 'Clear']);
    expect(frameText(app)).toContain('Letters and spaces');
    expect(frameText(app)).toContain('0–150');
    expect(frameText(app)).toContain('555-123-4567');
    expect(frameText(app)).toContain('►');
    expect(frameText(app)).toContain('Ctrl+A/C/X/V');
    dispose();
  });
});

// Filter and maxLength operate on paste as well as ordinary keystrokes.
test('the name field filters characters and caps the bound value at 24 characters', () => {
  createRoot((dispose) => {
    const { app, inputs } = buildInputExample();
    const nameInput = inputs[0];
    if (nameInput === undefined) throw new Error('the Input lab has no name field');

    app.loop.dispatch(key('n', { alt: true }));
    app.loop.dispatch(paste('Ada 9Lovelace! writes reliable examples'));
    expect(nameInput.getValueSignal()()).toBe('Ada Lovelace writes reli');
    dispose();
  });
});

// Range validation waits for completion and reports an out-of-range value after focus leaves.
test('the age field rejects letters live and marks 151 invalid on blur', () => {
  createRoot((dispose) => {
    const { app, inputs } = buildInputExample();
    const ageInput = inputs[1];
    if (ageInput === undefined) throw new Error('the Input lab has no age field');

    app.loop.dispatch(key('a', { alt: true }));
    app.loop.dispatch(paste('1x51'));
    expect(ageInput.getValueSignal()()).toBe('151');
    app.loop.dispatch(key('tab'));
    expect(ageInput.invalid).toBe(true);
    dispose();
  });
});

// Picture validation inserts the punctuation while the user types the phone digits.
test('the phone field auto-fills its picture mask', () => {
  createRoot((dispose) => {
    const { app, inputs } = buildInputExample();
    const phoneInput = inputs[2];
    if (phoneInput === undefined) throw new Error('the Input lab has no phone field');

    app.loop.dispatch(key('p', { alt: true }));
    app.loop.dispatch(paste('5551234567'));
    expect(phoneInput.getValueSignal()()).toBe('555-123-4567');
    dispose();
  });
});

// Selection is reactive, and the action row demonstrates external updates to every bound signal.
test('the long field reports selection and the action row can load, validate, and clear bound values', () => {
  createRoot((dispose) => {
    const { app, inputs } = buildInputExample();
    const longInput = inputs[3];
    if (longInput === undefined) throw new Error('the Input lab has no long-value field');

    app.loop.dispatch(key('l', { alt: true }));
    app.loop.dispatch(key('a', { ctrl: true }));
    expect(longInput.hasSelection()).toBe(true);
    expect(frameText(app)).toContain('selection: active');

    app.loop.dispatch(key('s', { alt: true }));
    expect(inputs.map((input) => input.getValueSignal()())).toEqual([
      'Ada Lovelace',
      '36',
      '555-123-4567',
      'This value is deliberately longer than the visible field',
    ]);

    app.loop.dispatch(key('k', { alt: true }));
    expect(frameText(app)).toContain('Status: all fields valid');

    app.loop.dispatch(key('c', { alt: true }));
    expect(inputs.map((input) => input.getValueSignal()())).toEqual(['', '', '', '']);
    expect(frameText(app)).toContain('Status: cleared');
    dispose();
  });
});
