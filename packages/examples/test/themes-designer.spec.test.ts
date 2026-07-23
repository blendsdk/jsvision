/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theme designer (ST-30…ST-33).
 *
 * Source: RD-22 AC-14, AC-15 → ST-30…ST-33 (plans/theming/07-testing-strategy.md; 03-06-designer-and-story.md;
 * AR-273, AR-283). The pure designer state machine: `currentTheme` is always a valid theme, the
 * cycles advance deterministically, `exportJson` round-trips, and `contrastWarnings` skips
 * unresolvable pairs while flagging low-contrast ones without mutating the theme.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { parseTheme, toRgb, createTheme } from '@jsvision/core';
import {
  currentTheme,
  cycleAccent,
  cycleMode,
  cycleDepth,
  randomizeSeed,
  exportJson,
  contrastWarnings,
  contrastWarningsForTheme,
  type DesignerState,
} from '../themes-demo/designer.js';

const initial: DesignerState = { mode: 'dark', accent: '#3b82f6', status: {}, depth: 'truecolor' };

// ── ST-30: currentTheme is always a valid theme ────────────────────────────────────────────────────

test('ST-30: currentTheme(state) is a valid theme (every role fg/bg resolves)', () => {
  const theme = currentTheme(initial);
  for (const [name, role] of Object.entries(theme)) {
    expect(() => toRgb(role.fg), `${name}.fg resolves`).not.toThrow();
    expect(() => toRgb(role.bg), `${name}.bg resolves`).not.toThrow();
  }
});

// ── ST-31: the cycles advance deterministically ────────────────────────────────────────────────────

test('ST-31: cycleAccent/cycleMode/cycleDepth advance deterministically', () => {
  const nextAccent = cycleAccent(initial, +1).accent;
  expect(nextAccent, 'accent changes').not.toBe(initial.accent);
  expect(cycleAccent(initial, +1).accent, 'same input → same output').toBe(nextAccent);
  expect(cycleAccent(cycleAccent(initial, +1), -1).accent, 'forward then back is identity').toBe(initial.accent);

  expect(cycleMode(initial).mode, 'dark → light').toBe('light');
  expect(cycleMode(cycleMode(initial)).mode, 'light → dark').toBe('dark');

  const d1 = cycleDepth(initial).depth;
  expect(d1, 'depth advances').not.toBe(initial.depth);
  expect(cycleDepth(initial).depth, 'deterministic').toBe(d1);

  // randomizeSeed is index-varied (no Math.random), so it is reproducible in a test.
  expect(randomizeSeed(initial, 2).accent, 'index-varied seed is reproducible').toBe(randomizeSeed(initial, 2).accent);
});

// ── ST-32: exportJson round-trips ──────────────────────────────────────────────────────────────────

test('ST-32: parseTheme(exportJson(state)) deep-equals currentTheme(state)', () => {
  const state = cycleAccent(cycleMode(initial), +1);
  expect(parseTheme(exportJson(state)), 'round-trips').toStrictEqual(currentTheme(state));
});

// ── ST-33: contrast warnings skip unresolvable pairs, flag low-contrast, never mutate ───────────────

test('ST-33: contrastWarnings skips a default pair and flags a low-contrast pair without mutating', () => {
  const theme = createTheme({
    mode: 'dark',
    accent: '#3b82f6',
    roleOverrides: {
      staticText: { fg: 'default', bg: 'default' }, // unresolvable → must be skipped
      desktop: { fg: '#777777', bg: '#808080', pattern: '░' }, // ~1.05 contrast → must be flagged
    },
  });
  const warnings = contrastWarningsForTheme(theme);

  expect(
    warnings.some((w) => w.pair.includes('desktop')),
    'the low-contrast desktop pair is flagged',
  ).toBe(true);
  expect(
    warnings.some((w) => w.pair.includes('text')),
    "the 'default' body-text pair is skipped (NaN → no warning)",
  ).toBe(false);
  expect(
    warnings.every((w) => Number.isFinite(w.ratio)),
    'no warning carries a NaN ratio',
  ).toBe(true);
  // The theme is not mutated by computing warnings.
  expect(theme.staticText.fg, "staticText stays 'default'").toBe('default');
  expect(theme.desktop.fg, 'desktop stays #777777').toBe('#777777');
});

test('ST-33: contrastWarnings(state) returns only finite low-contrast entries', () => {
  const warnings = contrastWarnings(initial);
  for (const w of warnings) {
    expect(Number.isFinite(w.ratio), 'finite ratio').toBe(true);
    expect(w.ratio, 'below the AA threshold').toBeLessThan(4.5);
  }
});
