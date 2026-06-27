/**
 * Implementation tests — dependency-policy guard edge cases (RD-01, Session 2.3).
 *
 * Exercises the guard's internal decisions beyond the ST oracle: a missing
 * `dependencies` key, a benign install script (allowed), and `os`/`cpu`
 * platform constraints (rejected as native). Real fixtures, real process runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // test/
const repoRoot = resolve(here, '..');
const guardScript = resolve(repoRoot, 'scripts/check-no-native-deps.mjs');

/** Run the guard against a project root and return its exit status + output. */
function runGuard(rootDir: string): { status: number | null; output: string } {
  const res = spawnSync(process.execPath, [guardScript, rootDir], { encoding: 'utf8' });
  return { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

/** Write a project fixture with the given manifest and optional installed dep. */
function fixtureProject(
  manifest: Record<string, unknown>,
  dep?: { name: string; manifest: Record<string, unknown> },
): string {
  const dir = mkdtempSync(join(tmpdir(), 'rd01-guard-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  if (dep) {
    const depDir = join(dir, 'node_modules', dep.name);
    mkdirSync(depDir, { recursive: true });
    writeFileSync(join(depDir, 'package.json'), JSON.stringify(dep.manifest));
  }
  return dir;
}

test('guard exits 0 when the dependencies key is absent', () => {
  const dir = fixtureProject({ name: 'fixture', version: '1.0.0' });
  try {
    assert.equal(runGuard(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('guard allows a benign install script that is not a native build', () => {
  const dir = fixtureProject(
    { name: 'fixture', version: '1.0.0', dependencies: { benign: '1.0.0' } },
    { name: 'benign', manifest: { name: 'benign', version: '1.0.0', scripts: { postinstall: 'echo thanks' } } },
  );
  try {
    assert.equal(runGuard(dir).status, 0, 'a non-native postinstall must be allowed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('guard rejects a dependency with a cpu constraint', () => {
  const dir = fixtureProject(
    { name: 'fixture', version: '1.0.0', dependencies: { archdep: '1.0.0' } },
    { name: 'archdep', manifest: { name: 'archdep', version: '1.0.0', cpu: ['x64'] } },
  );
  try {
    const res = runGuard(dir);
    assert.notEqual(res.status, 0);
    assert.ok(/archdep/.test(res.output), 'message must name the offending dependency');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('guard rejects a dependency with an os constraint', () => {
  const dir = fixtureProject(
    { name: 'fixture', version: '1.0.0', dependencies: { osdep: '1.0.0' } },
    { name: 'osdep', manifest: { name: 'osdep', version: '1.0.0', os: ['darwin'] } },
  );
  try {
    const res = runGuard(dir);
    assert.notEqual(res.status, 0);
    assert.ok(/osdep/.test(res.output), 'message must name the offending dependency');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('guard rejects a dependency that ships a node-gyp install script', () => {
  const dir = fixtureProject(
    { name: 'fixture', version: '1.0.0', dependencies: { gyplib: '1.0.0' } },
    { name: 'gyplib', manifest: { name: 'gyplib', version: '1.0.0', scripts: { install: 'node-gyp rebuild' } } },
  );
  try {
    const res = runGuard(dir);
    assert.notEqual(res.status, 0);
    assert.ok(/gyplib/.test(res.output), 'message must name the offending dependency');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
