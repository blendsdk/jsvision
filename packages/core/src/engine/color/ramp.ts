/**
 * Perceptual color math in the OKLab space — the generator behind themed color
 * ramps and light/dark adjustments.
 *
 * OKLab spaces colors by how the eye actually perceives lightness and hue, so a
 * ramp of evenly-spaced steps *looks* evenly spaced (unlike naive RGB
 * interpolation, which bunches up in the greens). Every function here takes a
 * {@link Color} at the boundary and returns a `#rrggbb` string; the sRGB↔OKLab
 * conversions are internal. An unresolvable seed (`'default'`, which has no fixed
 * RGB) throws {@link InvalidColorError} — generated themes seed from concrete
 * colors only.
 */
import type { Color } from '../render/types.js';

import { InvalidColorError, toRgb, type Rgb } from './color.js';

/** A color in the OKLab space: perceptual lightness `L` (0..1) plus the `a`/`b` chroma axes. */
interface Oklab {
  readonly L: number;
  readonly a: number;
  readonly b: number;
}

/** Linearize one 0–255 sRGB channel to linear-light 0..1 (undo the sRGB transfer curve). */
function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Re-apply the sRGB transfer curve to a linear-light 0..1 value and quantize to 0–255. */
function linearToSrgbChannel(c: number): number {
  const clamped = c <= 0 ? 0 : c >= 1 ? 1 : c;
  const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  // Round to the nearest cell value and clamp to gamut — an out-of-gamut OKLab point lands in [0,255].
  return Math.min(255, Math.max(0, Math.round(s * 255)));
}

/** Convert 0–255 sRGB to OKLab (Björn Ottosson's matrices). */
function rgbToOklab(rgb: Rgb): Oklab {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** Convert OKLab back to a `#rrggbb` string, gamut-clamped per channel. */
function oklabToHex(lab: Oklab): `#${string}` {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = linearToSrgbChannel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linearToSrgbChannel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = linearToSrgbChannel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  const hex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Resolve a {@link Color} to RGB for OKLab math, rejecting the unresolvable
 * `'default'` (it has no fixed RGB). `toRgb` already throws on malformed input.
 */
function seedToRgb(color: Color): Rgb {
  const rgb = toRgb(color);
  if (rgb === null) {
    throw new InvalidColorError(`Cannot ramp an unresolvable color: ${String(color)}`);
  }
  return rgb;
}

/**
 * Generate `steps` perceptually-even shades of a seed color, dark → light.
 *
 * The shades share the seed's hue and chroma while their OKLab lightness sweeps
 * evenly from dark to light, so they read as a coherent tonal ramp (useful for
 * deriving raised/sunken surfaces or hover states from one brand color).
 *
 * @param seed A resolvable color (hex or named) — **not** `'default'`.
 * @param steps How many shades to return (≥ 1). `1` returns the seed itself, round-tripped.
 * @returns `steps` `#rrggbb` strings, ordered darkest → lightest.
 * @throws InvalidColorError when `seed` is `'default'` or otherwise unresolvable.
 * @example
 * import { ramp } from '@jsvision/core';
 *
 * ramp('#3b82f6', 5); // 5 blues from dark to light, evenly spaced to the eye
 */
export function ramp(seed: Color, steps: number): Color[] {
  const base = rgbToOklab(seedToRgb(seed));
  if (steps <= 1) return [oklabToHex(base)];
  const lo = 0.2;
  const hi = 0.9;
  const out: Color[] = [];
  for (let i = 0; i < steps; i += 1) {
    const L = lo + ((hi - lo) * i) / (steps - 1);
    out.push(oklabToHex({ L, a: base.a, b: base.b }));
  }
  return out;
}

/**
 * Lighten a color by raising its OKLab lightness.
 *
 * Hue and chroma are preserved; only perceptual lightness moves, clamped to the
 * `[0,1]` range (so lightening an already-white color is a no-op).
 *
 * @param color A resolvable color — **not** `'default'`.
 * @param amount OKLab-lightness increase, `0..1` (e.g. `0.2` for a hover state).
 * @returns The lightened color as `#rrggbb`.
 * @throws InvalidColorError when `color` is unresolvable.
 * @example
 * import { lighten } from '@jsvision/core';
 *
 * lighten('#3b82f6', 0.2); // a lighter blue, same hue
 */
export function lighten(color: Color, amount: number): Color {
  const lab = rgbToOklab(seedToRgb(color));
  return oklabToHex({ L: Math.min(1, Math.max(0, lab.L + amount)), a: lab.a, b: lab.b });
}

/**
 * Darken a color by lowering its OKLab lightness.
 *
 * The perceptual counterpart of {@link lighten}; hue and chroma stay put, `L` is
 * clamped to `[0,1]`.
 *
 * @param color A resolvable color — **not** `'default'`.
 * @param amount OKLab-lightness decrease, `0..1` (e.g. `0.2` for a pressed state).
 * @returns The darkened color as `#rrggbb`.
 * @throws InvalidColorError when `color` is unresolvable.
 * @example
 * import { darken } from '@jsvision/core';
 *
 * darken('#3b82f6', 0.2); // a darker blue, same hue
 */
export function darken(color: Color, amount: number): Color {
  const lab = rgbToOklab(seedToRgb(color));
  return oklabToHex({ L: Math.min(1, Math.max(0, lab.L - amount)), a: lab.a, b: lab.b });
}

/**
 * Blend two colors in OKLab space.
 *
 * At `t = 0` the result is exactly `a` and at `t = 1` exactly `b` (both returned
 * verbatim); in between, all three OKLab components interpolate linearly, so the
 * blend crosses perceptual color space rather than raw RGB.
 *
 * @param a The start color (returned as-is at `t = 0`) — resolvable, not `'default'`.
 * @param b The end color (returned as-is at `t = 1`) — resolvable, not `'default'`.
 * @param t The blend position, `0..1`.
 * @returns `a`, `b`, or the interpolated `#rrggbb` midpoint.
 * @throws InvalidColorError when either color is unresolvable (evaluated even at the endpoints).
 * @example
 * import { mix } from '@jsvision/core';
 *
 * mix('#000000', '#ffffff', 0.5); // a perceptual mid-gray
 */
export function mix(a: Color, b: Color, t: number): Color {
  // Resolve both ends up front so an unresolvable endpoint throws even at t=0/1.
  const labA = rgbToOklab(seedToRgb(a));
  const labB = rgbToOklab(seedToRgb(b));
  if (t <= 0) return a;
  if (t >= 1) return b;
  return oklabToHex({
    L: labA.L + (labB.L - labA.L) * t,
    a: labA.a + (labB.a - labA.a) * t,
    b: labA.b + (labB.b - labA.b) * t,
  });
}
