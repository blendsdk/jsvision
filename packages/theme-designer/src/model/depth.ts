/**
 * Color-depth preview — how a single color renders once downsampled to each terminal depth. The
 * designer shows this as a small swatch strip beside the inspector so an author can see, e.g., what a
 * truecolor accent collapses to on a 16-color terminal. The per-depth conversion is shared with the
 * whole-theme preview transform in {@link colorAtDepth}.
 */
import { toRgb } from '@jsvision/core';
import type { Color, ColorDepth } from '@jsvision/core';

import { colorAtDepth } from './downsample.js';

/** One depth's stand-in for a color: the depth, the resulting `#rrggbb`, and a short label. */
export interface DepthSample {
  readonly depth: ColorDepth;
  readonly hex: string;
  readonly label: string;
}

/** The four terminal depths in preview order, each with its display label. */
const DEPTHS: readonly { depth: ColorDepth; label: string }[] = [
  { depth: 'truecolor', label: 'truecolor' },
  { depth: '256', label: '256-color' },
  { depth: '16', label: '16-color' },
  { depth: 'mono', label: 'mono' },
];

/**
 * Compute how `color` looks at each terminal color depth: the color as-is (truecolor), its nearest
 * xterm-256 entry, its nearest DOS-16 palette color, and a mono black/white. A `'default'` or
 * otherwise unresolvable color has no fixed RGB, so it yields a single `n/a` row.
 *
 * @param color The color to preview.
 * @returns Four {@link DepthSample}s (truecolor/256/16/mono), or one `n/a` row for `'default'`.
 * @example
 * import { depthSamples } from './model/depth.js';
 *
 * depthSamples('#3b82f6').map((s) => `${s.depth}:${s.hex}`);
 * // e.g. ['truecolor:#3b82f6', '256:#5f87ff', '16:#5555ff', 'mono:#000000']
 */
export function depthSamples(color: Color): DepthSample[] {
  if (toRgb(color) === null) return [{ depth: 'truecolor', hex: '', label: 'n/a' }];
  return DEPTHS.map(({ depth, label }) => ({ depth, hex: colorAtDepth(color, depth), label }));
}
