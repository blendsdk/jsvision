/**
 * Specification tests (immutable oracles) — Navigation router · Phase 0 shell (ST-1, ST-2).
 *
 * Source: 07-testing-strategy.md ST-1/ST-2 (R-1, R-7 / AR-2, AR-10). A non-Desktop `content` body
 * hosts as the app's `fr:1` middle and auto-gates window-management; a no-content app is a
 * byte-unchanged Desktop (regression). Expectations derive from the spec, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { Desktop } from '../src/desktop/index.js';
import { Window } from '../src/window/index.js';
import { Commands } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A hidden post-process view that records the command names routed to it. */
class CommandSpy extends View {
  readonly commands: string[] = [];
  constructor() {
    super();
    this.postProcess = true;
    this.state.visible = false;
  }
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

// ST-1 — a non-Desktop content body fills the app; app.desktop is undefined; window commands are unhandled.
test('ST-1: content body hosts as fr:1; app.desktop undefined; window commands unhandled', () => {
  const body = new Group();
  const spy = new CommandSpy();
  body.add(spy);
  const app = createApplication({ caps, content: body, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  // The content is the fr:1 body — with no menu/status it fills the whole viewport.
  expect(body.bounds.width).toBe(40);
  expect(body.bounds.height).toBe(12);

  // No window manager is present for a router/plain-view app.
  expect(app.desktop).toBeUndefined();

  // Window-management commands reach the tree unhandled (no Desktop consumes them) — the post-process
  // spy receives them, proving nothing performed a window operation.
  app.loop.emitCommand(Commands.tile);
  app.loop.emitCommand(Commands.cascade);
  expect(spy.commands).toContain(Commands.tile);
  expect(spy.commands).toContain(Commands.cascade);
});

// ST-2 — no content ⇒ a Desktop body; app.desktop is a Desktop; tile tiles windows (regression).
test('ST-2: no content ⇒ a Desktop body; app.desktop is a Desktop; tile tiles windows', () => {
  const app = createApplication({ caps, viewport: { width: 30, height: 12 } });
  expect(app.desktop).toBeInstanceOf(Desktop);

  const a = new Window('A');
  a.layout.rect = { x: 1, y: 1, width: 8, height: 4 };
  const b = new Window('B');
  b.layout.rect = { x: 14, y: 3, width: 8, height: 4 };
  app.desktop.addWindow(a);
  app.desktop.addWindow(b);
  app.loop.renderRoot.flush();

  app.loop.emitCommand(Commands.tile);
  app.loop.renderRoot.flush();

  // Tiling repositions the windows to partition the desktop, so they no longer sit at their originals.
  const moved = a.layout.rect.x !== 1 || a.layout.rect.y !== 1 || b.layout.rect.x !== 14 || b.layout.rect.y !== 3;
  expect(moved).toBe(true);
});
