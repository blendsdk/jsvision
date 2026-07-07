/**
 * Cursor control sequences. Show/hide and absolute move are capability-independent
 * and safe on every terminal. Cursor shape (DECSCUSR) is intentionally not offered.
 */

import { CSI, cursorTo } from './ansi.js';

/**
 * Capability-independent cursor controls (show/hide/absolute move). Each method
 * returns an ANSI string for you to write to the terminal.
 *
 * @example
 * import { cursor } from '@jsvision/core';
 * process.stdout.write(cursor.hide());      // hide during a repaint
 * process.stdout.write(cursor.to(5, 10));   // move to row 5, column 10 (1-based)
 * process.stdout.write(cursor.show());      // show it again
 */
export const cursor = {
  /** Show the text cursor (`CSI ?25 h`). */
  show(): string {
    return `${CSI}?25h`;
  },
  /** Hide the text cursor (`CSI ?25 l`). */
  hide(): string {
    return `${CSI}?25l`;
  },
  /**
   * Move the cursor to a **1-based** (row, col) (`CSI row;col H`).
   *
   * @param row 1-based row (top is 1).
   * @param col 1-based column (left is 1).
   */
  to(row: number, col: number): string {
    return cursorTo(row, col);
  },
} as const;
