/**
 * Specification test (immutable oracle) — jsvision-ui RD-16 table packaging (ST-21).
 *
 * Source: RD-16 AC-11 → ST-21 (plans/table/03-03-theme-packaging.md §2, AR-178). The `table/`
 * subsystem lives under `src/` with explicit named re-exports from `src/index.ts` (imported here BY
 * NAME from `@jsvision/ui`, the published surface), every `table/` source file is ≤ 500 lines, and
 * the package declares zero native runtime dependencies (mirrors `containers.packaging.spec`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { signal } from '@jsvision/ui';
import { DataGrid } from '@jsvision/ui';
import type { Column, ColumnWidth, SortState, DataGridOptions } from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ST-21 / AC-11 — DataGrid is an importable, constructable class from the published surface, and the
// column types resolve (the type-only imports below compile ⇒ they are re-exported).
test('ST-21: DataGrid is exported as a constructable class from @jsvision/ui', () => {
  expect(typeof DataGrid).toBe('function');
  interface Row {
    readonly x: string;
  }
  const columns: Column<Row>[] = [{ title: 'X', accessor: (r) => r.x, width: '1fr' as ColumnWidth }];
  const opts: DataGridOptions<Row> = { rows: signal<Row[]>([{ x: 'a' }]), columns };
  const grid = new DataGrid<Row>(opts);
  expect(grid).toBeTruthy();
  expect(grid.rows.focusable, 'the exposed rows renderer is the focus target').toBe(true);
  // A SortState value is assignable (the type is re-exported).
  const sort: SortState = { col: 0, dir: 'asc' };
  grid.sort.set(sort);
  expect(grid.sort()).toEqual(sort);
});

// ST-21 / AR-178 — every file in src/table/ is ≤ 500 lines (architecture boundary).
test('ST-21: each src/table/ source file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'table');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

// ST-21 / AC-11 — the package declares no third-party/native runtime dependency (check:deps clean).
test('ST-21: @jsvision/ui declares only the workspace @jsvision/core runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});
