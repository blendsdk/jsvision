/**
 * Specification test (immutable oracle) — `@jsvision/datagrid` packaging: the built package exposes a
 * single public entry point and declares only workspace runtime dependencies (no native deps). Runs
 * in the e2e project so it executes after `build`, against the real `dist/` output.
 */
import { test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

// The package declares exactly one public entry (the `.` export -> dist/index.js) and the built entry
// files exist. Later phases compile more modules into dist/, but the exports map keeps them
// unreachable — there is no second importable entry point.
test('should expose exactly one public entry point after build', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    exports: Record<string, unknown>;
  };
  expect(Object.keys(pkg.exports)).toEqual(['.']);
  expect(pkg.exports['.']).toEqual({ types: './dist/index.d.ts', import: './dist/index.js' });
  expect(existsSync(join(pkgRoot, 'dist', 'index.js')), 'dist/index.js exists after build').toBe(true);
  expect(existsSync(join(pkgRoot, 'dist', 'index.d.ts')), 'dist/index.d.ts exists after build').toBe(true);
});

// Zero native runtime dependencies: the only declared dependencies are the workspace @jsvision
// packages. The check:deps guard enforces this in CI; it is asserted here at the package level too.
test('should declare only the workspace @jsvision runtime dependencies', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core', '@jsvision/ui']);
});
