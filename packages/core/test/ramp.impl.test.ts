/**
 * Implementation test — jsvision-ui RD-22 OKLab ramp internals & edge cases.
 *
 * Complements ramp.spec.test.ts (ST-1…ST-4) with gamut-clamp boundaries, ramp step-count edges,
 * and dark→light ordering. The `.js` import extension is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { ramp, lighten, darken, mix, PALETTE } from '../src/engine/index.js';

const HEX = /^#[0-9a-f]{6}$/;

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sum(hex: string): number {
  const [r, g, b] = channels(hex);
  return r + g + b;
}

test('lighten and darken clamp at the gamut ends (no overflow / underflow)', () => {
  const white = lighten('#ffffff', 0.5);
  const black = darken('#000000', 0.5);
  expect(white, 'lightening white stays #ffffff').toBe('#ffffff');
  expect(black, 'darkening black stays #000000').toBe('#000000');
  for (const [r, g, b] of [channels(lighten('#3b82f6', 5)), channels(darken('#3b82f6', 5))]) {
    for (const c of [r, g, b]) {
      expect(c, 'channel in [0,255]').toBeGreaterThanOrEqual(0);
      expect(c, 'channel in [0,255]').toBeLessThanOrEqual(255);
    }
  }
});

test('ramp(seed, 1) returns a single round-tripped shade', () => {
  const one = ramp('#3b82f6', 1);
  expect(one.length, 'one step → one shade').toBe(1);
  expect(one[0], 'shade is #rrggbb').toMatch(HEX);
});

test('ramp orders shades dark → light', () => {
  const shades = ramp(PALETTE.blue, 5);
  expect(shades.length, '5 shades').toBe(5);
  for (let i = 1; i < shades.length; i += 1) {
    expect(sum(shades[i]), `shade ${i} lighter than ${i - 1}`).toBeGreaterThan(sum(shades[i - 1]));
  }
});

test('mix is monotonic in t across the blend', () => {
  const lums = [0, 0.25, 0.5, 0.75, 1].map((t) => sum(mix('#000000', '#ffffff', t) as string));
  for (let i = 1; i < lums.length; i += 1) {
    expect(lums[i], `t step ${i} not darker than ${i - 1}`).toBeGreaterThanOrEqual(lums[i - 1]);
  }
});
