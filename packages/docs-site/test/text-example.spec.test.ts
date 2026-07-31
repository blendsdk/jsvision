/**
 * Specification tests for the live Text showcase.
 *
 * The example must present Text's static, reactive, wrapping, Unicode, and semantic-severity
 * behavior in one compact template1 application. It opens in a centered Classic dialog with a
 * one-cell content inset beyond the frame and keeps the patterned desktop visible.
 */
import { test, expect } from 'vitest';
import { classicTheme } from '@jsvision/core';
import { Button, Group, Text, createRoot } from '@jsvision/ui';
import textExample from '../examples/controls/text.js';
import { EXAMPLES } from '../examples/index.js';
import { absoluteOrigin, buildLabExample, frameText, key, viewsIn } from './example-lab-harness.js';

/** Build the Text example and collect its text blocks and actions in display order. */
function buildTextExample() {
  const { app, dialog } = buildLabExample('controls/text', textExample);
  const views = viewsIn(dialog);
  return {
    app,
    dialog,
    texts: views.filter((view): view is Text => view instanceof Text),
    buttons: views.filter((view): view is Button => view instanceof Button),
  };
}

// A template1 example owns its complete application instead of using the generic component stage.
test('the Text example is registered as a template1 application', () => {
  const entry = EXAMPLES.find((candidate) => candidate.id === 'controls/text');
  expect(entry?.kind).toBe('app');
});

// The showcase must retain the Classic shell, centered compact dialog, and one-cell inner padding.
test('the Text dialog is centered, padded, compact, and matches the Classic menu background', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildTextExample();
    const desktop = app.desktop;
    if (desktop === undefined) throw new Error('the Text example has no desktop');

    expect(dialog.bounds.width).toBeLessThan(desktop.bounds.width);
    expect(dialog.bounds.height).toBeLessThan(desktop.bounds.height);
    expect(dialog.bounds.x).toBe(Math.floor((desktop.bounds.width - dialog.bounds.width) / 2));
    expect(dialog.bounds.y).toBe(Math.floor((desktop.bounds.height - dialog.bounds.height) / 2));

    const content = dialog.children.find((child): child is Group => child instanceof Group);
    if (content === undefined) throw new Error('the Text dialog has no inset content group');
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

// The gallery compares all public presentation modes without requiring interaction first.
test('the Text lab presents static, reactive, wrapped, Unicode, warning, and error text', () => {
  createRoot((dispose) => {
    const { app, texts, buttons } = buildTextExample();
    const frame = frameText(app);

    expect(texts.length).toBeGreaterThanOrEqual(7);
    expect(texts.every((text) => !text.focusable)).toBe(true);
    expect(buttons.map((button) => button.activation.label)).toEqual(['Increment', 'Toggle copy', 'Reset']);
    expect(frame).toContain('Count: 0');
    expect(frame).toContain('日本語');
    expect(frame).toContain('Warning: review before continuing.');
    expect(frame).toContain('Error: a required value is missing.');
    dispose();
  });
});

// Severity text must visibly use its semantic theme roles, not merely describe them.
test('the Text lab paints warning and error samples with the Classic semantic roles', () => {
  createRoot((dispose) => {
    const { app, texts } = buildTextExample();
    const warning = texts.find((text) => text.bounds.y === 9);
    const error = texts.find((text) => text.bounds.y === 10);
    if (warning === undefined || error === undefined) throw new Error('the Text example has no severity samples');

    const warningOrigin = absoluteOrigin(warning);
    const errorOrigin = absoluteOrigin(error);
    expect(app.loop.renderRoot.buffer().get(warningOrigin.x, warningOrigin.y)?.fg).toBe(classicTheme.warningText.fg);
    expect(app.loop.renderRoot.buffer().get(errorOrigin.x, errorOrigin.y)?.fg).toBe(classicTheme.dangerText.fg);
    dispose();
  });
});

// Reactive getters repaint after signal updates, while reset restores the initial teaching state.
test('the Text lab updates its reactive readout and copy through the action hotkeys', () => {
  createRoot((dispose) => {
    const { app } = buildTextExample();

    app.loop.dispatch(key('i', { alt: true }));
    expect(frameText(app)).toContain('Count: 1');

    app.loop.dispatch(key('t', { alt: true }));
    expect(frameText(app)).toContain('Detailed mode');

    app.loop.dispatch(key('r', { alt: true }));
    expect(frameText(app)).toContain('Count: 0');
    expect(frameText(app)).toContain('Concise mode');
    dispose();
  });
});
