/** Implementation hardening for deferred Window resize ownership and cleanup. */
import type { MouseEvent } from '@jsvision/core';
import { resolveCapabilities } from '@jsvision/core';
import { expect, test } from 'vitest';

import { createApplication, View, Window } from '../src/index.js';
import type { DrawContext } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Convert a zero-based cell to one-based SGR mouse coordinates. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** Window fixture that records committed resize hooks. */
class ObservedWindow extends Window {
  resizeCalls = 0;

  override onResized(): void {
    this.resizeCalls += 1;
  }
}

/** Child fixture that exposes repaint requests while its Window shell suppresses composition. */
class RepaintingContent extends View {
  draws = 0;

  override draw(ctx: DrawContext): void {
    this.draws += 1;
    ctx.fill('R', ctx.color('window'));
  }
}

/** Create one mounted outline-resized Window. */
function fixture() {
  const app = createApplication({ caps, viewport: { width: 40, height: 16 } });
  const window = new ObservedWindow('Workspace');
  window.resizeMode = 'outline';
  window.setLayout({ rect: { x: 2, y: 1, width: 14, height: 8 } });
  app.desktop.addWindow(window);
  app.loop.renderRoot.flush();
  return { app, window };
}

test('title movement never enters resize state or mounts resize preview chrome', () => {
  const { app, window } = fixture();

  app.loop.dispatch(mouse('down', 9, 1));
  expect(window.dragging()).toBe(true);
  expect(window.resizing()).toBe(false);
  app.loop.dispatch(mouse('drag', 12, 4));
  app.loop.dispatch(mouse('up', 12, 4));

  expect(window.layout.rect).toEqual({ x: 5, y: 4, width: 14, height: 8 });
  expect(window.resizeCalls).toBe(0);
  expect(app.desktop.children.at(-1)).toBe(window);
});

test('removing a Window during outline resize cancels capture and removes preview ownership', () => {
  const { app, window } = fixture();

  app.loop.dispatch(mouse('down', 15, 8));
  app.loop.dispatch(mouse('drag', 26, 13));
  expect(window.resizing()).toBe(true);
  app.desktop.removeWindow(window);

  expect(window.resizing()).toBe(false);
  expect(window.dragging()).toBe(false);
  expect(window.resizeCalls).toBe(0);
  expect(app.desktop.children).not.toContain(window);
  expect(app.desktop.children).toHaveLength(0);
  expect(() => app.loop.dispatch(mouse('up', 26, 13))).not.toThrow();
});

test('releasing an unchanged outline candidate avoids a redundant committed resize hook', () => {
  const { app, window } = fixture();

  app.loop.dispatch(mouse('down', 15, 8));
  app.loop.dispatch(mouse('drag', 15, 8));
  app.loop.dispatch(mouse('up', 15, 8));

  expect(window.layout.rect).toEqual({ x: 2, y: 1, width: 14, height: 8 });
  expect(window.resizeCalls).toBe(0);
  expect(window.resizing()).toBe(false);
});

test('reentrant capture replacement cancels an unpublished outline without releasing the winner', () => {
  const { app, window } = fixture();
  let replacementActive = false;
  app.loop.acquireCapture(app.desktop, () => {
    const replacement = app.loop.acquireCapture(window, () => undefined);
    replacementActive = replacement.active();
  });

  app.desktop.beginResize(window);

  expect(replacementActive).toBe(true);
  expect(window.resizing()).toBe(false);
  expect(window.dragging()).toBe(false);
  expect(window.resizeCalls).toBe(0);
  expect(app.desktop.children).toEqual([window]);
});

test('capture loss restores the committed Window after live shell motion', () => {
  const { app, window } = fixture();
  const committed = { ...window.layout.rect };

  app.loop.dispatch(mouse('down', 15, 8));
  app.loop.dispatch(mouse('drag', 20, 11));
  expect(window.layout.rect).toEqual({ x: 2, y: 1, width: 19, height: 11 });
  expect(app.loop.renderRoot.buffer().get(9, 6)?.char).toBe('1');

  app.loop.releaseCapture();
  app.loop.dispatch(mouse('drag', 22, 12));
  expect(app.loop.renderRoot.buffer().get(9, 6)?.char).not.toBe('1');

  expect(window.layout.rect).toEqual(committed);
  expect(window.resizeCalls).toBe(0);
  expect(window.resizing()).toBe(false);
  expect(app.desktop.children).toEqual([window]);
});

test('a child repaint request stays suppressed until the live resize shell releases', () => {
  const { app, window } = fixture();
  const content = new RepaintingContent();
  content.setLayout({ position: 'fill' });
  window.add(content);
  app.loop.renderRoot.flush();

  app.loop.dispatch(mouse('down', 15, 8));
  app.loop.dispatch(mouse('drag', 24, 13));
  const drawsDuringShell = content.draws;
  content.invalidate();
  app.loop.renderRoot.flush();

  expect(content.draws).toBe(drawsDuringShell);
  expect(app.loop.renderRoot.buffer().get(3, 2)?.char).toBe(' ');

  app.loop.dispatch(mouse('up', 24, 13));
  expect(content.draws).toBeGreaterThan(drawsDuringShell);
  expect(app.loop.renderRoot.buffer().get(3, 2)?.char).toBe('R');
});
