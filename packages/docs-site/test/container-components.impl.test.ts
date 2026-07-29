/**
 * Implementation hardening for the container and dropdown laboratories.
 *
 * These checks cover clamping, popup ownership, pane constraints, and fixture isolation beyond the
 * public behavior oracle.
 */
import { ComboBox, createRoot, Dialog, History, ListBox, Scroller, SplitView, TabView } from '@jsvision/ui';
import type { Application, View } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample, dispatchExampleAction, frameText, viewsIn } from './example-lab-harness.js';
import { CONTAINER_EXAMPLE_IDS } from './contracts/containers.js';

/** Load a container/dropdown definition from the public lazy registry. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing container example ${exampleId}`);
  return (await entry.load()).default;
}

/** Return the first descendant matching a public widget class. */
function widgetIn<T extends View>(dialog: Dialog, type: abstract new (...args: never[]) => T): T {
  const widget = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (widget === undefined) throw new Error(`missing ${type.name} in container laboratory`);
  return widget;
}

/**
 * Mount one family laboratory and guarantee loop and reactive-owner disposal.
 *
 * @param exampleId Registry ID to build.
 * @param inspect Assertions to run while mounted.
 */
async function withLab(exampleId: string, inspect: (app: Application, dialog: Dialog) => void): Promise<void> {
  const definition = await loadDefinition(exampleId);
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample(exampleId, definition);
    try {
      inspect(app, dialog);
    } finally {
      try {
        app.loop.dispose();
      } finally {
        dispose();
      }
    }
  });
}

describe('list and scrolling boundaries', () => {
  test('ListBox clamps focus after its reactive source shrinks', async () => {
    await withLab('containers/list-box', (app, dialog) => {
      const list = widgetIn(dialog, ListBox);
      dispatchExampleAction(app, { kind: 'key', key: 'end', modifiers: [] });
      expect(list.focused()).toBe(4);
      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
      expect(list.focused()).toBe(1);
      expect(list.selected()).toBe(-1);
    });
  });

  test('Scroller clamps repeated movement at stable positive extents', async () => {
    await withLab('containers/scroller', (app, dialog) => {
      const scroller = widgetIn(dialog, Scroller);
      dispatchExampleAction(app, { kind: 'key', key: 'end', modifiers: [] });
      dispatchExampleAction(app, { kind: 'key', key: 'x', modifiers: ['Alt'] });
      const atEnd = scroller.delta;
      expect(atEnd.x).toBeGreaterThan(0);
      expect(atEnd.y).toBeGreaterThan(0);
      dispatchExampleAction(app, { kind: 'key', key: 'x', modifiers: ['Alt'] });
      expect(scroller.delta).toEqual(atEnd);
    });
  });

  test('ScrollBar bound-value updates move the real vertical and horizontal thumbs', async () => {
    await withLab('containers/scroll-bar', (app) => {
      const thumbCoordinates = (): string[] =>
        frameText(app)
          .split('\n')
          .flatMap((line, y) => [...line].flatMap((cell, x) => (cell === '█' ? [`${x},${y}`] : [])));
      const before = thumbCoordinates();
      dispatchExampleAction(app, { kind: 'key', key: 'n', modifiers: ['Alt'] });
      expect(thumbCoordinates()).not.toEqual(before);
    });
  });
});

describe('popup and page ownership', () => {
  test('ComboBox popup commits and disposes its transient ListView', async () => {
    await withLab('dropdown/combo-box', (app, dialog) => {
      const combo = widgetIn(dialog, ComboBox);
      const root = app.desktop?.parent ?? app.desktop;
      expect(root).toBeDefined();
      const before = root === undefined ? 0 : viewsIn(root).length;
      dispatchExampleAction(app, { kind: 'key', key: 'g', modifiers: [] });
      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: [] });
      dispatchExampleAction(app, { kind: 'key', key: 'down', modifiers: ['Alt'] });
      const during = root === undefined ? 0 : viewsIn(root).length;
      expect(during).toBeGreaterThan(before);
      dispatchExampleAction(app, { kind: 'key', key: 'enter', modifiers: [] });
      expect(combo.value()).toBe('Green');
      expect(root === undefined ? 0 : viewsIn(root).length).toBe(before);
    });
  });

  test('TabView keeps hidden pages mounted and unmounts a closed page', async () => {
    await withLab('containers/tabs', (app, dialog) => {
      const tabs = widgetIn(dialog, TabView);
      const output = tabs.tabs()[2]?.content;
      expect(output?.mounted).toBe(true);
      dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
      expect(tabs.tabs()).toHaveLength(3);
      dispatchExampleAction(app, { kind: 'key', key: 'pagedown', modifiers: ['Ctrl'] });
      expect(output?.mounted).toBe(true);
      dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
      expect(output?.mounted).toBe(false);
      expect(tabs.tabs()).toHaveLength(2);
      expect(tabs.active()).toBe(0);
    });
  });
});

describe('split constraints and history isolation', () => {
  test('SplitView refuses to resize either pane below its configured minimum', async () => {
    await withLab('containers/split-view', (_app, dialog) => {
      const split = widgetIn(dialog, SplitView);
      split.resizeBy(0, -1000);
      expect(split.splitters[0]?.bounds.x).toBeGreaterThanOrEqual(10);
      split.resizeBy(0, 1000);
      expect(40 - (split.splitters[0]?.bounds.x ?? 40) - 1).toBeGreaterThanOrEqual(14);
    });
  });

  test('app-owned History fixtures rebuild without values from a prior run', async () => {
    await withLab('dropdown/history', (app, dialog) => {
      expect(widgetIn(dialog, History)).toBeDefined();
      dispatchExampleAction(app, { kind: 'key', key: 'down', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      expect(frameText(app)).toContain('Entries: 4');
    });
    await withLab('dropdown/history', (app) => {
      expect(frameText(app)).toContain('Entries: 3');
    });
  });
});

test('every container/dropdown laboratory unmounts its complete dialog subtree', async () => {
  for (const exampleId of CONTAINER_EXAMPLE_IDS) {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      const descendants = viewsIn(dialog);
      try {
        expect(descendants.every((view) => view.mounted)).toBe(true);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
      expect(descendants.every((view) => !view.mounted)).toBe(true);
    });
  }
});
