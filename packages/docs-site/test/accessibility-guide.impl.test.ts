/**
 * Implementation hardening for the two accessibility course laboratories.
 *
 * These cases extend the immutable course contract with repeated focus traversal, focused-key
 * activation, profile wraparound, reduced host geometry, row ownership, and post-disposal inertia.
 */
import { degradeCapsFully, fallbackGlyph, isAsciiSafe, resolveCapabilities } from '@jsvision/core';
import { Button, Group, Text } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { AccessibleInteractionPanel } from '../src/example-fixtures/accessibility/accessible-interaction-panel.js';
import { ResilientPresentationPanel } from '../src/example-fixtures/accessibility/resilient-presentation-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

const INTERACTION_ID = 'guides/accessible-interaction';
const PRESENTATION_ID = 'guides/resilient-presentation';

/** Load a registered Guide laboratory through the learner-facing lazy boundary. */
async function definition(id: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

/** Find the mounted keyboard-interaction evidence panel. */
function interactionPanel(dialog: ReturnType<typeof buildLabExample>['dialog']): AccessibleInteractionPanel {
  const panel = viewsIn(dialog).find(
    (view): view is AccessibleInteractionPanel => view instanceof AccessibleInteractionPanel,
  );
  if (panel === undefined) throw new Error('missing accessible-interaction panel');
  return panel;
}

/** Find the mounted presentation-resilience evidence panel. */
function presentationPanel(dialog: ReturnType<typeof buildLabExample>['dialog']): ResilientPresentationPanel {
  const panel = viewsIn(dialog).find(
    (view): view is ResilientPresentationPanel => view instanceof ResilientPresentationPanel,
  );
  if (panel === undefined) throw new Error('missing resilient-presentation panel');
  return panel;
}

/** Find one mounted action button by its plain activation label. */
function buttonIn(dialog: ReturnType<typeof buildLabExample>['dialog'], label: string): Button {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`missing ${label} button`);
  return button;
}

/** Assert that the authored panel, controls, and instruction own disjoint rows. */
function expectDisjointRows(dialog: ReturnType<typeof buildLabExample>['dialog']): void {
  const content = dialog.children.find((view): view is Group => view instanceof Group);
  if (content === undefined) throw new Error('missing accessibility laboratory content');
  const panel = content.children.find(
    (view) => view instanceof AccessibleInteractionPanel || view instanceof ResilientPresentationPanel,
  );
  const button = content.children.find((view): view is Button => view instanceof Button);
  const instruction = content.children.find((view): view is Text => view instanceof Text);
  expect(panel).toBeDefined();
  expect(button).toBeDefined();
  expect(instruction).toBeDefined();
  expect((panel?.bounds.y ?? 0) + (panel?.bounds.height ?? 0)).toBeLessThanOrEqual(button?.bounds.y ?? -1);
  expect((button?.bounds.y ?? 0) + (button?.bounds.height ?? 0)).toBeLessThanOrEqual(instruction?.bounds.y ?? -1);
}

describe('accessibility course laboratory hardening', () => {
  test('traverses forward and backward without focusing the disabled action', async () => {
    const { app, dialog } = buildLabExample(INTERACTION_ID, await definition(INTERACTION_ID));
    const panel = interactionPanel(dialog);
    const activate = buttonIn(dialog, 'Activate');
    const inspect = buttonIn(dialog, 'Inspect');
    const unavailable = buttonIn(dialog, 'Delete');
    expect(app.loop.getFocused()).toBe(activate);
    dispatchExampleAction(app, { kind: 'key', key: 'tab', modifiers: [] });
    expect(app.loop.getFocused()).toBe(inspect);
    dispatchExampleAction(app, { kind: 'key', key: 'tab', modifiers: ['Shift'] });
    expect(app.loop.getFocused()).toBe(activate);
    expect(app.loop.getFocused()).not.toBe(unavailable);
    expect(panel.keyboardVisits).toBeGreaterThanOrEqual(2);
    expect(panel.keyboardVisits).toBe(panel.visibleFocusChecks);
    app.loop.dispose();
  });

  test('reports Space, Enter, accelerator, and pointer activation with non-colour feedback', async () => {
    const { app, dialog } = buildLabExample(INTERACTION_ID, await definition(INTERACTION_ID));
    const panel = interactionPanel(dialog);
    const activate = buttonIn(dialog, 'Activate');
    app.loop.focusView(activate);
    dispatchExampleAction(app, { kind: 'key', key: 'space', modifiers: [] });
    dispatchExampleAction(app, { kind: 'key', key: 'enter', modifiers: [] });
    dispatchExampleAction(app, { kind: 'key', key: 'a', modifiers: ['Alt'] });
    const origin = absoluteOrigin(activate);
    dispatchExampleAction(app, {
      kind: 'mouse',
      gesture: 'click',
      at: { x: origin.x + 2, y: origin.y },
    });
    expect(panel.focusedActivations).toBe(2);
    expect(panel.hotkeyActivations).toBe(1);
    expect(panel.mouseActivations).toBe(1);
    expect(panel.nonColorChecks).toBe(4);
    expect(frameText(app)).toMatch(/Activation:\s*PASS/iu);
    app.loop.dispose();
  });

  test('routes every Inspect input path through one observable command', async () => {
    const { app, dialog } = buildLabExample(INTERACTION_ID, await definition(INTERACTION_ID));
    const panel = interactionPanel(dialog);
    const inspect = buttonIn(dialog, 'Inspect');
    app.loop.focusView(inspect);
    dispatchExampleAction(app, { kind: 'key', key: 'space', modifiers: [] });
    dispatchExampleAction(app, { kind: 'key', key: 'i', modifiers: ['Alt'] });
    const origin = absoluteOrigin(inspect);
    dispatchExampleAction(app, {
      kind: 'mouse',
      gesture: 'click',
      at: { x: origin.x + 2, y: origin.y },
    });
    expect(panel.inspectActivations).toBe(3);
    expect(frameText(app)).toMatch(/Activation:\s*PASS.+Inspect command/iu);
    app.loop.dispose();
  });

  test('wraps the bounded five-profile sequence without losing semantic labels', async () => {
    const { app, dialog } = buildLabExample(PRESENTATION_ID, await definition(PRESENTATION_ID));
    const panel = presentationPanel(dialog);
    for (let index = 0; index < 5; index += 1) {
      dispatchExampleAction(app, { kind: 'key', key: 'p', modifiers: ['Alt'] });
      expect(panel.meaningChecks).toBe(index + 1);
      expect(panel.clippingFailures).toBe(0);
      expect(panel.asciiUnsafeGlyphs).toBe(0);
      if (panel.profileName === 'ASCII') expect(frameText(app)).toMatch(/\+-+\+/u);
      if (panel.profileName === 'Narrow') expect(panel.renderedSurfaceWidth).toBe(28);
    }
    expect(panel.profileName).toBe('Classic');
    expect(panel.renderedSurfaceWidth).toBe(54);
    expect(panel.profileChanges).toBe(5);
    expect(panel.meaningChecks).toBe(5);
    expect(panel.monochromeAttributeChecks).toBe(2);
    expect(panel.clippingFailures).toBe(0);
    expect(panel.asciiUnsafeGlyphs).toBe(0);
    expect(frameText(app)).toMatch(/FOCUSED[\s\S]+SELECTED.+DISABLED[\s\S]+ERROR/u);
    app.loop.dispose();
  });

  test('keeps explicit NO_COLOR and ASCII facts independent', () => {
    const noColor = resolveCapabilities({
      env: { NO_COLOR: '', FORCE_COLOR: '3', TERM: 'xterm-256color' },
      platform: 'linux',
    }).profile;
    expect(noColor.colorDepth).toBe('mono');
    const ascii = degradeCapsFully(
      resolveCapabilities({
        env: {},
        platform: 'linux',
        override: { colorDepth: 'truecolor' },
      }).profile,
    );
    expect(isAsciiSafe(ascii)).toBe(true);
    expect(ascii.colorDepth).toBe('truecolor');
    expect([fallbackGlyph('┌', ascii), fallbackGlyph('─', ascii), fallbackGlyph('█', ascii)].join('')).toBe('+-#');
  });

  test.each([INTERACTION_ID, PRESENTATION_ID])('keeps %s compact and legible in a reduced 68x20 host', async (id) => {
    const { app, dialog } = buildLabExample(id, await definition(id), {
      viewport: { width: 68, height: 20 },
    });
    const evidence = collectTemplate1Evidence(app, dialog);
    expect(evidence.viewport).toEqual({ width: 68, height: 20 });
    expectDisjointRows(dialog);
    expect(frameText(app)).toMatch(/(?:FOCUSED|Focus:|Profile:)[\s\S]+(?:PASS|meaning|Activation)/u);
    app.loop.dispose();
  });

  test.each([INTERACTION_ID, PRESENTATION_ID])(
    'keeps %s authored rows disjoint after maximize and restore',
    async (id) => {
      const { app, dialog } = buildLabExample(id, await definition(id));
      expectDisjointRows(dialog);
      dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expectDisjointRows(dialog);
      dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
      collectTemplate1Evidence(app, dialog);
      expectDisjointRows(dialog);
      app.loop.dispose();
    },
  );

  test('rejects interaction evidence after owner disposal', async () => {
    const { app, dialog } = buildLabExample(INTERACTION_ID, await definition(INTERACTION_ID));
    const panel = interactionPanel(dialog);
    app.loop.dispose();
    panel.observeFocus('Inspect');
    panel.prepareActivation('hotkey');
    panel.activateSharedCommand();
    panel.prepareActivation('mouse');
    panel.activateSharedCommand();
    panel.prepareActivation('focused-key');
    panel.activateSharedCommand();
    panel.inspectSharedCommand();
    expect(panel.cleanupCount).toBe(1);
    expect(panel.hotkeyActivations).toBe(0);
    expect(panel.mouseActivations).toBe(0);
    expect(panel.focusedActivations).toBe(0);
    expect(panel.inspectActivations).toBe(0);
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
  });

  test('rejects presentation transitions after owner disposal', async () => {
    const { app, dialog } = buildLabExample(PRESENTATION_ID, await definition(PRESENTATION_ID));
    const panel = presentationPanel(dialog);
    panel.nextProfile();
    expect(panel.profileName).toBe('NO_COLOR');
    app.loop.dispose();
    panel.nextProfile();
    expect(panel.profileName).toBe('NO_COLOR');
    expect(panel.profileChanges).toBe(1);
    expect(panel.cleanupCount).toBe(1);
  });
});
