/**
 * Specification coverage for the experimental resizable Data Grid laboratory.
 */
import { EditableDataGrid } from '@jsvision/datagrid';
import { datagridDe } from '@jsvision/datagrid/locales/de';
import { createI18n } from '@jsvision/i18n';
import { DataGrid, createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import masterDetail from '../examples/data-grid/master-detail.js';
import quickStart from '../examples/data-grid/quick-start.js';
import validation from '../examples/data-grid/validation.js';
import windowed from '../examples/data-grid/windowed.js';
import {
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';
import { DataGridLabProbe } from '../src/example-fixtures/data-grid/probe.js';
import { buildDataGridLab } from '../src/example-fixtures/data-grid/lab.js';

const settleValidation = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const germanValidation: ExampleDefinition = {
  title: 'Validation and Escape Recovery',
  blurb: 'Exercise official translated trap, pending, and failure feedback.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'validation',
      title: 'Validation & Recovery',
      objective: 'Commit Start ≥ End, test row-leave, then use Escape to restore the session baseline.',
      i18n: createI18n({ locale: 'de', catalogs: [datagridDe] }),
    }),
};

async function makeValidationRowInvalid(app: ReturnType<typeof buildLabExample>['app']): Promise<void> {
  for (const action of [
    { kind: 'key' as const, key: '9', modifiers: [] },
    { kind: 'key' as const, key: 'tab', modifiers: [] },
    { kind: 'key' as const, key: 'arrowdown', modifiers: [] },
  ]) {
    dispatchExampleAction(app, action);
    await settleValidation();
  }
}

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

test('validation lab preserves Classic reflow and complete recovery instructions at 80x24', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('data-grid/validation', validation, {
      viewport: { width: 80, height: 24 },
    });
    try {
      const grid = viewsIn(dialog).find((view) => view instanceof EditableDataGrid);
      if (grid === undefined) throw new Error('the validation laboratory is missing its Data Grid');
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(dialog.isZoomed()).toBe(true);
      const maximizedGrid = { ...grid.bounds };
      let text = frameText(app);
      expect(text).toContain('Enter/Tab edit · ↑↓ leave · Esc revert');
      expect(text).toContain('Alt+P/R/V hold/go/veto');
      expect(text).toContain('Status: ready');

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'compact' });
      expect(grid.bounds.width).toBeLessThan(maximizedGrid.width);
      expect(grid.bounds.height).toBeLessThan(maximizedGrid.height);
      text = frameText(app);
      expect(text).toContain('Esc revert');
      expect(text).toContain('Alt+P/R/V hold/go/veto');
      expect(text).toContain('Status: ready');

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(grid.bounds).toEqual(maximizedGrid);
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

test('validation lab keeps keyboard recovery and non-color success or veto feedback visible', async () => {
  await createRoot(async (dispose) => {
    const { app, dialog } = buildLabExample('data-grid/validation', validation, {
      viewport: { width: 80, height: 24 },
    });
    try {
      const grid = viewsIn(dialog).find((view): view is EditableDataGrid<unknown> => view instanceof EditableDataGrid);
      const probe = viewsIn(dialog).find((view): view is DataGridLabProbe => view instanceof DataGridLabProbe);
      if (grid === undefined || probe === undefined) throw new Error('validation lab requires a real grid and probe');
      app.loop.focusView(grid.rows);

      await makeValidationRowInvalid(app);
      expect(probe.read('validation-status')).toContain('End must be after Start');
      expect(frameText(app)).toContain('Esc reverts row changes');
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      await settleValidation();
      expect(probe.read('cell-text')).toContain('Start 1 · End 9');
      expect(probe.read('status-text')).toContain('pending → restored');
      expect(frameText(app)).toContain('restored');

      dispatchExampleAction(app, { kind: 'key', key: 'v', modifiers: ['Alt'] });
      app.loop.focusView(grid.rows);
      await makeValidationRowInvalid(app);
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      await settleValidation();
      expect(probe.read('cell-text')).toContain('Start 9 · End 9');
      expect(probe.read('validation-status')).toBe('Could not revert row changes');
      expect(probe.read('status-text')).toContain('vetoed · Escape retries');
      const failure = frameText(app);
      expect(failure).toContain('Could not revert row changes');
      expect(failure).toContain('vetoed · Escape');
      expect(failure).toContain('retries');
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

test('validation lab keeps longer official translated recovery feedback unclipped across window states', async () => {
  await createRoot(async (dispose) => {
    const { app, dialog } = buildLabExample('data-grid/validation', germanValidation, {
      viewport: { width: 80, height: 24 },
    });
    try {
      const grid = viewsIn(dialog).find((view): view is EditableDataGrid<unknown> => view instanceof EditableDataGrid);
      if (grid === undefined) throw new Error('translated validation lab requires a real grid');
      app.loop.focusView(grid.rows);

      dispatchExampleAction(app, { kind: 'key', key: 'p', modifiers: ['Alt'] });
      await makeValidationRowInvalid(app);
      expect(frameText(app).replaceAll(/\s+/gu, ' ')).toContain(
        'End must be after Start · Esc macht Zeilenänderungen rückgängig',
      );
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      await settleValidation();
      expect(frameText(app)).toContain('Zeilenänderungen werden rückgängig gemacht…');

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'compact' });
      expect(frameText(app)).toContain('Zeilenänderungen werden rückgängig gemacht…');

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(frameText(app)).toContain('Zeilenänderungen werden rückgängig gemacht…');

      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
      await settleValidation();
      dispatchExampleAction(app, { kind: 'key', key: 'v', modifiers: ['Alt'] });
      app.loop.focusView(grid.rows);
      await makeValidationRowInvalid(app);
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      await settleValidation();
      expect(frameText(app)).toContain('Zeilenänderungen konnten nicht rückgängig gemacht werden');
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});
