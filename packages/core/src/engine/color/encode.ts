/**
 * Depth-aware SGR encoding — turn colors and text attributes into the ANSI
 * escape sequences a terminal understands, automatically downsampled to what the
 * terminal can display.
 *
 * - {@link encode} encodes ONE color to a standalone sequence for a given depth
 *   (and throws on a malformed color).
 * - {@link encodeStyle} merges attributes + foreground + background into a single
 *   sequence for a resolved {@link CapabilityProfile}. It is crash-safe: a
 *   malformed color degrades to no-color instead of throwing, so a bad cell can
 *   never take down the render loop.
 * - {@link styleKey} produces a stable string key for caching / run-merging cells
 *   that share the same style.
 */
import { CSI } from '../render/ansi.js';
import { Attr } from '../render/types.js';
import type { Color, AttrMask } from '../render/types.js';
import type { CapabilityProfile, ColorDepth } from '../capability/index.js';

import { InvalidColorError, toRgb } from './color.js';
import { nearest16, nearest256 } from './downsample.js';

/** Whether a color is a foreground or background (selects the SGR base code). */
export type ColorRole = 'fg' | 'bg';

/** SGR attribute codes, paired with their {@link Attr} bit. */
const ATTR_SGR: readonly { readonly bit: number; readonly code: number }[] = [
  { bit: Attr.bold, code: 1 },
  { bit: Attr.dim, code: 2 },
  { bit: Attr.italic, code: 3 },
  { bit: Attr.underline, code: 4 },
  { bit: Attr.blink, code: 5 },
  { bit: Attr.reverse, code: 7 },
  { bit: Attr.strike, code: 9 },
];

/** The SGR parameter list for a set attribute bitmask (empty when none set). */
function attrParams(attrs: AttrMask): number[] {
  const out: number[] = [];
  for (const { bit, code } of ATTR_SGR) {
    if ((attrs & bit) !== 0) out.push(code);
  }
  return out;
}

/**
 * The SGR parameter list for one color at `depth`. Empty for `'default'` (keep
 * the terminal default) or `mono` (no color at all). Throws `InvalidColorError`
 * on a malformed color (via {@link toRgb}).
 */
function colorParams(color: Color, role: ColorRole, depth: ColorDepth): number[] {
  if (depth === 'mono') return [];
  const rgb = toRgb(color);
  if (!rgb) return []; // 'default' → terminal default (no SGR)
  const base = role === 'fg' ? 38 : 48;
  if (depth === 'truecolor') return [base, 2, rgb.r, rgb.g, rgb.b];
  if (depth === '256') return [base, 5, nearest256(rgb)];
  // depth === '16': 30–37/40–47 (normal) or 90–97/100–107 (bright)
  const idx = nearest16(rgb);
  if (role === 'fg') return [idx < 8 ? 30 + idx : 90 + (idx - 8)];
  return [idx < 8 ? 40 + idx : 100 + (idx - 8)];
}

/** Like {@link colorParams} but never throws — a malformed color yields `[]`. */
function colorParamsSafe(color: Color, role: ColorRole, depth: ColorDepth): number[] {
  try {
    return colorParams(color, role, depth);
  } catch (err) {
    if (err instanceof InvalidColorError) return []; // degrade (render-loop safety)
    throw err;
  }
}

/** Wrap an SGR parameter list in `CSI … m`, or `''` when empty. */
function sgr(params: readonly number[]): string {
  return params.length > 0 ? `${CSI}${params.join(';')}m` : '';
}

/**
 * Encode ONE color to a standalone ANSI escape sequence for the given depth,
 * downsampling automatically when the depth is lower than truecolor.
 *
 * By depth: `truecolor` → `38;2;r;g;b` / `48;2;r;g;b`; `256` → `38;5;n` / `48;5;n`
 * (nearest palette entry); `16` → `30–37` / `40–47` / `90–97` / `100–107`
 * (nearest); `'default'` and `mono` → `''` (no sequence).
 *
 * @param color The color to encode.
 * @param role `'fg'` for foreground or `'bg'` for background (selects the base code).
 * @param depth The target color depth (typically `caps.colorDepth`).
 * @returns The escape sequence, or `''` when nothing needs emitting.
 * @throws InvalidColorError when `color` is malformed. Use {@link encodeStyle} in
 *   a render loop, where malformed colors are swallowed instead.
 * @example
 * import { encode } from '@jsvision/core';
 *
 * encode('#ff0000', 'fg', 'truecolor');  // → '\x1b[38;2;255;0;0m'
 * encode('#ff0000', 'bg', '16');         // → '\x1b[101m'  (nearest bright red bg)
 * encode('default', 'fg', 'truecolor');  // → ''
 */
export function encode(color: Color, role: ColorRole, depth: ColorDepth): string {
  return sgr(colorParams(color, role, depth));
}

/**
 * Merge text attributes + foreground + background into ONE escape sequence,
 * downsampled to the terminal's color depth. This is the encoder the renderer
 * uses per cell.
 *
 * Crash-safe: a malformed color degrades to no-color rather than throwing, so bad
 * cell data can never take down the render loop. At `mono` depth no color codes
 * are emitted, but attributes (bold, underline, …) still are, to keep text legible.
 *
 * @param fg Foreground color.
 * @param bg Background color.
 * @param attrs Attribute bitmask (see {@link Attr}; combine with `|`).
 * @param caps A resolved capability profile — only its `colorDepth` is read.
 * @returns One merged escape sequence, or `''` when nothing needs emitting.
 * @example
 * import { encodeStyle, resolveCapabilities, Attr } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ override: { colorDepth: 'truecolor' } }).profile;
 *
 * encodeStyle('#ff0000', '#0000ff', Attr.bold, caps);
 * // → '\x1b[1;38;2;255;0;0;48;2;0;0;255m'
 * encodeStyle('default', 'default', Attr.bold | Attr.underline, caps);
 * // → '\x1b[1;4m'  (attributes only)
 */
export function encodeStyle(fg: Color, bg: Color, attrs: AttrMask, caps: CapabilityProfile): string {
  const params = [
    ...attrParams(attrs),
    ...colorParamsSafe(fg, 'fg', caps.colorDepth),
    ...colorParamsSafe(bg, 'bg', caps.colorDepth),
  ];
  return sgr(params);
}

/**
 * Build a stable string key that is identical for cells sharing the same style —
 * use it to cache encoded sequences or merge adjacent same-style runs.
 *
 * Two cells with the same fg/bg/attrs produce the same key; any difference
 * produces a different key. It is just a cheap concatenation, not an escape
 * sequence — pass the same inputs to {@link encodeStyle} to get the actual bytes.
 *
 * @param fg Foreground color.
 * @param bg Background color.
 * @param attrs Attribute bitmask (see {@link Attr}).
 * @returns A stable key string.
 * @example
 * import { styleKey, Attr } from '@jsvision/core';
 *
 * styleKey('#fff', '#000', Attr.bold) === styleKey('#fff', '#000', Attr.bold); // true
 * styleKey('#fff', '#000', Attr.bold) === styleKey('#eee', '#000', Attr.bold); // false
 */
export function styleKey(fg: Color, bg: Color, attrs: AttrMask): string {
  return `${fg}|${bg}|${attrs}`;
}
