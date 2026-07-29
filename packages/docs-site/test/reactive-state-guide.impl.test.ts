/**
 * Implementation coverage for the Reactive state guide laboratories.
 *
 * The specifications prove the teaching outcomes. These checks cover the shared dialog's concrete
 * responsive geometry and the lifetime lesson's idempotent teardown mechanics.
 */
import { describe, expect, test } from 'vitest';
import { Group, createRoot } from '@jsvision/ui';
import type { Application, Dialog } from '@jsvision/ui';
import graphExample from '../examples/guides/reactive-graph.js';
import lifetimeExample from '../examples/guides/reactive-lifetimes.js';
import {
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

    app.loop.dispatch(key('b', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 2');

    app.loop.dispatch(key('r', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 3');

    app.loop.dispatch(key('r', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 3');

    app.loop.dispatch(key('p', { alt: true }));
    app.loop.dispatch(key('q', { alt: true }));
    expect(frameText(app)).toContain('Effect runs: 5');
    expect(frameText(app)).toContain('$36');
    dispose();
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
