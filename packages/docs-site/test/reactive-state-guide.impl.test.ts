/**
 * Implementation coverage for the Reactive state guide laboratories.
 *
 * The specifications prove the teaching outcomes. These checks cover the shared dialog's concrete
 * responsive geometry and the lifetime lesson's idempotent teardown mechanics.
 */
import { describe, expect, test, vi } from 'vitest';
import { Group, createRoot } from '@jsvision/ui';
import type { Application, Dialog } from '@jsvision/ui';
import graphExample from '../examples/guides/reactive-graph.js';
import lifetimeExample from '../examples/guides/reactive-lifetimes.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { demoShell } from '../src/demo-shell.js';
import {
  EXAMPLE_CAPS,
  EXAMPLE_VIEWPORT,
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
} from './example-lab-harness.js';

const LESSONS = [
  { id: 'guides/reactive-graph', definition: graphExample },
  { id: 'guides/reactive-lifetimes', definition: lifetimeExample },
] as const;

/** Grow a laboratory dialog through its real south-east resize grip. */
function resizeDialog(app: Application, dialog: Dialog, widthDelta = 10, heightDelta = 4): void {
  const origin = absoluteOrigin(dialog);
  const grip = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: grip,
    to: { x: grip.x + widthDelta, y: grip.y + heightDelta },
  });
}

/**
 * Build through the browser-facing cleanup seam without an ambient reactive owner.
 *
 * This deliberately differs from the ordinary lab harness: a browser Play build happens before
 * `mountApp`, so build-time computations must own themselves and register teardown explicitly.
 */
function buildThroughHostLifecycle(definition: ExampleDefinition): { app: Application; cleanups: Array<() => void> } {
  const cleanups: Array<() => void> = [];
  const app = demoShell({
    build: (ctx) => definition.build(ctx),
    title: definition.title,
    kind: 'app',
    caps: EXAMPLE_CAPS,
    viewport: EXAMPLE_VIEWPORT,
    onCleanup: (cleanup) => cleanups.push(cleanup),
  });
  app.loop.resize(EXAMPLE_VIEWPORT);
  return { app, cleanups };
}

describe.each(LESSONS)('$id responsive implementation', ({ id, definition }) => {
  test('grows through resize and maximize, then restores the intermediate rectangle exactly', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      const content = dialog.children.find((child): child is Group => child instanceof Group);
      if (content === undefined) throw new Error(`${id} has no inset content group`);
      const authored = { ...content.bounds };

      resizeDialog(app, dialog);
      const resizedDialog = { ...dialog.bounds };
      const resizedContent = { ...content.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(resizedContent.width).toBeGreaterThan(authored.width);
      expect(resizedContent.height).toBeGreaterThan(authored.height);

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(content.bounds.width).toBeGreaterThan(resizedContent.width);
      expect(content.bounds.height).toBeGreaterThan(resizedContent.height);
      for (const child of content.children) {
        expect(child.bounds.x).toBeGreaterThanOrEqual(0);
        expect(child.bounds.y).toBeGreaterThanOrEqual(0);
        expect(child.bounds.x + child.bounds.width).toBeLessThanOrEqual(content.bounds.width);
        expect(child.bounds.y + child.bounds.height).toBeLessThanOrEqual(content.bounds.height);
      }

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resizedDialog);
      expect(content.bounds).toEqual(resizedContent);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dispose();
    });
  });
});

test('repeated batched writes notify once per changed transaction and ignore equal resets', () => {
  createRoot((dispose) => {
    const { app } = buildLabExample('guides/reactive-graph', graphExample);

    app.loop.dispatch(key('b', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 2');
    expect(frameText(app)).toContain('batch: price + quantity, one effect');

    app.loop.dispatch(key('b', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 2');
    expect(frameText(app)).toContain('batch: values unchanged, no effect rerun');

    app.loop.dispatch(key('r', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 3');
    expect(frameText(app)).toContain('reset batched to one consistent snapshot');

    app.loop.dispatch(key('r', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 3');
    expect(frameText(app)).toContain('reset: values unchanged, no effect rerun');

    app.loop.dispatch(key('p', { alt: true }));
    app.loop.dispatch(key('q', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 5');
    expect(frameText(app)).toContain('$36');
    dispose();
  });
});

describe.each([
  {
    id: 'graph',
    definition: graphExample,
    beforeCleanup: key('b', { alt: true }),
    afterCleanup: key('p', { alt: true }),
    beforeEvidence: 'Effect runs: 2',
    afterEvidence: 'Effect runs: 2',
  },
  {
    id: 'lifetimes',
    definition: lifetimeExample,
    beforeCleanup: key('a', { alt: true }),
    afterCleanup: key('a', { alt: true }),
    beforeEvidence: 'Runs 2 · cleanups 1 · scope active',
    afterEvidence: 'Runs 2 · cleanups 2 · scope active',
  },
] as const)('$id host lifecycle', ({ definition, beforeCleanup, afterCleanup, beforeEvidence, afterEvidence }) => {
  test('owns build-time computations and silences them when the browser host tears down', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { app, cleanups } = buildThroughHostLifecycle(definition);
    try {
      expect(cleanups).toHaveLength(1);
      expect(warn.mock.calls.flat().join('\n')).not.toContain('created outside any createRoot() scope');

      app.loop.dispatch(beforeCleanup);
      expect(frameText(app)).toContain(beforeEvidence);

      cleanups[0]?.();
      app.loop.dispatch(afterCleanup);
      app.loop.resize(EXAMPLE_VIEWPORT);
      expect(frameText(app)).toContain(afterEvidence);
    } finally {
      app.loop.dispose();
      warn.mockRestore();
    }
  });
});

test('disposing the watcher repeatedly is a no-op and later branch changes cannot revive it', () => {
  createRoot((dispose) => {
    const { app } = buildLabExample('guides/reactive-lifetimes', lifetimeExample);

    app.loop.dispatch(key('d', { alt: true }));
    app.loop.dispatch(key('d', { alt: true }));
    app.loop.dispatch(key('s', { alt: true }));

    expect(frameText(app)).toContain('Runs 1 · cleanups 1 · scope disposed');
    expect(frameText(app)).toContain('Watching primary = 10');
    dispose();
  });
});

test('alternating dependencies keep exact cleanup counts and remain silent after disposal', () => {
  createRoot((dispose) => {
    const { app } = buildLabExample('guides/reactive-lifetimes', lifetimeExample);

    for (let cycle = 0; cycle < 2; cycle += 1) {
      app.loop.dispatch(key('i', { alt: true }));
      app.loop.dispatch(key('n', { alt: true }));
      app.loop.dispatch(key('s', { alt: true }));
      app.loop.dispatch(key('a', { alt: true }));
    }
    expect(frameText(app)).toContain('Watching primary = 12');
    expect(frameText(app)).toContain('Runs 5 · cleanups 4 · scope active');

    app.loop.dispatch(key('d', { alt: true }));
    expect(frameText(app)).toContain('Runs 5 · cleanups 5 · scope disposed');

    app.loop.dispatch(key('s', { alt: true }));
    app.loop.dispatch(key('a', { alt: true }));
    expect(frameText(app)).toContain('Watching primary = 12');
    expect(frameText(app)).toContain('Runs 5 · cleanups 5 · scope disposed');
    dispose();
  });
});
