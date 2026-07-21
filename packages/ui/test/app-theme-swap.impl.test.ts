/**
 * Implementation test — jsvision-ui RD-22 hot-swap re-entrancy & coalescing.
 *
 * Complements app-theme-swap.spec.test.ts (ST-29): a setTheme called from inside an onCommand handler
 * joins the active tick and still produces exactly one frame. `.js` import extension per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, nordTheme } from '@jsvision/core';
import { View, Group, createEventLoop } from '../src/index.js';
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

function themedRoot(): Group {
  const child = new PaintView('X');
  child.setLayout({ size: { kind: 'fixed', cells: 2 } });
  const root = new Group();
  root.setLayout({ direction: 'row' });
  root.background = 'window';
  root.add(child);
  return root;
}

test('setTheme from inside an onCommand handler coalesces to a single frame', () => {
  const loop = createEventLoop({ width: 10, height: 2 }, { caps, theme: defaultTheme });
  let frames = 0;
  loop.onFrame = () => (frames += 1);
  loop.mount(themedRoot());
  loop.onCommand('go-nord', () => loop.setTheme(nordTheme));

  frames = 0;
  loop.emitCommand('go-nord'); // one tick: the command handler swaps the theme re-entrantly
  expect(frames, 'the whole tick produced exactly one frame').toBe(1);
  expect(loop.renderRoot.buffer().get(9, 0)?.bg, 'theme applied').toBe(nordTheme.window.bg);
});

test('a bare setTheme between ticks produces exactly one frame', () => {
  const loop = createEventLoop({ width: 10, height: 2 }, { caps, theme: defaultTheme });
  let frames = 0;
  loop.onFrame = () => (frames += 1);
  loop.mount(themedRoot());

  frames = 0;
  loop.setTheme(nordTheme);
  expect(frames, 'one frame per swap').toBe(1);
});
