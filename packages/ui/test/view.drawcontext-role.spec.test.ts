/**
 * Specification test (immutable oracle) — RD-03 DrawContext.role() raw-role access (RD-05 Phase 0).
 *
 * FX-05 derives from the App-Shell foundation-extensions spec
 * (codeops/features/jsvision-ui/plans/app-shell/03-00-foundation-extensions.md §B / PA-16) and the
 * testing strategy (07-testing-strategy.md). It asserts the additive `DrawContext.role(name)`
 * accessor returns the raw theme role — including the role-only extras the chrome needs (the desktop
 * pattern glyph, the window border/title colors) — not just `{fg,bg}`. Derived from the contract,
 * never from the implementation.
 *
 * Trace: RD-05 03-00 §B · PA-16 · FX-05.
 */
import { test, expect } from 'vitest';
import { ScreenBuffer, defaultTheme } from '@jsvision/core';
import type { Rect } from '../src/layout/index.js';
import { makeDrawContext } from '../src/view/index.js';

// FX-05 — ctx.role('desktop').pattern and ctx.role('window').border return the role-only extras.
test('FX-05: ctx.role(name) returns the raw theme role with its role-only extras', () => {
  const buf = new ScreenBuffer(4, 1, { fg: 'default', bg: 'default' });
  const rect: Rect = { x: 0, y: 0, width: 4, height: 1 };
  const ctx = makeDrawContext(buf, rect, rect, defaultTheme);

  // The desktop role carries a `pattern` glyph beyond {fg,bg}.
  expect(ctx.role('desktop').pattern).toBe(defaultTheme.desktop.pattern);
  expect(ctx.role('desktop').fg).toBe(defaultTheme.desktop.fg);
  expect(ctx.role('desktop').bg).toBe(defaultTheme.desktop.bg);

  // The window role carries `border` and `title` colors beyond {fg,bg}.
  expect(ctx.role('window').border).toBe(defaultTheme.window.border);
  expect(ctx.role('window').title).toBe(defaultTheme.window.title);
});
