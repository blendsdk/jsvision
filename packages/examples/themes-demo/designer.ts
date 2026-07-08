/**
 * The pure state machine behind the `demo:themes` theme designer.
 *
 * View-free and deterministic: it owns the designer's seeds and derives a live {@link Theme} with
 * `createTheme`, so it can be unit-tested and driven by a headless walkthrough without a terminal.
 * The real-TTY host (`main.ts`) wraps this in a `createApplication` and calls `app.setTheme` on each
 * change; the kitchen-sink `Theming` story shows the presets.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { createTheme, serializeTheme, contrastRatio, type Color, type ColorDepth, type Theme } from '@jsvision/core';

/** The designer's full state: the seeds plus the preview color depth. */
export interface DesignerState {
  /** Light or dark base. */
  readonly mode: 'light' | 'dark';
  /** The brand accent seed (a resolvable color). */
  readonly accent: Color;
  /** Optional neutral seed; a mode gray when omitted. */
  readonly neutral?: Color;
  /** Optional status-signal seed overrides. */
  readonly status: { danger?: Color; warning?: Color; success?: Color; info?: Color };
  /** The color depth previewed (does not change the theme, only how it would render). */
  readonly depth: ColorDepth;
}

/** The rotation of accent seeds `cycleAccent`/`randomizeSeed` step through. */
const ACCENTS: readonly Color[] = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899'];

/** Neutral seeds paired with `randomizeSeed` for variety. */
const NEUTRALS: readonly Color[] = ['#808080', '#64748b', '#6b7280', '#78716c'];

/** The color depths `cycleDepth` previews, in order. */
const DEPTHS: readonly ColorDepth[] = ['truecolor', '256', '16', 'mono'];

/** The role fg/bg pairs the contrast check evaluates, named for the warning list. */
const CONTRAST_PAIRS: readonly { readonly pair: string; readonly role: keyof Theme }[] = [
  { pair: 'body text', role: 'staticText' },
  { pair: 'desktop', role: 'desktop' },
  { pair: 'menu bar', role: 'menuBar' },
  { pair: 'button', role: 'button' },
  { pair: 'input', role: 'inputNormal' },
  { pair: 'list focused', role: 'listFocused' },
  { pair: 'status bar', role: 'statusBar' },
];

/** The AA contrast floor for body text; pairs below this are flagged. */
const AA_CONTRAST = 4.5;

/**
 * Build the live theme for a designer state.
 *
 * @param s The designer state.
 * @returns The theme its seeds currently describe.
 */
export function currentTheme(s: DesignerState): Theme {
  return createTheme({ mode: s.mode, accent: s.accent, neutral: s.neutral, ...s.status });
}

/** Step the accent seed forward (`+1`) or back (`-1`) through the rotation, wrapping. */
export function cycleAccent(s: DesignerState, dir: 1 | -1): DesignerState {
  const idx = ACCENTS.indexOf(s.accent);
  const start = idx < 0 ? 0 : idx;
  const next = (start + dir + ACCENTS.length) % ACCENTS.length;
  return { ...s, accent: ACCENTS[next] };
}

/** Toggle between light and dark mode. */
export function cycleMode(s: DesignerState): DesignerState {
  return { ...s, mode: s.mode === 'dark' ? 'light' : 'dark' };
}

/** Advance the previewed color depth through truecolor → 256 → 16 → mono → truecolor. */
export function cycleDepth(s: DesignerState): DesignerState {
  const next = (DEPTHS.indexOf(s.depth) + 1) % DEPTHS.length;
  return { ...s, depth: DEPTHS[next] };
}

/** Pick a reproducible accent+neutral pair by index (index-varied, no `Math.random`). */
export function randomizeSeed(s: DesignerState, i: number): DesignerState {
  return { ...s, accent: ACCENTS[i % ACCENTS.length], neutral: NEUTRALS[i % NEUTRALS.length] };
}

/** Serialize the current theme to a JSON string (round-trips via `parseTheme`). */
export function exportJson(s: DesignerState): string {
  return serializeTheme(currentTheme(s));
}

/**
 * Contrast warnings for a theme: the named role pairs whose foreground/background contrast is below
 * the AA floor. Unresolvable pairs (a `'default'` color, contrast unknown) are **skipped** — never a
 * false alarm — and the theme is never mutated.
 *
 * @param theme The theme to check.
 * @returns One entry per flagged pair, each with its finite contrast ratio.
 */
export function contrastWarningsForTheme(theme: Theme): { pair: string; ratio: number }[] {
  const out: { pair: string; ratio: number }[] = [];
  for (const { pair, role } of CONTRAST_PAIRS) {
    const ratio = contrastRatio(theme[role].fg, theme[role].bg);
    if (Number.isNaN(ratio)) continue; // unresolvable ('default') → skip, not a warning
    if (ratio < AA_CONTRAST) out.push({ pair, ratio });
  }
  return out;
}

/**
 * Contrast warnings for a designer state (its current theme). Warn-only — it never adjusts colors.
 *
 * @param s The designer state.
 * @returns The flagged low-contrast pairs.
 */
export function contrastWarnings(s: DesignerState): { pair: string; ratio: number }[] {
  return contrastWarningsForTheme(currentTheme(s));
}
