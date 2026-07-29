/**
 * Data Grid documentation lifecycle implementation tests.
 *
 * These tests exercise the real example shell, focus chain, editor overlay, filter popup, and
 * lifecycle swaps. They complement the immutable objective contracts with cleanup-focused edges.
 */
import { EditableDataGrid } from '@jsvision/datagrid';
import { Group, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import advancedFilter from '../examples/data-grid/advanced-filter.js';
import customEditor from '../examples/data-grid/custom-editor.js';
import lifecycleStates from '../examples/data-grid/lifecycle-states.js';
import {
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';
import { DataGridLabProbe } from '../src/example-fixtures/data-grid/probe.js';

/** Run a mounted laboratory and guarantee reactive/event-loop teardown after each assertion. */
function withLab(
  id: string,
  definition: typeof lifecycleStates,
  run: (state: ReturnType<typeof buildLabExample>) => void,
): void {
  createRoot((dispose) => {
    const state = buildLabExample(id, definition);
    try {
      run(state);
    } finally {
      try {
        state.app.loop.dispose();
      } finally {
        dispose();
      }
    }
  });
}

/** Find the real editable grid mounted in a lab dialog. */
function editableGrid(state: ReturnType<typeof buildLabExample>): EditableDataGrid<unknown> {
  const grid = viewsIn(state.dialog).find(
    (view): view is EditableDataGrid<unknown> => view instanceof EditableDataGrid,
  );
  if (grid === undefined) throw new Error('expected an EditableDataGrid in the laboratory');
  return grid;
}

describe('lifecycle example state swaps', () => {
  test('loading and error remain inside one padded template1 host', () => {
    withLab('data-grid/lifecycle-states', lifecycleStates, ({ app, dialog }) => {
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dispatchExampleAction(app, { kind: 'key', key: 'l', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Loading');
      dispatchExampleAction(app, { kind: 'key', key: 'l', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'f', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'x', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Source unavailable');
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
    });
  });

  test('disposing after lifecycle transitions is idempotent at the example boundary', () => {
    createRoot((dispose) => {
      const { app } = buildLabExample('data-grid/lifecycle-states', lifecycleStates);
      dispatchExampleAction(app, { kind: 'key', key: 'l', modifiers: ['Alt'] });
      expect(() => app.loop.dispose()).not.toThrow();
      expect(() => app.loop.dispose()).not.toThrow();
      dispose();
    });
  });
});

describe('editing and popup cleanup', () => {
  test('Escape closes a custom editor overlay and restores idle state', () => {
    withLab('data-grid/custom-editor', customEditor, (state) => {
      const grid = editableGrid(state);
      const controller = viewsIn(state.dialog).find((view) => view instanceof DataGridLabProbe);
      if (controller?.parent instanceof Group) controller.parent.remove(controller);
      state.app.loop.focusView(grid.rows);
      dispatchExampleAction(state.app, { kind: 'key', key: 'enter', modifiers: [] });
      expect(grid.isEditing()).toBe(true);
      expect(grid.overlay.children.length).toBeGreaterThan(0);
      dispatchExampleAction(state.app, { kind: 'key', key: 'escape', modifiers: [] });
      expect(grid.isEditing()).toBe(false);
      expect(grid.overlay.children).toHaveLength(0);
    });
  });

  test('Escape removes a condition popup without removing the grid', () => {
    withLab('data-grid/advanced-filter', advancedFilter, (state) => {
      const grid = editableGrid(state);
      state.app.loop.focusView(grid.rows);
      dispatchExampleAction(state.app, { kind: 'key', key: 'down', modifiers: ['Alt'] });
      expect(grid.popupOverlay.children.length).toBeGreaterThan(0);
      dispatchExampleAction(state.app, { kind: 'key', key: 'escape', modifiers: [] });
      expect(grid.popupOverlay.children).toHaveLength(0);
      expect(viewsIn(state.dialog)).toContain(grid);
    });
  });
});
