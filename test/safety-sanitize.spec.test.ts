/**
 * Specification tests — the canonical RD-08 output sanitizer (the SDK's primary
 * injection boundary).
 *
 * Immutable oracle: expectations derive from RD-08 §Sanitizer rule and the
 * acceptance criteria (AC-3/AC-8) via ST-9…ST-13 in plan doc 07-testing-strategy
 * — never from reading the implementation. If a case fails after the relocation,
 * the relocation is wrong (AR-13), not the test.
 *
 * Imports from the relocated canonical home `safety/sanitize.js`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sanitize } from '../src/engine/safety/sanitize.js';

// ST-9 — an embedded OSC-injection attempt has its control bytes stripped (AC-3).
test('ST-9: strips ESC and BEL from an OSC-injection attempt', () => {
  const out = sanitize('a\x1b]0;x\x07b');
  assert.ok(!out.includes('\x1b'), 'no ESC remains');
  assert.ok(!out.includes('\x07'), 'no BEL remains');
  assert.equal(out, 'a]0;xb');
});

// ST-10 — printable UTF-8 (incl. astral), tab, and newline pass through (AC-3).
test('ST-10: preserves UTF-8, astral, tab, and newline unchanged', () => {
  assert.equal(sanitize('café\tline\n😀'), 'café\tline\n😀');
});

// ST-11 — the two-byte `ESC \` String Terminator is removed whole.
test('ST-11: removes both bytes of the ESC-backslash String Terminator', () => {
  assert.equal(sanitize('x\x1b\\y'), 'xy');
});

// ST-12 — each control class is stripped: BEL, single-byte ST, a C0, a C1 (AC-8).
test('ST-12: strips BEL, single-byte ST, a C0, and a C1 control byte', () => {
  assert.ok(!sanitize('a\x07b').includes('\x07'), 'BEL (0x07)');
  assert.ok(!sanitize('a\x9cb').includes('\x9c'), 'ST (0x9c)');
  assert.ok(!sanitize('a\x01b').includes('\x01'), 'C0 (0x01)');
  assert.ok(!sanitize('a\x85b').includes('\x85'), 'C1 (0x85)');
});

// ST-13 — empty and all-control inputs collapse to the empty string (AC-8).
test('ST-13: empty and all-control inputs collapse to the empty string', () => {
  assert.equal(sanitize(''), '');
  assert.equal(sanitize('\x1b\x1b\x1b'), '');
});
