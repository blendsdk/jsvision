/**
 * Hardening coverage for architecture fixture repetition, disposal, failure, and source boundaries.
 */
import { readFileSync } from 'node:fs';

import { Button, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { ArchitectureBoundariesPanel } from '../src/example-fixtures/application-architecture/architecture-boundaries-panel.js';
import { ArchitectureOwnershipPanel } from '../src/example-fixtures/application-architecture/architecture-ownership-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const boundariesLabId = 'guides/architecture-boundaries';
const ownershipLabId = 'guides/architecture-ownership';
const guideSource = readFileSync(new URL('../guide/application-architecture.md', import.meta.url), 'utf8');

/** Load one architecture laboratory through the real docs registry. */
async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`Missing architecture laboratory: ${id}`);
  return (await entry.load()).default;
}

/** Find the dependency-boundary panel in its rendered dialog. */
function boundariesPanel(dialog: Parameters<typeof viewsIn>[0]): ArchitectureBoundariesPanel {
  const panel = viewsIn(dialog).find((view): view is ArchitectureBoundariesPanel => {
    return view instanceof ArchitectureBoundariesPanel;
  });
  if (panel === undefined) throw new Error('Architecture boundaries panel is missing');
  return panel;
}

/** Find the lifetime-ownership panel in its rendered dialog. */
function ownershipPanel(dialog: Parameters<typeof viewsIn>[0]): ArchitectureOwnershipPanel {
  const panel = viewsIn(dialog).find((view): view is ArchitectureOwnershipPanel => {
    return view instanceof ArchitectureOwnershipPanel;
  });
  if (panel === undefined) throw new Error('Architecture ownership panel is missing');
  return panel;
}

/** Click one real laboratory Button through mounted terminal coordinates. */
function clickButton(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: Parameters<typeof viewsIn>[0],
  label: string,
): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`Architecture laboratory is missing ${label}`);
  expect(button.activation.command).not.toBeNull();
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

describe('Application architecture hardening', () => {
  test('should keep the diagnostic coupled path separate from layered service and state evidence', async () => {
    const definition = await loadDefinition(boundariesLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(boundariesLabId, definition);
      const panel = boundariesPanel(dialog);

      app.loop.dispatch(key('c', { alt: true }));
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.coupledMutations).toBe(2);
      expect(panel.commandRuns).toBe(0);
      expect(panel.serviceCalls).toBe(0);
      expect(panel.statePublications).toBe(0);
      expect(frameText(app)).toContain('Domain value: 0');

      app.loop.dispatch(key('l', { alt: true }));
      app.loop.dispatch(key('l', { alt: true }));
      expect(panel.commandRuns).toBe(2);
      expect(panel.serviceCalls).toBe(2);
      expect(panel.statePublications).toBe(2);
      expect(frameText(app)).toContain('Domain value: 2');
      app.loop.dispose();
      dispose();
      expect(panel.cleanupCount).toBe(1);
    });
  });

  test('should release one screen and widget owner for every repeated navigation', async () => {
    const definition = await loadDefinition(ownershipLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(ownershipLabId, definition);
      const panel = ownershipPanel(dialog);
      panel.publishCurrent('keyboard');
      expect(panel.resultPublications).toBe(1);
      expect(panel.publishedResult).toBe('current-generation');

      for (let index = 0; index < 4; index += 1) {
        panel.navigate(index % 2 === 0 ? 'keyboard' : 'mouse');
        app.loop.renderRoot.flush();
      }

      expect(panel.applicationResources).toBe(1);
      expect(panel.screenCleanups).toBe(4);
      expect(panel.widgetCleanups).toBe(4);
      const stale = panel.createCompletion('stale-corruption');
      panel.navigate('keyboard');
      app.loop.renderRoot.flush();
      stale();
      expect(panel.staleResultsSuppressed).toBe(1);
      expect(panel.publishedResult).toBe('current-generation');
      expect(frameText(app)).toContain('Screen: detail');
      app.loop.dispose();
      dispose();
      expect(panel.screenCleanups).toBe(6);
      expect(panel.widgetCleanups).toBe(6);
      expect(panel.applicationResources).toBe(0);
      expect(panel.applicationResourceUses).toBe(1);
      expect(panel.applicationResourceDisposals).toBe(1);
    });
  });

  test('should keep retained actions inert after idempotent application disposal', async () => {
    const definition = await loadDefinition(ownershipLabId);
    const { app, dialog } = buildLabExample(ownershipLabId, definition);
    const panel = ownershipPanel(dialog);
    const late = panel.createCompletion('post-disposal-corruption');
    app.loop.dispose();
    app.loop.dispose();
    const afterDispose = {
      screenCleanups: panel.screenCleanups,
      widgetCleanups: panel.widgetCleanups,
      failures: panel.isolatedFailures,
      stale: panel.staleResultsSuppressed,
      publications: panel.resultPublications,
      result: panel.publishedResult,
      cleanup: panel.cleanupCount,
    };

    late();
    panel.navigate('mouse');
    panel.isolateFailure('keyboard');
    panel.suppressStale('keyboard');

    expect(panel.applicationResources).toBe(0);
    expect({
      screenCleanups: panel.screenCleanups,
      widgetCleanups: panel.widgetCleanups,
      failures: panel.isolatedFailures,
      stale: panel.staleResultsSuppressed,
      publications: panel.resultPublications,
      result: panel.publishedResult,
      cleanup: panel.cleanupCount,
    }).toEqual(afterDispose);
    expect(panel.applicationResourceDisposals).toBe(1);
  });

  test('should keep repeated failures isolated, bounded, and value-free', async () => {
    const definition = await loadDefinition(ownershipLabId);
    const { app, dialog } = buildLabExample(ownershipLabId, definition);
    const panel = ownershipPanel(dialog);
    panel.isolateFailure('keyboard');
    panel.isolateFailure('mouse');
    app.loop.renderRoot.flush();

    const frame = frameText(app);
    expect(panel.isolatedFailures).toBe(2);
    expect(panel.applicationResources).toBe(1);
    expect(frame).toContain('Failure: isolated · code SERVICE_UNAVAILABLE');
    expect(panel.diagnosticEntries).toEqual(['SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE']);
    expect(JSON.stringify(panel.diagnosticEntries)).not.toContain('fixture-secret-payload');
    app.loop.dispose();
  });

  test('should route every mouse button through its registered application command', async () => {
    const boundariesDefinition = await loadDefinition(boundariesLabId);
    const boundaries = buildLabExample(boundariesLabId, boundariesDefinition);
    const boundaryPanel = boundariesPanel(boundaries.dialog);
    clickButton(boundaries.app, boundaries.dialog, 'Coupled path');
    clickButton(boundaries.app, boundaries.dialog, 'Layered flow');
    expect(boundaryPanel.coupledMutations).toBe(1);
    expect(boundaryPanel.commandRuns).toBe(1);
    expect(boundaryPanel.serviceCalls).toBe(1);
    expect(frameText(boundaries.app)).toContain('Action source: mouse');
    boundaries.app.loop.dispose();

    const ownershipDefinition = await loadDefinition(ownershipLabId);
    const ownership = buildLabExample(ownershipLabId, ownershipDefinition);
    const ownerPanel = ownershipPanel(ownership.dialog);
    clickButton(ownership.app, ownership.dialog, 'Navigate');
    clickButton(ownership.app, ownership.dialog, 'Isolate failure');
    clickButton(ownership.app, ownership.dialog, 'Suppress stale');
    expect(ownerPanel.screenCleanups).toBe(2);
    expect(ownerPanel.isolatedFailures).toBe(1);
    expect(ownerPanel.staleResultsSuppressed).toBe(1);
    expect(frameText(ownership.app)).toContain('Action source: mouse');
    ownership.app.loop.dispose();
  });

  test('should teach circular-dependency repair through public feature boundaries', () => {
    expect(guideSource).toMatch(
      /circular dependency[\s\S]{0,350}(?:extract|invert)[\s\S]{0,350}(?:interface|package boundary)/iu,
    );
    expect(guideSource).toContain('public package entry points');
    expect(guideSource).toContain('never reach into another');
    expect(guideSource).not.toMatch(/from ['"]@jsvision\/ui\/src/gu);
    expect(guideSource).not.toMatch(/packages\/[^'"]+\/src/gu);
  });
});
