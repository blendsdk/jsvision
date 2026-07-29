/**
 * Presentation specifications for every non-pilot Code Editor lesson.
 *
 * A reader entering any specialist page must see a distinct, substantial editor workspace and
 * understand the capability without decoding an implementation-oriented state dump.
 */
import { CodeEditor, CodeEditorWindow } from '@jsvision/code-editor';
import { Button, View, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import {
  EXAMPLE_CAPS,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  viewsIn,
} from './example-lab-harness.js';

/** The remaining lesson IDs and the capability-named primary action each reader must see. */
const LESSONS = [
  ['code-editor/quick-start', 'Show window chrome', 'chrome.'],
  ['code-editor/document-controller', 'Apply document edit', 'advance.'],
  ['code-editor/external-changes', 'Reload external change', 'outcome.'],
  ['code-editor/editing-navigation', 'Edit & select', 'selection.'],
  ['code-editor/readonly-clipboard', 'Copy selection', 'zero.'],
  ['code-editor/language-gallery', 'Next language', 'adapter.'],
  ['code-editor/syntax-fallback', 'Trigger fallback', 'visible.'],
  ['code-editor/invisibles-line-endings', 'Reveal invisibles', 'count.'],
  ['code-editor/structural-folding', 'Fold structure', 'rows.'],
  ['code-editor/search', 'Find message', 'selection.'],
  ['code-editor/replace', 'Replace message', 'once.'],
  ['code-editor/lsp-navigation', 'Navigate to symbol', 'document.'],
  ['code-editor/viewport-mouse', 'Select with mouse', 'source.'],
  ['code-editor/large-document-tiers', 'Classify large document', 'result.'],
  ['code-editor/themes', 'Next editor theme', 'together.'],
  ['code-editor/theme-fallback', 'Resolve fallback', 'report.'],
  ['code-editor/safe-terminal-text', 'Show safe diagnostic', 'explanation.'],
  ['code-editor/host-recovery', 'Recover service', 'callback.'],
] as const;

interface ReadableProbe {
  read(name: string): string | number | boolean | undefined;
}

/** Narrow a mounted view to the content-free public lesson probe. */
function isReadableProbe(view: View): view is View & ReadableProbe {
  return 'read' in view && typeof view.read === 'function';
}

/** Load a lesson through the same lazy registry used by the documentation site. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing Code Editor lesson ${exampleId}`);
  return (await entry.load()).default;
}

/** Let parser, protocol, and host continuations reach a stable bounded state. */
async function settleLesson(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Resolve the authoritative editor surface from either direct or windowed composition. */
function editorIn(dialog: ReturnType<typeof buildLabExample>['dialog']): CodeEditor {
  const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
  if (editor === undefined) throw new Error('Code Editor lesson is missing its editor');
  return editor;
}

/** Render complete Template1 teaching text for reader-facing assertions. */
function renderedText(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  startup: 'compact' | 'maximized' = 'maximized',
): string {
  return collectTemplate1Evidence(app, dialog, { startup }).frameLines.join('\n');
}

/** Capture native editor and window state that a focused capability action is allowed to change. */
function nativeSignature(dialog: ReturnType<typeof buildLabExample>['dialog'], editor: CodeEditor): string {
  const windowed = viewsIn(dialog).find((view): view is CodeEditorWindow => view instanceof CodeEditorWindow);
  const frame = editor.project({
    width: Math.max(1, editor.bounds.width),
    height: Math.max(1, editor.bounds.height),
    caps: EXAMPLE_CAPS,
  });
  return JSON.stringify({
    source: editor.controller.document.text,
    identity: editor.controller.document.identity,
    language: editor.controller.document.languageId,
    selection: editor.controller.document.selection,
    folds: editor.controller.folds,
    diagnostics: editor.controller.diagnostics,
    search: editor.searchState,
    assistance: {
      visible: editor.assistanceView.state.visible,
      items: editor.assistanceView.items,
    },
    retained: editor.retainedState,
    theme: editor.themeInspection,
    viewport: editor.viewportMetrics,
    windowVisible: windowed?.state.visible ?? false,
    frame: frame.cellSignature,
  });
}

describe('Code Editor non-pilot flagship lessons', () => {
  test.each(LESSONS)('%s opens as a distinct, substantial teaching workspace', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        await settleLesson();
        const editor = editorIn(dialog);
        const sourceLines = editor.controller.document.text.split(/\r?\n/u).filter((line) => line.trim().length > 0);

        expect(dialog.isZoomed()).toBe(true);
        expect(
          sourceLines.length,
          `${exampleId} needs enough source to show realistic structure`,
        ).toBeGreaterThanOrEqual(12);
        expect(sourceLines.length, `${exampleId} fixture must remain bounded`).toBeLessThanOrEqual(250);
        if (exampleId !== 'code-editor/language-gallery') {
          expect(
            editor.controller.languageResult?.syntax.length ?? 0,
            `${exampleId} must paint real syntax`,
          ).toBeGreaterThan(8);
        }

        const text = renderedText(app, dialog);
        expect(text).toContain('Try:');
        expect(text).toContain('Result: Ready');
        expect(text).toContain('Look for:');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('uses a different source fixture for every focused lesson', async () => {
    const sources = new Map<string, string>();
    for (const [exampleId] of LESSONS) {
      const definition = await loadDefinition(exampleId);
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(exampleId, definition);
        try {
          const source = editorIn(dialog).controller.document.text;
          expect(sources.has(source), `${exampleId} must not reuse another lesson's source`).toBe(false);
          sources.set(source, exampleId);
        } finally {
          app.loop.dispose();
          dispose();
        }
      });
    }
  });

  test.each(LESSONS)(
    '%s exposes a named action, native result, and independent reset',
    async (exampleId, actionLabel, lookForTail) => {
      const definition = await loadDefinition(exampleId);
      await createRoot(async (dispose) => {
        const { app, dialog } = buildLabExample(exampleId, definition);
        try {
          await settleLesson();
          const editor = editorIn(dialog);
          const probe = viewsIn(dialog).find(isReadableProbe);
          if (probe === undefined) throw new Error(`${exampleId} is missing its lesson probe`);
          const labels = viewsIn(dialog)
            .filter((view): view is Button => view instanceof Button)
            .map((button) => button.activation.label);
          expect(labels).toContain(actionLabel);
          expect(labels).toContain('Clear & reset');
          expect(labels).not.toContain('Run check');
          expect(labels).not.toContain('Focus editor');

          const initialSource = editor.controller.document.text;
          const before = nativeSignature(dialog, editor);
          dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
          await settleLesson();
          expect(nativeSignature(dialog, editor), `${exampleId} action must change native editor state`).not.toBe(
            before,
          );
          expect(renderedText(app, dialog)).not.toContain('Result: Ready');

          dialog.zoom();
          app.loop.renderRoot.flush();
          const compactText = renderedText(app, dialog, 'compact');
          expect(compactText, `${exampleId} compact rail must show complete Look-for guidance`).toContain(lookForTail);
          expect(compactText).toContain('F2 zoom');
          dialog.zoom();
          app.loop.renderRoot.flush();

          dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
          await settleLesson();
          expect(editor.controller.document.text).toBe(initialSource);
          expect(probe.read('status-text')).toBe('Ready');
          expect(renderedText(app, dialog)).toContain('Result: Ready');
        } finally {
          app.loop.dispose();
          dispose();
        }
      });
    },
  );
});
