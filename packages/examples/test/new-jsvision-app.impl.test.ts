// Implementation tests for the jsvision-new-app generator: name normalization edge cases, the
// no-overwrite guard, the publish-agnostic dependency seam, determinism, and write path-safety.
// These complement the ST-1…ST-6 specification oracle in new-jsvision-app.spec.test.ts.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  buildAppFiles,
  slugify,
  uiDependency,
  writeApp,
} from '../../../tools/claude-plugin/skills/jsvision-new-app/scripts/new-jsvision-app.mjs';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jsvision-scaffold-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test('slugify collapses whitespace, underscores, and repeated dashes', () => {
  expect(slugify('  spaced   out  ')).toBe('spaced-out');
  expect(slugify('__foo__bar__')).toBe('foo-bar');
  expect(slugify('a---b')).toBe('a-b');
  expect(slugify('Hello World 2')).toBe('hello-world-2');
});

test('slugify trims leading/trailing dashes and strips non-slug characters', () => {
  expect(slugify('-lead-')).toBe('lead');
  expect(slugify('!!!weird!!!')).toBe('weird');
  // Accented letters have no ASCII slug form and are dropped, not transliterated.
  expect(slugify('Café')).toBe('caf');
});

test('slugify throws on names that would normalize to nothing usable', () => {
  expect(() => slugify('!!!')).toThrow();
  expect(() => slugify('   ')).toThrow();
});

test('uiDependency is the single @jsvision/ui seam used by the generated package.json', () => {
  const pkg = JSON.parse(buildAppFiles('todo').get('packages/todo/package.json') as string);
  expect(pkg.dependencies['@jsvision/ui']).toBe(uiDependency());
  // The workspace form resolves @jsvision/ui inside the monorepo today.
  expect(uiDependency()).toBe('*');
  // It is the only runtime dependency the skeleton declares.
  expect(Object.keys(pkg.dependencies)).toEqual(['@jsvision/ui']);
});

test('buildAppFiles is deterministic and the smoke test filename tracks the slug', () => {
  const a = buildAppFiles('my-thing');
  const b = buildAppFiles('my-thing');
  expect([...a.entries()]).toEqual([...b.entries()]);
  expect(a.has('packages/my-thing/test/my-thing.smoke.test.ts')).toBe(true);
});

test('writeApp materializes the package and reports the chosen slug', () => {
  const result = writeApp('My App', { root });
  expect(result.slug).toBe('my-app');
  expect(result.dir).toBe('packages/my-app');
  expect(existsSync(join(root, 'packages/my-app/src/main.ts'))).toBe(true);
  const pkg = JSON.parse(readFileSync(join(root, 'packages/my-app/package.json'), 'utf8'));
  expect(pkg.name).toBe('@jsvision/my-app');
});

test('writeApp refuses to overwrite an existing package', () => {
  mkdirSync(join(root, 'packages/todo'), { recursive: true });
  expect(() => writeApp('todo', { root })).toThrow(/already exists/);
});

test('writeApp rejects unsafe names before writing anything', () => {
  for (const evil of ['../evil', 'a/b', '/abs', '']) {
    expect(() => writeApp(evil, { root })).toThrow();
  }
  // Nothing was created under the temp root.
  expect(existsSync(join(root, 'packages'))).toBe(false);
});
