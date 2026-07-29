/**
 * Implementation hardening for surface, general editing, and terminal laboratories.
 *
 * These checks cover clamping, reset/undo, clipboard behavior, window constraints, safe output, and
 * complete disposal beyond the public behavior oracle.
 */
import {
  createEventLoop,
  createApplication,
  createRoot,
  EditWindow,
  Editor,
  Group,
  Indicator,
  Memo,
  ScrollBar,
  Surface,
  SurfaceView,
  Terminal,
  View,
  at,
} from '@jsvision/ui';
import type { Application, Dialog } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import {
  EXAMPLE_CAPS,
  absoluteOrigin,
  buildLabExample,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';
import { EDITING_EXAMPLE_IDS } from './contracts/editing.js';

/** Load one family definition from the public lazy registry. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing editing example ${exampleId}`);
  return (await entry.load()).default;
}

/** Return the first descendant matching a public widget class. */
function widgetIn<T extends View>(root: View, type: abstract new (...args: never[]) => T): T {
  const widget = viewsIn(root).find((view): view is T => view instanceof type);
  if (widget === undefined) throw new Error(`missing ${type.name} in editing laboratory`);
  return widget;
}

/** Mount one laboratory and guarantee event-loop plus reactive-owner disposal. */
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

describe('surface and viewport boundaries', () => {
  test('Surface sanitizes direct cell writes and clear removes the stored content', () => {
    const surface = new Surface({ size: { x: 4, y: 2 } });
    surface.set(1, 0, '\u001b', { fg: 'white', bg: 'blue' });
    expect(surface.at(1, 0)?.char).toBe(' ');
    surface.set(2, 1, 'X', { fg: 'white', bg: 'blue' });
    expect(surface.at(2, 1)?.char).toBe('X');
    surface.clear();
    expect(surface.at(2, 1)?.char).toBe(' ');
  });

  test('Surface resize preserves drawn overlap and exposes the new size', async () => {
    await withLab('surface/surface', (app) => {
      dispatchExampleAction(app, { kind: 'key', key: 'g', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Surface: 36×12');
      expect(frameText(app)).toContain('SAFE CELL');
    });
  });

  test('SurfaceView repeated panning clamps at both content extents', async () => {
    await withLab('surface/surface-view', (app, dialog) => {
      const view = widgetIn(dialog, SurfaceView);
      for (let index = 0; index < 10; index += 1) {
        dispatchExampleAction(app, { kind: 'key', key: 'p', modifiers: ['Alt'] });
      }
      expect(view.delta()).toEqual({ x: 16, y: 6 });
    });
  });
});

describe('editing reset, clipboard, and window constraints', () => {
  test('Editor undo removes the inserted step and reset restores the fixture', async () => {
    await withLab('editor/editor', (app, dialog) => {
      const editor = widgetIn(dialog, Editor);
      dispatchExampleAction(app, { kind: 'key', key: 'x', modifiers: [] });
      expect(editor.canUndo()).toBe(true);
      dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Ctrl'] });
      expect(editor.getText()).toBe('Edit this document\nSecond line for navigation.');
      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
      expect(editor.getText()).toBe('Edit this document\nSecond line for navigation.');
    });
  });

  test('Memo Tab leaves the editor after an external signal replacement', async () => {
    await withLab('editor/memo', (app, dialog) => {
      const memo = widgetIn(dialog, Memo);
      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
      expect(memo.getText()).toBe('Replaced from the signal');
      dispatchExampleAction(app, { kind: 'key', key: 'tab', modifiers: [] });
      expect(app.loop.getFocused()?.constructor.name).toBe('Button');
    });
  });

  test('EditWindow zoom keeps the hosted editor inside the teaching surface', async () => {
    await withLab('editor/edit-window', (app, dialog) => {
      const win = widgetIn(dialog, EditWindow);
      dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
      expect(win.bounds.width).toBeLessThanOrEqual(64);
      expect(win.editor.bounds.width).toBeLessThanOrEqual(win.bounds.width - 2);
      const bars = viewsIn(win).filter((view): view is ScrollBar => view instanceof ScrollBar);
      const indicator = widgetIn(win, Indicator);
      expect(bars).toHaveLength(2);
      expect(bars.every((bar) => bar.state.visible && bar.bounds.width > 0 && bar.bounds.height > 0)).toBe(true);
      expect(indicator.state.visible).toBe(true);
    });
  });

  test('an actual desktop drag switches EditWindow Indicator presentation', () => {
    createRoot((dispose) => {
      const app = createApplication({ caps: EXAMPLE_CAPS, viewport: { width: 80, height: 24 } });
      const win = new EditWindow({ rect: { x: 8, y: 4, width: 52, height: 10 } });
      app.desktop.addWindow(win);
      const indicator = widgetIn(win, Indicator);
      const winOrigin = absoluteOrigin(win);
      const indicatorOrigin = absoluteOrigin(indicator);
      const indicatorFill = (): string =>
        app.loop.renderRoot.buffer().get(indicatorOrigin.x + 1, indicatorOrigin.y)?.char ?? '';

      try {
        expect(indicatorFill()).toBe('═');
        app.loop.dispatch({
          type: 'mouse',
          kind: 'down',
          button: 0,
          x: winOrigin.x + 7,
          y: winOrigin.y + 1,
        });
        expect(win.dragging()).toBe(true);
        expect(indicatorFill()).toBe('─');
        app.loop.dispatch({
          type: 'mouse',
          kind: 'up',
          button: 0,
          x: winOrigin.x + 7,
          y: winOrigin.y + 1,
        });
        expect(win.dragging()).toBe(false);
        expect(indicatorFill()).toBe('═');
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    });
  });
});

describe('terminal safety and disposal', () => {
  test('Terminal capacity evicts oldest whole lines', () => {
    class InspectableTerminal extends Terminal {
      /** Return the retained lines through the real Terminal ring. */
      retainedLines(): string[] {
        return Array.from({ length: this.ring.lineCount() }, (_, index) => this.ring.line(index));
      }
    }

    const terminal = new InspectableTerminal({ capacity: 18 });
    const root = new Group();
    root.add(at(terminal, 0, 0, 20, 3));
    const loop = createEventLoop({ width: 20, height: 3 }, { caps: EXAMPLE_CAPS });
    try {
      loop.mount(root);
      terminal.writeLine('oldest');
      terminal.writeLine('middle');
      terminal.writeLine('newest');
      expect(terminal.retainedLines()).toEqual(['middle', 'newest']);
    } finally {
      loop.dispose();
    }
  });

  test('Terminal sanitizes streamed control bytes and clear resets the visible line count', async () => {
    await withLab('terminal/terminal', (app) => {
      dispatchExampleAction(app, { kind: 'key', key: 'w', modifiers: ['Alt'] });
      expect(frameText(app)).not.toContain('\u001b');
      expect(frameText(app)).toContain('job complete');
      dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Lines: 0 · Terminal cleared');
    });
  });
});

test('every surface/editing/terminal laboratory unmounts its complete dialog subtree', async () => {
  for (const exampleId of EDITING_EXAMPLE_IDS) {
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
