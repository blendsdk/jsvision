/**
 * Specification test (immutable oracle) — the wildcard matcher (ST-2, AC-2).
 *
 * TV decode: `FindFirstRec::wildcardMatch` (`source/platform/findfrst.cpp:173-186`) — `?` = exactly one
 * char, `*` = greedy zero-or-more (a trailing `*` matches the rest), any other char = **exact
 * case-sensitive** byte compare; both pattern and name must be fully consumed. `isWild` = `strpbrk(f,
 * "?*") != NULL`. The `"*.*"` special case collapses to `"*"` so it matches extensionless names
 * (03-01). Case-sensitivity is retained cross-platform (PA/AR-243). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { isWild, wildcardMatch } from '../src/fs/wildcard.js';

test('ST-2: isWild is true iff the pattern contains * or ?', () => {
  expect(isWild('*.ts')).toBe(true);
  expect(isWild('a?c')).toBe(true);
  expect(isWild('*')).toBe(true);
  expect(isWild('readme.txt')).toBe(false);
  expect(isWild('')).toBe(false);
});

test('ST-2: ? matches exactly one character', () => {
  expect(wildcardMatch('a?c', 'abc')).toBe(true);
  expect(wildcardMatch('a?c', 'ac')).toBe(false); // ? needs a char
  expect(wildcardMatch('a?c', 'abbc')).toBe(false); // ? is exactly one
});

test('ST-2: * matches greedily (zero or more), incl. a trailing *', () => {
  expect(wildcardMatch('a*', 'abcdef')).toBe(true);
  expect(wildcardMatch('a*', 'a')).toBe(true); // zero chars
  expect(wildcardMatch('*z', 'xyz')).toBe(true);
  expect(wildcardMatch('*z', 'xya')).toBe(false);
  expect(wildcardMatch('foo*', 'foo')).toBe(true);
  expect(wildcardMatch('foo*', 'foobar')).toBe(true);
});

test('ST-2: non-wild chars compare exact and CASE-SENSITIVE (AR-243)', () => {
  expect(wildcardMatch('*.txt', 'readme.txt')).toBe(true);
  expect(wildcardMatch('*.TXT', 'readme.txt')).toBe(false); // case matters, cross-platform
  expect(wildcardMatch('abc', 'abc')).toBe(true);
  expect(wildcardMatch('abc', 'abd')).toBe(false);
});

test('ST-2: "*.*" collapses to "*" and matches extensionless names', () => {
  expect(wildcardMatch('*.*', 'readme')).toBe(true); // extensionless
  expect(wildcardMatch('*.*', 'a.b')).toBe(true);
  expect(wildcardMatch('*.*', '')).toBe(true);
});

test('ST-2: both pattern and name must be fully consumed (empty edges)', () => {
  expect(wildcardMatch('*', '')).toBe(true);
  expect(wildcardMatch('', '')).toBe(true);
  expect(wildcardMatch('', 'x')).toBe(false);
  expect(wildcardMatch('abc', 'ab')).toBe(false);
});
