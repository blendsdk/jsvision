/**
 * Specification tests (immutable oracles) — RD-06 controls packaging (03-07).
 *
 * Source: jsvision-ui RD-06 AC-11 → ST-13 (essential-controls/07-testing-strategy.md). The controls
 * live in `src/controls/` with explicit named re-exports from `src/index.ts` (imported here BY NAME
 * from `@jsvision/ui`, the published surface), the package declares zero native runtime deps, and each
 * control source file is ≤ 500 lines. Expectations derive from the acceptance criteria + PA-4.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  Text,
  Label,
  Button,
  Input,
  CheckGroup,
  RadioGroup,
  filter,
  range,
  lookup,
  signal,
  type Validator,
  type ButtonOptions,
  type InputOptions,
} from '@jsvision/ui';

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

// ST-13 / AC-11 — every control is a named export of `@jsvision/ui`.
test('ST-13: controls + validators are importable by name from @jsvision/ui', () => {
  for (const ctor of [Text, Label, Button, Input, CheckGroup, RadioGroup]) {
    expect(ctor).toBeTypeOf('function');
  }
  for (const fn of [filter, range, lookup]) {
    expect(fn).toBeTypeOf('function');
  }
  // Type-only usage — fails to typecheck if a type is missing from the public surface.
  const v: Validator = filter('0-9');
  const bo: ButtonOptions = { command: 'ok' };
  const io: InputOptions = { value: signal('') };
  expect(v.isValidInput('5')).toBe(true);
  expect(bo.command).toBe('ok');
  expect(typeof io.value).toBe('function');
});

// ST-13 / PA-4 — each control source file is ≤ 500 lines (architecture boundary).
test('ST-13: each src/controls file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'controls');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

// ST-13 / AC-11 — the package declares no third-party/native runtime dependency (only the workspace
// JS engine `@jsvision/core`); the `check:deps` gate enforces the native-dep ban in CI.
test('ST-13: @jsvision/ui declares only the workspace @jsvision/core runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});
