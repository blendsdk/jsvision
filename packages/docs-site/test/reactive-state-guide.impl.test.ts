/**
 * Implementation coverage for the Reactive state guide laboratories.
 *
 * The specifications prove the teaching outcomes. These checks cover the shared dialog's concrete
 * responsive geometry and the lifetime lesson's idempotent teardown mechanics.
 */
import { describe, expect, test } from 'vitest';
import { Group, createRoot } from '@jsvision/ui';
import graphExample from '../examples/guides/reactive-graph.js';
import lifetimeExample from '../examples/guides/reactive-lifetimes.js';
import { buildLabExample, frameText, key } from './example-lab-harness.js';

const LESSONS = [
  { id: 'guides/reactive-graph', definition: graphExample },
  { id: 'guides/reactive-lifetimes', definition: lifetimeExample },
] as const;

describe.each(LESSONS)('$id responsive implementation', ({ id, definition }) => {
  test('grows its inset content on maximize and restores the compact rectangle exactly', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      const content = dialog.children.find((child): child is Group => child instanceof Group);
      if (content === undefined) throw new Error(`${id} has no inset content group`);
      const compact = { ...content.bounds };

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(content.bounds.width).toBeGreaterThan(compact.width);
      expect(content.bounds.height).toBeGreaterThan(compact.height);
      for (const child of content.children) {
        expect(child.bounds.x).toBeGreaterThanOrEqual(0);
        expect(child.bounds.y).toBeGreaterThanOrEqual(0);
        expect(child.bounds.x + child.bounds.width).toBeLessThanOrEqual(content.bounds.width);
        expect(child.bounds.y + child.bounds.height).toBeLessThanOrEqual(content.bounds.height);
      }

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(content.bounds).toEqual(compact);
      dispose();
    });
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
