/**
 * Implementation hardening for the Dialogs & modality laboratories.
 *
 * These checks stress repeated result workflows, nested cancellation, exact cleanup, and the
 * documented ownership boundary beyond the immutable learner-visible contract.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Button, Dialog, View, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import resultsExample from '../examples/guides/dialog-results.js';
import workflowsExample from '../examples/guides/modal-workflows.js';
import { DialogResultsPanel } from '../src/example-fixtures/dialogs-and-modality/dialog-results-panel.js';
import { ModalWorkflowsPanel } from '../src/example-fixtures/dialogs-and-modality/modal-workflows-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const dialogPagePath = fileURLToPath(new URL('../components/containers/dialog.md', import.meta.url));

/** Return the single mounted fixture panel of the requested class. */
function panelIn<T extends View>(dialog: View, type: abstract new (...args: never[]) => T): T {
  const panel = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (panel === undefined) throw new Error(`laboratory is missing ${type.name}`);
  return panel;
}

/** Activate a named button through the same pointer route available to a learner. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`laboratory is missing "${label}"`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

/** Let settled modal promises run their cleanup continuations. */
async function settleModalCleanup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('dialog result laboratory edges', () => {
  test('should keep invalid, accepted, and cancelled runs independent', async () => {
    const built = createRoot((dispose) => ({
      ...buildLabExample('guides/dialog-results', resultsExample),
      dispose,
    }));
    const panel = panelIn(built.dialog, DialogResultsPanel);
    const desktop = built.app.desktop;
    if (desktop === undefined) throw new Error('dialog results laboratory requires a desktop');

    try {
      built.app.loop.dispatch(key('o', { alt: true }));
      built.app.loop.dispatch(key('f', { alt: true }));
      built.app.loop.dispatch(key('o', { alt: true }));
      await settleModalCleanup();
      expect(panel.invalidAttempts).toBe(1);
      expect(panel.acceptedResults).toBe(1);
      expect(panel.settledCommands).toEqual(['ok']);
      expect(panel.settledValues).toEqual(['50']);
      expect(panel.cleanupCount).toBe(1);
      expect(frameText(built.app)).toMatch(/Focus:\s*launcher/iu);

      built.app.loop.dispatch(key('r', { alt: true }));
      built.app.loop.dispatch(key('c', { alt: true }));
      await settleModalCleanup();
      expect(panel.cancelBypasses).toBe(1);
      expect(panel.acceptedResults).toBe(1);
      expect(panel.settledCommands).toEqual(['ok', 'cancel']);
      expect(panel.settledValues).toEqual(['50', 'no change']);
      expect(panel.cleanupCount).toBe(2);
      expect(frameText(built.app)).toMatch(/Command result:\s*cancel[\s\S]*Value result:\s*no change/iu);
      expect(
        desktop.children.filter((view): view is Dialog => view instanceof Dialog && view !== built.dialog),
      ).toHaveLength(0);
    } finally {
      built.app.loop.dispose();
      built.dispose();
    }
  });

  test('should report the pointer route while retaining validation behavior', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/dialog-results', resultsExample);
      const panel = panelIn(dialog, DialogResultsPanel);
      clickButton(app, dialog, 'Try OK');
      expect(panel.invalidAttempts).toBe(1);
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });
});

describe('nested modal workflow edges', () => {
  test('should repeat LIFO cancellation without leaking dialogs or outer input', async () => {
    const built = createRoot((dispose) => ({
      ...buildLabExample('guides/modal-workflows', workflowsExample),
      dispose,
    }));
    const panel = panelIn(built.dialog, ModalWorkflowsPanel);
    const desktop = built.app.desktop;
    if (desktop === undefined) throw new Error('modal workflows laboratory requires a desktop');

    try {
      for (let run = 1; run <= 3; run += 1) {
        built.app.loop.dispatch(key('n', { alt: true }));
        built.app.loop.dispatch(key('x'));
        expect(panel.confinedOuterEvents).toBe(0);
        built.app.loop.dispatch(key('y', { alt: true }));
        built.app.loop.dispatch(key('c', { alt: true }));
        await settleModalCleanup();
        expect(panel.nestedRuns).toBe(run);
        expect(panel.settledResults.slice(-2)).toEqual(['inner yes', 'outer cancel']);
        expect(panel.focusRestorations).toBe(run * 2);
        expect(panel.cleanupCount).toBe(run * 2);
        expect(frameText(built.app)).toMatch(/Focus restored:\s*launcher/iu);
      }

      expect(panel.cleanupCount).toBe(6);
      expect(
        desktop.children.filter((view): view is Dialog => view instanceof Dialog && view !== built.dialog),
      ).toHaveLength(0);
    } finally {
      built.app.loop.dispose();
      built.dispose();
    }
  });

  test('should release every isolated modal exactly once across repeated disposal probes', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample('guides/modal-workflows', workflowsExample);
      const panel = panelIn(dialog, ModalWorkflowsPanel);
      for (let run = 0; run < 3; run += 1) app.loop.dispatch(key('d', { alt: true }));
      await settleModalCleanup();
      expect(panel.cleanupCount).toBe(6);
      expect(panel.teardownSettlements).toBe(3);
      expect(frameText(app)).toMatch(/Teardown result:\s*undefined[\s\S]*Mounted modals:\s*0/iu);
      app.loop.dispose();
      dispose();
    });
  });
});

test('Dialog documentation should teach caller-owned desktop membership', () => {
  const source = readFileSync(dialogPagePath, 'utf8');
  expect(source).toMatch(/already-mounted[\s\S]*execView/iu);
  expect(source).toMatch(
    /addWindow\(dialog\)[\s\S]*try\s*\{[\s\S]*execView\(dialog\)[\s\S]*finally\s*\{[\s\S]*removeWindow\(dialog\)/u,
  );
  expect(source).toMatch(/`execView` does not own desktop membership/iu);
});
