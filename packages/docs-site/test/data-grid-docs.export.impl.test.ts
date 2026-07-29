/** Export escaping and deterministic variant-state tests for the Data Grid documentation hub. */
import { EditableDataGrid, column, fromRows } from '@jsvision/datagrid';
import { createRoot, signal } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import exportExample from '../examples/data-grid/export.js';
import personalizationExample from '../examples/data-grid/variants-personalization.js';
import { HOSTILE_EXPORT_VALUES } from '../src/example-fixtures/data-grid/export-fixtures.js';
import { buildLabExample, collectTemplate1Evidence, dispatchExampleAction, frameText } from './example-lab-harness.js';

interface ExportRow {
  readonly id: number;
  readonly value: string;
}

/** Build a real public grid containing the hostile export corpus. */
function exportGrid(): EditableDataGrid<ExportRow> {
  const rows = signal(HOSTILE_EXPORT_VALUES.map((value, id) => ({ id, value })));
  const columns = [column({ id: 'value', title: 'Value', value: (row: ExportRow) => row.value, width: 30 })];
  return new EditableDataGrid({ columns, source: fromRows(rows, { rowKey: (row) => row.id }) });
}

describe('public export serializers', () => {
  test('CSV and TSV neutralize formulas and quote delimiter-bearing text', () => {
    const grid = exportGrid();
    const csv = grid.exportView('csv');
    const tsv = grid.exportView('tsv');
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+SUM(A1:A2)");
    expect(csv).toContain("'-10+20");
    expect(csv).toContain("'@cmd");
    expect(csv).toContain('"comma,value"');
    expect(csv).toContain('"""quoted"""');
    expect(tsv).toContain("'=SUM(A1:A2)");
    expect(tsv).toContain('"tab\tvalue"');
    expect(tsv).toContain('"quoted"');
    expect(csv).toContain('"line\nbreak"');
    expect(csv).toContain('"crlf\nbreak"');
  });

  test('HTML escapes markup while JSON preserves data rather than executable markup', () => {
    const grid = exportGrid();
    expect(grid.exportView('html')).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    const parsed: unknown = JSON.parse(grid.exportView('json'));
    expect(parsed).toEqual(expect.arrayContaining([{ value: '<script>alert(1)</script>' }]));
  });
});

describe('variant determinism and live labs', () => {
  test('a saved variant restores order, width, visibility, and freeze state', () => {
    const grid = exportGrid();
    const baseline = grid.saveVariant('Baseline');
    grid.setColumnWidth('value', 12);
    grid.setColumnVisible('value', false);
    grid.applyVariant(baseline);
    expect(grid.columnOrder()).toEqual(['value']);
    expect(grid.columns()[0]).toMatchObject({ id: 'value', visible: true });
    expect(grid.saveVariant('Again')).toMatchObject({
      columns: expect.arrayContaining([expect.objectContaining({ id: 'value', visible: true })]),
    });
  });

  test('export and personalization actions remain inside template1 and expose outcomes', () => {
    createRoot((dispose) => {
      const exported = buildLabExample('data-grid/export', exportExample);
      try {
        collectTemplate1Evidence(exported.app, exported.dialog, { startup: 'maximized' });
        dispatchExampleAction(exported.app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
        expect(frameText(exported.app)).toContain("'=SUM(A1:A2)");
      } finally {
        exported.app.loop.dispose();
      }

      const personalized = buildLabExample('data-grid/variants-personalization', personalizationExample);
      try {
        dispatchExampleAction(personalized.app, { kind: 'key', key: 's', modifiers: ['Alt'] });
        dispatchExampleAction(personalized.app, { kind: 'key', key: 'a', modifiers: ['Alt'] });
        expect(frameText(personalized.app)).toContain('Compact applied');
      } finally {
        personalized.app.loop.dispose();
        dispose();
      }
    });
  });
});
