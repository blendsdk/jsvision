/**
 * Specification coverage for the Reactive state guide and its two teaching laboratories.
 *
 * The course must lead from writable signals through derived state and UI bindings, then teach
 * scheduling, dynamic dependencies, ownership, cleanup, and structural combinators. Both live
 * lessons use the shared compact application shell and make their reactive behavior visible.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Button, createRoot } from '@jsvision/ui';
import graphExample from '../examples/guides/reactive-graph.js';
import lifetimeExample from '../examples/guides/reactive-lifetimes.js';
import { EXAMPLES } from '../examples/index.js';
import { buildLabExample, collectTemplate1Evidence, frameText, key, viewsIn } from './example-lab-harness.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDE = readFileSync(join(PACKAGE_ROOT, 'guide', 'reactive-state.md'), 'utf8');

/** Build the signal-graph lesson through the registered application shell. */
function buildGraph(viewport = { width: 80, height: 24 }) {
  return buildLabExample('guides/reactive-graph', graphExample, { viewport });
}

/** Build the ownership lesson through the registered application shell. */
function buildLifetimes(viewport = { width: 80, height: 24 }) {
  return buildLabExample('guides/reactive-lifetimes', lifetimeExample, { viewport });
}

describe('Reactive state course content', () => {
  test('progresses from the reactive graph mental model to lifetimes, combinators, and failure modes', () => {
    const requiredLessons = [
      '## Mental model',
      '## Start with signals',
      '## Derive state with computed',
      '## Bind state to views',
      '## Run side effects',
      '## Coordinate updates',
      '## Control dependencies',
      '## Own and clean up reactive work',
      '## Render conditional and keyed structures',
      '## Common failure modes',
      '## Best practices',
      '## API reference',
    ];

    for (const lesson of requiredLessons) expect(GUIDE).toContain(lesson);
    expect(GUIDE).toContain('<PlayExample id="guides/reactive-graph"');
    expect(GUIDE).toContain('<PlayExample id="guides/reactive-lifetimes"');
    expect(GUIDE).toMatch(/```ts[\s\S]*\bsignal\s*\([\s\S]*\bcomputed\s*\([\s\S]*\beffect\s*\(/u);
    expect(GUIDE).toMatch(/\bbatch\s*\([\s\S]*\buntrack\s*\(/u);
    expect(GUIDE).toMatch(/\bcreateRoot\s*\([\s\S]*\bonCleanup\s*\(/u);
    expect(GUIDE).toMatch(/\bShow\s*\([\s\S]*\bFor\s*\(/u);
  });

  test('registers both lessons as complete applications', () => {
    expect(
      EXAMPLES.filter((entry) => entry.id.startsWith('guides/reactive')).map(({ id, kind }) => ({ id, kind })),
    ).toEqual([
      { id: 'guides/reactive-graph', kind: 'app' },
      { id: 'guides/reactive-lifetimes', kind: 'app' },
    ]);
  });
});

describe('Reactive Signal Graph Lab', () => {
  test('opens as a compact centered Classic-theme lesson with live source and derived values', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildGraph();
      const evidence = collectTemplate1Evidence(app, dialog);
      const rendered = frameText(app);

      expect(evidence.dialogRect.width).toBeLessThan(evidence.viewport.width);
      expect(evidence.dialogRect.height).toBeLessThan(evidence.viewport.height - 2);
      expect(rendered).toContain('price signal');
      expect(rendered).toContain('quantity signal');
      expect(rendered).toContain('total computed');
      expect(rendered).toContain('Effect runs: 1');
      dispose();
    });
  });

  test('updates one dependency at a time and coalesces the paired sale update', () => {
    createRoot((dispose) => {
      const { app } = buildGraph();

      app.loop.dispatch(key('p', { alt: true }));
      expect(frameText(app)).toContain('$12');
      expect(frameText(app)).toContain('Effect runs: 2');

      app.loop.dispatch(key('b', { alt: true }));
      expect(frameText(app)).toContain('$9');
      expect(frameText(app)).toContain('Qty 3');
      expect(frameText(app)).toContain('Effect runs: 3');
      expect(frameText(app)).toContain('batch: price + quantity, one effect');
      dispose();
    });
  });

  test('offers visible controls for every graph mutation', () => {
    createRoot((dispose) => {
      const { dialog } = buildGraph();
      const labels = viewsIn(dialog)
        .filter((view): view is Button => view instanceof Button)
        .map((button) => button.activation.label);

      expect(labels).toEqual(['Raise price', 'Add quantity', 'Batch sale', 'Reset']);
      dispose();
    });
  });
});

describe('Reactive Lifetime Lab', () => {
  test('shows tracked, untracked, cleanup, and ownership state in the compact template shell', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLifetimes();
      collectTemplate1Evidence(app, dialog);

      expect(frameText(app)).toContain('Watching primary = 10');
      expect(frameText(app)).toContain('Runs 1 · cleanups 0 · scope active');
      expect(frameText(app)).toContain('note read with untrack');
      dispose();
    });
  });

  test('recollects conditional dependencies while ignoring inactive and untracked changes', () => {
    createRoot((dispose) => {
      const { app } = buildLifetimes();

      app.loop.dispatch(key('i', { alt: true }));
      expect(frameText(app)).toContain('Runs 1 · cleanups 0');

      app.loop.dispatch(key('n', { alt: true }));
      expect(frameText(app)).toContain('Runs 1 · cleanups 0');

      app.loop.dispatch(key('s', { alt: true }));
      expect(frameText(app)).toContain('Watching backup = 101');
      expect(frameText(app)).toContain('Runs 2 · cleanups 1');

      app.loop.dispatch(key('a', { alt: true }));
      expect(frameText(app)).toContain('Watching backup = 102');
      expect(frameText(app)).toContain('Runs 3 · cleanups 2');
      dispose();
    });
  });

  test('disposes the nested watcher and prevents later writes from rerunning it', () => {
    createRoot((dispose) => {
      const { app } = buildLifetimes();

      app.loop.dispatch(key('d', { alt: true }));
      expect(frameText(app)).toContain('Runs 1 · cleanups 1 · scope disposed');

      app.loop.dispatch(key('a', { alt: true }));
      expect(frameText(app)).toContain('Runs 1 · cleanups 1 · scope disposed');
      dispose();
    });
  });
});
