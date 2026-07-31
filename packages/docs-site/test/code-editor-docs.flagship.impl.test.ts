/**
 * Implementation hardening for the flagship Code Editor teaching workbench.
 */
import { CodeEditor } from '@jsvision/code-editor';
import { createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import completion from '../examples/code-editor/lsp-completion.js';
import diagnostics from '../examples/code-editor/lsp-diagnostics.js';
import folding from '../examples/code-editor/language-folding.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample, dispatchExampleAction, viewsIn } from './example-lab-harness.js';

/** Stable pilot definitions used to prove reset isolation across different capability families. */
const PILOTS = [
  ['code-editor/lsp-completion', completion, 'completion-count'],
  ['code-editor/lsp-diagnostics', diagnostics, 'diagnostic-count'],
  ['code-editor/language-folding', folding, 'fold-count'],
] as const;

/** Resolve the mounted editor without importing the concrete workbench implementation. */
function editorIn(dialog: ReturnType<typeof buildLabExample>['dialog']): CodeEditor {
  const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
  if (editor === undefined) throw new Error('flagship Code Editor workbench is missing its editor');
  return editor;
}

/** Resolve the content-free probe shared with the objective specifications. */
function probeIn(dialog: ReturnType<typeof buildLabExample>['dialog']) {
  const probe = viewsIn(dialog).find(
    (view): view is typeof view & { read(name: string): string | number | boolean | undefined } =>
      'read' in view && typeof view.read === 'function',
  );
  if (probe === undefined) throw new Error('flagship Code Editor workbench is missing its probe');
  return probe;
}

/** Yield one event-loop turn so bounded parser work can settle. */
async function settleWorkbench(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Allow every bounded parser continuation from a burst of edits to settle. */
async function settleLanguageWork(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await settleWorkbench();
}

/** Build a pilot while retaining its literal definition type for table-driven checks. */
function buildPilot(id: string, definition: ExampleDefinition) {
  return buildLabExample(id, definition);
}

describe('Code Editor flagship workbench hardening', () => {
  test.each(PILOTS)('%s supports repeated action and reset cycles', async (id, definition, countProbe) => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildPilot(id, definition);
      try {
        await settleWorkbench();
        const probe = probeIn(dialog);
        for (let cycle = 0; cycle < 2; cycle += 1) {
          dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
          await settleWorkbench();
          expect(Number(probe.read(countProbe)), `${id} action cycle ${cycle + 1}`).toBeGreaterThan(0);

          dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
          await settleWorkbench();
          expect(probe.read(countProbe), `${id} reset cycle ${cycle + 1}`).toBe(0);
        }
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('rapid editing applies only syntax that matches the current document revision', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildPilot('code-editor/lsp-completion', completion);
      try {
        const editor = editorIn(dialog);
        const probe = probeIn(dialog);
        await settleLanguageWork();
        const initialRevision = Number(editor.controller.document.identity.revision);
        app.loop.focusView(editor);
        app.loop.dispatch({ type: 'key', key: 'x', codepoint: 120, ctrl: false, alt: false, shift: false });
        app.loop.dispatch({ type: 'key', key: 'y', codepoint: 121, ctrl: false, alt: false, shift: false });
        await settleLanguageWork();

        expect(Number(editor.controller.document.identity.revision)).toBe(initialRevision + 2);
        expect(editor.controller.languageResult?.identity).toEqual(editor.controller.document.identity);
        expect(editor.controller.languageResult?.syntax.length ?? 0).toBeGreaterThan(8);
        expect(probe.read('syntax-state')).toBe('ready');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test.each(PILOTS)('%s keeps its editor responsive across maximize and restore', async (id, definition) => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 110, height: 36 } });
      try {
        await settleWorkbench();
        const editor = editorIn(dialog);
        const maximized = { ...editor.bounds };
        expect(maximized.width).toBeGreaterThan(60);
        expect(maximized.height).toBeGreaterThan(20);

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

  test('reset cancels a folding action that is still waiting for language analysis', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildPilot('code-editor/language-folding', folding);
      try {
        const probe = probeIn(dialog);
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
        await settleLanguageWork();

        expect(probe.read('fold-count')).toBe(0);
        expect(probe.read('status-text')).toBe('Ready');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('unmount disposes the editor controller and rejects later mutations', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildPilot('code-editor/lsp-completion', completion);
      const editor = editorIn(dialog);
      const probe = probeIn(dialog);
      await settleLanguageWork();
      app.loop.focusView(editor);
      app.loop.dispatch({ type: 'key', key: 'z', codepoint: 122, ctrl: false, alt: false, shift: false });
      app.loop.dispose();
      await settleWorkbench();

      expect(probe.read('syntax-state')).toBe('ready');
      expect(
        editor.controller.applyMutation({
          edits: [{ range: { from: 0, to: 0 }, text: 'late edit' }],
          origin: 'external',
        }),
      ).toMatchObject({ accepted: false, reason: 'invalid-edit' });
      expect(editor.retainedState).toMatchObject({
        completionItems: 0,
        popupRows: 0,
        pendingHostEffects: 0,
      });
      dispose();
    });
  });
});
