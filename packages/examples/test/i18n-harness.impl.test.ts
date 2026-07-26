/**
 * Implementation-edge coverage for the multilingual harness input and teardown boundaries.
 *
 * The immutable specification files own product behavior. These cases exercise defensive branches
 * that keep invalid headless inputs and repeated cleanup from leaking partially mounted sessions.
 */
import { expect, test } from 'vitest';
import { CodeEditorWindow } from '@jsvision/code-editor';
import { FilterPopup, ValueList } from '@jsvision/datagrid';
import { ChDirDialog, FileDialog } from '@jsvision/files';
import { Calendar, ComboBox, DatePicker, Dialog, Group, Input, Switch } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { constructHeadlessI18nStory, createI18nDemoSupervisor, I18N_STORIES } from '../i18n-demo/harness.js';

/** Return the first stable story ID or fail clearly if the registry is accidentally empty. */
function firstStoryId(): string {
  const story = I18N_STORIES[0];
  if (story === undefined) throw new Error('The multilingual story registry is empty.');
  return story.id;
}

/** Find one registered story by category or fail with a useful implementation-test error. */
function storyId(category: string): string {
  const story = I18N_STORIES.find((candidate) => candidate.category === category);
  if (story === undefined) throw new Error(`The ${category} multilingual story is missing.`);
  return story.id;
}

/** Find a story that explicitly claims one package surface. */
function coveredStoryId(category: string, coverage: string): string {
  const story = I18N_STORIES.find(
    (candidate) => candidate.category === category && candidate.coverage.includes(coverage),
  );
  if (story === undefined) throw new Error(`The ${category}/${coverage} multilingual story is missing.`);
  return story.id;
}

/** Return every mounted descendant in stable tree order. */
function descendants(view: View): readonly View[] {
  const children = view instanceof Group ? view.children : [];
  return children.flatMap((child) => [child, ...descendants(child)]);
}

test('rejects unsupported locale, story, and viewport inputs before mounting a session', async () => {
  const storyId = firstStoryId();
  await expect(
    constructHeadlessI18nStory({
      locale: 'ja',
      storyId,
      viewport: { width: 80, height: 24 },
    }),
  ).rejects.toThrow(/locale/i);
  await expect(
    constructHeadlessI18nStory({
      locale: 'en',
      storyId: 'missing/story',
      viewport: { width: 80, height: 24 },
    }),
  ).rejects.toThrow(/story/i);
  await expect(
    constructHeadlessI18nStory({
      locale: 'en',
      storyId,
      viewport: { width: 0, height: 24 },
    }),
  ).rejects.toThrow(/viewport/i);
  await expect(
    constructHeadlessI18nStory({
      locale: 'en',
      storyId,
      viewport: { width: 40.5, height: 12 },
    }),
  ).rejects.toThrow(/viewport/i);
});

test('validates application overrides through the catalog safety boundary', async () => {
  await expect(
    constructHeadlessI18nStory({
      locale: 'en',
      storyId: firstStoryId(),
      viewport: { width: 80, height: 24 },
      applicationCatalog: { 'ui.action.ok': 'unsafe\u0007caption' },
    }),
  ).rejects.toThrow();
});

test('disposes a mounted headless story idempotently and prevents later inspection', async () => {
  const story = await constructHeadlessI18nStory({
    locale: 'sv',
    storyId: firstStoryId(),
    viewport: { width: 80, height: 24 },
  });
  expect(story.snapshot().surfaces).toHaveLength(1);

  await story.dispose();
  await story.dispose();

  expect(() => story.snapshot()).toThrow(/no longer active/i);
});

test('mounts real translated package components instead of metadata-only facades', async () => {
  const expectations = [
    {
      category: 'ui',
      coverage: 'dropdown',
      types: [Calendar, DatePicker, ComboBox, Switch],
    },
    { category: 'forms', coverage: 'async', types: [Dialog, Input] },
    { category: 'files', coverage: 'file', types: [FileDialog] },
    { category: 'files', coverage: 'change-directory', types: [ChDirDialog] },
    { category: 'files', coverage: 'error', types: [Dialog] },
    { category: 'datagrid', coverage: 'value-list', types: [FilterPopup, ValueList] },
    { category: 'datagrid', coverage: 'personalization', types: [Dialog, Input] },
    { category: 'code-editor', coverage: 'search', types: [CodeEditorWindow] },
  ] as const;

  for (const expectation of expectations) {
    const session = await createI18nDemoSupervisor({
      locale: 'de',
      storyId: coveredStoryId(expectation.category, expectation.coverage),
    }).construct();
    const views = [session.story.root, ...descendants(session.story.root)];
    for (const expectedType of expectation.types) {
      expect(
        views.some((view) => view instanceof expectedType),
        `${expectation.category} mounts ${expectedType.name}`,
      ).toBe(true);
    }
    const editorWindow = views.find((view): view is CodeEditorWindow => view instanceof CodeEditorWindow);
    if (editorWindow !== undefined) {
      expect(editorWindow.editor.journey).toContain('search.replaceOpen');
      expect(editorWindow.editor.controller.publicState.degradation.affectedFeatures).toContain('languageService');
      expect(editorWindow.editor.controller.presentation.assistance.completion?.items).toHaveLength(1);
      expect(editorWindow.editor.controller.document.text).toContain('\u202E');
      expect(editorWindow.statusView).toBeDefined();
    }
    await session.story.close();
  }
});

test('constructs every claimed UI dialog through a real modal surface', async () => {
  for (const coverage of ['message', 'confirm', 'input', 'find', 'replace'] as const) {
    const session = await createI18nDemoSupervisor({
      locale: 'fr',
      storyId: coveredStoryId('ui', coverage),
    }).construct();
    expect(session.story.root, `ui/${coverage} root`).toBeInstanceOf(Dialog);
    expect(session.application.loop.getFocused(), `ui/${coverage} focus`).not.toBeNull();
    await session.story.close();
    expect(session.application.loop.getFocused(), `ui/${coverage} disposed focus`).toBeNull();
  }
});

test('applies stress overlays to the pair and one-row action groups', async () => {
  const overrides = {
    'ui.action.ok': '~C~onfirm this unusually long operation 確認',
    'ui.action.cancel': '~D~ismiss this unusually long operation',
    'forms.action.cancel': '~A~bandon this unusually long form',
    'files.action.help': '~H~elp with this unusually long operation',
  };
  for (const arrangement of ['pair', 'one-row'] as const) {
    const metadata = I18N_STORIES.find(
      (candidate) => candidate.category === 'standard-actions' && candidate.coverage.includes(arrangement),
    );
    if (metadata === undefined) throw new Error(`The ${arrangement} action story is missing.`);
    const base = await constructHeadlessI18nStory({
      locale: 'en',
      storyId: metadata.id,
      viewport: metadata.viewports.standard,
    });
    const stressed = await constructHeadlessI18nStory({
      locale: 'en',
      storyId: metadata.id,
      viewport: metadata.viewports.standard,
      applicationCatalog: overrides,
    });

    expect(stressed.snapshot().actions.map(({ label }) => label)).not.toEqual(
      base.snapshot().actions.map(({ label }) => label),
    );
    await base.dispose();
    await stressed.dispose();
  }
});

test('preserves leading and continuation cells for wide Unicode glyphs', async () => {
  const session = await createI18nDemoSupervisor({
    locale: 'en',
    storyId: storyId('unicode'),
  }).construct();
  const rows = session.application.loop.renderRoot.buffer().rows();
  let wideCells = 0;
  let continuationCells = 0;

  for (const row of rows) {
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x];
      if (cell === undefined) continue;
      if (cell.width === 2) {
        wideCells += 1;
        expect(row[x + 1]?.width, `continuation after wide cell ${x}`).toBe(0);
      }
      if (cell.width === 0) {
        continuationCells += 1;
        expect(cell.char).toBe('');
        expect(row[x - 1]?.width, `leading cell before continuation ${x}`).toBe(2);
      }
    }
  }

  expect(wideCells).toBeGreaterThan(0);
  expect(continuationCells).toBe(wideCells);
  await session.story.close();
});
