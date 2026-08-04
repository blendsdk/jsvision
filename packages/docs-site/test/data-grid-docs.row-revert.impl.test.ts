/** Implementation-focused wiring checks for the Data Grid row-recovery laboratory. */
import { EditableDataGrid } from '@jsvision/datagrid';
import { createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import validation from '../examples/data-grid/validation.js';
import { DataGridLabProbe } from '../src/example-fixtures/data-grid/probe.js';
import { buildLabExample, dispatchExampleAction, viewsIn } from './example-lab-harness.js';

/** Let async cell commits and row-revert settlement finish without relying on private grid state. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Drive the reusable Start=9 cross-field trap through the documentation action adapter. */
async function trapFirstRow(app: ReturnType<typeof buildLabExample>['app']): Promise<void> {
  for (const action of [
    { kind: 'key' as const, key: '9', modifiers: [] },
    { kind: 'key' as const, key: 'tab', modifiers: [] },
    { kind: 'key' as const, key: 'arrowdown', modifiers: [] },
  ]) {
    dispatchExampleAction(app, action);
    await settle();
  }
}

test('documentation action adapter sends browser-style Arrow names through the real grid keymap', async () => {
  await createRoot(async (dispose) => {
    const { app, dialog } = buildLabExample('data-grid/validation', validation);
    try {
      const grid = viewsIn(dialog).find((view): view is EditableDataGrid<unknown> => view instanceof EditableDataGrid);
      if (grid === undefined) throw new Error('validation laboratory requires an EditableDataGrid');
      app.loop.focusView(grid.rows);

      await trapFirstRow(app);

      expect(grid.focusedKey()).toBe('r1');
      expect(grid.activeMessage()).toBe('End must be after Start');
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

test('validation Alt+V command wins over Classic View menu and leaves a retryable trap', async () => {
  await createRoot(async (dispose) => {
    const { app, dialog } = buildLabExample('data-grid/validation', validation);
    try {
      const grid = viewsIn(dialog).find((view): view is EditableDataGrid<unknown> => view instanceof EditableDataGrid);
      const probe = viewsIn(dialog).find((view): view is DataGridLabProbe => view instanceof DataGridLabProbe);
      if (grid === undefined || probe === undefined) throw new Error('validation laboratory wiring is incomplete');

      dispatchExampleAction(app, { kind: 'key', key: 'v', modifiers: ['Alt'] });
      expect(probe.read('status-text')).toContain('veto armed');
      app.loop.focusView(grid.rows);
      await trapFirstRow(app);
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      await settle();

      expect(grid.displayedRows()[0]).toMatchObject({ start: 9, end: 9 });
      expect(grid.activeMessage()).toBe('Could not revert row changes');
      expect(probe.read('status-text')).toContain('vetoed · Escape retries');
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});
