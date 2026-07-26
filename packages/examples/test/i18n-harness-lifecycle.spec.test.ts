/**
 * Immutable registry and reconstruction oracle for the dedicated multilingual QA harness.
 *
 * Locale changes rebuild framework state instead of mutating a live internationalization service.
 * The supervisor accepts and retains only validated serializable locale and story identifiers.
 */
import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import type { Catalog, I18n } from '@jsvision/i18n';
import type { Application, Signal, View } from '@jsvision/ui';

const HARNESS_MODULE = '../i18n-demo/harness.js';
const OFFICIAL_LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'] as const;
const REQUIRED_CATEGORIES = [
  'standard-actions',
  'ui',
  'forms',
  'files',
  'datagrid',
  'formatting',
  'overrides',
  'unicode',
  'code-editor',
] as const;

/** Serializable state that is allowed to survive a reconstruction. */
interface SupervisorSelection {
  readonly locale: string;
  readonly storyId: string;
}

/** Stable public metadata for one registry entry. */
interface StoryMetadata {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly coverage: readonly string[];
  readonly viewports: {
    readonly standard: { readonly width: number; readonly height: number };
    readonly narrow: readonly { readonly width: number; readonly height: number }[];
    readonly infeasible: { readonly width: number; readonly height: number };
  };
}

/** Public lifecycle handle for one fresh story construction. */
interface StoryLifecycle {
  readonly root: View;
  readonly state: Signal<unknown>;
  close(): Promise<void>;
}

/** One fresh five-catalog application and its story-owned lifecycle. */
interface I18nDemoSession {
  readonly selection: SupervisorSelection;
  readonly catalogs: readonly Catalog[];
  readonly i18n: I18n;
  readonly application: Application;
  readonly registry: readonly StoryMetadata[];
  readonly story: StoryLifecycle;
  readonly callerData?: Uint8Array;
  isDisposed(): boolean;
}

/**
 * The supervisor owns only its validated selection. Active framework objects are passed into a
 * transition, preventing them from leaking into serialized shell state.
 */
interface I18nDemoSupervisor {
  readonly selection: SupervisorSelection;
  construct(options?: { readonly callerData?: Uint8Array }): Promise<I18nDemoSession>;
  transition(
    previous: I18nDemoSession,
    requested: SupervisorSelection,
  ): Promise<{ readonly supervisor: I18nDemoSupervisor; readonly session: I18nDemoSession }>;
  toJSON(): SupervisorSelection;
}

/** Contract surface exported by the multilingual harness module. */
interface HarnessModule {
  readonly OFFICIAL_I18N_LOCALES: readonly string[];
  readonly I18N_STORIES: readonly StoryMetadata[];
  createI18nDemoSupervisor(selection: SupervisorSelection): I18nDemoSupervisor;
  restoreI18nDemoSupervisor(saved: unknown): I18nDemoSupervisor;
}

/** Load the future harness lazily so each missing contract reports its own named red test. */
async function loadHarness(): Promise<HarnessModule> {
  return import(HARNESS_MODULE);
}

/** Find one required story by public category and optional coverage tag. */
function storyIn(stories: readonly StoryMetadata[], category: string, coverage?: string): StoryMetadata | undefined {
  return stories.find(
    (story) => story.category === category && (coverage === undefined || story.coverage.includes(coverage)),
  );
}

// Registry IDs and categories are the stable shell/headless API; titles and viewport metadata keep
// construction data-driven rather than branching on private widget types.
test('publishes a complete typed registry with stable unique metadata', async () => {
  const harness = await loadHarness();
  expect(harness.OFFICIAL_I18N_LOCALES).toEqual(OFFICIAL_LOCALES);
  expect(new Set(harness.I18N_STORIES.map(({ id }) => id)).size).toBe(harness.I18N_STORIES.length);
  for (const category of REQUIRED_CATEGORIES) {
    expect(storyIn(harness.I18N_STORIES, category), `${category} story`).toBeDefined();
  }
  for (const story of harness.I18N_STORIES) {
    expect(story.id).toMatch(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/);
    expect(story.title).toBeTruthy();
    expect(story.viewports.standard).toEqual({ width: 80, height: 24 });
    expect(story.viewports.narrow.length).toBeGreaterThan(0);
    expect(story.viewports.infeasible.width).toBeLessThanOrEqual(
      Math.min(...story.viewports.narrow.map(({ width }) => width)),
    );
  }
});

// Every named surface from the multilingual acceptance contract is represented by public coverage
// tags, including all Code Editor internationalized presentation families.
test('registers every required surface and Code Editor integration story', async () => {
  const harness = await loadHarness();
  const requiredCoverage = {
    'standard-actions': ['single', 'pair', 'long', 'wrapped', 'vertical'],
    ui: [
      'message',
      'confirm',
      'input',
      'find',
      'replace',
      'editor-dialog',
      'dropdown',
      'popup',
      'switch',
      'calendar',
      'date-picker',
    ],
    forms: ['sync', 'async'],
    files: ['file', 'change-directory', 'error'],
    datagrid: ['filter', 'value-list', 'personalization'],
    formatting: ['number', 'date', 'plural', 'parameters'],
    overrides: ['long-caption', 'malformed-accelerator'],
    unicode: ['wide', 'emoji', 'combining'],
    'code-editor': ['search', 'replace', 'diagnostics', 'assistance', 'status', 'degradation', 'invisible-warning'],
  } as const;

  for (const [category, coverage] of Object.entries(requiredCoverage)) {
    for (const tag of coverage) {
      expect(storyIn(harness.I18N_STORIES, category, tag), `${category}/${tag}`).toBeDefined();
    }
  }
});

// Catalog module objects may be cached, but each construction owns a fresh five-package catalog
// array, I18n service, Application, registry entries, root view, and story Signal.
test('constructs fresh five-package framework and story identities every time', async () => {
  const harness = await loadHarness();
  const storyId = harness.I18N_STORIES[0]?.id;
  expect(storyId).toBeDefined();
  if (storyId === undefined) return;
  const supervisor = harness.createI18nDemoSupervisor({ locale: 'nl', storyId });
  const first = await supervisor.construct();
  const second = await supervisor.construct();

  expect(first.catalogs).toHaveLength(5);
  expect(second.catalogs).toHaveLength(5);
  expect(first.catalogs).not.toBe(second.catalogs);
  expect(first.i18n).not.toBe(second.i18n);
  expect(first.application).not.toBe(second.application);
  expect(first.registry).not.toBe(second.registry);
  expect(first.registry[0]).not.toBe(second.registry[0]);
  expect(first.story.root).not.toBe(second.story.root);
  expect(first.story.state).not.toBe(second.story.state);
  await first.story.close();
  await second.story.close();
});

// The terminal shell identifies its current selection and states that a locale command rebuilds the
// application. Reconstruction commands remain reachable even when the selected story is a modal.
test('renders the active locale/story selector and routes reconstruction commands through modals', async () => {
  const harness = await loadHarness();
  const modalStory = storyIn(harness.I18N_STORIES, 'ui', 'message');
  expect(modalStory).toBeDefined();
  if (modalStory === undefined) return;
  const session = await harness.createI18nDemoSupervisor({ locale: 'en', storyId: modalStory.id }).construct();
  const screen = session.application.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
  expect(screen).toContain('Locale en (rebuild)');
  expect(screen).toContain(`Story ${modalStory.id}`);

  let routed = 0;
  session.application.onCommand('i18n-demo:next-story', () => {
    routed += 1;
  });
  session.application.loop.emitCommand('i18n-demo:next-story');
  expect(routed).toBe(1);
  await session.story.close();
});

// The supervisor's own enumerable state is byte-serializable locale/story data. Framework objects
// live only in the separately returned active session.
test('allowlists supervisor state to validated serializable locale and story identifiers', async () => {
  const harness = await loadHarness();
  const storyId = harness.I18N_STORIES[0]?.id;
  expect(storyId).toBeDefined();
  if (storyId === undefined) return;
  const supervisor = harness.createI18nDemoSupervisor({ locale: 'fr', storyId });
  const forbiddenState = { locale: 'fr', storyId, application: 'forbidden' };

  expect(supervisor.toJSON()).toEqual({ locale: 'fr', storyId });
  expect(JSON.parse(JSON.stringify(supervisor))).toEqual({ locale: 'fr', storyId });
  expect(Object.values(supervisor)).not.toContainEqual(expect.objectContaining({ loop: expect.anything() }));
  expect(() => harness.createI18nDemoSupervisor(forbiddenState)).toThrow();
});

// Requested input is strict. Only restoration of a previously saved, now-unregistered story may
// select the first entry, while invalid locales and explicit unknown story requests are rejected.
test('validates requested selections and limits first-story fallback to saved stale IDs', async () => {
  const harness = await loadHarness();
  const firstStory = harness.I18N_STORIES[0]?.id;
  expect(firstStory).toBeDefined();
  if (firstStory === undefined) return;

  expect(() => harness.createI18nDemoSupervisor({ locale: 'ja', storyId: firstStory })).toThrow();
  expect(() => harness.createI18nDemoSupervisor({ locale: 'en', storyId: 'missing/story' })).toThrow();
  expect(harness.restoreI18nDemoSupervisor({ locale: 'de', storyId: 'removed/story' }).selection).toEqual({
    locale: 'de',
    storyId: firstStory,
  });
  expect(() => harness.restoreI18nDemoSupervisor({ locale: 'ja', storyId: firstStory })).toThrow();
  expect(() => harness.restoreI18nDemoSupervisor({ locale: 'en' })).toThrow();
});

// Locale transition first closes and disposes the old session, then creates fresh framework, focus,
// modal, handler, view, and reactive identities while preserving only the selected story ID.
test('reconstructs fresh state when the locale changes for the same story', async () => {
  const harness = await loadHarness();
  const storyId = storyIn(harness.I18N_STORIES, 'ui', 'confirm')?.id ?? harness.I18N_STORIES[0]?.id;
  expect(storyId).toBeDefined();
  if (storyId === undefined) return;
  const supervisor = harness.createI18nDemoSupervisor({ locale: 'en', storyId });
  const previous = await supervisor.construct();
  const oldFocus = previous.application.loop.getFocused();
  const oldModal = previous.application.desktop?.activeWindow();
  expect(oldFocus, 'the confirmation story establishes focus before transition').not.toBeNull();
  expect(oldModal, 'the confirmation story establishes a modal before transition').not.toBeNull();
  let oldHandlerCalls = 0;
  previous.application.onCommand('identity-probe', () => {
    oldHandlerCalls += 1;
  });

  const transitioned = await supervisor.transition(previous, { locale: 'sv', storyId });
  const current = transitioned.session;
  current.application.loop.emitCommand('identity-probe');
  previous.application.loop.emitCommand('identity-probe');

  expect(previous.isDisposed()).toBe(true);
  expect(previous.story.root.mounted, 'old story root mounted state').toBe(false);
  expect(previous.application.loop.renderRoot.originOf(previous.story.root), 'old story render attachment').toBeNull();
  expect(previous.application.loop.getFocused(), 'old application focus after disposal').toBeNull();
  expect(previous.application.desktop?.activeWindow(), 'old application modal after disposal').toBeNull();
  expect(current.selection).toEqual({ locale: 'sv', storyId });
  expect(current.i18n).not.toBe(previous.i18n);
  expect(current.application).not.toBe(previous.application);
  expect(current.story.root).not.toBe(previous.story.root);
  expect(current.story.state).not.toBe(previous.story.state);
  expect(current.application.loop.getFocused()).not.toBe(oldFocus);
  expect(current.application.desktop?.activeWindow()).not.toBe(oldModal);
  expect(oldHandlerCalls).toBe(0);
  await current.story.close();
});

// Story changes in one locale and repeated reconstruction obey the same disposal/freshness rules;
// no special locale-change path may accidentally preserve a live story.
test('reconstructs and disposes for story changes and repeated selections', async () => {
  const harness = await loadHarness();
  const firstStory = harness.I18N_STORIES[0]?.id;
  const secondStory = harness.I18N_STORIES[1]?.id;
  expect(firstStory).toBeDefined();
  expect(secondStory).toBeDefined();
  if (firstStory === undefined || secondStory === undefined) return;

  const firstSupervisor = harness.createI18nDemoSupervisor({ locale: 'pl', storyId: firstStory });
  const first = await firstSupervisor.construct();
  const changed = await firstSupervisor.transition(first, { locale: 'pl', storyId: secondStory });
  const repeated = await changed.supervisor.transition(changed.session, { locale: 'pl', storyId: secondStory });

  expect(first.isDisposed()).toBe(true);
  expect(changed.session.isDisposed()).toBe(true);
  expect(repeated.session.application).not.toBe(changed.session.application);
  expect(repeated.session.i18n).not.toBe(changed.session.i18n);
  expect(repeated.session.registry).not.toBe(changed.session.registry);
  expect(repeated.session.story.root).not.toBe(changed.session.story.root);
  await repeated.session.story.close();
});

// Reconstruction copies opaque caller bytes exactly and never localizes, normalizes, or mutates
// paths, source text, records, or form values owned by the caller.
test('preserves caller-owned data byte-for-byte across reconstruction', async () => {
  const harness = await loadHarness();
  const storyId = harness.I18N_STORIES[0]?.id;
  expect(storyId).toBeDefined();
  if (storyId === undefined) return;
  const original = new TextEncoder().encode('/tmp/資料/e\u0301.ts\u0000const π = \"🙂\";');
  const expected = original.slice();
  const supervisor = harness.createI18nDemoSupervisor({ locale: 'ro', storyId });
  const first = await supervisor.construct({ callerData: original });
  const transitioned = await supervisor.transition(first, { locale: 'pt-PT', storyId });

  expect(original).toEqual(expected);
  expect(transitioned.session.callerData).toEqual(expected);
  expect(transitioned.session.callerData).not.toBe(original);
  await transitioned.session.story.close();
});

// The package command uses the same repository TS runner pattern as the other interactive demos.
test('publishes the terminal-native demo:i18n command', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  expect(packageJson.scripts?.['demo:i18n']).toBe('tsx i18n-demo/main.ts');
});
