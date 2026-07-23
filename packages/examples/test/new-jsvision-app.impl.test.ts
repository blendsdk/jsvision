import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

import {
  buildAppFiles,
  detectPackageManager,
  writeApp,
} from '../../../plugins/jsvision-plugin/skills/jsvision-new-app/new-jsvision-app.mjs';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'jsvision-generator-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('should produce byte-identical output when invoked twice', () => {
  expect([...buildAppFiles('demo', 'grid')]).toEqual([...buildAppFiles('demo', 'grid')]);
});

test('should detect the packageManager field before lockfiles', () => {
  const directory = temporaryDirectory();
  writeFileSync(join(directory, 'package.json'), '{"packageManager":"pnpm@10.0.0"}');
  writeFileSync(join(directory, 'package-lock.json'), '');
  expect(detectPackageManager(directory)).toBe('pnpm');
});

test('should return null when multiple lockfiles make detection ambiguous', () => {
  const directory = temporaryDirectory();
  writeFileSync(join(directory, 'yarn.lock'), '');
  writeFileSync(join(directory, 'package-lock.json'), '');
  expect(detectPackageManager(directory)).toBeNull();
});

test('should detect each supported unambiguous lockfile', () => {
  for (const [manager, lockfile] of [
    ['npm', 'package-lock.json'],
    ['yarn', 'yarn.lock'],
    ['pnpm', 'pnpm-lock.yaml'],
    ['bun', 'bun.lock'],
  ] as const) {
    const directory = temporaryDirectory();
    writeFileSync(join(directory, lockfile), '');
    expect(detectPackageManager(directory)).toBe(manager);
  }
});

test('should refuse to overwrite an existing destination', () => {
  const root = temporaryDirectory();
  mkdirSync(join(root, 'demo'));
  writeFileSync(join(root, 'demo', 'keep.txt'), 'user content');
  expect(() => writeApp('demo', { root })).toThrow(/not empty/);
});
