/**
 * Specification test (immutable oracle) — `@jsvision/web` packaging (ST-1, ST-12).
 *
 * ST-1: `yarn workspace @jsvision/web build` (run by turbo before `test`) emits the three dist
 * artifacts — `dist/index.js`, `dist/index.d.ts`, and the standalone `dist/browser-stubs.js`.
 * ST-12: the `@jsvision/web/browser-stubs` subpath resolves and each stub **throws** when invoked; the
 * `.` barrel does **not** re-export the stubs (importing the package never drags the throwing native
 * placeholders into a consumer's graph); and `package.json#version` tracks the lockstepped root
 * version (the release tool bumps every package together, so this private package equals the root).
 *
 * The full barrel-symbol presence assertion (every public export is reachable from `@jsvision/web`)
 * lands in Phase 5 once all modules exist. `.js` specifiers per NodeNext.
 */
import { test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as web from '@jsvision/web';
import * as stubs from '@jsvision/web/browser-stubs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

// ST-1 — the build emits the barrel + the standalone browser-stubs entry.
test('ST-1: build emits dist/index.js, dist/index.d.ts, dist/browser-stubs.js', () => {
  for (const rel of ['dist/index.js', 'dist/index.d.ts', 'dist/browser-stubs.js']) {
    expect(existsSync(join(pkgRoot, rel)), rel).toBe(true);
  }
});

// ST-12 — every node-builtin stub is a loud, throwing placeholder (a call means the app reached a
// native facility that does not exist in the browser).
test('ST-12: each browser-stub throws when invoked', () => {
  expect(() => stubs.writeSync()).toThrow();
  expect(() => stubs.openSync()).toThrow();
  expect(() => stubs.closeSync()).toThrow();
  expect(() => new stubs.ReadStream()).toThrow();
  expect(() => new stubs.WriteStream()).toThrow();
});

// ST-12 — the `.` barrel never re-exports the stubs, so `import '@jsvision/web'` stays stub-free.
test('ST-12: the barrel does not re-export the node-builtin stubs', () => {
  const barrel = web as Record<string, unknown>;
  for (const name of ['writeSync', 'openSync', 'closeSync', 'ReadStream', 'WriteStream']) {
    expect(barrel[name], name).toBeUndefined();
  }
});

// ST-12 (full) — every planned public runtime symbol is reachable from the `.` barrel.
test('ST-12: the barrel exposes every public runtime symbol', () => {
  const barrel = web as Record<string, unknown>;
  for (const name of [
    'createBrowserHost',
    'buildBrowserCaps',
    'mountApp',
    'createBrowserFileSystem',
    'attachKeyReclaim',
    'setClipboard',
  ]) {
    expect(typeof barrel[name], name).toBe('function');
  }
  expect(Array.isArray(barrel.UNRECLAIMABLE_CHORDS)).toBe(true);
});

// ST-12 — this private package is lockstepped to the monorepo root version (the release tool bumps
// every package together), so its version always equals the root's — no hardcoded literal to go stale.
test('ST-12: package.json version matches the lockstepped root version', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as { version?: string };
  const root = JSON.parse(readFileSync(join(pkgRoot, '..', '..', 'package.json'), 'utf8')) as {
    version?: string;
  };
  expect(pkg.version).toBeTruthy();
  expect(pkg.version).toBe(root.version);
});
