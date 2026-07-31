/**
 * Implementation hardening for Code Editor document/session ownership in documentation examples.
 */
import { CodeEditor, CodeEditorWindow } from '@jsvision/code-editor';
import { createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import documentController from '../examples/code-editor/document-controller.js';
import externalChanges from '../examples/code-editor/external-changes.js';
import quickStart from '../examples/code-editor/quick-start.js';
import { buildLabExample, dispatchExampleAction, viewsIn } from './example-lab-harness.js';

/** Narrow the docs probe without importing its concrete implementation into the oracle. */
function probeIn(dialog: ReturnType<typeof buildLabExample>['dialog']) {
  const probe = viewsIn(dialog).find(
    (view): view is typeof view & { read(name: string): string | number | boolean | undefined } =>
      'read' in view && typeof view.read === 'function',
  );
  if (probe === undefined) throw new Error('Code Editor implementation example is missing its probe');
  return probe;
}

describe('Code Editor document example isolation', () => {
  test('rebuild restores the initial revision instead of sharing a mutated document', () => {
    createRoot((dispose) => {
      const first = buildLabExample('code-editor/document-controller', documentController);
      try {
        dispatchExampleAction(first.app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        expect(probeIn(first.dialog).read('document-revision')).toBeGreaterThan(0);
      } finally {
        first.app.loop.dispose();
      }

      const reset = buildLabExample('code-editor/document-controller', documentController);
      try {
        expect(probeIn(reset.dialog).read('document-revision')).toBe(0);
      } finally {
        reset.app.loop.dispose();
        dispose();
      }
    });
  });

  test('quick start swaps visibility between real direct and windowed public surfaces', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('code-editor/quick-start', quickStart);
      try {
        const direct = viewsIn(dialog).find((view) => view instanceof CodeEditor);
        const windowed = viewsIn(dialog).find((view) => view instanceof CodeEditorWindow);
        if (direct === undefined || windowed === undefined)
          throw new Error('quick start requires both public surfaces');
        expect(direct.state.visible).toBe(true);
        expect(windowed.state.visible).toBe(false);
        expect(windowed.editor.controller).toBe(direct.controller);
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        expect(direct.state.visible).toBe(false);
        expect(windowed.state.visible).toBe(true);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('external-change action reloads the real document through the lifecycle API', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample('code-editor/external-changes', externalChanges);
      try {
        const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
        if (editor === undefined) throw new Error('external-change example is missing its editor');
        const originalLineage = editor.controller.document.identity.lineage;
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();
        expect(editor.controller.document.text).toMatch(/^\/\/ externally reloaded/u);
        expect(editor.controller.document.identity.lineage).not.toBe(originalLineage);
        expect(probeIn(dialog).read('host-effects')).toBe('external-change reloaded');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });
});
