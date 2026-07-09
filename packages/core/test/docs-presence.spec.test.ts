/**
 * Techdocs output-presence guard.
 *
 * Specification oracle: the architecture overview, the API reference, at least
 * one ADR, and the architecture landing must all be present and committed, so
 * the docs set cannot silently rot or go uncommitted without `verify` noticing.
 * This mirrors how `gate.spec` guards the acceptance-gate doc. Pure file reads.
 *
 * The docs website (`@jsvision/docs-site`) absorbed the former repo-root `docs/`
 * techdocs into `packages/docs-site/reference/`, so this guard tracks them at
 * their new home. (The load-bearing `docs/acceptance-gate.md` stayed put and is
 * guarded separately by `gate.spec`.)
 */
import { test, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoPath } from './monorepo-root.js';

const reference = repoPath('packages', 'docs-site', 'reference');

test('the architecture overview is present', () => {
  expect(existsSync(join(reference, 'architecture', 'system-overview.md'))).toBeTruthy();
});

test('the API design reference is present', () => {
  expect(existsSync(join(reference, 'architecture', 'api-design.md'))).toBeTruthy();
});

test('at least one ADR is present', () => {
  const adrs = readdirSync(join(reference, 'decisions')).filter((f) => /^ADR-\d+.*\.md$/.test(f));
  expect(adrs.length >= 1).toBeTruthy();
});

test('the architecture landing is present', () => {
  expect(existsSync(join(reference, 'architecture', 'index.md'))).toBeTruthy();
});
