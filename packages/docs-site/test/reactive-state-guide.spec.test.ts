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
import { Button, batch, computed, createRoot, effect, onCleanup, signal, untrack } from '@jsvision/ui';
import graphExample from '../examples/guides/reactive-graph.js';
import lifetimeExample from '../examples/guides/reactive-lifetimes.js';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDE = readFileSync(join(PACKAGE_ROOT, 'guide', 'reactive-state.md'), 'utf8');
const CATALOG = parseGuideCatalog(readFileSync(join(PACKAGE_ROOT, 'guides.json'), 'utf8'));
const GRAPH_ID = 'guides/reactive-graph';
const LIFETIME_ID = 'guides/reactive-lifetimes';

/** Return the TypeScript teaching snippets embedded in the course. */
function typescriptSnippets(): readonly string[] {
  return [...GUIDE.matchAll(/```ts\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

/** Build the signal-graph lesson through the registered application shell. */
function buildGraph(viewport = { width: 80, height: 24 }) {
  return buildLabExample(GRAPH_ID, graphExample, { viewport });
}

/** Build the ownership lesson through the registered application shell. */
function buildLifetimes(viewport = { width: 80, height: 24 }) {
  return buildLabExample(LIFETIME_ID, lifetimeExample, { viewport });
}

/** Resize a compact template dialog through its real south-east mouse grip. */
function resizeDialog(
  app: ReturnType<typeof buildGraph>['app'],
  dialog: ReturnType<typeof buildGraph>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const from = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: from,
    to: { x: from.x + 12, y: from.y + 4 },
  });
}

/** Click a visible laboratory button through the real application mouse event loop. */
function clickButton(
  app: ReturnType<typeof buildGraph>['app'],
  dialog: ReturnType<typeof buildGraph>['dialog'],
  label: string,
): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`the laboratory is missing the "${label}" button`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: {
      x: origin.x + Math.floor(button.bounds.width / 2),
      y: origin.y,
    },
  });
}

describe('Reactive state course content', () => {
  test('should preserve the catalog-owned prerequisite, outcomes, and two-laboratory contract', () => {
    const entry = CATALOG.entries.find((candidate) => candidate.id === 'reactive-state');

    expect(entry).toMatchObject({
      title: 'Reactive state',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['layout'],
      requiredLiveExamples: 2,
      examples: [GRAPH_ID, LIFETIME_ID],
    });
    expect(entry?.learningOutcomes).toEqual([
      'Model source and derived state with signals and computed values.',
      'Bind state to views and coordinate effects, batching, and dynamic dependencies.',
      'Own, clean up, and dispose reactive work safely.',
    ]);
    expect(GUIDE).toContain('](/guide/layout)');
  });

  test('should progress from an explicit beginner contract to safe production ownership', () => {
    const requiredLessons = [
      '## Who this course is for',
      '## Mental model',
      '## Start with signals',
      '## Derive state with computed',
      '## Bind state to views',
      '## Run side effects',
      '## Coordinate updates',
      '## Control dependencies',
      '## Own and clean up reactive work',
      '## Render conditional and keyed structures',
      '## Composition and integration',
      '## Common failure modes',
      '## Best practices',
      '## Practice',
      '## API reference',
    ];

    for (const lesson of requiredLessons) expect(GUIDE).toContain(lesson);
    expect(GUIDE).toMatch(/^description:\s*.+signals.+computed.+effects.+(?:ownership|cleanup)/imu);
    expect(GUIDE).toMatch(/\b(?:build|model)\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
    expect(GUIDE).toContain(`<PlayExample id="${GRAPH_ID}"`);
    expect(GUIDE).toContain(`<PlayExample id="${LIFETIME_ID}"`);
    expect(GUIDE).toMatch(/```ts[\s\S]*\bsignal\s*\([\s\S]*\bcomputed\s*\([\s\S]*\beffect\s*\(/u);
    expect(GUIDE).toMatch(/\bbatch\s*\([\s\S]*\buntrack\s*\(/u);
    expect(GUIDE).toMatch(/\bcreateRoot\s*\([\s\S]*\bonCleanup\s*\(/u);
    expect(GUIDE).toMatch(/\bShow\s*\([\s\S]*\bFor\s*\(/u);
    expect(GUIDE).toMatch(/symptom[\s\S]*cause[\s\S]*(?:correction|fix)[\s\S]*(?:evidence|verify)/iu);
    expect(GUIDE).toMatch(/## Practice[\s\S]*\bbatch\b[\s\S]*dynamic dependenc[\s\S]*\bdispose/iu);
  });

  test('should keep every teaching snippet concise, public, and separate from laboratory plumbing', () => {
    const snippets = typescriptSnippets();

    expect(snippets.length).toBeGreaterThanOrEqual(10);
    for (const snippet of snippets) {
      const nonEmptyLines = snippet.split('\n').filter((line) => line.trim() !== '');
      expect(nonEmptyLines.length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/@jsvision\/(?:ui\/|[^'"]+\/src\/)/u);
      expect(snippet).not.toMatch(/\b(?:demoApp|Template1Dialog|defineExample)\b/u);
      for (const specifier of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(specifier[1]).toBe('@jsvision/ui');
      }
    }
    expect(GUIDE).toContain("import { computed, signal } from '@jsvision/ui';");
    expect(GUIDE).toContain("import { batch, signal } from '@jsvision/ui';");
    expect(GUIDE).toContain("import { createRoot, effect, onCleanup, signal } from '@jsvision/ui';");
  });

  test('should describe semantics that agree with the public reactive runtime', () => {
    const state = createRoot((dispose) => {
      const price = signal(10);
      const quantity = signal(2);
      const note = signal('alpha');
      let evaluations = 0;
      let runs = 0;
      let cleanups = 0;
      const snapshots: string[] = [];
      const total = computed(() => {
        evaluations += 1;
        return price() * quantity();
      });

      expect(evaluations).toBe(0);
      expect(total()).toBe(20);
      expect(total()).toBe(20);
      expect(evaluations).toBe(1);

      effect(() => {
        snapshots.push(`${total()}:${untrack(() => note())}`);
        runs += 1;
        onCleanup(() => {
          cleanups += 1;
        });
      });

      return {
        price,
        quantity,
        note,
        total,
        dispose,
        evaluations: () => evaluations,
        runs: () => runs,
        cleanups: () => cleanups,
        snapshots,
      };
    });

    expect(state.runs()).toBe(1);
    state.note.set('beta');
    state.price.set(10);
    expect(state.runs()).toBe(1);

    batch(() => {
      state.price.set(9);
      state.quantity.set(3);
    });
    expect(state.total()).toBe(27);
    expect(state.evaluations()).toBe(2);
    expect(state.runs()).toBe(2);
    expect(state.cleanups()).toBe(1);
    expect(state.snapshots).toEqual(['20:alpha', '27:beta']);

    state.dispose();
    expect(state.cleanups()).toBe(2);
    state.price.set(12);
    expect(state.runs()).toBe(2);
  });

  test('should preserve Guide, component, specialist, and API ownership boundaries', () => {
    expect(GUIDE).not.toMatch(/^## .*(?:Data Grid|Code Editor)/gimu);
    expect(GUIDE).not.toMatch(/\/guide\/(?:data-grid|code-editor)/u);
    expect(GUIDE).toContain('](/guide/views-and-focus)');
    expect(GUIDE).toContain('](/guide/forms)');
    expect(GUIDE).toMatch(/\]\(\/api\/ui\//u);
  });

  test('should register two distinct complete applications with objective-specific framing', () => {
    expect(
      EXAMPLES.filter((entry) => entry.id.startsWith('guides/reactive')).map(({ id, kind, sourcePath }) => ({
        id,
        kind,
        sourcePath,
      })),
    ).toEqual([
      { id: GRAPH_ID, kind: 'app', sourcePath: 'examples/guides/reactive-graph.ts' },
      { id: LIFETIME_ID, kind: 'app', sourcePath: 'examples/guides/reactive-lifetimes.ts' },
    ]);
    expect(graphExample.title).toBe('Reactive Signal Graph Lab');
    expect(graphExample.blurb).toMatch(/source signals[\s\S]*batch[\s\S]*computed total[\s\S]*effect/iu);
    expect(lifetimeExample.title).toBe('Reactive Lifetime Lab');
    expect(lifetimeExample.blurb).toMatch(/dynamic dependencies[\s\S]*untracked[\s\S]*cleanup[\s\S]*dispose/iu);
  });
});

describe('Reactive Signal Graph Lab', () => {
  test('should open as a compact centered Classic lesson with live source and derived values unclipped', () => {
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

  test('should update one dependency at a time and coalesce the paired sale update by keyboard', () => {
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

  test('should expose every mutation as a visible button and activate it by mouse', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildGraph();
      const labels = viewsIn(dialog)
        .filter((view): view is Button => view instanceof Button)
        .map((button) => button.activation.label);

      expect(labels).toEqual(['Raise price', 'Add quantity', 'Batch sale', 'Reset']);
      clickButton(app, dialog, 'Add quantity');
      expect(frameText(app)).toContain('Qty 3');
      expect(frameText(app)).toContain('single write: quantity notified its dependents');
      dispose();
    });
  });

  test('should remain live and unclipped through reader resize, maximize, and restore', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildGraph({ width: 120, height: 40 });
      const authored = { ...dialog.bounds };

      resizeDialog(app, dialog);
      const resized = { ...dialog.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(resized.width).toBeGreaterThan(authored.width);
      expect(resized.height).toBeGreaterThan(authored.height);
      expect(frameText(app)).toContain('Alt+P/Q changes one source');

      app.loop.dispatch(key('p', { alt: true }));
      expect(frameText(app)).toContain('$12');

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(frameText(app)).toContain('$12');
      expect(frameText(app)).toContain('Effect runs: 2');

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(frameText(app)).toContain('$12');
      dispose();
    });
  });
});

describe('Reactive Lifetime Lab', () => {
  test('should show tracked, untracked, cleanup, and ownership state in a compact Classic lesson', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLifetimes();
      collectTemplate1Evidence(app, dialog);

      expect(frameText(app)).toContain('Watching primary = 10');
      expect(frameText(app)).toContain('Runs 1 · cleanups 0 · scope active');
      expect(frameText(app)).toContain('note read with untrack');
      dispose();
    });
  });

  test('should recollect conditional dependencies while ignoring inactive and untracked writes', () => {
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

  test('should dispose the nested watcher and prevent later writes from rerunning it', () => {
    createRoot((dispose) => {
      const { app } = buildLifetimes();

      app.loop.dispatch(key('d', { alt: true }));
      expect(frameText(app)).toContain('Runs 1 · cleanups 1 · scope disposed');

      app.loop.dispatch(key('a', { alt: true }));
      expect(frameText(app)).toContain('Runs 1 · cleanups 1 · scope disposed');
      dispose();
    });
  });

  test('should expose every lifetime action as a visible button and activate it by mouse', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLifetimes();
      const labels = viewsIn(dialog)
        .filter((view): view is Button => view instanceof Button)
        .map((button) => button.activation.label);

      expect(labels).toEqual(['Switch source', 'Update active', 'Update inactive', 'Change note', 'Dispose watcher']);
      clickButton(app, dialog, 'Change note');
      expect(frameText(app)).toContain('Runs 1 · cleanups 0 · scope active · note beta');
      expect(frameText(app)).toContain('untracked note changed: watcher kept its snapshot');
      dispose();
    });
  });

  test('should preserve dynamic dependencies and cleanup evidence through resize, maximize, and restore', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLifetimes({ width: 120, height: 40 });
      const authored = { ...dialog.bounds };

      resizeDialog(app, dialog);
      const resized = { ...dialog.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(resized.width).toBeGreaterThan(authored.width);
      expect(resized.height).toBeGreaterThan(authored.height);
      expect(frameText(app)).toContain('Alt+S/A/I/N/D');

      app.loop.dispatch(key('s', { alt: true }));
      expect(frameText(app)).toContain('Watching backup = 100');
      expect(frameText(app)).toContain('Runs 2 · cleanups 1');

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(frameText(app)).toContain('Watching backup = 100');

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(frameText(app)).toContain('Runs 2 · cleanups 1');
      dispose();
    });
  });
});
