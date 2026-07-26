/**
 * Immutable requirements for translated dialog geometry.
 *
 * Framework and caller text is measured in terminal cells. A feasible desktop expands a preferred
 * compact dialog until its complete action group fits; a hard smaller desktop may clip the surface,
 * but it must retain every action in source/focus order.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { createApplication } from '../src/app/index.js';
import { Button } from '../src/controls/index.js';
import { messageBox } from '../src/dialog/index.js';
import { stringWidth } from '../src/controls/measure.js';
import { Group } from '../src/view/index.js';
import type { View } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Return every descendant in stable tree order. */
function descendants(view: View): readonly View[] {
  if (!(view instanceof Group)) return [];
  return view.children.flatMap((child) => [child, ...descendants(child)]);
}

const expandedActions = createI18n({
  locale: 'de',
  catalogs: [
    defineCatalog({
      schema: 1,
      locale: 'de',
      messages: {
        'ui.action.ok': '~Ä~nderungen übernehmen',
        'ui.action.cancel': '~V~organg vollständig abbrechen',
      },
    }),
  ],
});

test('a feasible message box uses display cells and expands for the complete translated action group', async () => {
  const app = createApplication({ caps, viewport: { width: 80, height: 24 }, i18n: expandedActions });
  const text = '界界界界界界界界界界界界界界界界界界';
  const pending = messageBox(app, { title: 'Übersicht', text, buttons: 'okCancel' });
  app.loop.renderRoot.flush();

  const dialog = app.desktop.activeWindow();
  expect(dialog).not.toBeNull();
  const buttons = descendants(dialog!).filter((view): view is Button => view instanceof Button);
  expect(buttons).toHaveLength(2);
  expect(dialog!.bounds.width).toBeGreaterThanOrEqual(stringWidth(text) + 6);
  for (const button of buttons) {
    expect(button.bounds.width).toBeGreaterThanOrEqual(button.measure().width);
    const origin = app.loop.renderRoot.originOf(button);
    const dialogOrigin = app.loop.renderRoot.originOf(dialog!);
    expect(origin).not.toBeNull();
    expect(dialogOrigin).not.toBeNull();
    expect((origin?.x ?? 0) + button.bounds.width).toBeLessThanOrEqual((dialogOrigin?.x ?? 0) + dialog!.bounds.width);
  }

  app.loop.emitCommand('cancel');
  await pending;
});

test('the compact English message-box geometry remains compatible', async () => {
  const app = createApplication({ caps, viewport: { width: 60, height: 20 } });
  const pending = messageBox(app, { title: 'T', text: 'hi', buttons: 'okCancel' });
  app.loop.renderRoot.flush();

  expect(app.desktop.activeWindow()?.bounds).toMatchObject({ width: 40, height: 9 });

  app.loop.emitCommand('cancel');
  await pending;
});

test('a wide translated title is complete and centered by display cells', async () => {
  const app = createApplication({ caps, viewport: { width: 80, height: 24 }, i18n: expandedActions });
  const title = '界界界界界界界界界界界界界界界界';
  const pending = messageBox(app, { title, text: 'Body', buttons: 'ok' });
  app.loop.renderRoot.flush();
  const dialog = app.desktop.activeWindow();
  const origin = app.loop.renderRoot.originOf(dialog!);
  const titleRow = app.loop.renderRoot.buffer().rows()[origin?.y ?? 0];
  const titleStart = titleRow.findIndex((cell) => cell.char === '界');

  expect(dialog!.bounds.width).toBeGreaterThanOrEqual(stringWidth(title) + 16);
  expect(titleRow.map((cell) => cell.char).join('')).toContain(title);
  expect(titleStart - (origin?.x ?? 0)).toBe(Math.floor((dialog!.bounds.width - stringWidth(title)) / 2));

  app.loop.emitCommand('ok');
  await pending;
});

test('an infeasible hard bound keeps every translated action in focus order', async () => {
  const app = createApplication({ caps, viewport: { width: 28, height: 8 }, i18n: expandedActions });
  const pending = messageBox(app, { title: 'T', text: 'Body', buttons: 'okCancel' });
  app.loop.renderRoot.flush();
  const dialog = app.desktop.activeWindow();
  const buttons = descendants(dialog!).filter((view): view is Button => view instanceof Button);

  expect(app.loop.getFocused()).toBe(buttons[0]);
  app.loop.focusNext();
  expect(app.loop.getFocused()).toBe(buttons[1]);
  expect(buttons.every((button) => button.parent !== null && button.focusable)).toBe(true);

  app.loop.emitCommand('cancel');
  await pending;
});
