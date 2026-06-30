/**
 * Specification tests (immutable oracle) — RD-06 validators (03-04).
 *
 * Source: jsvision-ui RD-06 AC-5 → ST-07 (essential-controls/07-testing-strategy.md), corrected by
 * PA-15 to the TV source. TV: `tvalidat.cpp:610-807` (`TFilterValidator`/`TRangeValidator`/
 * `TStringLookupValidator`) + `tvtext2.cpp:144-145` (`validUnsignedChars = "+0123456789"`,
 * `validSignedChars = "+-0123456789"`). `isValidInput` is the transient per-keystroke gate (allows
 * partials); `isValid` is the blocking on-completion gate. Expectations derive from the TV source.
 */
import { test, expect } from 'vitest';
import { filter, range, lookup } from '../src/controls/index.js';

// ST-07 — filter: every char of the candidate must be in the allowed set (same test for both gates).
test('ST-07: filter(chars) accepts only candidates whose chars are all in the set', () => {
  const digits = filter('0-9');
  expect(digits.isValidInput('5')).toBe(true);
  expect(digits.isValidInput('a')).toBe(false);
  expect(digits.isValid('123')).toBe(true);
  expect(digits.isValid('12a')).toBe(false);

  // Range-spec expansion: '0-9A-Za-z ' covers digits, both letter cases, and a literal space.
  const alnum = filter('0-9A-Za-z ');
  expect(alnum.isValidInput('Hello World 42')).toBe(true);
  expect(alnum.isValidInput('no_underscore')).toBe(false);
});

// ST-07 — range (unsigned): transient digit/sign filter (partials allowed); blocking parse + bounds.
test('ST-07: range(0,100) — unsigned: isValidInput digit/+ filter, isValid parses + bounds-checks', () => {
  const r = range(0, 100);
  expect(r.isValidInput('1')).toBe(true);
  expect(r.isValidInput('+')).toBe(true); // unsigned validChars = "+0123456789"
  expect(r.isValidInput('-')).toBe(false); // PA-15: '-' is a signed-only char
  expect(r.isValidInput('')).toBe(true); // partial allowed mid-edit
  expect(r.isValid('150')).toBe(false); // above max
  expect(r.isValid('50')).toBe(true);
  expect(r.isValid('')).toBe(false); // blocking: empty is not a number
});

// ST-07 — range (signed): a min<0 range admits a leading '-' in the transient filter.
test('ST-07: range(-50,50) — signed: isValidInput admits a leading -', () => {
  const r = range(-50, 50);
  expect(r.isValidInput('-')).toBe(true); // signed validChars = "+-0123456789"
  expect(r.isValid('-25')).toBe(true);
  expect(r.isValid('-75')).toBe(false); // below min
});

// ST-07 — lookup: no per-keystroke filtering; blocking exact membership on completion.
test('ST-07: lookup(list) — isValidInput always true, isValid exact membership', () => {
  const l = lookup(['red', 'green', 'blue']);
  expect(l.isValidInput('x')).toBe(true);
  expect(l.isValidInput('anything')).toBe(true);
  expect(l.isValid('blue')).toBe(true);
  expect(l.isValid('red')).toBe(true);
  expect(l.isValid('purple')).toBe(false);
});
