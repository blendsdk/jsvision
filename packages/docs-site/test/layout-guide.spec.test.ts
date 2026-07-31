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
import { Button, createRoot, layout, type LayoutBox } from '@jsvision/ui';
import flowExample from '../examples/guides/layout-flow.js';
import overlayExample from '../examples/guides/layout-overlays.js';
import { EXAMPLES } from '../examples/index.js';
import { LayoutLessonPanel } from '../src/example-fixtures/layout/lesson-panel.js';
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
const GUIDE = readFileSync(join(PACKAGE_ROOT, 'guide', 'layout.md'), 'utf8');
const CATALOG = parseGuideCatalog(readFileSync(join(PACKAGE_ROOT, 'guides.json'), 'utf8'));
const FLOW_ID = 'guides/layout-flow';
const OVERLAY_ID = 'guides/layout-overlays';

/** Return the TypeScript teaching snippets without treating live-example modules as page snippets. */
function typescriptSnippets(): readonly string[] {
  return [...GUIDE.matchAll(/```ts\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

/** Resize a compact template dialog through the same south-east grip used by a reader. */
function resizeDialog(app: ReturnType<typeof buildFlow>['app'], dialog: ReturnType<typeof buildFlow>['dialog']): void {
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

/** Build the flow laboratory through the same registered application shell used by the browser. */
function buildFlow(viewport = { width: 80, height: 24 }) {
  const { app, dialog } = buildLabExample(FLOW_ID, flowExample, { viewport });
  const panels = viewsIn(dialog).filter((view): view is LayoutLessonPanel => view instanceof LayoutLessonPanel);
  return { app, dialog, panels };
}

/** Build the overlay laboratory through the same registered application shell used by the browser. */
function buildOverlays(viewport = { width: 80, height: 24 }) {
  const { app, dialog } = buildLabExample(OVERLAY_ID, overlayExample, { viewport });
  const panels = viewsIn(dialog).filter((view): view is LayoutLessonPanel => view instanceof LayoutLessonPanel);
  return { app, dialog, panels };
}

describe('Layout course content', () => {
  test('should preserve the catalog-owned prerequisites, outcomes, and two-laboratory contract', () => {
    const entry = CATALOG.entries.find((candidate) => candidate.id === 'layout');

    expect(entry).toMatchObject({
      title: 'Layout',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['install-and-packages'],
      requiredLiveExamples: 2,
      examples: [FLOW_ID, OVERLAY_ID],
    });
    expect(entry?.learningOutcomes).toEqual([
      'Compose responsive terminal-cell interfaces with rows, columns, sizing, spacing, and alignment.',
      'Choose deliberately between flow layout, overlays, and exact placement.',
      'Diagnose collapsed, clipped, and translation-sensitive layouts.',
    ]);
    expect(GUIDE).toContain('](/guide/install-and-packages)');
  });

  test('should progress from an explicit learner contract through advanced layout judgment', () => {
    const requiredLessons = [
      '## Who this course is for',
      '## Mental model',
      '## Your first layout',
      '## How size negotiation works',
      '## Spacing and alignment',
      '## Build responsive layouts',
      '## Overlays and exact placement',
      '## Use the pure layout engine',
      '## Composition and integration',
      '## Common failure modes',
      '## Best practices',
      '## Practice',
      '## API reference',
    ];

    for (const lesson of requiredLessons) expect(GUIDE).toContain(lesson);
    expect(GUIDE).toMatch(/^description:\s*.+responsive.+terminal-cell.+(?:overlay|placement)/imu);
    expect(GUIDE).toMatch(/\b(?:build|compose)\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
    expect(GUIDE).toContain(`<PlayExample id="${FLOW_ID}"`);
    expect(GUIDE).toContain(`<PlayExample id="${OVERLAY_ID}"`);
    expect(GUIDE).toMatch(/```ts[\s\S]*\brow\s*\([\s\S]*\bcol\s*\(/u);
    expect(GUIDE).toMatch(/\bauto\b[\s\S]*\bfixed\b[\s\S]*\b(?:grow|fr)\b/iu);
    expect(GUIDE).toMatch(/\bat\(\)[\s\S]*out of flow/iu);
    expect(GUIDE).toMatch(/symptom[\s\S]*cause[\s\S]*(?:correction|fix)[\s\S]*(?:evidence|verify)/iu);
    expect(GUIDE).toMatch(
      /## Practice[\s\S]*(?:resize|maximize)[\s\S]*(?:translation|translated)[\s\S]*(?:overlay|placement)/iu,
    );
  });

  test('should keep snippets concise, public, and separate from laboratory infrastructure', () => {
    const snippets = typescriptSnippets();

    expect(snippets.length).toBeGreaterThanOrEqual(8);
    for (const snippet of snippets) {
      const nonEmptyLines = snippet.split('\n').filter((line) => line.trim() !== '');
      expect(nonEmptyLines.length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/@jsvision\/(?:ui\/|[^'"]+\/src\/)/u);
      expect(snippet).not.toMatch(/\b(?:demoApp|Template1Dialog|defineExample)\b/u);
      for (const specifier of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(specifier[1]).toBe('@jsvision/ui');
      }
    }
    expect(GUIDE).toContain("import { Text, col, fixed, grow, row } from '@jsvision/ui';");
    expect(GUIDE).toContain("import { centered, stack, topRight } from '@jsvision/ui';");
    expect(GUIDE).toContain("import { layout, type LayoutBox } from '@jsvision/ui';");
  });

  test('should teach the exact proportional fallback when fractional minimums cannot all fit', () => {
    const navigation: LayoutBox = {
      props: { size: { kind: 'fr', weight: 1, min: 16 } },
      children: [],
    };
    const editor: LayoutBox = {
      props: { size: { kind: 'fr', weight: 3, min: 30 } },
      children: [],
    };
    const root: LayoutBox = {
      props: { direction: 'row' },
      children: [navigation, editor],
    };

    const rects = layout(root, { width: 20, height: 1 });
    const widths = [rects.get(navigation)?.width, rects.get(editor)?.width];

    expect(widths).toEqual([7, 13]);
    expect((widths[0] ?? 0) + (widths[1] ?? 0)).toBe(20);
    expect(GUIDE).toMatch(/combined minimums[\s\S]*proportionally compresses[\s\S]*7 and 13 cells/iu);
    expect(GUIDE).toMatch(/fixed and measured auto tracks[\s\S]*absolute rectangle[\s\S]*past its parent/iu);
  });

  test('should respect Guide, component, specialist, and API ownership boundaries', () => {
    expect(GUIDE).not.toMatch(/^## .*(?:Data Grid|Code Editor)/gimu);
    expect(GUIDE).not.toMatch(/\/guide\/(?:data-grid|code-editor)/u);
    expect(GUIDE).toContain('](/guide/reactive-state)');
    expect(GUIDE).toContain('](/guide/views-and-focus)');
    expect(GUIDE).toMatch(/\]\(\/api\/ui\//u);
  });

  test('should register two distinct complete applications with objective-specific framing', () => {
    expect(
      EXAMPLES.filter((entry) => entry.id.startsWith('guides/layout')).map(({ id, kind, sourcePath }) => ({
        id,
        kind,
        sourcePath,
      })),
    ).toEqual([
      { id: FLOW_ID, kind: 'app', sourcePath: 'examples/guides/layout-flow.ts' },
      { id: OVERLAY_ID, kind: 'app', sourcePath: 'examples/guides/layout-overlays.ts' },
    ]);
    expect(flowExample.title).toBe('Layout Flow Workshop');
    expect(flowExample.blurb).toMatch(/fixed cells[\s\S]*flex weights[\s\S]*reflows/iu);
    expect(overlayExample.title).toBe('Layout Overlay Workshop');
    expect(overlayExample.blurb).toMatch(/z-order[\s\S]*out-of-flow/iu);
  });
});

describe('Layout Flow Workshop', () => {
  test('should open as a compact centered Classic lesson with all authored panes unclipped', () => {
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

  test('should change flex weights, fixed width, and parent padding through usable hotkeys and buttons', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildFlow();
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

      app.loop.dispatch(key('p', { alt: true }));
      expect(frameText(app)).toContain('Padding: 2');

      const labels = viewsIn(dialog)
        .filter((view): view is Button => view instanceof Button)
        .map((button) => button.activation.label);
      expect(labels).toEqual(['Balance', 'Widen sidebar', 'Cycle padding']);
      dispose();
    });
  });

  test('should preserve responsive content through reader resize, maximize, and restore', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildFlow({ width: 120, height: 40 });
      const workspace = panels.find((panel) => panel.lessonName === 'Workspace');
      if (workspace === undefined) throw new Error('the flow lesson has no workspace');
      const authoredDialog = { ...dialog.bounds };

      resizeDialog(app, dialog);
      const resizedDialog = { ...dialog.bounds };
      const resizedWorkspace = { ...workspace.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(resizedDialog.width).toBeGreaterThan(authoredDialog.width);
      expect(resizedDialog.height).toBeGreaterThan(authoredDialog.height);
      expect(frameText(app)).toContain('Alt+B/S/P changes layout');

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(workspace.bounds.width).toBeGreaterThan(resizedWorkspace.width);
      expect(workspace.bounds.height).toBeGreaterThan(resizedWorkspace.height);
      expect(frameText(app)).toContain('Alt+B/S/P changes layout');

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resizedDialog);
      expect(workspace.bounds).toEqual(resizedWorkspace);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dispose();
    });
  });
});

describe('Layout Overlay Workshop', () => {
  test('should present fill, centered, and corner layers in a compact centered Classic lesson', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildOverlays();
      collectTemplate1Evidence(app, dialog);

      expect(panels.map((panel) => panel.lessonName)).toEqual(['Base layer', 'Centered card', 'NEW']);
      expect(frameText(app)).toContain('later layers paint in front');
      dispose();
    });
  });

  test('should toggle independent overlay layers by keyboard without collapsing the base flow', () => {
    createRoot((dispose) => {
      const { app, panels } = buildOverlays();
      const base = panels.find((panel) => panel.lessonName === 'Base layer');
      const card = panels.find((panel) => panel.lessonName === 'Centered card');
      const badge = panels.find((panel) => panel.lessonName === 'NEW');
      if (base === undefined || card === undefined || badge === undefined) {
        throw new Error('the overlay lesson is missing a layer');
      }
      const baseBounds = { ...base.bounds };
      const badgeOrigin = absoluteOrigin(badge);

      app.loop.dispatch(key('c', { alt: true }));
      expect(card.state.visible).toBe(false);
      expect(base.bounds).toEqual(baseBounds);
      expect(frameText(app)).toContain('Card hidden');
      expect(frameText(app)).not.toContain('Centered card');

      app.loop.dispatch(key('n', { alt: true }));
      expect(badge.state.visible).toBe(false);
      expect(base.bounds).toEqual(baseBounds);
      expect(app.loop.renderRoot.buffer().get(badgeOrigin.x + 1, badgeOrigin.y)?.char).not.toBe('N');
      dispose();
    });
  });

  test('should make every documented overlay action immediately usable through visible buttons', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildOverlays();
      const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
      const card = panels.find((panel) => panel.lessonName === 'Centered card');
      const badge = panels.find((panel) => panel.lessonName === 'NEW');
      if (card === undefined || badge === undefined) {
        throw new Error('the overlay lesson is missing a toggleable layer');
      }
      const badgeOrigin = absoluteOrigin(badge);

      expect(buttons.map((button) => button.activation.label)).toEqual(['Toggle card', 'Toggle NEW']);

      for (const button of buttons) {
        const origin = absoluteOrigin(button);
        dispatchExampleAction(app, {
          kind: 'mouse',
          gesture: 'click',
          at: { x: origin.x + 1, y: origin.y },
        });
      }

      expect(card.state.visible).toBe(false);
      expect(badge.state.visible).toBe(false);
      expect(frameText(app)).not.toContain('Centered card');
      expect(app.loop.renderRoot.buffer().get(badgeOrigin.x + 1, badgeOrigin.y)?.char).not.toBe('N');
      dispose();
    });
  });

  test('should preserve layer sizing and anchors through reader resize, maximize, and restore', () => {
    createRoot((dispose) => {
      const { app, dialog, panels } = buildOverlays({ width: 120, height: 40 });
      const base = panels.find((panel) => panel.lessonName === 'Base layer');
      const card = panels.find((panel) => panel.lessonName === 'Centered card');
      const badge = panels.find((panel) => panel.lessonName === 'NEW');
      if (base === undefined || card === undefined || badge === undefined) {
        throw new Error('the overlay lesson is missing a layer');
      }

      resizeDialog(app, dialog);
      const resizedDialog = { ...dialog.bounds };
      const resizedBase = { ...base.bounds };
      const resizedCard = { ...card.bounds };
      const resizedBadge = { ...badge.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(frameText(app)).toContain('Alt+C/N toggles layers');

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(base.bounds.width).toBeGreaterThan(resizedBase.width);
      expect(base.bounds.height).toBeGreaterThan(resizedBase.height);
      expect(card.bounds.width).toBe(resizedCard.width);
      expect(card.bounds.height).toBe(resizedCard.height);
      expect(card.bounds.x).toBeGreaterThan(resizedCard.x);
      expect(card.bounds.y).toBeGreaterThan(resizedCard.y);
      expect(badge.bounds.x).toBeGreaterThan(resizedBadge.x);
      expect(badge.bounds.y).toBe(resizedBadge.y);

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resizedDialog);
      expect(base.bounds).toEqual(resizedBase);
      expect(card.bounds).toEqual(resizedCard);
      expect(badge.bounds).toEqual(resizedBadge);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dispose();
    });
  });
});
