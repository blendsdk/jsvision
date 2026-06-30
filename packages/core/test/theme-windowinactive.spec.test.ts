/**
 * Specification test (immutable oracle) — the additive `windowInactive` Theme role (RD-05 Phase 1).
 *
 * Derived from RD-05 AC-15/AC-21 + AR-73/PA-1 and the App-Shell spec
 * (codeops/features/jsvision-ui/plans/app-shell/03-05-statusline-commands-theme-seams.md §Theme).
 * `windowInactive` is the **sole cross-package edit**: a sibling of `window` mirroring its shape
 * (fg/bg + border/title) so the Frame chrome can theme an inactive window distinctly from the active
 * one. Expectations derive from the contract, never from the implementation.
 *
 * Trace: RD-05 03-05 §Theme · AR-73 · PA-1.
 */
import { test, expect } from 'vitest';

import { defaultTheme, encode } from '../src/engine/color/index.js';

// `defaultTheme.windowInactive` exists with the full {fg, bg, border, title} shape (mirrors `window`).
test('defaultTheme.windowInactive exists with {fg, bg, border, title}', () => {
  expect('windowInactive' in defaultTheme).toBeTruthy();
  const role = defaultTheme.windowInactive;
  expect(role).toHaveProperty('fg');
  expect(role).toHaveProperty('bg');
  expect(role).toHaveProperty('border');
  expect(role).toHaveProperty('title');
});

// Its colors resolve to a usable Style — each encodes without throwing through core's encoder.
test('windowInactive colors resolve (encode without throwing) — a usable Style', () => {
  const role = defaultTheme.windowInactive;
  expect(() => encode(role.fg, 'fg', 'truecolor')).not.toThrow();
  expect(() => encode(role.bg, 'bg', 'truecolor')).not.toThrow();
  expect(() => encode(role.border, 'fg', 'truecolor')).not.toThrow();
  expect(() => encode(role.title, 'fg', 'truecolor')).not.toThrow();
});

// Inactive theming is visually distinct from active (AR-73): the border/title colors differ from `window`.
test('windowInactive is visually distinct from the active window role (border/title differ)', () => {
  const active = defaultTheme.window;
  const inactive = defaultTheme.windowInactive;
  const differs = active.border !== inactive.border || active.title !== inactive.title;
  expect(differs).toBe(true);
});
