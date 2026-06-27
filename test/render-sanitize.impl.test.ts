/**
 * Implementation tests — sanitizer edge cases (RD-04, PL-2/PL-16).
 *
 * Both String Terminator forms, tab/newline preservation, the empty string,
 * and multibyte pass-through. Complements the ST-14 spec oracle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sanitize } from '../src/engine/render/sanitize.js';

test('ST in single-byte C1 form (0x9c) is stripped', () => {
  assert.equal(sanitize('a\x9cb'), 'ab');
});

test('ST in two-byte ESC-backslash form is stripped whole', () => {
  assert.equal(sanitize('a\x1b\\b'), 'ab');
  assert.equal(sanitize('\x1b\\'), '');
});

test('a lone ESC drops only the ESC, keeping a following non-backslash', () => {
  assert.equal(sanitize('a\x1bXb'), 'aXb');
});

test('tab and newline are preserved; other C0 controls are stripped', () => {
  assert.equal(sanitize('a\tb\nc'), 'a\tb\nc');
  assert.equal(sanitize('a\x00\x01\x1f b'), 'a b');
});

test('the empty string sanitizes to the empty string', () => {
  assert.equal(sanitize(''), '');
});

test('multibyte and combining text passes through unchanged', () => {
  assert.equal(sanitize('café 世界 😀 é'), 'café 世界 😀 é');
});

test('the full C1 range 0x80–0x9f is stripped', () => {
  for (let cp = 0x80; cp <= 0x9f; cp += 1) {
    assert.equal(sanitize(`x${String.fromCodePoint(cp)}y`), 'xy', `U+00${cp.toString(16)}`);
  }
});
