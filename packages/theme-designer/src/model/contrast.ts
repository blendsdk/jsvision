/**
 * WCAG contrast scoring for a theme's key text/background pairs — the readout the designer shows so an
 * author can spot an unreadable combination as they edit.
 */
import { contrastRatio } from '@jsvision/core';
import type { Color, Theme } from '@jsvision/core';

/** One scored text/background pair. */
export interface ContrastRow {
  /** A human label for the pair (the primary role name). */
  readonly pair: string;
  /** The WCAG contrast ratio (1–21). */
  readonly ratio: number;
  /** The WCAG level the ratio meets: `AAA` (≥7), `AA` (≥4.5), else `fail`. */
  readonly level: 'AAA' | 'AA' | 'fail';
}

/** The fixed set of representative text-on-surface pairs the designer scores. */
const CONTRAST_PAIRS: readonly { label: string; fg: (t: Theme) => Color; bg: (t: Theme) => Color }[] = [
  { label: 'staticText', fg: (t) => t.staticText.fg, bg: (t) => t.staticText.bg },
  { label: 'dialog', fg: (t) => t.dialog.fg, bg: (t) => t.dialog.bg },
  { label: 'menuBar', fg: (t) => t.menuBar.fg, bg: (t) => t.menuBar.bg },
  { label: 'button', fg: (t) => t.button.fg, bg: (t) => t.button.bg },
  { label: 'inputNormal', fg: (t) => t.inputNormal.fg, bg: (t) => t.inputNormal.bg },
  { label: 'listFocused', fg: (t) => t.listFocused.fg, bg: (t) => t.listFocused.bg },
  { label: 'statusBar', fg: (t) => t.statusBar.fg, bg: (t) => t.statusBar.bg },
  { label: 'window', fg: (t) => t.window.title, bg: (t) => t.window.bg },
];

/**
 * Score a theme's key text/background pairs against WCAG. A pair whose color is `'default'` (its
 * `contrastRatio` is `NaN`, because a terminal default has no fixed RGB) is **skipped**, not flagged —
 * so the readout never shows a meaningless row.
 *
 * @param theme The theme to score.
 * @returns One {@link ContrastRow} per scorable pair, in a fixed order.
 * @example
 * import { defaultTheme } from '@jsvision/core';
 * import { contrastRows } from './model/contrast.js';
 *
 * const rows = contrastRows(defaultTheme);
 * rows.filter((r) => r.level === 'fail'); // pairs that need attention
 */
export function contrastRows(theme: Theme): ContrastRow[] {
  const out: ContrastRow[] = [];
  for (const p of CONTRAST_PAIRS) {
    const ratio = contrastRatio(p.fg(theme), p.bg(theme));
    if (!Number.isFinite(ratio)) continue; // a 'default' color yields NaN — skip it
    out.push({ pair: p.label, ratio, level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fail' });
  }
  return out;
}
