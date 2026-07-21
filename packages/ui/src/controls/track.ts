/**
 * The pure value↔position math shared by {@link Slider} and `ScrollBar` — no view, no `Signal`, no
 * events, just integer-cell arithmetic. Extracting it into one module keeps the two controls'
 * geometry identical by construction: a value in `[min, max]` maps to a 0-based cell offset along a
 * groove of `length` cells (a one-cell thumb by default), and back, with half-up rounding.
 */

/** A value range, the minimal shape {@link clampValue} / {@link stepValue} need. */
export interface ValueRange {
  readonly min: number;
  readonly max: number;
}

/**
 * The geometry of a value track laid along `length` cells.
 *
 * The thumb's leading cell offset ranges over `[0, length - thumbSize]` (the *span*); a value maps
 * proportionally into that span. `max <= min` (a degenerate range) or a span of 0 pins the thumb at
 * offset 0.
 */
export interface TrackSpec extends ValueRange {
  /** Cells available for the groove the thumb travels along. */
  readonly length: number;
  /** Thumb size in cells (default 1). A `ScrollBar` may pass a larger proportional size. */
  readonly thumbSize?: number;
}

/** The number of offsets the thumb's leading cell can occupy: `length - thumbSize`, floored at 0. */
function span(spec: TrackSpec): number {
  return Math.max(0, spec.length - (spec.thumbSize ?? 1));
}

/**
 * Clamp `value` into `[min, max]`.
 *
 * @param range The `{ min, max }` bounds.
 * @param value The value to clamp.
 * @returns `value` pinned to the range.
 * @example
 * // clampValue is internal (not re-exported from the package barrel) — imported by relative path.
 * import { clampValue } from './track.js';
 *
 * clampValue({ min: 0, max: 255 }, 300); // 255
 */
export function clampValue(range: ValueRange, value: number): number {
  return Math.min(range.max, Math.max(range.min, value));
}

/**
 * Map a value to the thumb's leading cell offset within the groove (0-based, integer, half-up).
 *
 * The value is clamped first, then scaled into `[0, span]` with a `(range >> 1)` rounding bias so the
 * midpoint value lands on the centre cell. A degenerate range or a zero span returns 0.
 *
 * @param spec The track geometry.
 * @param value The value to place.
 * @returns The thumb's leading cell offset in `[0, length - thumbSize]`.
 * @example
 * // valueToOffset is internal (not re-exported from the package barrel) — imported by relative path.
 * import { valueToOffset } from './track.js';
 *
 * valueToOffset({ min: 0, max: 100, length: 11 }, 50); // 5 — the centre cell
 */
export function valueToOffset(spec: TrackSpec, value: number): number {
  const r = spec.max - spec.min;
  const sp = span(spec);
  if (r <= 0 || sp <= 0) return 0;
  const off = Math.floor(((clampValue(spec, value) - spec.min) * sp + (r >> 1)) / r);
  return Math.min(sp, Math.max(0, off));
}

/**
 * Map a thumb cell offset (e.g. a click/drag position along the groove) back to the nearest value.
 *
 * The offset is clamped to `[0, span]`, then scaled into `[min, max]` with a `(span >> 1)` rounding
 * bias — the exact inverse rounding of {@link valueToOffset}. A zero span returns `min`.
 *
 * @param spec The track geometry.
 * @param offset The thumb's leading cell offset.
 * @returns The value at that offset, clamped to `[min, max]`.
 * @example
 * // offsetToValue is internal (not re-exported from the package barrel) — imported by relative path.
 * import { offsetToValue } from './track.js';
 *
 * offsetToValue({ min: 0, max: 100, length: 11 }, 10); // 100 — the last cell
 */
export function offsetToValue(spec: TrackSpec, offset: number): number {
  const sp = span(spec);
  if (sp <= 0) return spec.min;
  const off = Math.min(sp, Math.max(0, offset));
  const r = spec.max - spec.min;
  return clampValue(spec, Math.floor((off * r + (sp >> 1)) / sp) + spec.min);
}

/**
 * Step a value by `±delta`, clamped to the range (no overflow) — for arrow/page/wheel input.
 *
 * @param range The `{ min, max }` bounds.
 * @param value The current value.
 * @param delta The signed step.
 * @returns `value + delta`, clamped to `[min, max]`.
 * @example
 * // stepValue is internal (not re-exported from the package barrel) — imported by relative path.
 * import { stepValue } from './track.js';
 *
 * stepValue({ min: 0, max: 10 }, 10, +1); // 10 — clamped at the top
 */
export function stepValue(range: ValueRange, value: number, delta: number): number {
  return clampValue(range, value + delta);
}
