/**
 * Immutable requirements for translated Files dialog geometry.
 *
 * Vertical action rails share the complete set's widest rendered width. Feasible hosts enlarge the
 * dialog for that rail and display-cell text; filesystem state and caller values remain untouched.
 */
import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { Button, Commands, createEventLoop, frameTitleMinimumWidth, Group, stringWidth } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { errorBox } from '../src/dialog/error-dialog.js';
import { FileInfoPane } from '../src/list/file-info-pane.js';
import {
  filesDe,
  filesEn,
  filesEs,
  filesFr,
  filesIt,
  filesNl,
  filesPl,
  filesPtPT,
  filesRo,
  filesSv,
} from '../src/i18n/locales.js';
import { createMemoryFs, dir } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const localeCatalogs = [filesEn, filesNl, filesDe, filesFr, filesEs, filesIt, filesPtPT, filesPl, filesRo, filesSv];

/** Return every descendant in stable tree order. */
function descendants(view: View): readonly View[] {
  if (!(view instanceof Group)) return [];
  return view.children.flatMap((child) => [child, ...descendants(child)]);
}

describe.each(localeCatalogs)('FileDialog complete action geometry for $locale', (catalog) => {
  test('uses one widest rendered width for every save-mode action', () => {
    const dialog = new FileDialog({
      fs: createMemoryFs(dir()),
      save: true,
      i18n: createI18n({ locale: catalog.locale, catalogs: [catalog] }),
    });
    const root = new Group();
    root.add(dialog);
    const loop = createEventLoop({ width: 80, height: 24 }, { caps });
    loop.mount(root);

    const widths = dialog.buttons.map((button) => button.bounds.width);
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeGreaterThanOrEqual(Math.max(...dialog.buttons.map((button) => button.measure().width)));
  });
});

const longFilesActions = createI18n({
  locale: 'de',
  catalogs: [
    defineCatalog({
      schema: 1,
      locale: 'de',
      messages: {
        'files.action.ok': '~Ä~nderungen übernehmen',
        'files.action.replace': 'Datei vollständig ~e~rsetzen',
        'files.action.clear': 'Eingabe vollständig ~l~öschen',
        'files.action.cancel': '~V~organg vollständig abbrechen',
        'files.action.help': '~H~ilfe und weitere Informationen',
        'files.dialog.error.title': 'Fehler',
        'files.dialog.change-directory.title': 'In ein anderes Arbeitsverzeichnis wechseln',
        'files.field.directory-name': '~V~ollständiger Verzeichnisname',
        'files.field.directory-tree': '~V~erzeichnisstruktur und Unterordner',
        'files.action.chdir': 'In das ~a~usgewählte Verzeichnis wechseln',
        'files.action.revert': 'Zum ~u~rsprünglichen Verzeichnis zurückkehren',
        'files.info.time.pm': 'nachmittags',
      },
    }),
  ],
});

test('a feasible FileDialog expands for the translated vertical rail without changing caller state', () => {
  const dialog = new FileDialog({
    fs: createMemoryFs(dir()),
    save: true,
    i18n: longFilesActions,
  });
  const root = new Group();
  root.add(dialog);
  const loop = createEventLoop({ width: 100, height: 24 }, { caps });
  loop.mount(root);

  const actionWidth = Math.max(...dialog.buttons.map((button) => button.measure().width));
  expect(dialog.bounds.width).toBeGreaterThanOrEqual(actionWidth + 27);
  expect(dialog.buttons.every((button) => button.bounds.width >= button.measure().width)).toBe(true);
  expect(dialog.directory()).toBe('/');
  expect(dialog.filename()).toBe('');
});

test('a feasible ChDirDialog expands for its complete translated vertical rail and labels', () => {
  const dialog = new ChDirDialog({
    fs: createMemoryFs(dir()),
    i18n: longFilesActions,
  });
  const root = new Group();
  root.add(dialog);
  const loop = createEventLoop({ width: 120, height: 24 }, { caps });
  loop.mount(root);

  const actionWidth = Math.max(...dialog.buttons.map((button) => button.measure().width));
  expect(dialog.bounds.width).toBeGreaterThanOrEqual(actionWidth + 38);
  expect(new Set(dialog.buttons.map((button) => button.bounds.width)).size).toBe(1);
  expect(dialog.buttons.every((button) => button.bounds.width >= button.measure().width)).toBe(true);
});

test('FileDialog accounts for translated title and field captions as geometry inputs', () => {
  const title = 'Eine außergewöhnlich ausführliche Dateiauswahl';
  const inputName = '~V~ollständiger Name der zu speichernden Datei';
  const dialog = new FileDialog({
    fs: createMemoryFs(dir()),
    save: true,
    title,
    inputName,
    i18n: longFilesActions,
  });
  const root = new Group();
  root.add(dialog);
  createEventLoop({ width: 120, height: 24 }, { caps }).mount(root);

  expect(dialog.bounds.width).toBeGreaterThanOrEqual(frameTitleMinimumWidth(title));
  expect(dialog.bounds.width).toBeGreaterThanOrEqual(stringWidth(inputName.replaceAll('~', '')) + 6);
});

test('FileInfoPane keeps a long translated period label visible at its trailing inset', () => {
  const fs = createMemoryFs(dir());
  const pane = new FileInfoPane({
    fs,
    directory: () => '/',
    wildcard: () => '*.*',
    focusedEntry: () => ({
      name: 'report.txt',
      kind: 'file',
      size: 12,
      mtime: new Date(2026, 0, 1, 13, 30),
      hidden: false,
    }),
    i18n: longFilesActions,
  });
  pane.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 60, height: 2 } });
  const root = new Group();
  root.add(pane);
  const loop = createEventLoop({ width: 60, height: 2 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const row = loop.renderRoot
    .buffer()
    .rows()[1]
    .map((cell) => cell.char)
    .join('');

  expect(row).toContain('01:30nachmittags');
  expect(row.endsWith('nachmittags  ')).toBe(true);
});

test('errorBox sizes wide caller text and its translated OK action in display cells', async () => {
  const root = new Group();
  const loop = createEventLoop({ width: 80, height: 24 }, { caps });
  loop.mount(root);
  let dialog: View | null = null;
  const host = {
    i18n: longFilesActions,
    loop,
    desktop: {
      addWindow: (view: View) => {
        dialog = view;
        root.add(view);
      },
      removeWindow: (view: View) => root.remove(view),
    },
  };
  const message = '界界界界界界界界界界界界界界界界界界';
  const pending = errorBox(host, message);
  loop.renderRoot.flush();

  expect(dialog).not.toBeNull();
  const action = descendants(dialog!).find((view): view is Button => view instanceof Button);
  expect(dialog!.bounds.width).toBeGreaterThanOrEqual(stringWidth(message) + 6);
  expect(action).toBeDefined();
  expect(action!.bounds.width).toBeGreaterThanOrEqual(action!.measure().width);

  loop.emitCommand(Commands.ok);
  await pending;
});
