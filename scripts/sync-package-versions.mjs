#!/usr/bin/env node
/**
 * Sync release-derived version literals to their package manifests.
 *
 * Versioning is owned by `@blendsdk/lockstep`, which bumps every public package
 * manifest in lockstep but does not know about the `VERSION` constants those packages
 * export or the package version pinned in the installation guide. This script closes
 * that gap by rewriting each derived literal from its owning `package.json#version`.
 *
 * Each `VERSION` is intentionally a static literal (not a runtime read of `package.json`)
 * so the package stays importable in the browser runtime, where `node:fs`/`require` are
 * stubbed — a load-time file read would throw. The release workflow runs this right after
 * `lockstep version`, so the literals ship in step with the manifests. A specification
 * test per package also asserts the two match, so drift fails `yarn verify`.
 *
 * To cover a new runtime constant, add a `{ pkg, versionFile }` entry to
 * `VERSION_CONSTANT_TARGETS` below. Documentation literals belong in
 * `DOCUMENTATION_TARGETS` so the published guide always teaches the release being made.
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
const VERSION_CONSTANT_TARGETS = [
  { pkg: 'packages/core/package.json', versionFile: 'packages/core/src/engine/version.ts' },
  { pkg: 'packages/ui/package.json', versionFile: 'packages/ui/src/version.ts' },
];

const VERSION_RE = /export const VERSION\s*=\s*['"]([^'"]*)['"]/;
const DOCUMENTATION_TARGETS = [
  {
    pkg: 'packages/ui/package.json',
    documentationFile: 'packages/docs-site/guide/install-and-packages.md',
    versionPattern: /("@jsvision\/ui"\s*:\s*"\^)([^"]+)(")/,
  },
];

let mismatch = false;

for (const { pkg, versionFile } of VERSION_CONSTANT_TARGETS) {
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

for (const { pkg, documentationFile, versionPattern } of DOCUMENTATION_TARGETS) {
  const pkgPath = resolve(root, pkg);
  const documentationPath = resolve(root, documentationFile);
  const target = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  if (typeof target !== 'string' || target.length === 0) {
    process.stderr.write(`sync-package-versions: no version in ${pkgPath}\n`);
    process.exit(1);
  }

  const source = readFileSync(documentationPath, 'utf8');
  const current = source.match(versionPattern)?.[2];
  if (current === undefined) {
    process.stderr.write(`sync-package-versions: no package version found in ${documentationPath}\n`);
    process.exit(1);
  }

  if (check) {
    if (current !== target) {
      process.stderr.write(
        `sync-package-versions --check: ${documentationFile} uses '${current}', ${pkg} is '${target}'.\n`,
      );
      mismatch = true;
    } else {
      process.stdout.write(`sync-package-versions --check: ${documentationFile} matches (${target}).\n`);
    }
    continue;
  }

  const next = source.replace(versionPattern, (_match, prefix, _currentVersion, suffix) => {
    return `${prefix}${target}${suffix}`;
  });
  if (next !== source) {
    writeFileSync(documentationPath, next);
    process.stdout.write(`sync-package-versions: set ${documentationFile} package version to ${target}.\n`);
  } else {
    process.stdout.write(`sync-package-versions: ${documentationFile} already matches (${target}).\n`);
  }
}

process.exit(mismatch ? 1 : 0);
