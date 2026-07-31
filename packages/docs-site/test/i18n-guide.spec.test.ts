/**
 * Immutable oracle for the Internationalization course and its two teaching laboratories.
 *
 * The course must teach catalog ownership, safe publication, locale-bound reconstruction, and
 * translated terminal geometry through public APIs. The laboratories then prove those contracts
 * with deterministic catalogs instead of visitor network, filesystem, or locale state.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createI18n, defineCatalog, isI18nError, loadI18n, plural, select, validateCatalog } from '@jsvision/i18n';
import { Button, View, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/i18n.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'i18n');
const catalogLabId = 'guides/i18n-catalogs';
const layoutLabId = 'guides/i18n-locale-layout';

interface CatalogLabPanel extends View {
  readonly lessonName: 'Catalog lookup and safe publication';
  readonly translationRuns: number;
  readonly missingRuns: number;
  readonly overlayRuns: number;
  readonly cleanupCount: number;
}

interface LocaleLayoutPanel extends View {
  readonly lessonName: 'Locale reconstruction and translated geometry';
  readonly locale: 'en' | 'de';
  readonly switchRuns: number;
  readonly actionRuns: number;
  readonly replacedSubtrees: number;
  readonly disposedSubtrees: number;
  readonly lastReplacedActions?: View;
  readonly cleanupCount: number;
}

/** Find the course panel through its stable, learner-facing lesson name. */
function panelIn<T extends View>(dialog: View, lessonName: string): T {
  const panel = viewsIn(dialog).find((view): view is T => 'lessonName' in view && view.lessonName === lessonName);
  if (panel === undefined) throw new Error(`Internationalization lab is missing "${lessonName}"`);
  return panel;
}

/** Return authored TypeScript snippets without treating live-example modules as page snippets. */
function snippets(): readonly string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

/** Load one registered application laboratory. */
async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

/** Drag the real resize affordance so responsive behavior is not inferred from direct rectangles. */
function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const corner = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: corner,
    to: { x: corner.x + 8, y: corner.y + 3 },
  });
}

/** Activate one real Button by mouse through its rendered terminal coordinates. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], button: Button): void {
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

/** Minimal disposable generation used to prove application-owned handoff ordering. */
interface ApplicationGeneration {
  /** Stable fixture identity. */
  readonly name: string;
  /** Release the detached generation exactly once. */
  dispose(): void;
}

/** Application-owned slot that atomically redirects input to one ready generation. */
interface ApplicationSlot {
  /** Swap the active application and return the now-detached previous generation. */
  replace(next: ApplicationGeneration): ApplicationGeneration;
}

/** Publish one ready generation, rolling back only a failed slot replacement. */
function publishGeneration(slot: ApplicationSlot, next: ApplicationGeneration): ApplicationGeneration {
  let previous: ApplicationGeneration;
  try {
    previous = slot.replace(next);
  } catch (cause) {
    next.dispose();
    throw cause;
  }
  previous.dispose();
  return next;
}

describe('Internationalization course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Internationalization',
      page: '/guide/i18n',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['application-shell', 'text-unicode-and-cells'],
      learningOutcomes: [
        'Define, load, validate, and switch locale catalogs through public entry points.',
        'Design translated layouts, formatted values, diagnostics, and multilingual QA.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [catalogLabId, layoutLabId],
    });
  });

  test('should state the learner contract and follow a complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the internationalization mental model?',
      '## How do I produce the first translated result?',
      '## Laboratory: catalog lookup and safe publication',
      '## How do catalogs, fallbacks, and messages compose?',
      '## How do I validate and load untrusted catalogs?',
      '## How do I switch locale safely?',
      '## Laboratory: locale reconstruction and translated geometry',
      '## How do translated layouts stay usable?',
      '## How do formatting, diagnostics, and trust boundaries work?',
      '## How do I test every supported locale?',
      '## How do I diagnose internationalization failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:locale|catalog).+(?:layout|format|diagnostic).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,500}\bexplain\b[\s\S]{0,500}\bdiagnos(?:e|is)\b[\s\S]{0,500}\bverify\b/iu,
    );
    expect(source).toMatch(
      /(?:assume|already know|comfortable with)[\s\S]{0,450}(?:application shell)[\s\S]{0,350}(?:Unicode|terminal cell)/iu,
    );
    expect(source).toMatch(/beginner[\s\S]{0,450}intermediate[\s\S]{0,450}advanced/iu);
    expect(source).toContain(`<PlayExample id="${catalogLabId}"`);
    expect(source).toContain(`<PlayExample id="${layoutLabId}"`);
  });

  test('should teach public catalog construction, lookup, fallback, and structured messages', () => {
    expect(source).toMatch(/defineCatalog[\s\S]{0,450}schema:\s*1[\s\S]{0,250}locale[\s\S]{0,250}messages/iu);
    expect(source).toMatch(/namespac(?:e|ed)[\s\S]{0,350}(?:key|message)/iu);
    expect(source).toMatch(/later[\s\S]{0,250}(?:catalog|layer)[\s\S]{0,250}(?:win|override)/iu);
    expect(source).toMatch(
      /requested locale[\s\S]{0,350}(?:language|base)[\s\S]{0,350}(?:fallbackLocales|fallback locale)[\s\S]{0,250}English/iu,
    );
    expect(source).toMatch(/plural[\s\S]{0,300}Intl\.PluralRules[\s\S]{0,250}other/iu);
    expect(source).toMatch(/select[\s\S]{0,300}exact[\s\S]{0,250}other/iu);
    expect(source).toMatch(/\$\$\{name\}[\s\S]{0,200}(?:literal|escape)/iu);
    expect(source).toMatch(/createApplication\s*\(\s*\{[\s\S]{0,180}i18n/iu);

    const firstResult = snippets().find(
      (snippet) =>
        /from ['"]@jsvision\/i18n['"]/u.test(snippet) &&
        /\bdefineCatalog\s*\(/u.test(snippet) &&
        /\bcreateI18n\s*\(/u.test(snippet) &&
        /\.t\s*\(/u.test(snippet),
    );
    expect(firstResult, 'minimal defineCatalog/createI18n/t snippet').toBeDefined();
  });

  test('should teach validation, asynchronous loading, atomic overlays, and locale reconstruction', () => {
    expect(source).toMatch(/partial[\s\S]{0,450}strict/iu);
    expect(source).toMatch(
      /strict[\s\S]{0,500}(?:referenceCatalog|reference catalog)[\s\S]{0,350}(?:placeholderManifest|placeholder manifest)[\s\S]{0,350}(?:acceleratorManifest|accelerator manifest)/iu,
    );
    expect(source).toMatch(
      /loadI18n[\s\S]{0,500}(?:required source|required:\s*true)[\s\S]{0,350}(?:optional source|required:\s*false)[\s\S]{0,350}(?:atomic|publish)/iu,
    );
    expect(source).toMatch(/AbortSignal|AbortController/u);
    expect(source).toMatch(
      /network[\s\S]{0,350}(?:authentication|authorization)[\s\S]{0,350}(?:retry|timeout|cache)/iu,
    );
    expect(source).toMatch(
      /setCatalog[\s\S]{0,350}(?:same locale|overlay)[\s\S]{0,350}(?:validat|atomic)[\s\S]{0,300}(?:previous|existing)/iu,
    );
    expect(source).toMatch(
      /(?:switch|change).+locale[\s\S]{0,500}fresh[\s\S]{0,220}I18n[\s\S]{0,220}Application[\s\S]{0,350}(?:dispose|cleanup)/iu,
    );
    expect(source).not.toMatch(/(?:setLocale|changeLocale|mutateLocale)\s*\(/u);
  });

  test('should teach translated cell geometry, diagnostics, safety, and multilingual QA', () => {
    expect(source).toMatch(/measureButtonGroup[\s\S]{0,400}buttonGroup/iu);
    expect(source).toMatch(
      /(?:display|terminal)[ -]cell[\s\S]{0,300}(?:wide|combining)[\s\S]{0,300}(?:accelerator|~X~)[\s\S]{0,300}(?:JavaScript|\\.length)/iu,
    );
    expect(source).toMatch(/long[\s\S]{0,250}(?:label|caption)[\s\S]{0,300}(?:wrap|resize|viewport|clip)/iu);
    expect(source).toMatch(
      /diagnostic[\s\S]{0,350}(?:bounded|100)[\s\S]{0,350}(?:deduplicat|value-free)[\s\S]{0,350}(?:parameter value|translated text)/iu,
    );
    expect(source).toMatch(/unsafe[\s\S]{0,300}(?:control|bidi|Unicode|terminal)/iu);
    expect(source).toContain('yarn workspace @jsvision/examples demo:i18n');
    expect(source).toMatch(
      /en[\s,|/]+nl[\s,|/]+de[\s,|/]+fr[\s,|/]+es[\s,|/]+it[\s,|/]+pt-PT[\s,|/]+pl[\s,|/]+ro[\s,|/]+sv/u,
    );
    expect(source).toMatch(/normal[\s\S]{0,450}constrained/iu);
    expect(source).toMatch(/monochrome[\s\S]{0,300}ASCII-safe|ASCII-safe[\s\S]{0,300}monochrome/iu);
  });

  test('should include a concrete failure table, practices, exercises, and owning references', () => {
    for (const phrase of [
      'missing translation',
      'missing parameter',
      'invalid catalog',
      'source failed',
      'clipped',
      'stale',
    ]) {
      expect(source.toLowerCase()).toContain(phrase);
    }
    expect(source).toMatch(/symptom[\s\S]{0,200}cause[\s\S]{0,200}(?:correction|fix)[\s\S]{0,200}evidence/iu);
    expect(source).toMatch(/## What should I practice next\?[\s\S]{0,1800}(?:exercise|experiment)/iu);
    expect(source).toContain('../guide/application-shell');
    expect(source).toContain('../guide/text-unicode-and-cells');
    expect(source).toContain('../reference/i18n');
    expect(source).toContain('/api/i18n/');
    expect(source).toContain('/api/i18n-node/');
  });
});

describe('Internationalization public behavior evidence', () => {
  test('should resolve structured messages, fallbacks, diagnostics, and atomic overlays', () => {
    const en = defineCatalog({
      schema: 1,
      locale: 'en',
      messages: {
        'app.files': plural('count', { one: '${count} file', other: '${count} files' }),
        'app.role': select('role', { admin: 'Administrator', other: 'Member' }),
        'app.save': 'Save',
      },
    });
    const nl = defineCatalog({
      schema: 1,
      locale: 'nl',
      messages: { 'app.save': 'Opslaan' },
    });
    const i18n = createI18n({ locale: 'nl-BE', fallbackLocales: ['en'], catalogs: [en, nl] });

    expect(i18n.t('app.save')).toBe('Opslaan');
    expect(i18n.t('app.files', { params: { count: 2 } })).toBe('2 files');
    expect(i18n.t('app.role', { params: { role: 'admin' } })).toBe('Administrator');
    expect(i18n.t('app.missing')).toBe('app.missing');
    expect(i18n.diagnostics.map((diagnostic) => diagnostic.code)).toContain('MISSING_TRANSLATION');

    expect(() => i18n.setCatalog({ schema: 1, locale: 'nl', messages: { 'app.save': '\u001b[31munsafe' } })).toThrow();
    expect(i18n.t('app.save')).toBe('Opslaan');
    i18n.setCatalog({ schema: 1, locale: 'nl', messages: { 'app.save': 'Bewaren' } });
    expect(i18n.t('app.save')).toBe('Bewaren');
  });

  test('should distinguish partial application validation from strict catalog completeness', () => {
    const reference = defineCatalog({
      schema: 1,
      locale: 'en',
      messages: { 'app.open': '~O~pen', 'app.close': '~C~lose' },
    });
    const partial = { schema: 1, locale: 'de', messages: { 'app.open': '~Ö~ffnen' } };

    expect(validateCatalog(partial, { mode: 'partial' })).toEqual([]);
    expect(
      validateCatalog(partial, {
        mode: 'strict',
        referenceCatalog: reference,
        acceleratorManifest: {
          scopes: [{ name: 'actions', keys: ['app.open', 'app.close'] }],
        },
        official: true,
      }).some((issue) => issue.severity === 'error'),
    ).toBe(true);
  });

  test('should load required and optional sources atomically and honor caller cancellation', async () => {
    const successful = defineCatalog({
      schema: 1,
      locale: 'en',
      messages: { 'app.ready': 'Ready' },
    });
    const optional = await loadI18n({
      locale: 'en',
      sources: [
        {
          name: 'optional-product-copy',
          required: false,
          async load() {
            throw new Error('fixture failure');
          },
        },
        {
          name: 'required-application-copy',
          async load() {
            return successful;
          },
        },
      ],
    });
    expect(optional.t('app.ready')).toBe('Ready');
    expect(optional.diagnostics).toEqual([
      {
        code: 'SOURCE_FAILED',
        severity: 'warning',
        key: '',
        locale: 'en',
        source: 'optional-product-copy',
      },
    ]);

    await expect(
      loadI18n({
        sources: [
          {
            name: 'required-copy',
            async load() {
              throw new Error('fixture failure');
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_FAILED' });

    const controller = new AbortController();
    controller.abort('sensitive reason');
    await expect(loadI18n({ signal: controller.signal, sources: [] })).rejects.toMatchObject({
      code: 'ABORTED',
    });
  });

  test('should format and compare by locale while rejecting typed invalid values', () => {
    const i18n = createI18n({
      locale: 'de-DE',
      catalogs: [
        defineCatalog({
          schema: 1,
          locale: 'de',
          messages: { 'app.literal': '$${name}' },
        }),
      ],
    });

    expect(i18n.t('app.literal')).toBe('${name}');
    expect(i18n.number(1234.5)).toMatch(/1[.\u00a0]234,5/u);
    expect(i18n.date(Date.UTC(2026, 6, 30), { timeZone: 'UTC' })).toContain('2026');
    expect(i18n.compare('Apfel', 'Zitrone', { sensitivity: 'base' })).toBeLessThan(0);
    for (const operation of [
      () => i18n.number(Number.POSITIVE_INFINITY),
      () => i18n.date(new Date(Number.NaN)),
      () => i18n.compare('\u001b[31m', 'safe'),
    ]) {
      try {
        operation();
        throw new Error('Expected internationalization operation to reject invalid input');
      } catch (cause) {
        expect(isI18nError(cause)).toBe(true);
      }
    }
  });

  test('should atomically replace a ready application before disposing the detached generation', () => {
    const events: string[] = [];
    const makeApplication = (name: string): ApplicationGeneration => ({
      name,
      dispose: () => events.push(`dispose:${name}`),
    });
    let active = makeApplication('en');
    const slot: ApplicationSlot = {
      replace(next) {
        const previous = active;
        active = next;
        events.push('replace');
        return previous;
      },
    };

    const next = makeApplication('de');
    const published = publishGeneration(slot, next);

    expect(published).toBe(next);
    expect(active).toBe(next);
    expect(events).toEqual(['replace', 'dispose:en']);
  });

  test('should roll back replacement failure without disposing an active published generation', () => {
    const events: string[] = [];
    const current: ApplicationGeneration = {
      name: 'en',
      dispose: () => events.push('dispose:en'),
    };
    let active = current;
    const failedCandidate: ApplicationGeneration = {
      name: 'de-failed',
      dispose: () => events.push('dispose:de-failed'),
    };
    const failingSlot: ApplicationSlot = {
      replace() {
        throw new Error('publication failed');
      },
    };

    expect(() => publishGeneration(failingSlot, failedCandidate)).toThrow('publication failed');
    expect(active).toBe(current);
    expect(events).toEqual(['dispose:de-failed']);

    const cleanupFailure = new Error('old cleanup failed');
    const previousWithFailingCleanup: ApplicationGeneration = {
      name: 'en',
      dispose() {
        events.push('dispose:en');
        throw cleanupFailure;
      },
    };
    active = previousWithFailingCleanup;
    const ready: ApplicationGeneration = {
      name: 'de',
      dispose: () => events.push('dispose:de'),
    };
    const workingSlot: ApplicationSlot = {
      replace(next) {
        const previous = active;
        active = next;
        events.push('replace');
        return previous;
      },
    };

    expect(() => publishGeneration(workingSlot, ready)).toThrow(cleanupFailure);
    expect(active).toBe(ready);
    expect(events).toEqual(['dispose:de-failed', 'replace', 'dispose:en']);
  });
});

describe('Internationalization live laboratories', () => {
  test.each([
    [catalogLabId, 'Catalog lookup and safe publication'],
    [layoutLabId, 'Locale reconstruction and translated geometry'],
  ] as const)('should render %s as a compact, responsive Classic application', async (id, lessonName) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      panelIn(dialog, lessonName);
      collectTemplate1Evidence(app, dialog);
      app.loop.dispose();
      dispose();
    });

    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 70, height: 24 },
      });
      collectTemplate1Evidence(app, dialog);
      app.loop.dispose();
      dispose();
    });

    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      resizeDialog(app, dialog);
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });

      app.loop.dispose();
      dispose();
    });
  });

  test('should expose lookup, missing-key, and atomic-overlay outcomes by keyboard', async () => {
    const definition = await loadDefinition(catalogLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(catalogLabId, definition);
      const panel = panelIn<CatalogLabPanel>(dialog, 'Catalog lookup and safe publication');

      dispatchExampleAction(app, { kind: 'key', key: 't', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'm', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'o', modifiers: ['Alt'] });
      app.loop.renderRoot.flush();

      expect(panel.translationRuns).toBe(1);
      expect(panel.missingRuns).toBe(1);
      expect(panel.overlayRuns).toBe(1);
      expect(frameText(app)).toMatch(/fallback[\s\S]*missing translation[\s\S]*(?:overlay|atomic)/iu);
      app.loop.dispose();
      dispose();
      expect(panel.cleanupCount).toBe(1);
    });
  });

  test('should expose every catalog action through mouse controls', async () => {
    const definition = await loadDefinition(catalogLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(catalogLabId, definition);
      const panel = panelIn<CatalogLabPanel>(dialog, 'Catalog lookup and safe publication');
      const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
      for (const label of ['Translate', 'Missing key', 'Overlay']) {
        const button = buttons.find((candidate) => candidate.activation.label === label);
        if (button === undefined) throw new Error(`Catalog lab is missing ${label}`);
        clickButton(app, button);
      }

      expect(panel.translationRuns).toBe(1);
      expect(panel.missingRuns).toBe(1);
      expect(panel.overlayRuns).toBe(1);
      app.loop.dispose();
      dispose();
    });
  });

  test('should reconstruct the locale and preserve long Unicode action geometry', async () => {
    const definition = await loadDefinition(layoutLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(layoutLabId, definition);
      const panel = panelIn<LocaleLayoutPanel>(dialog, 'Locale reconstruction and translated geometry');

      expect(panel.locale).toBe('en');
      dispatchExampleAction(app, { kind: 'key', key: 'l', modifiers: ['Alt'] });
      app.loop.renderRoot.flush();

      expect(panel.locale).toBe('de');
      expect(panel.switchRuns).toBe(1);
      expect(panel.replacedSubtrees).toBe(1);
      expect(panel.disposedSubtrees).toBe(1);
      expect(panel.lastReplacedActions?.mounted).toBe(false);
      expect(panel.lastReplacedActions?.scope).toBeNull();
      expect(frameText(app)).toMatch(/de[\s\S]*(?:Über|Änder|Einstellungen)[\s\S]*(?:wide|combining|cells)/iu);
      const translatedButtons = viewsIn(panel).filter((view): view is Button => view instanceof Button);
      const apply = translatedButtons[0];
      const discard = translatedButtons[1];
      if (apply === undefined || discard === undefined) throw new Error('Translated actions are missing');
      app.loop.focusView(apply);
      expect(apply.state.focused).toBe(true);
      dispatchExampleAction(app, { kind: 'key', key: 'space', modifiers: [] });
      clickButton(app, discard);
      app.loop.renderRoot.flush();
      expect(panel.actionRuns).toBe(2);
      expect(frameText(app)).toMatch(/discard activated/iu);
      expect(frameText(app)).not.toMatch(/Status:[^\n]*~/u);
      collectTemplate1Evidence(app, dialog);
      const switchLocale = viewsIn(dialog).find(
        (view): view is Button => view instanceof Button && view.activation.label === 'Switch Locale',
      );
      if (switchLocale === undefined) throw new Error('Locale switch action is missing');
      clickButton(app, switchLocale);
      expect(panel.locale).toBe('en');
      expect(panel.switchRuns).toBe(2);
      expect(panel.replacedSubtrees).toBe(2);
      expect(panel.disposedSubtrees).toBe(2);
      app.loop.dispose();
      dispose();
      expect(panel.cleanupCount).toBe(1);
    });
  });
});
