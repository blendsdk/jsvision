/**
 * Implementation coverage for package-owned editor messages that are interpolated or selected by
 * the editor-dialog wiring layer.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { createApplication } from '../src/app/index.js';
import { wireEditorDialogs } from '../src/editor/dialogs.js';
import { Commands } from '../src/status/index.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Create an isolated service with only the messages exercised by this implementation suite. */
function createEditorI18n() {
  return createI18n({
    locale: 'nl',
    catalogs: [
      defineCatalog({
        schema: 1,
        locale: 'nl',
        messages: {
          'ui.editor.search-not-found': 'Niet gevonden.',
          'ui.editor.save-modified': '${name} bewaren?',
          'ui.action.ok': '~O~kee',
          'ui.action.yes': '~J~a',
          'ui.action.no': '~N~ee',
          'ui.action.cancel': '~A~fbreken',
        },
      }),
    ],
  });
}

/** Read the complete rendered application surface. */
function screen(app: ReturnType<typeof createApplication>): string {
  const buffer = app.loop.renderRoot.buffer();
  const rows: string[] = [];
  for (let y = 0; y < buffer.height; y += 1) {
    let row = '';
    for (let x = 0; x < buffer.width; x += 1) row += buffer.get(x, y)?.char ?? ' ';
    rows.push(row);
  }
  return rows.join('\n');
}

test('wireEditorDialogs localizes its search failure message', async () => {
  const app = createApplication({
    caps,
    viewport: { width: 50, height: 14 },
    i18n: createEditorI18n(),
  });
  const result = wireEditorDialogs(app)({ kind: 'searchFailed' });
  app.loop.renderRoot.flush();

  expect(screen(app)).toContain('Niet gevonden.');
  app.loop.emitCommand(Commands.ok);
  await expect(result).resolves.toEqual({ kind: 'ok' });
});

test('wireEditorDialogs interpolates caller filenames without translating them', async () => {
  const app = createApplication({
    caps,
    viewport: { width: 50, height: 14 },
    i18n: createEditorI18n(),
  });
  const result = wireEditorDialogs(app)({ kind: 'saveModify', name: 'résumé.txt' });
  app.loop.renderRoot.flush();

  expect(screen(app)).toContain('résumé.txt bewaren?');
  app.loop.emitCommand(Commands.no);
  await expect(result).resolves.toEqual({ kind: 'confirm', answer: 'no' });
});
