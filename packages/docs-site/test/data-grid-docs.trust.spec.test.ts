/**
 * Data Grid trust-boundary specifications.
 *
 * Scale fixtures must make full-array access impossible, export fixtures preserve hostile text,
 * and registry source must remain lazy and independent of the showcase registry.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WINDOWED_FIXTURE_MODULE = new URL('../src/example-fixtures/data-grid/windowed-source.js', import.meta.url).href;
const EXPORT_FIXTURE_MODULE = new URL('../src/example-fixtures/data-grid/export-fixtures.js', import.meta.url).href;

interface WindowedFixtureModule {
  readonly WINDOWED_TOTAL_ROWS: number;
  readonly createGuardedWindowedRows: () => {
    readonly fullArrayRead: () => boolean;
    readonly readCount: () => number;
    readonly readWindow: (start: number, count: number) => readonly unknown[];
  };
}

interface ExportFixtureModule {
  readonly HOSTILE_EXPORT_VALUES: readonly string[];
}

/** Narrow an unknown module namespace without bypassing the type system. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWindowedFixture(value: unknown): value is WindowedFixtureModule {
  return (
    isRecord(value) &&
    typeof value.WINDOWED_TOTAL_ROWS === 'number' &&
    typeof value.createGuardedWindowedRows === 'function'
  );
}

function isExportFixture(value: unknown): value is ExportFixtureModule {
  return (
    isRecord(value) &&
    Array.isArray(value.HOSTILE_EXPORT_VALUES) &&
    value.HOSTILE_EXPORT_VALUES.every((item) => typeof item === 'string')
  );
}

describe('bounded Data Grid fixtures', () => {
  test('windowed source reads bounded slices of 100k rows and never exposes a full array', async () => {
    const candidate: unknown = await import(WINDOWED_FIXTURE_MODULE);
    if (!isWindowedFixture(candidate)) throw new TypeError('invalid windowed Data Grid fixture');
    expect(candidate.WINDOWED_TOTAL_ROWS).toBe(100_000);
    const source = candidate.createGuardedWindowedRows();
    expect(source.readWindow(50_000, 40)).toHaveLength(40);
    expect(source.readCount()).toBe(1);
    expect(source.fullArrayRead()).toBe(false);
    expect(Object.keys(source)).not.toContain('rows');
  });

  test('export fixture includes formula, delimiter, quote, markup, and control-text hazards', async () => {
    const candidate: unknown = await import(EXPORT_FIXTURE_MODULE);
    if (!isExportFixture(candidate)) throw new TypeError('invalid export Data Grid fixture');
    expect(candidate.HOSTILE_EXPORT_VALUES).toEqual(
      expect.arrayContaining([
        '=SUM(A1:A2)',
        '+SUM(A1:A2)',
        '-10+20',
        '@cmd',
        'comma,value',
        'tab\tvalue',
        '"quoted"',
        '<script>alert(1)</script>',
        'line\nbreak',
        'crlf\r\nbreak',
      ]),
    );
  });
});

describe('lazy and isolated implementation boundary', () => {
  test('Data Grid registry uses lazy imports and never imports the showcase registry', async () => {
    const source = await readFile(join(PACKAGE_ROOT, 'src/example-registry/data-grid.ts'), 'utf8');
    expect(source).toContain('load: () => import(');
    expect(source).not.toContain('datagrid-showcase');
    expect(source).not.toMatch(/^import\s+.*examples\/data-grid/mu);
  });

  test('Data Grid examples do not import workspace source internals or the showcase registry', async () => {
    for (const exampleId of [
      'windowed',
      'large-memory',
      'export',
      'variants-personalization',
      'performance-boundaries',
    ]) {
      const source = await readFile(join(PACKAGE_ROOT, `examples/data-grid/${exampleId}.ts`), 'utf8');
      expect(source).not.toContain('packages/');
      expect(source).not.toContain('/src/');
      expect(source).not.toContain('datagrid-showcase');
    }
  });
});
