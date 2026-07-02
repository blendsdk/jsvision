/**
 * Specification tests (immutable oracles) — RD-07 `picture(mask)` validator (ST-07…ST-10).
 *
 * Source: jsvision-ui RD-07 AC-6/AC-7/AC-8 → ST-07…ST-10 (essential-control-completions/07). TV source:
 * `TPXPictureValidator` (`tvalidat.cpp`): `isValidInput`/`isValid` (`:149-162`), specials (`scan`,
 * `:371-463`), autoFill (`:572-585`), syntaxCheck + PA-2 bounds (`:519-550`). Expectations derive from
 * the TV semantics + the RD ACs, never from the implementation; the C++ outranks a mis-decoded cell.
 */
import { test, expect } from 'vitest';
import { picture } from '../src/controls/index.js';

// ST-07 / AC-6 — transient (isValidInput) accepts partial + literal auto-match; rejects a bad char.
test('ST-07: picture("###-##") — transient validity + literal auto-match', () => {
  const v = picture('###-##');
  expect(v.isValidInput('12')).toBe(true); // partial digits ok mid-edit
  expect(v.isValidInput('1a')).toBe(false); // 2nd char must be a digit → prError
  expect(v.isValidInput('123')).toBe(true); // 3 digits, the '-' is auto-matched (not yet typed)
  expect(v.isValidInput('123-45')).toBe(true); // fully-typed value is valid input
});

// ST-08 / AC-7 — blocking (isValid) requires complete; autoFill (fill) inserts literals; isValid never fills.
test('ST-08: picture("(###)###-####") — blocking completeness + autoFill delivery', () => {
  const v = picture('(###)###-####');
  expect(v.isValid('(555)123-4567')).toBe(true); // complete phone
  expect(v.isValid('(555)123-456')).toBe(false); // one digit short → incomplete
  // autoFill (PA-17): typing the '(' + 3 digits auto-appends the ')' literal.
  expect(v.fill?.('(555')).toBe('(555)');
  // isValid never autoFills: a value missing the trailing literals is incomplete.
  expect(v.isValid('(555')).toBe(false);
});

// ST-09 / AC-8 — DSL specials: & forces uppercase (delivered via fill), optional group, exact repeat.
test('ST-09: DSL specials — &, optional [ ], *N', () => {
  const amp = picture('&&&');
  expect(amp.isValid('abc')).toBe(true);
  expect(amp.fill?.('abc')).toBe('ABC'); // & stores uppercase (delivered via fill, PA-17)
  expect(amp.isValidInput('12')).toBe(false); // letters required

  // Optional area code: the group must be skippable, so it wraps a leading literal `(` — a bare
  // `[###]` is greedy (it would eat the first 3 digits), so TV uses `[(###)]` (fidelity: the C++
  // optional-group semantics outrank the mis-decoded `[###]` cell; `tvalidat.cpp:322-336,451-457`).
  const opt = picture('[(###)]###-####');
  expect(opt.isValid('123-4567')).toBe(true); // area code skipped (group errors on '1' → optional)
  expect(opt.isValid('(555)123-4567')).toBe(true); // area code present

  const three = picture('*3#'); // exactly three digits
  expect(three.isValid('123')).toBe(true);
  expect(three.isValid('12')).toBe(false);
  expect(three.isValid('1234')).toBe(false);
});

// ST-10 / AC-8 · PA-2 — bounds-safety: bad mask → invalid + error, no throw; over-cap mask rejected;
// a hostile input against `*` terminates.
test('ST-10: bounds-safety — malformed + over-cap masks rejected; no hang', () => {
  const unbalanced = picture('[##'); // unbalanced '['
  expect(unbalanced.isValid('12')).toBe(false);
  expect(unbalanced.error).toBeDefined();
  expect(() => unbalanced.isValidInput('12')).not.toThrow();

  const overCap = picture('*99999#'); // *N over MAX_REPEAT → syntax error (PA-2)
  expect(overCap.error).toBeDefined();
  expect(overCap.isValidInput('123')).toBe(false); // allowlist: over-cap mask rejects everything

  // A pathological input against an unbounded `*` mask terminates (never hangs).
  const star = picture('*#');
  const huge = '1'.repeat(5000);
  expect(() => star.isValid(huge)).not.toThrow();
  expect(star.isValid(huge)).toBe(true); // 5000 digits is a valid unbounded-repeat of '#'
});
