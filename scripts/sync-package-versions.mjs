#!/usr/bin/env node
/**
 * Sync each package's exported runtime `VERSION` constant to its own package manifest.
 *
 * Versioning is owned by `@blendsdk/lockstep`, which bumps every public package
 * manifest in lockstep but does not know about the `VERSION` constants those packages
 * export. This script closes that gap: for each entry in `TARGETS` it rewrites the
 * source `version.ts` to match that package's `package.json#version`.
 *
 * Each `VERSION` is intentionally a static literal (not a runtime read of `package.json`)
 * so the package stays importable in the browser runtime, where `node:fs`/`require` are
 * stubbed — a load-time file read would throw. The release workflow runs this right after
 * `lockstep version`, so the literals ship in step with the manifests. A specification
 * test per package also asserts the two match, so drift fails `yarn verify`.
 *
 * To cover a new package, add a `{ pkg, versionFile }` entry to `TARGETS` below.
 *
 * Usage:
 *   node scripts/sync-package-versions.mjs            # write every version.ts to match its package.json
 *   node scripts/sync-package-versions.mjs --check    # exit non-zero on any mismatch, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const check = process.argv.slice(2).includes('--check');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');

// Every package that exports a static `VERSION` constant, as repo-root-relative paths.
const TARGETS = [
  { pkg: 'packages/core/package.json', versionFile: 'packages/core/src/engine/version.ts' },
  { pkg: 'packages/ui/package.json', versionFile: 'packages/ui/src/version.ts' },
];

const VERSION_RE = /export const VERSION\s*=\s*['"]([^'"]*)['"]/;

let mismatch = false;

for (const { pkg, versionFile } of TARGETS) {
  const pkgPath = resolve(root, pkg);
  const srcPath = resolve(root, versionFile);

  const target = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  if (typeof target !== 'string' || target.length === 0) {
    process.stderr.write(`sync-package-versions: no version in ${pkgPath}\n`);
    process.exit(1);
  }

  const src = readFileSync(srcPath, 'utf8');
  const current = src.match(VERSION_RE)?.[1];
  if (current === undefined) {
    process.stderr.write(`sync-package-versions: no VERSION constant found in ${srcPath}\n`);
    process.exit(1);
  }

  if (check) {
    // Report every drifting package (don't stop at the first) so one run surfaces all of them.
    if (current !== target) {
      process.stderr.write(`sync-package-versions --check: ${versionFile} is '${current}', ${pkg} is '${target}'.\n`);
      mismatch = true;
    } else {
      process.stdout.write(`sync-package-versions --check: ${pkg} VERSION matches (${target}).\n`);
    }
    continue;
  }

  const next = src.replace(VERSION_RE, `export const VERSION = '${target}'`);
  if (next !== src) {
    writeFileSync(srcPath, next);
    process.stdout.write(`sync-package-versions: set ${versionFile} VERSION to ${target}.\n`);
  } else {
    process.stdout.write(`sync-package-versions: ${versionFile} VERSION already ${target}.\n`);
  }
}

process.exit(mismatch ? 1 : 0);
