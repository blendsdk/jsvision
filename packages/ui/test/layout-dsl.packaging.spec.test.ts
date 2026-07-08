/**
 * Specification test (immutable oracle) — the layout-DSL public surface + shipped-doc discipline.
 *
 * The builders live in `src/view/dsl.ts` with explicit named re-exports through `view/index.ts` →
 * `src/index.ts`, imported here BY NAME from `@jsvision/ui` (the published surface). The standalone
 * `fill` helper is intentionally NOT exported (it duplicated `grow` and collided with the engine
 * `position:'fill'` mode). The source file carries no CodeOps/Turbo-Vision provenance in its comments
 * and stays within the file-size budget.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ui from '@jsvision/ui';
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
  type Flex,
  type Placement,
} from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));

// ST-16 — every DSL value symbol is importable from `@jsvision/ui` as a function.
test('ST-16: col/row/stack/grow/fixed/spacer/place/centered/corner helpers are exported functions', () => {
  for (const fn of [col, row, stack, grow, fixed, spacer, place, centered, topRight, bottomRight, topLeft]) {
    expect(typeof fn).toBe('function');
  }
});

// ST-16 — the `Flex` and `Placement` types are on the public surface (type-only usage compiles).
test('ST-16: Flex and Placement are exported types', () => {
  const flex: Flex = { grow: 1, background: 'window' };
  const placement: Placement = { h: 'end', v: 'start', width: 4, height: 1 };
  expect(flex.grow).toBe(1);
  expect(placement.h).toBe('end');
});

// ST-16 — there is NO standalone `fill` export (it was dropped in favor of `grow`).
test('ST-16: no standalone `fill` helper is exported', () => {
  expect((ui as Record<string, unknown>).fill).toBeUndefined();
});

// ST-16 — the DSL source carries no CodeOps process IDs or Turbo-Vision/C++ provenance in its
// comments (the directive is comment-scoped, so extract the comments before grepping — a property
// access like `p.h` is code, not provenance).
test('ST-16: dsl.ts comments contain no banned CodeOps/TV references', () => {
  const source = readFileSync(join(here, '..', 'src', 'view', 'dsl.ts'), 'utf8');
  const comments = (source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g) ?? []).join('\n');
  const codeopsIds = /\b(?:RD|PA|AR|PF|HR|GATE|AC|ST|ADR|DEF|FR|RT|PL)-\d+/;
  const tvProvenance = /\b[\w.-]+\.(?:cpp|h)\b|getColor\s*\(|\bcp[A-Z][A-Za-z]{2,}\b|\bT[A-Z][A-Za-z]+::/;
  expect(codeopsIds.test(comments)).toBe(false);
  expect(tvProvenance.test(comments)).toBe(false);
});

// ST-16 — the DSL source stays within the file-size budget (≤ 500 lines).
test('ST-16: dsl.ts is within the 500-line budget', () => {
  const lines = readFileSync(join(here, '..', 'src', 'view', 'dsl.ts'), 'utf8').split('\n').length;
  expect(lines).toBeLessThanOrEqual(500);
});
