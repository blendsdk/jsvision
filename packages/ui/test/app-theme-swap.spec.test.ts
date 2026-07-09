/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming hot-swap (ST-29).
 *
 * Source: RD-22 AC-13 → ST-29 (plans/theming/07-testing-strategy.md; 03-05-hot-swap.md; AR-279, PA-3).
 * `EventLoop.setTheme`/`Application.setTheme` push a repainted frame to the host even when called
 * outside any input tick — a bare imperative swap between ticks reaches the screen, because the loop
 * wraps it in its own tick and reuses the trailing flush + onFrame.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, nordTheme } from '@jsvision/core';
import { View, Group, createEventLoop, createApplication } from '../src/index.js';
import type { DrawContext } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

class PaintView extends View {
  constructor(private readonly ch: string) {
    super();
  }
  draw(ctx: DrawContext): void {
    ctx.fill(this.ch);
  }
}

test('ST-29: loop.setTheme pushes a repainted frame to the host outside any dispatch', () => {
  const child = new PaintView('X');
  child.layout = { size: { kind: 'fixed', cells: 2 } };
  const root = new Group();
  root.layout = { direction: 'row' };
  root.background = 'window';
  root.add(child);

  const loop = createEventLoop({ width: 10, height: 2 }, { caps, theme: defaultTheme });
  let frames = 0;
  loop.onFrame = () => (frames += 1);
  loop.mount(root);

  const before = loop.renderRoot.buffer().get(9, 0)?.bg;
  frames = 0;
  loop.setTheme(nordTheme); // bare imperative call, no surrounding dispatch
  expect(frames, 'a frame was pushed to the host').toBeGreaterThan(0);
  expect(loop.renderRoot.buffer().get(9, 0)?.bg, 'buffer repainted with the new theme').toBe(nordTheme.window.bg);
  expect(loop.renderRoot.buffer().get(9, 0)?.bg, 'changed from before').not.toBe(before);
});

test('ST-29: Application.setTheme forwards to the loop and repaints the desktop', () => {
  const app = createApplication({ caps, requireTty: false });
  const before = app.loop.renderRoot.buffer().get(0, 0)?.bg;
  expect(before, 'desktop starts on the default theme').toBe(defaultTheme.desktop.bg);

  app.setTheme(nordTheme);
  expect(app.loop.renderRoot.buffer().get(0, 0)?.bg, 'desktop repainted with the new theme').toBe(nordTheme.desktop.bg);
});
