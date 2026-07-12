#!/usr/bin/env node
/**
 * Sync the `@jsvision/core` runtime `VERSION` constant to its own package
 * manifest.
 *
 * Versioning is owned by `@blendsdk/lockstep`, which bumps every public
 * package manifest in lockstep but does not know about core's exported
 * `VERSION` constant. This script closes that gap: it rewrites
 * `packages/core/src/engine/version.ts` to match `packages/core/package.json#version`.
 *
 * `VERSION` is intentionally a static literal (not a runtime read of
 * `package.json`) so that `@jsvision/core` stays importable in the browser
 * runtime, where `node:fs`/`require` are stubbed — a load-time file read would
 * throw. The release workflow runs this right after `lockstep version`, so the
 * literal ships in step with the manifest. A specification test also asserts the
 * two match, so drift fails `yarn verify`.
 *
 * Usage:
 *   node scripts/sync-core-version.mjs            # write version.ts to match package.json
 *   node scripts/sync-core-version.mjs --check    # exit non-zero on mismatch, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const check = process.argv.slice(2).includes('--check');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');

const pkgPath = resolve(root, 'packages', 'core', 'package.json');
const versionFile = resolve(root, 'packages', 'core', 'src', 'engine', 'version.ts');

const target = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
if (typeof target !== 'string' || target.length === 0) {
  process.stderr.write(`sync-core-version: no version in ${pkgPath}\n`);
  process.exit(1);
}

const src = readFileSync(versionFile, 'utf8');
const next = src.replace(/(export const VERSION\s*=\s*)['"][^'"]*['"]/, `$1'${target}'`);
if (next === src && !/export const VERSION\s*=/.test(src)) {
  process.stderr.write(`sync-core-version: no VERSION constant found in ${versionFile}\n`);
  process.exit(1);
}

const current = src.match(/export const VERSION\s*=\s*['"]([^'"]*)['"]/)?.[1];

if (check) {
  if (current !== target) {
    process.stderr.write(`sync-core-version --check: version.ts is '${current}', package.json is '${target}'.\n`);
    process.exit(1);
  }
  process.stdout.write(`sync-core-version --check: VERSION matches package.json (${target}).\n`);
  process.exit(0);
}

if (next !== src) {
  writeFileSync(versionFile, next);
  process.stdout.write(`sync-core-version: set VERSION to ${target}.\n`);
} else {
  process.stdout.write(`sync-core-version: VERSION already ${target}.\n`);
}
process.exit(0);
