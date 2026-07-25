/**
 * Implementation coverage for localized button geometry and per-label accelerator recovery.
 */
import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog, validateCatalog } from '@jsvision/i18n';
import { Button } from '../src/controls/index.js';
import { buttonBand } from '../src/dialog/message-box.js';
import { yesNoButtons } from '../src/dialog/buttons.js';
import { UI_ACCELERATOR_MANIFEST } from '../src/i18n/scopes.js';
import { UI_ENGLISH_CATALOG } from '../src/i18n/catalog.js';
import { createRenderRoot } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

describe('localized button geometry', () => {
  test('should allocate equal display-cell widths for a wide-glyph label', () => {
    const wide = new Button('~A~界界界界');
    const narrow = new Button('~O~K');
    const band = buttonBand(wide, narrow);
    const root = createRenderRoot({ width: 40, height: 2 }, { caps });

    root.mount(band);

    expect(wide.measure().width).toBe(13);
    expect(wide.bounds.width).toBe(wide.measure().width);
    expect(narrow.bounds.width).toBe(wide.measure().width);
  });
});

test('should deeply freeze the public accelerator topology', () => {
  expect(Object.isFrozen(UI_ACCELERATOR_MANIFEST)).toBe(true);
  expect(Object.isFrozen(UI_ACCELERATOR_MANIFEST.scopes)).toBe(true);
  for (const scope of UI_ACCELERATOR_MANIFEST.scopes) {
    expect(Object.isFrozen(scope)).toBe(true);
    expect(Object.isFrozen(scope.keys)).toBe(true);
  }
});

test('should keep the canonical no-service English catalog collision-free', () => {
  expect(
    validateCatalog(UI_ENGLISH_CATALOG, {
      official: true,
      acceleratorManifest: UI_ACCELERATOR_MANIFEST,
    }),
  ).toEqual([]);
});

describe('application accelerator recovery', () => {
  test.each(['Accept', '~Ö~verride', '~A~ccept ~N~ow', '~~Accept', '~AB~'])(
    'should fall back only the malformed label %s',
    (invalidYes) => {
      const service = createI18n({
        locale: 'en',
        catalogs: [
          defineCatalog({
            schema: 1,
            locale: 'en',
            messages: {
              'ui.action.yes': invalidYes,
              'ui.action.no': '~D~ecline',
            },
          }),
        ],
      });

      const [yes, no] = yesNoButtons(service);

      expect(yes.accelerators()).toEqual(['y']);
      expect(yes.measure().width).toBe(7);
      expect(no.accelerators()).toEqual(['d']);
      expect(no.measure().width).toBe(11);
    },
  );

  test('should retain one valid marker alongside an escaped literal tilde', () => {
    const service = createI18n({
      locale: 'en',
      catalogs: [
        defineCatalog({
          schema: 1,
          locale: 'en',
          messages: { 'ui.action.yes': '~A~ccept ~~ terms' },
        }),
      ],
    });

    const [yes] = yesNoButtons(service);

    expect(yes.accelerators()).toEqual(['a']);
  });
});
