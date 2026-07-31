/**
 * Implementation hardening for the Scrolling, lists & large content laboratories.
 *
 * The immutable course oracle owns learner-visible outcomes. These checks stress offset limits,
 * large resident fixtures, empty and shrinking collections, focus versus selection, responsive
 * geometry, pointer feedback, and teardown.
 */
import { existsSync, readFileSync } from 'node:fs';
import { degradeCapsFully } from '@jsvision/core';
import {
  Button,
  Group,
  Scroller,
  SurfaceView,
  Tree,
  View,
  at,
  createEventLoop,
  createRoot,
  signal,
  stringWidth,
} from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import viewportExample from '../examples/guides/viewport-strategies.js';
import collectionsExample from '../examples/guides/virtual-collections.js';
import { ViewportStrategyPanel } from '../src/example-fixtures/scrolling-lists-and-large-content/viewport-strategy-panel.js';
import { VirtualCollectionsPanel } from '../src/example-fixtures/scrolling-lists-and-large-content/virtual-collections-panel.js';
import {
  EXAMPLE_CAPS,
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const COURSE_SOURCE = readFileSync(new URL('../guide/scrolling-lists-and-large-content.md', import.meta.url), 'utf8');

/**
 * Deliberately multiplies formatter work so the laboratory counter must expose an over-budget paint.
 *
 * A capacity-triggered reset would hide this regression and make the bounded-work assertion pass.
 */
class UnboundedWorkProbePanel extends VirtualCollectionsPanel {
  /** Simulate one formatter accidentally doing resident-scale work for every visible row. */
  protected override recordListWork(): void {
    for (let call = 0; call < 50; call += 1) super.recordListWork();
  }
}

/** Return the one fixture panel of the requested class from a mounted laboratory. */
function panelIn<T extends View>(dialog: View, type: abstract new (...args: never[]) => T): T {
  const panel = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (panel === undefined) throw new Error(`laboratory is missing ${type.name}`);
  return panel;
}

/** Resize through the real south-east grip instead of assigning dialog geometry. */
function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
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
    to: { x: from.x + 12, y: from.y + 5 },
  });
}

/** Activate a named laboratory button through the real pointer route. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`laboratory is missing the ${label} button`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

/** Assert that one view remains fully contained by its immediate parent. */
function expectContained(view: View): void {
  const parent = view.parent;
  if (parent === null) return;
  expect(view.bounds.x).toBeGreaterThanOrEqual(0);
  expect(view.bounds.y).toBeGreaterThanOrEqual(0);
  expect(view.bounds.x + view.bounds.width).toBeLessThanOrEqual(parent.bounds.width);
  expect(view.bounds.y + view.bounds.height).toBeLessThanOrEqual(parent.bounds.height);
}

/** Serialize a headless event-loop frame as plain rows for marker assertions. */
function loopFrame(loop: ReturnType<typeof createEventLoop>): string {
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Assert the laboratory's uncapped per-frame counters fit their real row capacities. */
function expectBoundedWork(panel: VirtualCollectionsPanel, app: ReturnType<typeof buildLabExample>['app']): void {
  app.loop.renderRoot.flush();
  app.loop.renderRoot.flush();
  expect(panel.listFrameWork).toBeLessThanOrEqual(panel.listView.rows.bounds.height);
  expect(panel.treeFrameWork).toBeLessThanOrEqual(panel.tree.rows.bounds.height);
  expect(panel.visibleRowWork).toBe(panel.listFrameWork + panel.treeFrameWork);
  expect(panel.visibleRowWork).toBeLessThanOrEqual(panel.visibleRowCapacity);
  expect(frameText(app)).toContain(`Rendered rows: ${panel.visibleRowWork} <= viewport ${panel.visibleRowCapacity}`);
}

describe('viewport strategy fixture edges', () => {
  test('should clamp owned and passive offsets after repeated boundary navigation', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/viewport-strategies', viewportExample);
      const panel = panelIn(dialog, ViewportStrategyPanel);

      app.loop.focusView(panel.scroller);
      app.loop.dispatch(key('end'));
      expect(panel.scroller.delta).toEqual({ x: 0, y: 12 });
      for (let step = 0; step < 20; step += 1) panel.panSurface('keyboard');
      app.loop.renderRoot.flush();
      expect(frameText(app)).toContain('Surface offset: 16,12 · clamped');

      panel.resetSurface('keyboard');
      app.loop.dispatch(key('home'));
      expect(panel.scroller.delta).toEqual({ x: 0, y: 0 });
      expect(frameText(app)).toContain('Surface offset: 0,0 · clamped');

      app.loop.dispose();
      dispose();
    });
  });

  test('should retain the distinct focus contracts after resize and maximize restore', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/viewport-strategies', viewportExample, {
        viewport: { width: 120, height: 40 },
      });
      const panel = panelIn(dialog, ViewportStrategyPanel);
      const authored = { ...dialog.bounds };

      resizeDialog(app, dialog);
      const resized = { ...dialog.bounds };
      expect(resized.width).toBeGreaterThan(authored.width);
      expect(resized.height).toBeGreaterThan(authored.height);
      expect(panel.scroller).toBeInstanceOf(Scroller);
      expect(panel.scroller.focusable).toBe(true);
      expect(panel.surfaceView).toBeInstanceOf(SurfaceView);
      expect(panel.surfaceView.focusable).toBe(false);
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      expectContained(panel);

      app.loop.dispose();
      dispose();
    });
  });

  test('should distinguish keyboard and pointer sources on the passive viewport actions', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/viewport-strategies', viewportExample);

      app.loop.dispatch(key('p', { alt: true }));
      expect(frameText(app)).toMatch(/Action source:\s*keyboard/iu);
      clickButton(app, dialog, 'Pan surface');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      clickButton(app, dialog, 'Reset surface');
      expect(frameText(app)).toMatch(/Surface offset:\s*0,0[\s\S]*Action source:\s*mouse/iu);

      app.loop.dispose();
      dispose();
    });
  });
});

describe('virtual collection fixture edges', () => {
  test('should expose rather than cap formatter work that exceeds the viewport budget', () => {
    const panel = new UnboundedWorkProbePanel();
    const loop = createEventLoop({ width: 66, height: 9 }, { caps: EXAMPLE_CAPS });
    loop.mount(panel);
    loop.renderRoot.flush();

    expect(panel.listFrameWork).toBeGreaterThan(panel.listView.rows.bounds.height);
    expect(panel.visibleRowWork).toBeGreaterThan(panel.visibleRowCapacity);
    expect(loopFrame(loop)).toContain(`Rendered rows: ${panel.visibleRowWork} <= viewport ${panel.visibleRowCapacity}`);

    loop.dispose();
  });

  test('should keep formatter work bounded for the authored large resident fixtures', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/virtual-collections', collectionsExample);
      const panel = panelIn(dialog, VirtualCollectionsPanel);
      const headline = 'Virtual rows bound paint work; source arrays remain resident.';

      expectBoundedWork(panel, app);
      expect(stringWidth(headline)).toBeLessThanOrEqual(66);
      expect(frameText(app)).toContain(headline);
      expect(frameText(app)).toMatch(/Remote\/unbounded:[\s\S]*Data Grid or Code Editor/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should clamp focus while preserving explicit selection across shrink and empty data', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/virtual-collections', collectionsExample);
      const panel = panelIn(dialog, VirtualCollectionsPanel);

      app.loop.focusView(panel.listView.rows);
      for (let page = 0; page < 60; page += 1) app.loop.dispatch(key('pagedown'));
      expect(panel.listView.focused()).toBe(199);
      expectBoundedWork(panel, app);
      app.loop.dispatch(key('enter'));
      expect(panel.listView.selected()).toBe(199);
      panel.shrinkData('keyboard');
      app.loop.renderRoot.flush();
      expect(panel.listView.focused()).toBe(0);
      expect(panel.listView.selected()).toBe(199);
      expect(frameText(app)).toContain('Data: shrunk');
      expectBoundedWork(panel, app);

      panel.emptyData('keyboard');
      app.loop.renderRoot.flush();
      expect(panel.listView.focused()).toBe(0);
      expect(panel.listView.selected()).toBe(199);
      expect(frameText(app)).toMatch(/<empty>|Data:\s*empty/iu);
      expectBoundedWork(panel, app);

      app.loop.dispose();
      dispose();
    });
  });

  test('should preserve tree identity state while resident roots disappear and return', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/virtual-collections', collectionsExample);
      const panel = panelIn(dialog, VirtualCollectionsPanel);

      panel.toggleTree('keyboard');
      app.loop.renderRoot.flush();
      expect(frameText(app)).toContain('Tree expanded: yes');
      expectBoundedWork(panel, app);
      panel.emptyData('keyboard');
      app.loop.renderRoot.flush();
      expectBoundedWork(panel, app);
      panel.resetData('keyboard');
      app.loop.renderRoot.flush();
      expect(frameText(app)).toContain('Tree expanded: yes');
      expectBoundedWork(panel, app);
      panel.toggleTree('mouse');
      app.loop.renderRoot.flush();
      expect(frameText(app)).toMatch(/Tree expanded:\s*no[\s\S]*Action source:\s*mouse/iu);
      expectBoundedWork(panel, app);

      app.loop.dispose();
      dispose();
    });
  });

  test('should retain focus targets, complete status, and containment after responsive growth', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/virtual-collections', collectionsExample, {
        viewport: { width: 120, height: 40 },
      });
      const panel = panelIn(dialog, VirtualCollectionsPanel);

      resizeDialog(app, dialog);
      expect(panel.listView.rows.mounted).toBe(true);
      expect(panel.listBox.rows.mounted).toBe(true);
      expect(panel.tree.rows.mounted).toBe(true);
      expect(frameText(app)).toContain('Virtual rows bound paint work; source arrays remain resident.');
      expect(frameText(app)).toContain('Arrows move focus · Enter selects · Alt+T/S/E/R · click · resize');
      expectBoundedWork(panel, app);
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expectBoundedWork(panel, app);
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expectBoundedWork(panel, app);
      for (const view of viewsIn(panel)) expectContained(view);

      app.loop.dispose();
      dispose();
    });
  });

  test('should render the default tv marker and degrade an explicit triangle to brackets', () => {
    const branch: TreeNode<string> = {
      value: 'root',
      children: [{ value: 'child', children: [] }],
    };
    const defaultTree = new Tree<string>({ roots: signal([branch]), getText: (value) => value });
    defaultTree.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 3 } });
    const defaultRoot = new Group();
    defaultRoot.add(defaultTree);
    const defaultLoop = createEventLoop({ width: 20, height: 3 }, { caps: EXAMPLE_CAPS });
    defaultLoop.mount(defaultRoot);
    expect(loopFrame(defaultLoop)).toContain('+root');
    defaultLoop.dispose();

    const triangle = new Tree<string>({
      roots: signal([branch]),
      getText: (value) => value,
      markerStyle: 'triangle',
    });
    const degradedRoot = new Group();
    degradedRoot.add(at(triangle, 0, 0, 20, 3));
    const degradedLoop = createEventLoop({ width: 20, height: 3 }, { caps: degradeCapsFully(EXAMPLE_CAPS) });
    degradedLoop.mount(degradedRoot);
    const degradedFrame = loopFrame(degradedLoop);
    expect(degradedFrame).toContain('[+] root');
    expect(degradedFrame).not.toContain('▸');
    degradedLoop.dispose();
  });
});

describe('course integration and lifecycle edges', () => {
  test('should resolve every component, specialist, prerequisite, and API link', () => {
    const links = [...COURSE_SOURCE.matchAll(/\]\((\/[^)#]+)(?:#[^)]+)?\)/gu)].map((match) => match[1]);
    const knownSpecialists = new Set(['/components/data-grid/', '/components/code-editor/']);

    for (const link of links) {
      if (knownSpecialists.has(link)) continue;
      const relative = link?.startsWith('/guide/')
        ? `../guide/${link.slice('/guide/'.length)}.md`
        : link?.startsWith('/components/')
          ? `../components/${link.slice('/components/'.length)}.md`
          : null;
      if (relative !== null && !relative.includes('/api/')) {
        expect(existsSync(new URL(relative, import.meta.url)), `${link} must resolve`).toBe(true);
      }
    }
  });

  test.each([
    ['guides/viewport-strategies', viewportExample],
    ['guides/virtual-collections', collectionsExample],
  ] as const)('should release every mounted view scope when %s closes', (id, definition) => {
    let mounted: View[] = [];
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      mounted = viewsIn(dialog);
      app.loop.dispose();
      dispose();
    });

    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
  });
});
