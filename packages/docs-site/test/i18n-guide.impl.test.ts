/**
 * Implementation hardening for the Internationalization course laboratories.
 *
 * These checks stress diagnostic deduplication, rejected overlays, repeated locale reconstruction,
 * Unicode cell geometry, resize behavior, and repeat-safe cleanup beyond the immutable course
 * contract.
 */
import { Button, View, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import catalogExample from '../examples/guides/i18n-catalogs.js';
import layoutExample from '../examples/guides/i18n-locale-layout.js';
import { CatalogLabPanel } from '../src/example-fixtures/i18n-guide/catalog-lab-panel.js';
import { LocaleLayoutPanel } from '../src/example-fixtures/i18n-guide/locale-layout-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

/** Return one fixture instance from a mounted laboratory. */
function fixtureIn<T extends View>(dialog: View, constructor: new () => T): T {
  const fixture = viewsIn(dialog).find((view): view is T => view instanceof constructor);
  if (fixture === undefined) throw new Error(`Laboratory is missing ${constructor.name}`);
  return fixture;
}

/** Return either cleanup-aware fixture when a parameterized test supplies a constructor union. */
function cleanupFixtureIn(
  dialog: View,
  constructor: typeof CatalogLabPanel | typeof LocaleLayoutPanel,
): CatalogLabPanel | LocaleLayoutPanel {
  const fixture = viewsIn(dialog).find((view): view is CatalogLabPanel | LocaleLayoutPanel =>
    constructor === CatalogLabPanel ? view instanceof CatalogLabPanel : view instanceof LocaleLayoutPanel,
  );
  if (fixture === undefined) throw new Error(`Laboratory is missing ${constructor.name}`);
  return fixture;
}

describe('catalog laboratory edges', () => {
  test('deduplicates repeated missing-key diagnostics without retaining parameter values', () => {
    const panel = new CatalogLabPanel();

    panel.showMissing('keyboard');
    panel.showMissing('mouse');
    panel.i18n.t('app.files', { params: {} });

    expect(panel.missingRuns).toBe(2);
    expect(panel.i18n.diagnostics.filter((item) => item.code === 'MISSING_TRANSLATION')).toHaveLength(1);
    expect(panel.i18n.diagnostics.map((item) => Object.keys(item).sort())).toEqual([
      ['code', 'key', 'locale', 'severity'],
      ['code', 'key', 'locale', 'severity'],
    ]);
  });

  test('keeps the prior catalog readable when an unsafe overlay is rejected', () => {
    const panel = new CatalogLabPanel();
    expect(panel.i18n.t('app.save')).toBe('Opslaan');

    panel.publishOverlay('keyboard');

    expect(panel.overlayRuns).toBe(1);
    expect(panel.i18n.t('app.save')).toBe('Bewaren');
    expect(panel.i18n.availableLocales).toEqual(['en', 'nl']);
  });

  test('preserves interaction evidence through maximize and restore', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/i18n-catalogs', catalogExample, {
        viewport: { width: 120, height: 40 },
      });
      const panel = fixtureIn(dialog, CatalogLabPanel);
      panel.translate('keyboard');
      panel.showMissing('keyboard');
      panel.publishOverlay('keyboard');
      app.loop.renderRoot.flush();

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog);

      expect(frameText(app)).toMatch(/fallback:\s*2 files[\s\S]*missing translation[\s\S]*atomic overlay/iu);
      expect(panel.i18n.t('app.save')).toBe('Bewaren');
      app.loop.dispose();
      dispose();
    });
  });
});

describe('locale reconstruction and geometry edges', () => {
  test('reconstructs repeatedly without mutating the readonly locale contract', () => {
    const panel = new LocaleLayoutPanel();

    panel.switchLocale('keyboard');
    expect(panel.locale).toBe('de');
    panel.switchLocale('mouse');
    expect(panel.locale).toBe('en');
    panel.switchLocale('keyboard');

    expect(panel.locale).toBe('de');
    expect(panel.switchRuns).toBe(3);
  });

  test('keeps long German buttons and Unicode cell evidence inside the lesson panel', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/i18n-locale-layout', layoutExample);
      const panel = fixtureIn(dialog, LocaleLayoutPanel);
      panel.switchLocale('keyboard');
      app.loop.renderRoot.flush();

      const panelOrigin = absoluteOrigin(panel);
      const panelRight = panelOrigin.x + panel.bounds.width;
      const panelBottom = panelOrigin.y + panel.bounds.height;
      const translatedButtons = viewsIn(panel).filter((view): view is Button => view instanceof Button);
      expect(translatedButtons.map((button) => button.activation.label)).toEqual([
        'Einstellungen übernehmen',
        'Änderungen verwerfen',
      ]);
      for (const button of translatedButtons) {
        const origin = absoluteOrigin(button);
        expect(origin.x).toBeGreaterThanOrEqual(panelOrigin.x);
        expect(origin.y).toBeGreaterThanOrEqual(panelOrigin.y);
        expect(origin.x + button.bounds.width).toBeLessThanOrEqual(panelRight);
        expect(origin.y + button.bounds.height).toBeLessThanOrEqual(panelBottom);
      }
      expect(frameText(app)).toMatch(/wide\s*界[\s\S]*combining\s*é/iu);
      collectTemplate1Evidence(app, dialog);
      app.loop.dispose();
      dispose();
    });
  });

  test.each([
    ['guides/i18n-catalogs', catalogExample, CatalogLabPanel],
    ['guides/i18n-locale-layout', layoutExample, LocaleLayoutPanel],
  ] as const)('cleans %s exactly once under repeated disposal', (_id, example, Fixture) => {
    let panel: CatalogLabPanel | LocaleLayoutPanel | undefined;
    let descendants: View[] = [];
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(_id, example);
      panel = cleanupFixtureIn(dialog, Fixture);
      descendants = viewsIn(dialog);

      app.loop.dispose();
      app.loop.dispose();
      dispose();
    });

    expect(panel?.cleanupCount).toBe(1);
    expect(descendants.every((view) => !view.mounted && view.scope === null)).toBe(true);
  });
});
