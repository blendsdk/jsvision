/**
 * Implementation hardening for bounded in-process Code Editor language-service examples.
 */
import { CodeEditor } from '@jsvision/code-editor';
import { createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import completion from '../examples/code-editor/lsp-completion.js';
import diagnostics from '../examples/code-editor/lsp-diagnostics.js';
import languageGallery from '../examples/code-editor/language-gallery.js';
import navigation from '../examples/code-editor/lsp-navigation.js';
import syntaxFallback from '../examples/code-editor/syntax-fallback.js';
import { buildLabExample, dispatchExampleAction, viewsIn } from './example-lab-harness.js';

/** Resolve the target-owned probe shared by the focused examples. */
function probeIn(dialog: ReturnType<typeof buildLabExample>['dialog']) {
  const probe = viewsIn(dialog).find(
    (view): view is typeof view & { read(name: string): string | number | boolean | undefined } =>
      'read' in view && typeof view.read === 'function',
  );
  if (probe === undefined) throw new Error('Code Editor implementation example is missing its probe');
  return probe;
}

describe('Code Editor in-process service examples', () => {
  test.each([
    ['code-editor/lsp-completion', completion, 'completion-count'],
    ['code-editor/lsp-diagnostics', diagnostics, 'diagnostic-count'],
  ] as const)('%s publishes a bounded result through the real editor controller', (id, definition, countProbe) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      try {
        const editor = viewsIn(dialog).find((view) => view instanceof CodeEditor);
        if (editor === undefined) throw new Error(`${id} is missing its editor`);
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        expect(probeIn(dialog).read(countProbe)).toBeGreaterThan(0);
        if (id === 'code-editor/lsp-completion') {
          expect(probeIn(dialog).read('intelligence-kinds')).toBe(3);
        }
        expect(editor.controller.retainedState.requests).toBe(0);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('navigation exposes only a content-free authorized host result', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('code-editor/lsp-navigation', navigation);
      try {
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        expect(Number(probeIn(dialog).read('caret-offset'))).toBeGreaterThan(0);
        expect(String(probeIn(dialog).read('status-text'))).not.toContain('interface User');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('language gallery cycles all four built-in document language IDs', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('code-editor/language-gallery', languageGallery);
      try {
        const probe = probeIn(dialog);
        const languages = [probe.read('language')];
        for (let index = 0; index < 4; index += 1) {
          dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
          languages.push(probe.read('language'));
        }
        expect(languages).toEqual(['plain', 'javascript', 'typescript', 'postgresql', 'plain']);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('syntax fallback is driven by a real degraded scheduler result', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample('code-editor/syntax-fallback', syntaxFallback);
      try {
        const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
        if (editor === undefined) throw new Error('syntax fallback is missing its editor');
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();
        expect(
          editor.controller.degradation.snapshot().features.find((feature) => feature.feature === 'parser'),
        ).toMatchObject({ status: 'degraded', reason: 'failure' });
        expect(editor.controller.document.languageId).toBe('plain');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });
});
