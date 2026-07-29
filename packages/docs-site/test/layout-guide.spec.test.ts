/**
 * Specification coverage for the Layout guide and its two teaching laboratories.
 *
 * The guide must take a beginner from the row/column mental model through responsive sizing and
 * deliberate overlays. Both live examples use the shared centered application shell, remain
 * usable through resize/maximize/restore, and expose visible keyboard-driven state changes.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Button, createRoot } from '@jsvision/ui';
import flowExample from '../examples/guides/layout-flow.js';
import overlayExample from '../examples/guides/layout-overlays.js';
import { EXAMPLES } from '../examples/index.js';
import { LayoutLessonPanel } from '../src/example-fixtures/layout/lesson-panel.js';
import { buildLabExample, collectTemplate1Evidence, frameText, key, viewsIn } from './example-lab-harness.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDE = readFileSync(join(PACKAGE_ROOT, 'guide', 'layout.md'), 'utf8');

/** Build the flow laboratory through the same registered application shell used by the browser. */
function buildFlow(viewport = { width: 80, height: 24 }) {
  const { app, dialog } = buildLabExample('guides/layout-flow', flowExample, { viewport });
  const panels = viewsIn(dialog).filter((view): view is LayoutLessonPanel => view instanceof LayoutLessonPanel);
  return { app, dialog, panels };
}

/** Build the overlay laboratory through the same registered application shell used by the browser. */
function buildOverlays(viewport = { width: 80, height: 24 }) {
  const { app, dialog } = buildLabExample('guides/layout-overlays', overlayExample, { viewport });
  const panels = viewsIn(dialog).filter((view): view is LayoutLessonPanel => view instanceof LayoutLessonPanel);
  return { app, dialog, panels };
}

describe('Layout course content', () => {
  test('progresses from the cell layout mental model to responsive flow, overlays, and failure modes', () => {
    const requiredLessons = [
      '## Mental model',
      '## Your first layout',
      '## How size negotiation works',
      '## Spacing and alignment',
      '## Build responsive layouts',
      '## Overlays and exact placement',
      '## Common failure modes',
      '## Best practices',
      '## API reference',
    ];

    for (const lesson of requiredLessons) expect(GUIDE).toContain(lesson);
    expect(GUIDE).toContain('<PlayExample id="guides/layout-flow"');
    expect(GUIDE).toContain('<PlayExample id="guides/layout-overlays"');
    expect(GUIDE).toMatch(/```ts[\s\S]*\brow\s*\([\s\S]*\bcol\s*\(/u);
    expect(GUIDE).toMatch(/\bauto\b[\s\S]*\bfixed\b[\s\S]*\b(?:grow|fr)\b/iu);
    expect(GUIDE).toMatch(/\bat\(\)[\s\S]*out of flow/iu);
  });

  test('registers both lessons as complete applications', () => {
    expect(
      EXAMPLES.filter((entry) => entry.id.startsWith('guides/layout')).map(({ id, kind }) => ({ id, kind })),
    ).toEqual([
      { id: 'guides/layout-flow', kind: 'app' },
      { id: 'guides/layout-overlays', kind: 'app' },
    ]);
  });
});

describe('Layout Flow Workshop', () => {
  test('opens as a compact centered Classic-theme lesson with the authored panes', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildFlow();
      const evidence = collectTemplate1Evidence(app, dialog);

      expect(evidence.dialogRect.width).toBeLessThan(evidence.viewport.width);
      expect(evidence.dialogRect.height).toBeLessThan(evidence.viewport.height - 2);
      expect(panels.map((panel) => panel.lessonName)).toEqual([
        'Header',
        'Navigation',
        'Workspace',
        'Inspector',
        'Status',
      ]);
      expect(frameText(app)).toContain('2:1');
      dispose();
    });
  });

  test('changes flex weights and fixed sidebar width through usable hotkeys', () => {
    createRoot((dispose) => {
      const { app, panels } = buildFlow();
      const navigation = panels.find((panel) => panel.lessonName === 'Navigation');
      const workspace = panels.find((panel) => panel.lessonName === 'Workspace');
      const inspector = panels.find((panel) => panel.lessonName === 'Inspector');
      if (navigation === undefined || workspace === undefined || inspector === undefined) {
        throw new Error('the flow lesson is missing a principal pane');
      }

      expect(workspace.bounds.width).toBeGreaterThan(inspector.bounds.width);
      app.loop.dispatch(key('b', { alt: true }));
      expect(Math.abs(workspace.bounds.width - inspector.bounds.width)).toBeLessThanOrEqual(1);

      const initialSidebarWidth = navigation.bounds.width;
      app.loop.dispatch(key('s', { alt: true }));
      expect(navigation.bounds.width).toBeGreaterThan(initialSidebarWidth);
      expect(frameText(app)).toContain('Sidebar: 18 cells');
      dispose();
    });
  });

  test('reflows the principal workspace on maximize and restores its compact geometry', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildFlow({ width: 120, height: 40 });
      const workspace = panels.find((panel) => panel.lessonName === 'Workspace');
      if (workspace === undefined) throw new Error('the flow lesson has no workspace');
      const compact = { ...workspace.bounds };

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(workspace.bounds.width).toBeGreaterThan(compact.width);
      expect(workspace.bounds.height).toBeGreaterThan(compact.height);

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(workspace.bounds).toEqual(compact);
      dispose();
    });
  });
});

describe('Layout Overlay Workshop', () => {
  test('presents fill, centered, and corner layers together in the compact template shell', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildOverlays();
      collectTemplate1Evidence(app, dialog);

      expect(panels.map((panel) => panel.lessonName)).toEqual(['Base layer', 'Centered card', 'NEW']);
      expect(frameText(app)).toContain('later layers paint in front');
      dispose();
    });
  });

  test('toggles independent overlay layers without collapsing the base flow', () => {
    createRoot((dispose) => {
      const { app, panels } = buildOverlays();
      const base = panels.find((panel) => panel.lessonName === 'Base layer');
      const card = panels.find((panel) => panel.lessonName === 'Centered card');
      const badge = panels.find((panel) => panel.lessonName === 'NEW');
      if (base === undefined || card === undefined || badge === undefined) {
        throw new Error('the overlay lesson is missing a layer');
      }
      const baseBounds = { ...base.bounds };

      app.loop.dispatch(key('c', { alt: true }));
      expect(card.state.visible).toBe(false);
      expect(base.bounds).toEqual(baseBounds);
      expect(frameText(app)).toContain('Card hidden');

      app.loop.dispatch(key('n', { alt: true }));
      expect(badge.state.visible).toBe(false);
      expect(base.bounds).toEqual(baseBounds);
      dispose();
    });
  });

  test('offers visible button controls for every documented overlay action', () => {
    createRoot((dispose) => {
      const { dialog } = buildOverlays();
      const labels = viewsIn(dialog)
        .filter((view): view is Button => view instanceof Button)
        .map((button) => button.activation.label);

      expect(labels).toEqual(['Toggle card', 'Toggle NEW']);
      dispose();
    });
  });
});
