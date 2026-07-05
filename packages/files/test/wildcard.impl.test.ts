/**
 * Implementation test (edge/internal coverage) — `isWild` / `wildcardMatch` (`src/fs/wildcard.js`).
 * Exercises the `*.*`→`*` collapse, `?` single-char semantics, greedy `*` (incl. matching an empty
 * span mid-pattern), multi-wildcard backtracking, case-sensitivity, and the fully-consumed edges —
 * all derived from the recursive matcher in the source. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { isWild, wildcardMatch } from '../src/fs/wildcard.js';

test('impl: isWild edge patterns — literal, empty, and pure-wildcard tokens', () => {
  expect(isWild('a')).toBe(false);
  expect(isWild('..')).toBe(false);
  expect(isWild('.')).toBe(false);
  expect(isWild('?')).toBe(true);
  expect(isWild('*')).toBe(true);
  expect(isWild('a.b*c')).toBe(true);
  expect(isWild('a?')).toBe(true);
});

test('impl: "*.*" collapses to "*" — equivalent for every candidate', () => {
  for (const name of ['', 'a', 'a.b', 'readme', 'x.y.z', '.dotfile']) {
    expect(wildcardMatch('*.*', name)).toBe(wildcardMatch('*', name));
    expect(wildcardMatch('*.*', name)).toBe(true); // "*" matches everything
  }
});

test('impl: ? matches exactly one char at any position', () => {
  expect(wildcardMatch('?', 'a')).toBe(true);
  expect(wildcardMatch('?', '')).toBe(false); // needs a char
  expect(wildcardMatch('?', 'ab')).toBe(false); // exactly one
  expect(wildcardMatch('???', 'abc')).toBe(true);
  expect(wildcardMatch('???', 'ab')).toBe(false);
  expect(wildcardMatch('a?c?e', 'abcde')).toBe(true);
  expect(wildcardMatch('?bc', 'abc')).toBe(true); // leading ?
});

test('impl: * matches an empty span mid-pattern and backtracks across multiple stars', () => {
  expect(wildcardMatch('a*b', 'ab')).toBe(true); // star matches zero chars
  expect(wildcardMatch('a*b*c', 'abc')).toBe(true); // two empty spans
  expect(wildcardMatch('a*c*e', 'abcde')).toBe(true); // non-empty spans, greedy backtrack
  expect(wildcardMatch('*a*', 'xxaxx')).toBe(true);
  expect(wildcardMatch('*a*', 'xxxx')).toBe(false);
  expect(wildcardMatch('a*a', 'aXa')).toBe(true);
  expect(wildcardMatch('a*a', 'a')).toBe(false); // second literal 'a' has no char
});

test('impl: no-wildcard exact, case-sensitive, both sides fully consumed', () => {
  expect(wildcardMatch('readme.txt', 'readme.txt')).toBe(true);
  expect(wildcardMatch('readme.txt', 'readme.tx')).toBe(false); // name shorter
  expect(wildcardMatch('readme.tx', 'readme.txt')).toBe(false); // name longer
  expect(wildcardMatch('ABC', 'abc')).toBe(false); // case-sensitive
  expect(wildcardMatch('Abc', 'Abc')).toBe(true);
});

test('impl: trailing * matches the remainder incl. empty; combined ?/* patterns', () => {
  expect(wildcardMatch('src*', 'src')).toBe(true); // trailing star, empty remainder
  expect(wildcardMatch('src*', 'src/deep')).toBe(true);
  expect(wildcardMatch('*.ts', '.ts')).toBe(true); // star matches empty prefix
  expect(wildcardMatch('?*', 'a')).toBe(true); // one char then anything
  expect(wildcardMatch('?*', '')).toBe(false); // ? still needs a char
});
