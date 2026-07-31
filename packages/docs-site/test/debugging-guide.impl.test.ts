/**
 * Implementation hardening for the Debugging course evidence ladder.
 *
 * These checks exercise diagnostic eviction, every mouse command surface, authentic correction
 * facts, category distinction, and post-disposal inertia beyond the public course oracle.
 */
import { Button, View } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { DebuggingEvidencePanel } from '../src/example-fixtures/debugging/debugging-evidence-panel.js';
import { absoluteOrigin, buildLabExample, dispatchExampleAction, frameText, viewsIn } from './example-lab-harness.js';

const LAB_ID = 'guides/debugging-evidence';

/** Load the registered laboratory definition through the same lazy registry used by the docs host. */
async function loadDefinition(): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === LAB_ID);
  if (entry === undefined) throw new Error(`missing example registry entry: ${LAB_ID}`);
  return (await entry.load()).default;
}

/** Find the real diagnostic panel in the mounted template1 dialog. */
function panelIn(dialog: View): DebuggingEvidencePanel {
  const panel = viewsIn(dialog).find((view): view is DebuggingEvidencePanel => view instanceof DebuggingEvidencePanel);
  if (panel === undefined) throw new Error('debugging evidence panel is missing');
  return panel;
}

/** Click a real Button face and assert that it participates in the application command vocabulary. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`missing "${label}" button`);
  expect(button.activation.command).not.toBeNull();
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

describe('Debugging evidence ladder hardening', () => {
  test('should retain only the newest stable diagnostic codes and discard unsafe detail', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);

    panel.inspectLayout();
    panel.inspectFocus();
    panel.inspectCommand();
    panel.inspectRender();
    panel.inspectCapability();
    panel.inspectLifecycle();

    expect(panel.diagnosticCount).toBe(panel.diagnosticCapacity);
    expect(panel.diagnosticCodes).toEqual(['DIAG_COMMAND', 'DIAG_RENDER', 'DIAG_CAPABILITY', 'DIAG_LIFECYCLE']);
    expect(panel.leakedPayloads).toBe(0);
    expect(JSON.stringify(panel.diagnosticCodes)).not.toContain('fixture-secret-payload');
    app.loop.dispose();
  });

  test('should distinguish every boundary through its actual evidence text', async () => {
    const { app } = buildLabExample(LAB_ID, await loadDefinition());
    const cases = [
      ['L', /Boundary:\s*layout[\s\S]*probe rect 0x1/iu],
      ['F', /Boundary:\s*focus[\s\S]*probe disabled true/iu],
      ['C', /Boundary:\s*command[\s\S]*isCommandEnabled false/iu],
      ['R', /Boundary:\s*render[\s\S]*published version 1/iu],
      ['P', /Boundary:\s*capability[\s\S]*(?:colour|UTF-8|mouse SGR)/iu],
      ['H', /Boundary:\s*lifecycle[\s\S]*resource active true/iu],
    ] as const;

    for (const [hotkey, evidence] of cases) {
      dispatchExampleAction(app, { kind: 'key', key: hotkey, modifiers: ['Alt'] });
      expect(frameText(app)).toMatch(evidence);
    }
    app.loop.dispose();
  });

  test('should route every mouse action through a registered command', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);

    for (const label of [
      'Inspect layout',
      'Inspect focus',
      'Inspect command',
      'Render probe',
      'Capability',
      'Host life',
    ]) {
      clickButton(app, dialog, label);
    }
    clickButton(app, dialog, 'Verify');

    expect({
      layout: panel.layoutDiagnoses,
      focus: panel.focusDiagnoses,
      command: panel.commandDiagnoses,
      render: panel.renderDiagnoses,
      capability: panel.capabilityDiagnoses,
      lifecycle: panel.lifecycleDiagnoses,
      corrections: panel.corrections,
    }).toEqual({
      layout: 1,
      focus: 1,
      command: 1,
      render: 1,
      capability: 1,
      lifecycle: 1,
      corrections: 1,
    });
    expect(frameText(app)).toMatch(/Verification:\s*PASS.+verified/iu);
    expect(panel.diagnosticCodes).toContain('CORRECTION_VERIFIED');
    app.loop.dispose();
  });

  test('should correct and re-observe the selected boundary instead of reporting a generic pass', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);

    panel.inspectLayout();
    expect(panel.layoutProbeWidth).toBe(0);
    panel.verifyCorrection();
    expect(panel.layoutProbeWidth).toBe(5);
    expect(frameText(app)).toContain('ASCII');

    panel.inspectFocus();
    panel.verifyCorrection();
    expect(panel.focusProbeOwnsFocus).toBe(true);

    panel.inspectCommand();
    expect(panel.commandHandlerRuns).toBe(0);
    panel.verifyCorrection();
    expect(panel.commandHandlerRuns).toBe(1);

    const renderBefore = frameText(app);
    panel.inspectRender();
    expect(panel.renderedVersion).toBe(1);
    expect(frameText(app)).not.toBe(renderBefore);
    panel.verifyCorrection();
    expect(panel.renderedVersion).toBe(2);
    expect(frameText(app)).toMatch(/R2\/native/iu);

    panel.inspectCapability();
    panel.verifyCorrection();
    expect(panel.presentationMode).toBe('ASCII');
    expect(frameText(app)).toMatch(/R2\/ASCII/iu);

    panel.inspectLifecycle();
    panel.verifyCorrection();
    expect(panel.lateWorkRejections).toBe(1);
    expect(panel.lateWorkMutations).toBe(0);
    expect(panel.lateWorkResourceUses).toBe(0);
    expect(frameText(app)).toMatch(/Boundary:\s*lifecycle[\s\S]*PASS verified/iu);
    app.loop.dispose();
  });

  test('should keep retained diagnostic actions inert after idempotent disposal', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    panel.inspectLayout();
    const before = {
      layout: panel.layoutDiagnoses,
      focus: panel.focusDiagnoses,
      command: panel.commandDiagnoses,
      diagnostics: panel.diagnosticCount,
      corrections: panel.corrections,
    };

    app.loop.dispose();
    app.loop.dispose();
    panel.invokeRetainedWork();
    panel.inspectLayout();
    panel.inspectFocus();
    panel.inspectCommand();
    panel.verifyCorrection();

    expect({
      layout: panel.layoutDiagnoses,
      focus: panel.focusDiagnoses,
      command: panel.commandDiagnoses,
      diagnostics: panel.diagnosticCount,
      corrections: panel.corrections,
    }).toEqual(before);
    expect(panel.cleanupCount).toBe(1);
    expect(panel.resourceDisposals).toBe(1);
    expect(panel.lateWorkRejections).toBe(1);
    expect(panel.lateWorkMutations).toBe(0);
    expect(panel.lateWorkResourceUses).toBe(0);
  });

  test('should keep compact instructions, actions, and non-colour evidence visibly reachable', async () => {
    const { app } = buildLabExample(LAB_ID, await loadDefinition());
    const frame = frameText(app);
    expect(frame).toMatch(/Evidence ladder:\s*reproduce classify evidence correct/iu);
    expect(frame).toMatch(/Alt\+L\/F\/C\/R\/P\/H\/V/iu);
    expect(frame).toMatch(/Redaction PASS[\s\S]*ASCII/iu);
    for (const label of ['Inspect layout', 'Inspect focus', 'Inspect command', 'Render probe', 'Capability']) {
      expect(frame).toContain(label);
    }
    app.loop.dispose();
  });

  test('should repeat diagnosis without growing resources or diagnostics beyond their owners', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    for (let cycle = 0; cycle < 12; cycle += 1) {
      panel.inspectRender();
      panel.inspectCapability();
    }
    expect(panel.renderDiagnoses).toBe(12);
    expect(panel.capabilityDiagnoses).toBe(12);
    expect(panel.diagnosticCount).toBe(panel.diagnosticCapacity);
    expect(panel.leakedPayloads).toBe(0);
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    expect(panel.resourceDisposals).toBe(1);
  });
});
