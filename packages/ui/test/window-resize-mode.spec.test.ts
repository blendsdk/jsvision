/**
 * Specification oracles for live and deferred mouse-driven Window resizing.
 *
 * Live resizing remains the compatibility default. Deferred outline resizing keeps the committed
 * Window and hosted content unchanged while captured motion updates a frame-only candidate; release
 * commits the latest candidate exactly once, while cancellation leaves the original geometry intact.
 */
import type { MouseEvent } from '@jsvision/core';
import type { ScreenBuffer } from '@jsvision/core';
import { resolveCapabilities } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { createApplication, View, Window } from '../src/index.js';
import type { DrawContext, Rect } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Convert a zero-based terminal cell into the one-based coordinates carried by SGR mouse input. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** Content fixture that records whether a resize motion forced the hosted subtree to paint again. */
class CountingContent extends View {
  draws = 0;

  override draw(ctx: DrawContext): void {
    this.draws += 1;
    ctx.fill('C', ctx.color('window'));
  }
}

/** Window fixture that records committed resize-hook delivery. */
class CountingWindow extends Window {
  resizeCalls = 0;

  override onResized(): void {
    this.resizeCalls += 1;
  }
}

/** Mount one real Window and content subtree at a stable absolute geometry. */
function fixture(rect: Rect = { x: 2, y: 1, width: 14, height: 8 }) {
  const app = createApplication({ caps, viewport: { width: 42, height: 18 } });
  const window = new CountingWindow('Workspace');
  window.setLayout({ rect });
  const content = new CountingContent();
  content.setLayout({ position: 'fill' });
  window.add(content);
  app.desktop.addWindow(window);
  app.loop.renderRoot.flush();
  return { app, window, content };
}

/** Count exact composed cells that differ from a pre-gesture frame. */
function changedCells(current: ScreenBuffer, previous: ScreenBuffer): number {
  let changed = 0;
  for (let y = 0; y < current.height; y += 1) {
    for (let x = 0; x < current.width; x += 1) {
      if (JSON.stringify(current.get(x, y)) !== JSON.stringify(previous.get(x, y))) changed += 1;
    }
  }
  return changed;
}

test('live remains the default and updates the committed Window during captured motion', () => {
  const { app, window } = fixture();

  expect(app.desktop.resizeMode).toBe('live');
  expect(window.resizeMode).toBeUndefined();
  app.loop.dispatch(mouse('down', 15, 8));
  app.loop.dispatch(mouse('drag', 26, 13));

  expect(window.layout.rect).toEqual({ x: 2, y: 1, width: 25, height: 13 });
  expect(window.resizeCalls).toBe(1);
  app.loop.dispatch(mouse('up', 26, 13));
});

test('a Window outline override retains content geometry and paints only the latest candidate until release', () => {
  const { app, window, content } = fixture();
  window.resizeMode = 'outline';
  const rearWindow = new Window('Rear workspace');
  rearWindow.setLayout({ rect: { x: 20, y: 9, width: 12, height: 6 } });
  const rearContent = new CountingContent();
  rearContent.setLayout({ position: 'fill' });
  rearWindow.add(rearContent);
  app.desktop.addWindow(rearWindow);
  app.desktop.raise(window);
  app.loop.renderRoot.flush();
  const committed = { ...window.layout.rect };
  const contentBounds = { ...content.bounds };
  const baseFrame = app.loop.renderRoot.buffer().clone();
  const preservedInterior = { ...baseFrame.get(8, 5)! };
  // The expanded candidate crosses a real background Window. Shrinking must restore its exact
  // composed cell instead of replacing the swept region with blanks or desktop colors.
  const sweptCorner = { ...baseFrame.get(26, 13)! };
  app.loop.dispatch(mouse('down', 15, 8));
  const drawsAfterPreviewMount = content.draws;
  expect(window.resizing()).toBe(true);
  app.loop.dispatch(mouse('drag', 26, 13));

  expect(window.layout.rect).toEqual(committed);
  expect(content.bounds).toEqual(contentBounds);
  expect(content.draws).toBe(drawsAfterPreviewMount);
  expect(window.resizeCalls).toBe(0);
  expect(app.loop.renderRoot.buffer().get(26, 13)?.char).toBe('┘');
  expect(app.loop.renderRoot.buffer().get(8, 5)).toEqual(preservedInterior);
  expect(changedCells(app.loop.renderRoot.buffer(), baseFrame)).toBeLessThanOrEqual(2 * 25 + 2 * (13 - 2));

  app.loop.dispatch(mouse('drag', 20, 11));
  expect(app.loop.renderRoot.buffer().get(26, 13)).toEqual(sweptCorner);
  expect(app.loop.renderRoot.buffer().get(8, 5)).toEqual(preservedInterior);

  app.loop.dispatch(mouse('up', 20, 11));
  expect(window.layout.rect).toEqual({ x: 2, y: 1, width: 19, height: 11 });
  expect(window.resizeCalls).toBe(1);
  expect(window.resizing()).toBe(false);
});

test('dense outline motion paints immediately, coalesces to the latest candidate, and releases exactly', () => {
  vi.useFakeTimers();
  try {
    const { app, window, content } = fixture();
    window.resizeMode = 'outline';
    app.loop.dispatch(mouse('down', 15, 8));
    const drawsAfterPreviewMount = content.draws;

    app.loop.dispatch(mouse('drag', 20, 11));
    expect(app.loop.renderRoot.buffer().get(20, 11)?.char).toBe('┘');

    app.loop.dispatch(mouse('drag', 22, 12));
    app.loop.dispatch(mouse('drag', 24, 13));
    expect(app.loop.renderRoot.buffer().get(20, 11)?.char).toBe('┘');
    expect(app.loop.renderRoot.buffer().get(24, 13)?.char).not.toBe('┘');
    expect(content.draws).toBe(drawsAfterPreviewMount);

    vi.advanceTimersByTime(32);
    expect(app.loop.renderRoot.buffer().get(20, 11)?.char).toBe('┘');
    vi.advanceTimersByTime(1);
    expect(app.loop.renderRoot.buffer().get(24, 13)?.char).toBe('┘');
    expect(app.loop.renderRoot.buffer().get(20, 11)?.char).not.toBe('┘');

    app.loop.dispatch(mouse('drag', 26, 14));
    app.loop.dispatch(mouse('up', 26, 14));
    expect(window.layout.rect).toEqual({ x: 2, y: 1, width: 25, height: 14 });
    expect(window.resizeCalls).toBe(1);
    expect(window.resizing()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test('reversal-heavy outline motion remains bounded and still commits the newest candidate', () => {
  vi.useFakeTimers();
  try {
    const { app, window } = fixture();
    window.resizeMode = 'outline';
    app.loop.dispatch(mouse('down', 15, 8));

    let changedFrames = 0;
    for (const point of [
      { x: 22, y: 12 },
      { x: 20, y: 11 },
      { x: 24, y: 13 },
      { x: 19, y: 10 },
      { x: 26, y: 14 },
      { x: 21, y: 12 },
    ]) {
      app.loop.dispatch(mouse('drag', point.x, point.y));
      if (app.loop.renderRoot.serialize() !== '') changedFrames += 1;
    }

    expect(changedFrames).toBeLessThanOrEqual(2);
    vi.advanceTimersByTime(33);
    expect(app.loop.renderRoot.buffer().get(21, 12)?.char).toBe('┘');

    app.loop.dispatch(mouse('drag', 25, 14));
    app.loop.dispatch(mouse('up', 25, 14));
    expect(window.layout.rect).toEqual({ x: 2, y: 1, width: 24, height: 14 });
    expect(window.resizeCalls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test('the Desktop outline default is inherited and an explicit Window live mode overrides it', () => {
  const deferred = fixture();
  deferred.app.desktop.resizeMode = 'outline';
  deferred.app.loop.dispatch(mouse('down', 15, 8));
  deferred.app.loop.dispatch(mouse('drag', 26, 13));
  expect(deferred.window.layout.rect).toEqual({ x: 2, y: 1, width: 14, height: 8 });
  deferred.app.loop.dispatch(mouse('up', 26, 13));
  expect(deferred.window.layout.rect).toEqual({ x: 2, y: 1, width: 25, height: 13 });

  const live = fixture();
  live.app.desktop.resizeMode = 'outline';
  live.window.resizeMode = 'live';
  live.app.loop.dispatch(mouse('down', 15, 8));
  live.app.loop.dispatch(mouse('drag', 26, 13));
  expect(live.window.layout.rect).toEqual({ x: 2, y: 1, width: 25, height: 13 });
  live.app.loop.dispatch(mouse('up', 26, 13));
});

test('an outline left resize clamps its candidate and capture loss cancels without committing', () => {
  const { app, window } = fixture({ x: 12, y: 2, width: 14, height: 8 });
  window.resizeMode = 'outline';
  const committed = { ...window.layout.rect };

  app.loop.dispatch(mouse('down', 12, 9));
  app.loop.dispatch(mouse('drag', 24, 4));
  expect(window.layout.rect).toEqual(committed);
  expect(app.loop.renderRoot.buffer().get(16, 2)?.char).toBe('┌');

  app.loop.releaseCapture();
  app.loop.dispatch(mouse('drag', 8, 14));
  expect(window.layout.rect).toEqual(committed);
  expect(window.resizeCalls).toBe(0);
  expect(window.resizing()).toBe(false);
});
