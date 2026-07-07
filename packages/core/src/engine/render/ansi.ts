/**
 * The minimal ANSI control-sequence vocabulary the serializer emits. Deliberately
 * carries **no** hardcoded color — color encoding is the `StyleEncoder` seam's job.
 *
 * `ESC` = `\x1b`, `CSI` = `ESC [`.
 */

/** Control Sequence Introducer (`ESC [`). */
export const CSI = '\x1b[';

/** Reset all SGR attributes (`CSI 0 m`). Bounds every emitted run. */
export const SGR_RESET = `${CSI}0m`;

/** Begin a synchronized update (`CSI ?2026 h`); the terminal buffers until end. */
export const SYNC_BEGIN = `${CSI}?2026h`;

/** End a synchronized update (`CSI ?2026 l`); the terminal paints atomically. */
export const SYNC_END = `${CSI}?2026l`;

/**
 * Absolute cursor move to a **1-based** (row, col) (`CSI row;col H`).
 *
 * @param row 1-based row (top is 1).
 * @param col 1-based column (left is 1).
 * @returns The ANSI escape string to write to the terminal.
 * @example
 * import { cursorTo } from '@jsvision/core';
 * process.stdout.write(cursorTo(1, 1) + 'top-left corner');
 */
export function cursorTo(row: number, col: number): string {
  return `${CSI}${row};${col}H`;
}
