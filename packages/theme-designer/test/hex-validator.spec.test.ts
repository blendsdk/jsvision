/**
 * Specification test (immutable oracle) — the `#rrggbb` hex-color field validator (ST-22).
 *
 * The validator is well-formed-aware, not just a charset filter: `isValidInput` accepts the growing
 * prefix a user types (`#` then up to 6 hex digits, or a 3-digit `#rgb`), while `isValid` accepts only
 * a complete `#rrggbb` or `#rgb`. A failing case means the validator is wrong, not the oracle.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import { hexValidator } from '../src/model/hex-validator.js';

test('ST-22: isValid accepts a complete #rrggbb or #rgb, rejects partial / non-hex / wrong length', () => {
  expect(hexValidator.isValid('#3b82f6'), '#3b82f6 → valid').toBe(true);
  expect(hexValidator.isValid('#f00'), '#f00 (3-digit) → valid').toBe(true);
  expect(hexValidator.isValid('#12'), '#12 (too short) → invalid').toBe(false);
  expect(hexValidator.isValid('zzz'), 'zzz (non-hex, no #) → invalid').toBe(false);
  expect(hexValidator.isValid('12345'), '12345 (no #, wrong length) → invalid').toBe(false);
});

test('ST-22: isValidInput accepts the growing prefix of a #rrggbb value', () => {
  for (const prefix of ['', '#', '#3', '#3b', '#3b8', '#3b82', '#3b82f', '#3b82f6']) {
    expect(hexValidator.isValidInput(prefix), `prefix "${prefix}" accepted live`).toBe(true);
  }
  // A non-hex character or an over-long value is rejected even mid-type.
  expect(hexValidator.isValidInput('#3g'), 'non-hex digit rejected live').toBe(false);
  expect(hexValidator.isValidInput('#3b82f6a'), 'over-long rejected live').toBe(false);
  expect(hexValidator.isValidInput('3b'), 'missing leading # rejected live').toBe(false);
});
