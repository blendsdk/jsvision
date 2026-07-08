/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-1…ST-4).
 *
 * Source: RD-22 AC-5 → ST-1…ST-4 (plans/theming/07-testing-strategy.md; 03-01-aliases-ramp-contrast.md;
 * ambiguity registers AR-268, AR-283). Covers the OKLab perceptual color math — `ramp`/`lighten`/
 * `darken`/`mix` — exercised only through the public `@jsvision/core` contract (the sRGB↔OKLab
 * conversions themselves stay internal, so the round-trip is observed via `mix(c, c, 0.5)`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { ramp, lighten, darken, mix, InvalidColorError, PALETTE } from '../src/engine/index.js';

/** Parse a `#rrggbb` string to integer channels. */
function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * WCAG relative luminance — computed independently of the implementation so ST-2 observes
 * "lightness increased" through a neutral oracle rather than the OKLab L it is asserting about.
 */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const PALETTE_HEXES = Object.values(PALETTE);

// ── ST-1: sRGB→OKLab→sRGB round-trip within ≤ 1/255 per channel ────────────────────────────────────

test('ST-1: the OKLab round-trip preserves each PALETTE color within 1/255 per channel', () => {
  for (const hex of PALETTE_HEXES) {
    // mix of a color with itself interpolates in OKLab and converts back — a full round-trip.
    const round = mix(hex, hex, 0.5);
    const [r0, g0, b0] = channels(hex);
    const [r1, g1, b1] = channels(round);
    expect(Math.abs(r1 - r0), `${hex} R round-trip`).toBeLessThanOrEqual(1);
    expect(Math.abs(g1 - g0), `${hex} G round-trip`).toBeLessThanOrEqual(1);
    expect(Math.abs(b1 - b0), `${hex} B round-trip`).toBeLessThanOrEqual(1);
  }
});

// ── ST-2: lighten raises lightness, darken lowers it ────────────────────────────────────────────────

test('ST-2: lighten strictly increases luminance and darken strictly decreases it', () => {
  // A representative mid color (avoids the pinned 0/1 gamut ends where clamping removes strictness).
  const mid = '#3b82f6';
  expect(luminance(lighten(mid, 0.2)), 'lighten raises luminance').toBeGreaterThan(luminance(mid));
  expect(luminance(darken(mid, 0.2)), 'darken lowers luminance').toBeLessThan(luminance(mid));
});

// ── ST-3: mix endpoints exact, midpoint interpolated ────────────────────────────────────────────────

test('ST-3: mix(a,b,0) === a, mix(a,b,1) === b, and mix(a,b,0.5) lands between them', () => {
  const a = '#000000';
  const b = '#ffffff';
  expect(mix(a, b, 0), 'endpoint t=0 returns a').toBe(a);
  expect(mix(a, b, 1), 'endpoint t=1 returns b').toBe(b);
  const midLum = luminance(mix(a, b, 0.5));
  expect(midLum, 'midpoint brighter than a').toBeGreaterThan(luminance(a));
  expect(midLum, 'midpoint darker than b').toBeLessThan(luminance(b));
});

// ── ST-4: unresolvable ('default') seed throws ─────────────────────────────────────────────────────

test('ST-4: ramp/lighten/darken/mix throw InvalidColorError on an unresolvable seed', () => {
  expect(() => ramp('default', 5), 'ramp default').toThrow(InvalidColorError);
  expect(() => lighten('default', 0.2), 'lighten default').toThrow(InvalidColorError);
  expect(() => darken('default', 0.2), 'darken default').toThrow(InvalidColorError);
  expect(() => mix('default', '#fff', 0.5), 'mix default a').toThrow(InvalidColorError);
  expect(() => mix('#fff', 'default', 0.5), 'mix default b').toThrow(InvalidColorError);
});

test('ST-4: ramp returns the requested number of resolvable shades for a valid seed', () => {
  const shades = ramp('#3b82f6', 5);
  expect(shades.length, 'ramp returns `steps` shades').toBe(5);
  for (const shade of shades) {
    expect(shade, 'each shade is a #rrggbb string').toMatch(/^#[0-9a-f]{6}$/);
  }
});
