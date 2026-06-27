/**
 * Implementation tests — CLI arg parser internals (RD-03, plan doc 03-02).
 *
 * Edge cases beyond the ST oracle: usage text, combined flags, a flag-like value
 * after --out, and last-wins for a repeated --out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, USAGE } from '../examples/capability-probe/args.js';

test('USAGE documents every flag', () => {
  for (const flag of ['--auto', '--out', '--no-matrix', '--help']) {
    assert.ok(USAGE.includes(flag), `usage mentions ${flag}`);
  }
});

test('combined flags parse together', () => {
  const result = parseArgs(['--auto', '--no-matrix', '--out', 'f.json']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.args, { auto: true, out: 'f.json', matrix: false, help: false });
});

test('--out followed by another flag is an error (missing value)', () => {
  const result = parseArgs(['--out', '--auto']);
  assert.equal(result.ok, false);
});

test('a repeated --out keeps the last value', () => {
  const result = parseArgs(['--out', 'a.json', '--out', 'b.json']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.args.out, 'b.json');
});
