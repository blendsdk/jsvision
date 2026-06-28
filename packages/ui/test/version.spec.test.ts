/**
 * Specification test (immutable oracle): the runtime `VERSION` constant MUST
 * equal the package manifest version, so a release bump can never silently
 * desync the constant from `package.json`.
 *
 * Traceability: lockstep-versioning policy (the monorepo root is the source of
 * truth for public packages; this stub mirrors the contract locally).
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VERSION } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url)); // test/
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
  version: string;
};

test('VERSION matches package.json#version', () => {
  expect(VERSION).toBe(pkg.version);
});
