/**
 * Specification coverage for the experimental resizable Data Grid laboratory.
 */
import { EditableDataGrid } from '@jsvision/datagrid';
import { DataGrid, createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import masterDetail from '../examples/data-grid/master-detail.js';
import quickStart from '../examples/data-grid/quick-start.js';
import windowed from '../examples/data-grid/windowed.js';
import { buildLabExample, dispatchExampleAction, frameText, viewsIn } from './example-lab-harness.js';

// The overview starts maximized and gives both public grid surfaces the additional space.
test('overview reflows both comparison grids across restore and maximize', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('data-grid/quick-start', quickStart);
    try {
      const descendants = viewsIn(dialog);
      const readOnly = descendants.find((view) => view instanceof DataGrid);
      const editable = descendants.find((view) => view instanceof EditableDataGrid);
      if (readOnly === undefined || editable === undefined) {
        throw new Error('the overview must contain both public Data Grid surfaces');
      }
      expect(dialog.isZoomed()).toBe(true);
      const maximizedReadOnly = { ...readOnly.bounds };
      const maximizedEditable = { ...editable.bounds };

      dialog.zoom();
      app.loop.renderRoot.flush();

      expect(dialog.isZoomed()).toBe(false);
      expect(readOnly.bounds.width).toBeLessThan(maximizedReadOnly.width);
      expect(readOnly.bounds.height).toBeLessThan(maximizedReadOnly.height);
      expect(editable.bounds.width).toBeLessThan(maximizedEditable.width);
      expect(editable.bounds.height).toBeLessThan(maximizedEditable.height);

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(readOnly.bounds).toEqual(maximizedReadOnly);
      expect(editable.bounds).toEqual(maximizedEditable);
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

// A master/detail Data Grid example uses two vertically stacked grids, and the lower rows follow
// the stable identity under the master cursor in both compact and maximized dialog layouts.
test('master-detail stacks two grids and binds the lower rows to the focused master', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('data-grid/master-detail', masterDetail);
    try {
      const grids = viewsIn(dialog).filter((view) => view instanceof EditableDataGrid);
      expect(grids).toHaveLength(2);
      const [master, detail] = grids;
      if (master === undefined || detail === undefined) {
        throw new Error('the master-detail laboratory must contain a master grid and a detail grid');
      }

      expect(detail.bounds.x).toBe(master.bounds.x);
      expect(detail.bounds.width).toBe(master.bounds.width);
      expect(detail.bounds.y).toBeGreaterThan(master.bounds.y + master.bounds.height);
      expect(detail.displayedRows()).toHaveLength(2);
      expect(JSON.stringify(detail.displayedRows())).toContain('Discovery');

      dispatchExampleAction(app, {
        kind: 'key',
        key: 'arrowdown',
        modifiers: [],
      });
      app.loop.renderRoot.flush();

      expect(JSON.stringify(detail.displayedRows())).toContain('Migration');
      expect(JSON.stringify(detail.displayedRows())).not.toContain('Discovery');

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(detail.bounds.x).toBe(master.bounds.x);
      expect(detail.bounds.width).toBe(master.bounds.width);
      expect(detail.bounds.y).toBeGreaterThan(master.bounds.y + master.bounds.height);

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(detail.bounds.x).toBe(master.bounds.x);
      expect(detail.bounds.width).toBe(master.bounds.width);
      expect(detail.bounds.y).toBeGreaterThan(master.bounds.y + master.bounds.height);
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

// The windowed sample starts maximized, can restore to its compact frame, and can maximize again.
test('windowed lab starts maximized and reflows the grid across restore and maximize', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('data-grid/windowed', windowed);
    try {
      const grid = viewsIn(dialog).find((view) => view instanceof EditableDataGrid);
      if (grid === undefined) throw new Error('the windowed laboratory is missing its Data Grid');
      const desktop = app.desktop;
      if (desktop === undefined) throw new Error('the windowed laboratory requires a desktop');

      expect(dialog.resizable).toBe(true);
      expect(dialog.zoomable).toBe(true);
      expect(dialog.isZoomed()).toBe(true);
      expect(dialog.bounds).toEqual({
        x: 0,
        y: 0,
        width: desktop.bounds.width,
        height: desktop.bounds.height,
      });
      expect(frameText(app)).toContain('↕');
      const maximizedGrid = { ...grid.bounds };

      dialog.zoom();
      app.loop.renderRoot.flush();

      expect(dialog.isZoomed()).toBe(false);
      expect(dialog.bounds).toMatchObject({ width: 74, height: 20 });
      expect(grid.bounds.width).toBeLessThan(maximizedGrid.width);
      expect(grid.bounds.height).toBeLessThan(maximizedGrid.height);
      expect(frameText(app)).toContain('↑');

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.isZoomed()).toBe(true);
      expect(grid.bounds).toEqual(maximizedGrid);
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});
