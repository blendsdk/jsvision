/**
 * Immutable consumer oracles for Files localization. Package-owned actions, metadata, and error
 * chrome may translate; filesystem paths and names remain opaque caller data.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { Commands, Group, createApplication, createEventLoop, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { errorBox } from '../src/dialog/error-dialog.js';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { FileInfoPane } from '../src/list/file-info-pane.js';
import { openFile } from '../src/openers.js';
import type { DirEntry } from '../src/fs/types.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const filesDutch = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'files.action.open': '~O~penen',
    'files.action.cancel': '~A~fbreken',
    'files.action.ok': '~G~ereed',
    'files.dialog.error.title': 'Bestandsfout',
    'files.error.invalid-file-name': "Ongeldige bestandsnaam: '${name}'",
    'files.info.month.january.short': 'JAN-NL',
  },
});

function fixtureI18n() {
  return createI18n({ locale: 'nl', catalogs: [filesDutch] });
}

function fixtureFs() {
  return createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'Résumé.RAW.TS': file({ size: 42, mtime: new Date(2026, 0, 4, 9, 5) }),
        }),
      }),
    }),
  );
}

function textOf(loop: ReturnType<typeof createEventLoop>): string {
  loop.renderRoot.flush();
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

test('openFile uses host.i18n for actions while preserving a real filename and extension', async () => {
  const root = new Group();
  const loop = createEventLoop({ width: 55, height: 21 }, { caps });
  loop.mount(root);
  const host = {
    i18n: fixtureI18n(),
    loop,
    desktop: {
      addWindow: (view: View) => root.add(view),
      removeWindow: (view: View) => root.remove(view),
    },
  };

  const result = openFile(host, { fs: fixtureFs(), directory: '/home/user', wildcard: '*.TS' });
  const screen = textOf(loop);
  expect(screen).toContain('Openen');
  expect(screen).toContain('Afbreken');
  expect(screen).toContain('Résumé.RAW.TS');
  expect(screen).toContain('/home/user/*.TS');

  loop.emitCommand(Commands.cancel);
  await expect(result).resolves.toBeNull();
});

test('FileDialog localizes save/error defaults but keeps caller title and invalid name exact', () => {
  const errors: string[] = [];
  const callerTitle = 'CALLER /tmp/Ω';
  const invalidName = '';
  const dialog = new FileDialog({
    fs: fixtureFs(),
    directory: signal('/home/user'),
    filename: signal(invalidName),
    save: true,
    title: callerTitle,
    i18n: fixtureI18n(),
    showError: (message) => errors.push(message),
  });

  expect(dialog.buttonLabels).toContain('~G~ereed');
  expect(dialog.valid(Commands.ok)).toBe(false);
  expect(errors).toEqual([`Ongeldige bestandsnaam: '${invalidName}'`]);

  dialog.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 49, height: 19 } });
  const root = new Group();
  root.add(dialog);
  const loop = createEventLoop({ width: 49, height: 19 }, { caps });
  loop.mount(root);
  expect(textOf(loop)).toContain(callerTitle);
});

test('FileInfoPane localizes month metadata without changing path or filename bytes', () => {
  const path = '/home/user/Ångström';
  const wildcard = '*.RAW.TS';
  const filename = 'Cafe\u0301.RAW.TS';
  const entry: DirEntry = {
    name: filename,
    kind: 'file',
    size: 42,
    mtime: new Date(2026, 0, 4, 9, 5),
    hidden: false,
  };
  const pane = new FileInfoPane({
    fs: fixtureFs(),
    directory: () => path,
    wildcard: () => wildcard,
    focusedEntry: () => entry,
    i18n: fixtureI18n(),
  });
  pane.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 64, height: 2 } });
  const root = new Group();
  root.add(pane);
  const loop = createEventLoop({ width: 64, height: 2 }, { caps });
  loop.mount(root);

  const screen = textOf(loop);
  expect(screen).toContain(`${path}/${wildcard}`);
  expect(screen).toContain(filename);
  expect(screen).toContain('JAN-NL');
});

test('errorBox uses host.i18n for owned chrome and preserves its message', async () => {
  const app = createApplication({
    caps,
    viewport: { width: 60, height: 14 },
    i18n: fixtureI18n(),
  });
  const message = 'CALLER path /tmp/Cafe\u0301.RAW.TS';
  const result = errorBox(app, message);
  app.loop.renderRoot.flush();
  const screen = app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
  expect(screen).toContain('Bestandsfout');
  expect(screen).toContain('Gereed');
  expect(screen).toContain(message);
  app.loop.emitCommand(Commands.ok);
  await result;
});
