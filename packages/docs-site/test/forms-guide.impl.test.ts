/**
 * Implementation hardening for the Forms laboratories.
 *
 * These checks stress repeated invalid submission, baseline reset, submit-race gating, retry
 * eligibility, repeated disposal, and responsive geometry beyond the learner-visible contract.
 */
import { View, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import asyncExample from '../examples/guides/form-async-submit.js';
import stateExample from '../examples/guides/form-state-validation.js';
import { FormAsyncSubmitPanel } from '../src/example-fixtures/forms-guide/form-async-submit-panel.js';
import { FormStateValidationPanel } from '../src/example-fixtures/forms-guide/form-state-validation-panel.js';
import { buildLabExample, collectTemplate1Evidence, frameText, key, viewsIn } from './example-lab-harness.js';

/** Return the single mounted fixture panel of the requested class. */
function panelIn<T extends View>(dialog: View, type: abstract new (...args: never[]) => T): T {
  const panel = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (panel === undefined) throw new Error(`laboratory is missing ${type.name}`);
  return panel;
}

/** Allow the form store's forced-validation and submit continuations to settle. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

describe('form-state laboratory edges', () => {
  test('should keep repeated empty submissions invalid and focused on the first field', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/form-state-validation', stateExample);
      const panel = panelIn(dialog, FormStateValidationPanel);

      app.loop.dispatch(key('s', { alt: true }));
      app.loop.dispatch(key('s', { alt: true }));

      expect(panel.invalidSubmissions).toBe(2);
      expect(panel.validSubmissions).toBe(0);
      expect(app.loop.getFocused()).toBe(panel.nameInput);
      expect(frameText(app)).toMatch(/Dirty:\s*no[\s\S]*Touched:\s*all[\s\S]*Name required/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should reset valid edits to the original raw baseline without accepting them', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/form-state-validation', stateExample);
      const panel = panelIn(dialog, FormStateValidationPanel);

      panel.fillValid('keyboard');
      panel.edit('keyboard');
      app.loop.renderRoot.flush();
      expect(frameText(app)).toMatch(/Raw name:\s*db-edited[\s\S]*Dirty:\s*yes/iu);
      panel.reset('keyboard');
      app.loop.renderRoot.flush();

      expect(panel.resetCount).toBe(1);
      expect(panel.validSubmissions).toBe(0);
      expect(frameText(app)).toMatch(
        /Raw name:\s*empty[\s\S]*Raw port:\s*8080[\s\S]*Dirty:\s*no[\s\S]*Touched:\s*none/iu,
      );
      app.loop.dispose();
      dispose();
    });
  });
});

describe('async-form laboratory edges', () => {
  test('should keep settle and retry actions inert until their real phases exist', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/form-async-submit', asyncExample);
      const panel = panelIn(dialog, FormAsyncSubmitPanel);

      panel.settleValidation('keyboard');
      panel.settlePersistence('keyboard');
      panel.retry('keyboard');
      app.loop.renderRoot.flush();

      expect(panel.validationRuns).toBe(0);
      expect(panel.successfulSubmissions).toBe(0);
      expect(panel.failedSubmissions).toBe(0);
      expect(frameText(app)).toMatch(/Result:\s*idle[\s\S]*Persistence:\s*none[\s\S]*Retry:\s*unavailable/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should ignore duplicate submit and premature retry while one gate is active', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/form-async-submit', asyncExample);
      const panel = panelIn(dialog, FormAsyncSubmitPanel);

      panel.submit('keyboard');
      panel.submit('keyboard');
      panel.settlePersistence('keyboard');
      panel.retry('keyboard');
      app.loop.renderRoot.flush();

      expect(panel.validationRuns).toBe(1);
      expect(frameText(app)).toMatch(/Submitting:\s*yes[\s\S]*Persistence:\s*none[\s\S]*Retry:\s*unavailable/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should require a fresh forced validator when persistence failure becomes retryable', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample('guides/form-async-submit', asyncExample);
      const panel = panelIn(dialog, FormAsyncSubmitPanel);

      panel.failNext('keyboard');
      panel.submit('keyboard');
      panel.settleValidation('keyboard');
      await settle();
      panel.settlePersistence('keyboard');
      await settle();
      expect(panel.failedSubmissions).toBe(1);

      panel.retry('keyboard');
      app.loop.renderRoot.flush();
      expect(panel.validationRuns).toBe(2);
      expect(frameText(app)).toMatch(/Submitting:\s*yes[\s\S]*Validating:\s*yes/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should abort one pending generation and clean up exactly once on repeated disposal', () => {
    let panel: FormAsyncSubmitPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/form-async-submit', asyncExample);
      panel = panelIn(dialog, FormAsyncSubmitPanel);
      panel.validate('keyboard');

      app.loop.dispose();
      app.loop.dispose();
      dispose();
    });

    expect(panel?.abortedValidations).toBe(1);
    expect(panel?.cleanupCount).toBe(1);
    expect(panel?.mounted).toBe(false);
  });

  test('should suppress a resolved manual continuation when disposal wins the microtask race', async () => {
    let panel: FormAsyncSubmitPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/form-async-submit', asyncExample);
      panel = panelIn(dialog, FormAsyncSubmitPanel);
      panel.validate('keyboard');
      panel.supersede('keyboard');
      panel.settleNewest('keyboard');

      app.loop.dispose();
      dispose();
    });
    await settle();

    expect(panel?.pendingManualRuns()).toBe(0);
    expect(panel?.acceptedValidationResults).toBe(0);
    expect(panel?.staleValidationResults).toBe(0);
    expect(panel?.cleanupCount).toBe(1);
    expect(panel?.mounted).toBe(false);
  });

  test('should suppress forced-submit settlement after persistence is torn down', async () => {
    let panel: FormAsyncSubmitPanel | undefined;
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample('guides/form-async-submit', asyncExample);
      panel = panelIn(dialog, FormAsyncSubmitPanel);
      panel.submit('keyboard');
      panel.settleValidation('keyboard');
      await settle();
      expect(frameText(app)).toMatch(/Persistence:\s*pending/iu);

      app.loop.dispose();
      dispose();
    });
    await settle();

    expect(panel?.successfulSubmissions).toBe(0);
    expect(panel?.failedSubmissions).toBe(0);
    expect(panel?.cleanupCount).toBe(1);
    expect(panel?.mounted).toBe(false);
  });

  test.each([
    ['guides/form-state-validation', stateExample, 'f'],
    ['guides/form-async-submit', asyncExample, 'v'],
  ] as const)('should preserve active teaching state when %s grows and zooms', (id, definition, accelerator) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      app.loop.dispatch(key(accelerator, { alt: true }));
      const stateBefore = frameText(app);

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog);

      const stateAfter = frameText(app);
      if (id.endsWith('state-validation')) {
        expect(stateBefore).toMatch(/Raw name:\s*db/iu);
        expect(stateAfter).toMatch(/Raw name:\s*db/iu);
      } else {
        expect(stateBefore).toMatch(/Current:\s*older value 1/iu);
        expect(stateAfter).toMatch(/Current:\s*older value 1/iu);
      }
      app.loop.dispose();
      dispose();
    });
  });
});
