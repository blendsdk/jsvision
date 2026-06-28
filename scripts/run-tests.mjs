#!/usr/bin/env node
/**
 * Cross-platform, Node-version-independent unit test runner.
 *
 * `node --test` only learned to expand glob patterns in Node 21, so the previous
 * brace-glob test script ("tsx --test test/...{spec,impl}.test.ts") failed on the
 * Node 18/20 CI cells ("Could not find …"). This script discovers the spec/impl
 * test files in pure Node (no glob dependency, works on every OS and Node version)
 * and hands the explicit file list to `tsx --test`. The heavier e2e files
 * (".e2e.test.ts") are deliberately excluded — they run explicitly (CI: POSIX only).
 *
 * Pure-Node ESM, mirroring `scripts/check-no-native-deps.mjs` / `scripts/gate.mjs`.
 * Exit code mirrors the test run (0 = all passed).
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const TEST_DIR = 'test';
/** Only the unit tiers — never the explicit `*.e2e.test.ts` files. */
const SUFFIXES = ['.spec.test.ts', '.impl.test.ts'];

/** Recursively collect spec/impl test files under a directory. */
function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collect(path));
    } else if (SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      found.push(path);
    }
  }
  return found;
}

const files = collect(TEST_DIR).sort();
if (files.length === 0) {
  process.stderr.write('run-tests: no *.spec.test.ts / *.impl.test.ts files found under test/\n');
  process.exit(1);
}

// `npx tsx` resolves the local tsx; shell hop needed for npm/npx on win32.
const result = spawnSync('npx', ['tsx', '--test', ...files], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
