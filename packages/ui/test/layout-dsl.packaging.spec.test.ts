/**
 * Specification test (immutable oracle) — the layout-DSL public surface + shipped-doc discipline.
 *
 * The builders live in the `src/view/dsl/` folder (`flex.ts`, `stack.ts`, and the `index.ts` barrel)
 * with explicit named re-exports through `view/index.ts` → `src/index.ts`, imported here BY NAME from
 * `@jsvision/ui` (the published surface). The standalone `fill` helper is intentionally NOT exported
 * (it duplicated `grow` and collided with the engine `position:'fill'` mode). Every module in the
 * folder carries no CodeOps/Turbo-Vision provenance in its comments and stays within the file-size
 * budget — the budget is applied per file, since the DSL is now a folder of modules.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ui from '@jsvision/ui';
import * as dslBarrel from '../src/view/dsl/index.js';
import {
  col,
  row,
  stack,
  grow,
  fixed,
  spacer,
  place,
  centered,
  topRight,
  bottomRight,
  topLeft,
  at,
  cover,
  center,
  type Flex,
  type Placement,
} from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));
const dslDir = join(here, '..', 'src', 'view', 'dsl');

/** Every TypeScript module in the split `dsl/` folder. */
const dslFiles = readdirSync(dslDir).filter((f) => f.endsWith('.ts'));

// Every DSL value symbol — including the new at/cover/center — is importable from `@jsvision/ui` as
// a function.
test('col/row/stack/grow/fixed/spacer/place/centered/corner + at/cover/center are exported functions', () => {
  const fns = [
    col,
    row,
    stack,
    grow,
    fixed,
    spacer,
    place,
    centered,
    topRight,
    bottomRight,
    topLeft,
    at,
    cover,
    center,
  ];
  for (const fn of fns) {
    expect(typeof fn).toBe('function');
  }
});

// The DSL barrel exports EXACTLY the expected builder set — at/cover/center were added and nothing
// else leaked onto the surface (an `import * as` sees only the value exports; types are erased).
test('the dsl/ barrel exports exactly the expected builder set (+at/cover/center, nothing else)', () => {
  const expected = [
    'col',
    'row',
    'grow',
    'fixed',
    'spacer',
    'stack',
    'place',
    'centered',
    'topRight',
    'bottomRight',
    'topLeft',
    'at',
    'cover',
    'center',
  ].sort();
  expect(Object.keys(dslBarrel).sort()).toEqual(expected);
});

// The `Flex` and `Placement` types are on the public surface (type-only usage compiles).
test('Flex and Placement are exported types', () => {
  const flex: Flex = { grow: 1, background: 'window' };
  const placement: Placement = { h: 'end', v: 'start', width: 4, height: 1 };
  expect(flex.grow).toBe(1);
  expect(placement.h).toBe('end');
});

// There is NO standalone `fill` export (it was dropped in favor of `grow`).
test('no standalone `fill` helper is exported', () => {
  expect((ui as Record<string, unknown>).fill).toBeUndefined();
});

// The DSL is a folder of modules now — the old single-file `dsl.ts` must be gone, and the folder
// must hold at least one module (the split actually happened).
test('the DSL split landed: src/view/dsl.ts is gone and the dsl/ folder has modules', () => {
  expect(existsSync(join(here, '..', 'src', 'view', 'dsl.ts'))).toBe(false);
  expect(dslFiles.length).toBeGreaterThan(0);
});

// Every DSL module carries no CodeOps process IDs or Turbo-Vision/C++ provenance in its comments
// (the directive is comment-scoped, so extract the comments before grepping — a property access
// like `p.h` is code, not provenance).
test('every dsl/ module has no banned CodeOps/TV references in its comments', () => {
  const codeopsIds = /\b(?:RD|PA|AR|PF|HR|GATE|AC|ST|ADR|DEF|FR|RT|PL)-\d+/;
  const tvProvenance = /\b[\w.-]+\.(?:cpp|h)\b|getColor\s*\(|\bcp[A-Z][A-Za-z]{2,}\b|\bT[A-Z][A-Za-z]+::/;
  for (const file of dslFiles) {
    const source = readFileSync(join(dslDir, file), 'utf8');
    const comments = (source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g) ?? []).join('\n');
    expect(codeopsIds.test(comments), `${file} contains a banned CodeOps id`).toBe(false);
    expect(tvProvenance.test(comments), `${file} contains TV/C++ provenance`).toBe(false);
  }
});

// Each DSL module stays within the file-size budget (≤ 500 lines) — enforced per file.
test('every dsl/ module is within the 500-line budget', () => {
  for (const file of dslFiles) {
    const lines = readFileSync(join(dslDir, file), 'utf8').split('\n').length;
    expect(lines, `${file} exceeds the 500-line budget`).toBeLessThanOrEqual(500);
  }
});
