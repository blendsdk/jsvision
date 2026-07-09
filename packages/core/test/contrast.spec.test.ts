/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-5, ST-6).
 *
 * Source: RD-22 AC-14 → ST-5, ST-6 (plans/theming/07-testing-strategy.md; 03-01-aliases-ramp-contrast.md;
 * ambiguity register AR-283). `contrastRatio` is the WCAG 2.x helper the designer uses to warn about
 * unreadable pairs — pure, never called inside `createTheme`, and `NaN` (never a throw) when a color
 * is unresolvable (`'default'`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { contrastRatio } from '../src/engine/index.js';

test('ST-5: contrastRatio is 21 for black-on-white and 1 for a color against itself', () => {
  expect(contrastRatio('#000000', '#ffffff'), 'max contrast').toBeCloseTo(21, 2);
  expect(contrastRatio('#ffffff', '#000000'), 'order-independent').toBeCloseTo(21, 2);
  expect(contrastRatio('#3b82f6', '#3b82f6'), 'identical colors → 1').toBeCloseTo(1, 2);
});

test('ST-6: contrastRatio returns NaN (never throws) when a color is unresolvable', () => {
  expect(Number.isNaN(contrastRatio('default', '#ffffff')), 'default fg → NaN').toBe(true);
  expect(Number.isNaN(contrastRatio('#ffffff', 'default')), 'default bg → NaN').toBe(true);
  expect(Number.isNaN(contrastRatio('default', 'default')), 'both default → NaN').toBe(true);
});
