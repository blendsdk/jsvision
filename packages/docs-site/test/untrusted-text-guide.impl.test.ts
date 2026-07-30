/**
 * Implementation hardening for the untrusted-text comparison fixture.
 *
 * These cases stress repeated use, fixture bounds, diagnostic eviction, sensitive-preview
 * suppression, and post-disposal inertia beyond the immutable course contract.
 */
import { Button, Text } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { UntrustedTextPanel } from '../src/example-fixtures/untrusted-text/untrusted-text-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

const LAB_ID = 'guides/untrusted-text-boundary';

/** Load the registered example through the same lazy boundary used by the docs site. */
async function definition(): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === LAB_ID);
  if (entry === undefined) throw new Error(`missing example registry entry: ${LAB_ID}`);
  return (await entry.load()).default;
}

/** Find the concrete mounted comparison panel. */
function panelIn(dialog: ReturnType<typeof buildLabExample>['dialog']): UntrustedTextPanel {
  const panel = viewsIn(dialog).find((view): view is UntrustedTextPanel => view instanceof UntrustedTextPanel);
  if (panel === undefined) throw new Error('missing untrusted-text comparison panel');
  return panel;
}

/** Find one mounted action button by its public activation label. */
function buttonIn(dialog: ReturnType<typeof buildLabExample>['dialog'], label: string): Button {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`missing ${label} button`);
  return button;
}

/** Activate a mounted button through its real mouse hit-test route. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], button: Button): void {
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + Math.floor(button.bounds.width / 2), y: origin.y },
  });
}

/** Exercise the dialog's real resize handle. */
function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const corner = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: corner,
    to: { x: corner.x + 10, y: corner.y + 3 },
  });
}

/** Assert the panel, two-row buttons, and complete instruction own disjoint rows. */
function expectDisjointTeachingRows(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const panel = panelIn(dialog);
  const buttons = ['Next sample', 'Sanitize', 'Redact log'].map((label) => buttonIn(dialog, label));
  const parent = buttons[0]?.parent;
  const instruction = viewsIn(dialog).find(
    (view): view is Text => view instanceof Text && view.parent === parent && view.measure().width === 51,
  );
  expect(instruction).toBeDefined();
  const buttonRow = buttons[0]?.bounds.y ?? -1;
  expect(panel.bounds.y + panel.bounds.height).toBeLessThanOrEqual(buttonRow);
  for (const button of buttons) {
    expect(button.bounds.y).toBe(buttonRow);
    expect(button.bounds.height).toBe(2);
    expect(button.bounds.y + button.bounds.height).toBeLessThanOrEqual(instruction?.bounds.y ?? -1);
  }
  expect(instruction?.bounds.height).toBe(1);
  expect(frameText(app)).toContain('Alt+N next | Alt+S safe | Alt+R redact | Alt+Z zoom');
}

describe('untrusted-text comparison hardening', () => {
  test('cycles the bounded fixture table and returns to the original sample', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    const panel = panelIn(dialog);
    expect(panel.sampleIndex).toBe(0);
    expect(panel.unsafeControlCount).toBeGreaterThan(0);
    for (let index = 0; index < 5; index += 1) panel.nextSample();
    expect(panel.sampleIndex).toBe(0);
    expect(panel.renderedControlCount).toBe(0);
    app.loop.dispose();
  });

  test('keeps repeated explicit sanitization control-free and exactly counted', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    const panel = panelIn(dialog);
    for (let index = 0; index < 12; index += 1) panel.sanitizeSelected();
    expect(panel.sanitizations).toBe(12);
    expect(panel.renderedControlCount).toBe(0);
    expect(panel.leakedPayloads).toBe(0);
    expect(panel.diagnosticCount).toBe(panel.diagnosticCapacity);
    app.loop.dispose();
  });

  test('redacts a sensitive paste without displaying or retaining its printable payload', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    const panel = panelIn(dialog);
    for (let index = 0; index < 4; index += 1) panel.nextSample();
    panel.redactSelected();
    app.loop.renderRoot.flush();
    expect(panel.redactions).toBe(1);
    expect(panel.leakedPayloads).toBe(0);
    expect(frameText(app)).not.toContain('visitor-secret-token');
    expect(frameText(app)).toContain('[REDACTED');
    app.loop.dispose();
  });

  test('retains only the bounded latest structural records across mixed actions', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    const panel = panelIn(dialog);
    for (let index = 0; index < 8; index += 1) {
      panel.sanitizeSelected();
      panel.redactSelected();
    }
    expect(panel.diagnosticCount).toBe(panel.diagnosticCapacity);
    expect(panel.leakedPayloads).toBe(0);
    app.loop.dispose();
  });

  test('routes focused keyboard and mouse activation through the same commands', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    const panel = panelIn(dialog);
    const next = buttonIn(dialog, 'Next sample');
    const sanitize = buttonIn(dialog, 'Sanitize');
    const redact = buttonIn(dialog, 'Redact log');

    app.loop.focusView(next);
    dispatchExampleAction(app, { kind: 'key', key: 'space', modifiers: [] });
    expect(panel.sampleIndex).toBe(1);
    clickButton(app, next);
    expect(panel.sampleIndex).toBe(2);
    app.loop.focusView(next);
    dispatchExampleAction(app, { kind: 'key', key: 'enter', modifiers: [] });
    expect(panel.sampleIndex).toBe(3);

    app.loop.focusView(sanitize);
    dispatchExampleAction(app, { kind: 'key', key: 'space', modifiers: [] });
    expect(panel.sanitizations).toBe(1);
    clickButton(app, sanitize);
    expect(panel.sanitizations).toBe(2);

    app.loop.focusView(redact);
    dispatchExampleAction(app, { kind: 'key', key: 'space', modifiers: [] });
    expect(panel.redactions).toBe(1);
    clickButton(app, redact);
    expect(panel.redactions).toBe(2);
    expect(frameText(app)).toContain('Route: shared command');
    app.loop.dispose();
  });

  test('does not expose raw terminal controls in any switched rendered frame', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    const panel = panelIn(dialog);
    for (let index = 0; index < 5; index += 1) {
      panel.nextSample();
      panel.sanitizeSelected();
      expect(frameText(app)).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u0080-\u009f]/u);
      expect(panel.renderedControlCount).toBe(0);
    }
    app.loop.dispose();
  });

  test('rejects every action after disposal and cleans up once', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    const panel = panelIn(dialog);
    panel.sanitizeSelected();
    panel.redactSelected();
    const snapshot = {
      sample: panel.sampleIndex,
      sanitizations: panel.sanitizations,
      redactions: panel.redactions,
      diagnostics: panel.diagnosticCount,
    };
    app.loop.dispose();
    panel.nextSample();
    panel.sanitizeSelected();
    panel.redactSelected();
    expect({
      sample: panel.sampleIndex,
      sanitizations: panel.sanitizations,
      redactions: panel.redactions,
      diagnostics: panel.diagnosticCount,
    }).toEqual(snapshot);
    expect(panel.cleanupCount).toBe(1);
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
  });

  test('keeps panel, buttons, and the full instruction disjoint through every window state', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await definition());
    collectTemplate1Evidence(app, dialog);
    expectDisjointTeachingRows(app, dialog);

    resizeDialog(app, dialog);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    expectDisjointTeachingRows(app, dialog);

    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
    expectDisjointTeachingRows(app, dialog);

    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    expectDisjointTeachingRows(app, dialog);
    app.loop.dispose();
  });
});
