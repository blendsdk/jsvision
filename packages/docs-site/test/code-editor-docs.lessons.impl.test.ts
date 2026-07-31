/**
 * Implementation hardening shared by the non-pilot Code Editor lesson cohorts.
 */
import { CodeEditor } from '@jsvision/code-editor';
import { createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import documentController from '../examples/code-editor/document-controller.js';
import externalChanges from '../examples/code-editor/external-changes.js';
import languageGallery from '../examples/code-editor/language-gallery.js';
import structuralFolding from '../examples/code-editor/structural-folding.js';
import themes from '../examples/code-editor/themes.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample, dispatchExampleAction, viewsIn } from './example-lab-harness.js';

/** Representative lesson from each migration cohort. */
const COHORT_LESSONS = [
  ['code-editor/document-controller', documentController],
  ['code-editor/language-gallery', languageGallery],
  ['code-editor/themes', themes],
] as const;

/** Resolve the authoritative direct editor mounted by a shared lesson. */
function editorIn(dialog: ReturnType<typeof buildLabExample>['dialog']): CodeEditor {
  const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
  if (editor === undefined) throw new Error('Code Editor lesson is missing its editor');
  return editor;
}

/** Resolve the content-free lesson probe without importing the concrete shell. */
function probeIn(dialog: ReturnType<typeof buildLabExample>['dialog']) {
  const probe = viewsIn(dialog).find(
    (view): view is typeof view & { read(name: string): string | number | boolean | undefined } =>
      'read' in view && typeof view.read === 'function',
  );
  if (probe === undefined) throw new Error('Code Editor lesson is missing its probe');
  return probe;
}

/** Allow bounded parser and host continuations to settle. */
async function settleLesson(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Preserve the literal definition type while using the generic lab harness. */
function buildLesson(id: string, definition: ExampleDefinition) {
  return buildLabExample(id, definition);
}

describe('Code Editor shared lesson shell hardening', () => {
  test.each(COHORT_LESSONS)('%s survives repeated action and reset cycles', async (id, definition) => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLesson(id, definition);
      try {
        const editor = editorIn(dialog);
        const probe = probeIn(dialog);
        const initialSource = editor.controller.document.text;
        for (let cycle = 0; cycle < 2; cycle += 1) {
          dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
          await settleLesson();
          expect(probe.read('status-text'), `${id} action ${cycle + 1}`).not.toBe('Ready');

          dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
          await settleLesson();
          expect(editor.controller.document.text, `${id} reset ${cycle + 1}`).toBe(initialSource);
          expect(probe.read('status-text'), `${id} reset ${cycle + 1}`).toBe('Ready');
        }
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('reset invalidates an external reload continuation that is still pending', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLesson('code-editor/external-changes', externalChanges);
      try {
        const editor = editorIn(dialog);
        const probe = probeIn(dialog);
        const initialSource = editor.controller.document.text;
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
        await settleLesson();

        expect(editor.controller.document.text).toBe(initialSource);
        expect(probe.read('status-text')).toBe('Ready');
        expect(probe.read('host-effects')).toBe('none');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('language gallery repaints each programming-language fixture with its real adapter', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLesson('code-editor/language-gallery', languageGallery);
      try {
        const editor = editorIn(dialog);
        for (const expectedLanguage of ['javascript', 'typescript', 'postgresql'] as const) {
          dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
          await settleLesson();
          expect(editor.controller.document.languageId).toBe(expectedLanguage);
          expect(editor.controller.languageResult?.adapterId).toBe(expectedLanguage);
          expect(editor.controller.languageResult?.syntax.length ?? 0).toBeGreaterThan(8);
        }
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('structural folding publishes an explicit parser-independent range', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLesson('code-editor/structural-folding', structuralFolding);
      try {
        const editor = editorIn(dialog);
        await settleLesson();
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        await settleLesson();

        expect(editor.controller.languageResult?.adapterId).toBe('docs-structural');
        expect(editor.controller.languageResult?.folds).toHaveLength(1);
        expect(editor.controller.folds).toHaveLength(1);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test.each(COHORT_LESSONS)('%s reflows its native editor across restore and maximize', async (id, definition) => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 110, height: 36 } });
      try {
        await settleLesson();
        const editor = editorIn(dialog);
        const maximized = { ...editor.bounds };
        dialog.zoom();
        app.loop.renderRoot.flush();
        expect(editor.bounds.width).toBeLessThan(maximized.width);
        expect(editor.bounds.height).toBeLessThan(maximized.height);

        dialog.zoom();
        app.loop.renderRoot.flush();
        expect(editor.bounds).toEqual(maximized);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('disposal aborts language work and leaves no retained editor tasks', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLesson('code-editor/language-gallery', languageGallery);
      const editor = editorIn(dialog);
      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
      app.loop.dispose();
      await settleLesson();

      expect(editor.retainedState).toMatchObject({
        completionItems: 0,
        popupRows: 0,
        pendingHostEffects: 0,
      });
      dispose();
    });
  });
});
