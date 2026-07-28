/**
 * Implementation coverage for Files accelerator recovery and translated action-column geometry.
 */
import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { filesAcceleratorLabel } from '../src/i18n/label.js';
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
const LOCALES = [filesEn, filesNl, filesDe, filesFr, filesEs, filesIt, filesPtPT, filesPl, filesRo, filesSv];

test('should fall back only a malformed Files accelerator label', () => {
  const service = createI18n({
    locale: 'en',
    catalogs: [
      defineCatalog({
        schema: 1,
        locale: 'en',
        messages: {
          'files.action.open': '~Ö~ffnen',
          'files.action.cancel': '~D~ismiss',
        },
      }),
    ],
  });

  expect(filesAcceleratorLabel(service, 'files.action.open', '~O~pen')).toBe('~O~pen');
  expect(filesAcceleratorLabel(service, 'files.action.cancel', '~C~ancel')).toBe('~D~ismiss');
});

describe.each(LOCALES)('ChDirDialog translated geometry for $locale', (catalog) => {
  test('should allocate every action its intrinsic display-cell width', () => {
    const fs = createMemoryFs(dir({ child: dir() }));
    const dialog = new ChDirDialog({
      fs,
      directory: signal('/'),
      i18n: createI18n({ locale: catalog.locale, catalogs: [catalog] }),
    });
    dialog.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 48, height: 18 } });
    const root = new Group();
    root.add(dialog);
    const loop = createEventLoop({ width: 48, height: 18 }, { caps });
    loop.mount(root);

    for (const button of dialog.buttons) {
      expect(button.measure().width).toBeLessThanOrEqual(button.bounds.width);
    }
  });
});
