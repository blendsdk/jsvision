/**
 * Specification tests — CLI arg parser (RD-03, plan doc 03-02).
 *
 * Oracle source: 07-testing-strategy.md ST-1…ST-7 (CLI surface, AR-7). Expectations
 * derive from the requirements' CLI table, not from the implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../examples/capability-probe/args.js';

// ST-1: defaults.
test('ST-1: no flags yields the default options', () => {
  const result = parseArgs([]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.args, { auto: false, out: null, matrix: true, help: false });
});

// ST-2: --auto.
test('ST-2: --auto sets auto', () => {
  const result = parseArgs(['--auto']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.args.auto, true);
});

// ST-3: --out <path>.
test('ST-3: --out captures the path', () => {
  const result = parseArgs(['--out', 'r.json']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.args.out, 'r.json');
});

// ST-4: --no-matrix.
test('ST-4: --no-matrix disables the matrix append', () => {
  const result = parseArgs(['--no-matrix']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.args.matrix, false);
});

// ST-5: --help.
test('ST-5: --help sets help', () => {
  const result = parseArgs(['--help']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.args.help, true);
});

// ST-6: unknown flag is an error.
test('ST-6: an unknown flag yields an error result', () => {
  const result = parseArgs(['--bogus']);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.error.length > 0, 'error message is non-empty');
});

// ST-7: --out without a value is an error.
test('ST-7: --out without a value yields an error result', () => {
  const result = parseArgs(['--out']);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.error.length > 0, 'error message is non-empty');
});
