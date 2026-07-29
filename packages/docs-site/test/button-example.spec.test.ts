/**
 * Specification tests for the live Button showcase.
 *
 * The example is a hands-on control laboratory: visitors can compare the normal, default, and
 * disabled faces at once, use every keyboard activation path, and watch a Save action join the Tab
 * order when its input becomes non-empty. It opens in a compact, centered dialog whose Classic
 * background matches the application menu bar.
 */
import { test, expect } from 'vitest';
import { classicTheme } from '@jsvision/core';
import { Button, Group, createRoot } from '@jsvision/ui';
import buttonExample from '../examples/controls/button.js';
import { EXAMPLES } from '../examples/index.js';
import { absoluteOrigin, buildLabExample, frameText, key, viewsIn } from './example-lab-harness.js';

/** Build the registered Button example through the same shell used by the browser. */
function buildButtonExample() {
  const { app, dialog } = buildLabExample('controls/button', buttonExample);
  return { app, dialog, buttons: viewsIn(dialog).filter((view): view is Button => view instanceof Button) };
}

test('the Button example owns its centered application dialog', () => {
  const entry = EXAMPLES.find((candidate) => candidate.id === 'controls/button');
  expect(entry?.kind).toBe('app');
});

test('the Button dialog is centered, does not fill the desktop, and matches the Classic menu background', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildButtonExample();
    const desktop = app.desktop;
    if (desktop === undefined) throw new Error('the Button example has no desktop');

    expect(dialog.bounds.width).toBeLessThan(desktop.bounds.width);
    expect(dialog.bounds.height).toBeLessThan(desktop.bounds.height);
    expect(dialog.bounds.x).toBe(Math.floor((desktop.bounds.width - dialog.bounds.width) / 2));
    expect(dialog.bounds.y).toBe(Math.floor((desktop.bounds.height - dialog.bounds.height) / 2));

    const content = dialog.children.find((child): child is Group => child instanceof Group);
    if (content === undefined) throw new Error('the Button dialog has no inset content group');
    // One frame cell plus one content-padding cell separates the content from every dialog edge.
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

test('the Button lab presents normal, default, disabled, and reactive actions together', () => {
  createRoot((dispose) => {
    const { app, buttons } = buildButtonExample();
    const labels = buttons.map((button) => button.activation.label);

    expect(labels).toEqual(['Preview', 'Deploy', 'Unavailable', 'Save changes']);
    expect(frameText(app)).toContain('State gallery');
    expect(frameText(app)).toContain('Reactive disabled state');
    expect(buttons.find((button) => button.activation.label === 'Unavailable')?.state.disabled).toBe(true);
    expect(buttons.find((button) => button.activation.label === 'Save changes')?.state.disabled).toBe(true);
    dispose();
  });
});

test('typing a project name enables Save and its hotkey reports the saved value', () => {
  createRoot((dispose) => {
    const { app, buttons } = buildButtonExample();
    const save = buttons.find((button) => button.activation.label === 'Save changes');
    if (save === undefined) throw new Error('the Button lab has no Save changes action');

    app.loop.dispatch(key('n', { alt: true }));
    app.loop.dispatch(key('J'));
    app.loop.dispatch(key('S'));
    expect(save.state.disabled).toBe(false);

    app.loop.dispatch(key('s', { alt: true }));
    expect(frameText(app)).toContain('Saved "JS"');
    dispose();
  });
});

test('Enter activates the default command and a disabled hotkey remains inert', () => {
  createRoot((dispose) => {
    const { app, buttons } = buildButtonExample();
    const deploy = buttons.find((button) => button.activation.label === 'Deploy');
    expect(deploy?.activation.command).toBe('demo.button.deploy');

    app.loop.dispatch(key('u', { alt: true }));
    expect(frameText(app)).toContain('Last action: Nothing yet');

    app.loop.dispatch(key('enter'));
    expect(frameText(app)).toContain('Deploy command + callback');
    dispose();
  });
});
