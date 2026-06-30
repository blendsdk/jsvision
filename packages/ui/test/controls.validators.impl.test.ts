/**
 * Implementation tests — RD-06 validator edge cases (03-04).
 *
 * Signed-range leading `-`, the empty-string edge per validator (transient allows, blocking rejects),
 * the `range` parse of a non-numeric leftover (`'12x'`), and the degenerate empty set/list cases.
 */
import { test, expect } from 'vitest';
import { filter, range, lookup } from '../src/controls/index.js';

test('range(min<0) admits a leading - and bounds-checks the signed value', () => {
  const r = range(-50, 50);
  expect(r.isValidInput('-')).toBe(true);
  expect(r.isValidInput('-5')).toBe(true);
  expect(r.isValid('-50')).toBe(true); // at min
  expect(r.isValid('-51')).toBe(false); // below min
  expect(r.isValid('-')).toBe(false); // blocking: '-' alone is not an integer
});

test('empty-string edge: transient gates allow it, blocking gates reject (except filter membership)', () => {
  // filter: an empty string is vacuously all-in-set → valid for both gates.
  expect(filter('0-9').isValidInput('')).toBe(true);
  expect(filter('0-9').isValid('')).toBe(true);
  // range: partial-allowed for input, but empty is not a number for the blocking gate.
  expect(range(0, 100).isValidInput('')).toBe(true);
  expect(range(0, 100).isValid('')).toBe(false);
  // lookup: input always allowed; empty is valid only if it is actually a member.
  expect(lookup(['red']).isValidInput('')).toBe(true);
  expect(lookup(['red']).isValid('')).toBe(false);
  expect(lookup(['']).isValid('')).toBe(true);
});

test('range rejects a non-numeric leftover (12x) at both gates', () => {
  const r = range(0, 100);
  expect(r.isValidInput('12x')).toBe(false); // 'x' is not in the digit/sign set
  expect(r.isValid('12x')).toBe(false); // not a clean integer
});

test('degenerate sets: filter("") rejects all non-empty input; lookup([]) is never valid', () => {
  expect(filter('').isValidInput('')).toBe(true);
  expect(filter('').isValidInput('a')).toBe(false);
  expect(lookup([]).isValid('anything')).toBe(false);
});

test('expandCharSet edge: a trailing - is literal', () => {
  const f = filter('0-9-'); // digits plus a literal hyphen
  expect(f.isValidInput('5-5')).toBe(true);
  expect(f.isValidInput('a')).toBe(false);
});
