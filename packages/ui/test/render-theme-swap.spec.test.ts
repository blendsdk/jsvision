/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming hot-swap (ST-28).
 *
 * Source: RD-22 AC-13 → ST-28 (plans/theming/07-testing-strategy.md; 03-05-hot-swap.md; AR-276, PA-3).
 * `RenderRoot.setTheme` replaces the active theme and forces exactly one coalesced full recompose:
 * the buffer repaints with the new colors, and a view whose geometry did not change keeps its origin.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, nordTheme } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Fills its whole rect with one glyph. */
class PaintView extends View {
  constructor(private readonly ch: string) {
    super();
  }
  draw(ctx: DrawContext): void {
    ctx.fill(this.ch);
  }
}

test('ST-28: setTheme recomposes once with new colors and preserves unchanged origins', () => {
  const child = new PaintView('X');
  child.layout = { size: { kind: 'fixed', cells: 2 } };
  const root = new Group();
  root.layout = { direction: 'row' };
  root.background = 'window'; // the group fills its rect with the window role's colors
  root.add(child);

  let scheduled = 0;
  const rr = createRenderRoot(
    { width: 10, height: 2 },
    { caps, theme: defaultTheme, schedule: () => (scheduled += 1) }, // no-op schedule: the test drives flush()
  );
  rr.mount(root); // mount composes directly (not via schedule)

  const beforeBg = rr.buffer().get(9, 0)?.bg; // a group-background cell (not covered by the child)
  const beforeOrigin = rr.originOf(child);
  expect(beforeBg, 'default window background').toBe(defaultTheme.window.bg);

  scheduled = 0;
  rr.setTheme(nordTheme);
  expect(scheduled, 'setTheme schedules exactly one frame').toBe(1);
  rr.flush();

  expect(rr.buffer().get(9, 0)?.bg, 'background repainted with the new theme').toBe(nordTheme.window.bg);
  expect(rr.buffer().get(9, 0)?.bg, 'and it actually changed').not.toBe(beforeBg);
  expect(rr.originOf(child), 'an unchanged view keeps its origin').toEqual(beforeOrigin);
});
