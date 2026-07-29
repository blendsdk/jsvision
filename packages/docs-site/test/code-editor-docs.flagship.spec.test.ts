/**
 * Flagship Code Editor presentation specifications.
 *
 * These tests describe what a reader must see and be able to try in the three presentation
 * pilots. They intentionally inspect public editor state and rendered teaching text rather than
 * fixture implementation details.
 */
import { CodeEditor, offsetToPosition } from '@jsvision/code-editor';
import { Button, createRoot } from '@jsvision/ui';
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

/** Stable pilot identifiers selected to establish the assistance, diagnostic, and folding layouts. */
const FLAGSHIP_PILOT_IDS = [
  'code-editor/lsp-completion',
  'code-editor/lsp-diagnostics',
  'code-editor/language-folding',
] as const;

/** User-facing action labels required for each focused lesson. */
const EXPECTED_ACTION_LABELS: Readonly<Record<(typeof FLAGSHIP_PILOT_IDS)[number], string>> = {
  'code-editor/lsp-completion': 'Request suggestions',
  'code-editor/lsp-diagnostics': 'Reveal diagnostics',
  'code-editor/language-folding': 'Fold region',
};

/** Load one pilot through the public lazy example registry. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing flagship Code Editor example ${exampleId}`);
  return (await entry.load()).default;
}

/** Let bounded language and protocol promises settle before inspecting their public projections. */
async function settleExample(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Return the normalized labels of every visible Button in a mounted pilot. */
function buttonLabels(dialog: Parameters<typeof viewsIn>[0]): readonly string[] {
  return viewsIn(dialog)
    .filter((view): view is Button => view instanceof Button)
    .map((button) => button.activation.label);
}

/** Render the dialog and join its decoded cells into searchable teaching text. */
function renderedText(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): string {
  return collectTemplate1Evidence(app, dialog, { startup: 'maximized' }).frameLines.join('\n');
}

/** Project the native editor surface at its live responsive size. */
function projectEditor(editor: CodeEditor) {
  return editor.project({
    width: Math.max(1, editor.bounds.width),
    height: Math.max(1, editor.bounds.height),
    caps: EXAMPLE_CAPS,
  });
}

describe('Code Editor flagship presentation pilots', () => {
  test.each(FLAGSHIP_PILOT_IDS)('%s opens as a substantial syntax-highlighted workspace', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        await settleExample();
        app.loop.renderRoot.flush();
        const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
        if (editor === undefined) throw new Error(`${exampleId} is missing its CodeEditor`);

        expect(dialog.isZoomed(), `${exampleId} should use the available flagship workspace`).toBe(true);
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });

        const sourceLines = editor.controller.document.text.split('\n').filter((line) => line.length > 0);
        expect(sourceLines.length, `${exampleId} needs enough source to demonstrate structure`).toBeGreaterThanOrEqual(
          15,
        );
        expect(sourceLines.length, `${exampleId} fixture must remain bounded and readable`).toBeLessThanOrEqual(40);
        expect(editor.controller.languageResult?.adapterId).toBe('typescript');
        expect(
          editor.controller.languageResult?.syntax.length ?? 0,
          `${exampleId} must display real syntax highlighting`,
        ).toBeGreaterThan(8);
        const syntaxRoles = new Set(
          projectEditor(editor)
            .cells.flat()
            .map((cell) => cell.role)
            .filter((role) =>
              [
                'comment',
                'function',
                'keyword',
                'number',
                'operator',
                'property',
                'string',
                'type',
                'variable',
              ].includes(role),
            ),
        );
        expect(syntaxRoles.size, `${exampleId} must paint visibly distinct syntax roles`).toBeGreaterThanOrEqual(3);

        dialog.zoom();
        app.loop.renderRoot.flush();
        collectTemplate1Evidence(app, dialog);
        dialog.zoom();
        app.loop.renderRoot.flush();
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    });
  });

  test.each(FLAGSHIP_PILOT_IDS)('%s explains what to try and exposes named actions', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        const labels = buttonLabels(dialog);
        expect(labels).toContain(EXPECTED_ACTION_LABELS[exampleId]);
        expect(labels).toContain('Clear & reset');
        expect(labels).not.toContain('Run check');

        const initial = renderedText(app, dialog);
        expect(initial).toContain('Try:');
        expect(initial).toContain('Result: Ready');
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    });
  });

  test.each(FLAGSHIP_PILOT_IDS)('%s shows a human-readable result and can reset', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        await settleExample();
        const afterAction = renderedText(app, dialog);
        expect(afterAction).toMatch(/Result: (?:Suggestions|Diagnostic|Folded)/u);

        const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
        if (editor === undefined) throw new Error(`${exampleId} is missing its CodeEditor`);
        if (exampleId === 'code-editor/lsp-completion') {
          const caret = offsetToPosition(
            editor.controller.document.snapshot,
            Number(editor.controller.document.selection.head),
          );
          expect(editor.assistanceView.state.visible).toBe(true);
          expect(editor.assistanceView.items).toEqual(['displayName', 'email', 'role']);
          const probe = viewsIn(dialog).find(
            (view): view is typeof view & { read(name: string): string | number | boolean | undefined } =>
              'read' in view && typeof view.read === 'function',
          );
          expect(probe?.read('request-line')).toBe(Number(caret.line));
          expect(probe?.read('request-character')).toBe(Number(caret.character));
        } else if (exampleId === 'code-editor/lsp-diagnostics') {
          const target = editor.controller.document.text.indexOf('customerIdd');
          expect(editor.controller.diagnostics).toHaveLength(1);
          expect(projectEditor(editor).cellAtDocumentOffset(target)?.overlays).toContain('diagnostic.error');
        } else {
          const frame = projectEditor(editor);
          expect(editor.controller.folds.length).toBeGreaterThan(0);
          expect(frame.cells.flat().some((cell) => cell.role === 'fold' && /[>▶]/u.test(cell.text))).toBe(true);
        }

        dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
        await settleExample();
        expect(renderedText(app, dialog)).toContain('Result: Ready');

        if (exampleId === 'code-editor/lsp-completion') {
          expect(editor.controller.retainedState.completions).toBe(0);
        } else if (exampleId === 'code-editor/lsp-diagnostics') {
          expect(editor.controller.retainedState.diagnostics).toBe(0);
        } else {
          expect(editor.controller.folds).toHaveLength(0);
        }
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    });
  });
});
