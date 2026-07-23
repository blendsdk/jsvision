// The consumer generator creates a standalone, safe, latest-stable JSVision project.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

import {
  buildAppFiles,
  listArchetypes,
  slugify,
  writeApp,
} from '../../../plugins/jsvision-plugin/skills/jsvision-new-app/new-jsvision-app.mjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('should create a standalone latest-stable project when given a safe name', () => {
  const files = buildAppFiles('Inventory Desk');
  expect([...files.keys()].sort()).toEqual([
    'package.json',
    'src/main.ts',
    'test/inventory-desk.smoke.test.ts',
    'tsconfig.json',
    'vitest.config.ts',
  ]);
  const manifest = JSON.parse(files.get('package.json') as string);
  expect(manifest.name).toBe('inventory-desk');
  expect(manifest.type).toBe('module');
  expect(manifest.dependencies['@jsvision/ui']).toBe('1.0.0');
  expect(manifest.devDependencies.typescript).toBeDefined();
  expect(files.get('src/main.ts')).toContain('export function buildApp');
});

test('should reject traversal and separators before producing project files', () => {
  for (const unsafeName of ['', '../escape', 'nested/app', 'nested\\app', '/absolute']) {
    expect(() => buildAppFiles(unsafeName)).toThrow();
  }
});

test('should write to a new subdirectory by default', () => {
  const root = mkdtempSync(join(tmpdir(), 'jsvision-consumer-'));
  temporaryDirectories.push(root);
  const result = writeApp('Inventory Desk', { root });
  expect(result.dir).toBe(join(root, 'inventory-desk'));
  expect(JSON.parse(readFileSync(join(result.dir, 'package.json'), 'utf8')).name).toBe('inventory-desk');
});

test('should refuse a non-empty current directory even when current-directory mode is requested', () => {
  const root = mkdtempSync(join(tmpdir(), 'jsvision-consumer-'));
  temporaryDirectories.push(root);
  writeFileSync(join(root, 'existing.txt'), 'preserve me');
  expect(() => writeApp('Inventory Desk', { root, currentDir: true })).toThrow(/not empty/);
});

test('should provide all documented starter archetypes', () => {
  expect(listArchetypes().map(({ name }) => name)).toEqual(['basic', 'dashboard', 'form', 'grid']);
});

test('should generate every archetype without unresolved template tokens', () => {
  for (const { name } of listArchetypes()) {
    const files = buildAppFiles('demo', name);
    expect(files.get('src/main.ts')).not.toContain('__SLUG__');
    expect(files.get('src/main.ts')).toContain('export function buildApp');
  }
});

test('should normalize human-readable names to safe package names', () => {
  expect(slugify('  Inventory__Desk  ')).toBe('inventory-desk');
});
