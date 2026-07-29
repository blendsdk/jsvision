/**
 * Code Editor hub objective specifications.
 *
 * Each approved example has a typed contract before implementation. The real registry, editor
 * surface, template shell, and target-owned probe make every learning objective executable.
 */
import { CodeEditor, CodeEditorWindow } from '@jsvision/code-editor';
import { Dialog, View, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample, collectTemplate1Evidence, dispatchExampleAction, viewsIn } from './example-lab-harness.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import { CODE_EDITOR_CONTRACTS, CODE_EDITOR_EXAMPLE_IDS } from './contracts/code-editor/index.js';
import type { CodeEditorExpectation } from './contracts/code-editor/_shared.js';

interface ReadableProbe {
  read(name: string): string | number | boolean | undefined;
}

/** Narrow a view to the public probe seam required by the specification. */
function isReadableProbe(view: View): view is View & ReadableProbe {
  return 'read' in view && typeof view.read === 'function';
}

/** Resolve one lazily registered Code Editor example. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing Code Editor example ${exampleId}`);
  return (await entry.load()).default;
}

/** Assert one typed expectation against target-owned laboratory state. */
function expectProbe(probe: ReadableProbe, expectation: CodeEditorExpectation, dialogWidth: number): void {
  const actual = expectation.probe === 'dialog-width' ? dialogWidth : probe.read(expectation.probe);
  switch (expectation.operator) {
    case 'equals':
      expect(actual, expectation.probe).toBe(expectation.value);
      return;
    case 'contains':
      expect(String(actual), expectation.probe).toContain(String(expectation.value));
      return;
    case 'excludes':
      expect(String(actual), expectation.probe).not.toContain(String(expectation.value));
      return;
    case 'greater-than':
      expect(Number(actual), expectation.probe).toBeGreaterThan(Number(expectation.value));
      return;
    case 'less-than':
      expect(Number(actual), expectation.probe).toBeLessThan(Number(expectation.value));
      return;
  }
}

describe('Code Editor objective contracts', () => {
  test('cover exactly the approved 21-example population', () => {
    expect(CODE_EDITOR_CONTRACTS.map((contract) => contract.exampleId)).toEqual(CODE_EDITOR_EXAMPLE_IDS);
    for (const contract of CODE_EDITOR_CONTRACTS) validateBehaviorContract(contract);
  });

  test('registry contains every approved example exactly once', () => {
    const actual = EXAMPLES.filter((entry) => entry.id.startsWith('code-editor/')).map((entry) => entry.id);
    expect(actual).toEqual(CODE_EDITOR_EXAMPLE_IDS);
  });
});

describe('Code Editor live examples', () => {
  test.each(CODE_EDITOR_EXAMPLE_IDS)('%s uses compact responsive template1 around a real editor', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        const descendants = viewsIn(dialog);
        expect(dialog).toBeInstanceOf(Dialog);
        expect(
          descendants.some((view) => view instanceof CodeEditor || view instanceof CodeEditorWindow),
          `${exampleId} must contain a public Code Editor surface`,
        ).toBe(true);
        collectTemplate1Evidence(app, dialog);
        expect(dialog.isZoomed(), `${exampleId} needs explicit approval before maximized startup`).toBe(false);
        const compact = { ...dialog.bounds };
        dialog.zoom();
        app.loop.renderRoot.flush();
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
        dialog.zoom();
        app.loop.renderRoot.flush();
        expect(dialog.bounds).toEqual(compact);
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

describe('Code Editor executable behavior contracts', () => {
  for (const contract of CODE_EDITOR_CONTRACTS) {
    for (const behavior of contract.cases) {
      test(`${contract.exampleId} · ${behavior.id}`, async () => {
        const definition = await loadDefinition(contract.exampleId);
        await createRoot(async (dispose) => {
          const { app, dialog } = buildLabExample(contract.exampleId, definition);
          try {
            const probe = viewsIn(dialog).find(isReadableProbe);
            if (probe === undefined) throw new Error(`${contract.exampleId} is missing its target probe`);
            let copiedText = '';
            if (contract.exampleId === 'code-editor/readonly-clipboard') {
              const fixtureSink = app.loop.writeClipboardText;
              app.loop.writeClipboardText = (text) => {
                copiedText = text;
                return fixtureSink?.(text);
              };
            }
            for (const expectation of behavior.initial) expectProbe(probe, expectation, dialog.bounds.width);
            for (const action of behavior.actions) {
              dispatchExampleAction(app, action);
              for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();
            }
            for (const expectation of behavior.expected) expectProbe(probe, expectation, dialog.bounds.width);
            const descendants = viewsIn(dialog);
            const editors = descendants.filter((view): view is CodeEditor => view instanceof CodeEditor);
            const windowed = descendants.find((view): view is CodeEditorWindow => view instanceof CodeEditorWindow);
            if (contract.exampleId === 'code-editor/quick-start') {
              expect(windowed?.editor.controller).toBe(editors[0]?.controller);
            }
            if (contract.exampleId === 'code-editor/readonly-clipboard') {
              expect(copiedText).toBe('SELECT');
              expect(editors[0]?.controller.document.identity.revision).toBe(0);
            }
            if (contract.exampleId === 'code-editor/viewport-mouse') {
              expect(editors[0]?.controller.publicState.selectionSize).toBeGreaterThan(0);
              expect(editors[0]?.viewportMetrics.width).toBeGreaterThan(40);
            }
            if (contract.exampleId === 'code-editor/theme-fallback') {
              expect(editors[0]?.themeInspection.rejected).not.toHaveLength(0);
            }
            if (contract.exampleId === 'code-editor/host-recovery') {
              expect(
                editors[0]?.controller.degradation
                  .snapshot()
                  .features.find((feature) => feature.feature === 'hostCallback'),
              ).toMatchObject({ status: 'enabled', reason: 'recovered' });
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
    }
  }
});
