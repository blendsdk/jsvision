/**
 * Implementation tests — Navigation router · Phase 2 keep-alive / chrome / focus internals.
 *
 * Beyond the ST oracles: a kept-warm screen re-applies its chrome contribution on every activation; a
 * disposed+rebuilt screen restores focus into the rebuilt tree (never the stale instance); and
 * navigating while a modal is open must not focus into a disposed screen when the modal closes
 * (focusView on an unmounted view is a documented no-op).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { statusLine, statusItem, StatusItemView } from '../src/status/index.js';
import { createRouter } from '../src/router/router.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A minimal focusable leaf. */
class Field extends View {
  override focusable = true;
  constructor(readonly name: string) {
    super();
  }
  draw(_ctx: DrawContext): void {}
}

/** A screen root holding one focusable field at a stable child path `[0]`. */
class Screen extends Group {
  readonly field: Field;
  constructor(readonly label: string) {
    super();
    this.field = new Field(`${label}-field`);
    this.add(this.field);
  }
}

/** Whether the status bar currently holds a command item with this name. */
function hasCommand(bar: { children: readonly View[] }, command: string): boolean {
  return bar.children.some((c) => c instanceof StatusItemView && c.command === command);
}

// Warm chrome re-apply — a kept-warm screen re-applies its cached status contribution on return.
test('a kept-warm screen re-applies its status contribution on every activation', () => {
  type R = { list: void; item: void };
  const router = createRouter<R>({
    initial: { name: 'list' },
    routes: {
      list: {
        keepAlive: true,
        build: () => ({ view: new Screen('list'), status: [statusItem('~L~ist', 'list.action')] }),
      },
      item: { build: () => ({ view: new Screen('item') }) }, // no status → the app base shows
    },
  });
  const baseBar = statusLine([statusItem('~H~elp', 'help', 'Alt+H')]);
  const app = createApplication({ caps, content: router, statusLine: baseBar, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  expect(hasCommand(baseBar, 'list.action')).toBe(true); // initial list contribution

  router.push('item');
  app.loop.renderRoot.flush();
  expect(hasCommand(baseBar, 'list.action')).toBe(false); // item has no status → the base returns
  expect(hasCommand(baseBar, 'help')).toBe(true);

  router.back(); // warm list re-applies its cached bundle onto the shared bar
  app.loop.renderRoot.flush();
  expect(hasCommand(baseBar, 'list.action')).toBe(true);
});

// Disposed-frame focus restore — a rebuilt screen restores focus into the rebuilt tree, not the stale one.
test('a disposed+rebuilt screen restores focus into the rebuilt tree, not the stale instance', () => {
  type R = { a: void; b: void };
  const builtA: Screen[] = [];
  const router = createRouter<R>({
    initial: { name: 'a' },
    routes: {
      a: {
        build: () => {
          const s = new Screen('a');
          builtA.push(s);
          return { view: s };
        },
      },
      b: { build: () => ({ view: new Screen('b') }) },
    },
  });
  const app = createApplication({ caps, content: router, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  const firstA = builtA[0];
  app.loop.focusView(firstA.field);
  expect(app.loop.getFocused()).toBe(firstA.field);

  router.push('b'); // a disposed (default)
  app.loop.renderRoot.flush();
  expect(firstA.field.mounted).toBe(false); // the old field is gone

  router.back(); // a rebuilt fresh
  app.loop.renderRoot.flush();
  const secondA = builtA[builtA.length - 1];
  expect(secondA).not.toBe(firstA);
  // Focus landed on the rebuilt screen's same-position field (index-path tier), never the disposed one.
  const focused = app.loop.getFocused();
  expect(focused).toBe(secondA.field);
  expect(focused?.mounted).toBe(true);
});

// PF-006 — navigating while a modal is open must not focus a disposed screen when the modal closes.
test('navigating while a modal is open does not focus a disposed screen on modal close (PF-006)', () => {
  type R = { a: void; b: void };
  const builtA: Screen[] = [];
  const router = createRouter<R>({
    initial: { name: 'a' },
    routes: {
      a: {
        build: () => {
          const s = new Screen('a');
          builtA.push(s);
          return { view: s };
        },
      },
      b: { build: () => ({ view: new Screen('b') }) },
    },
  });
  const app = createApplication({ caps, content: router, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  const firstA = builtA[0];
  app.loop.focusView(firstA.field);
  expect(app.loop.getFocused()).toBe(firstA.field);

  // Open a modal in the shared overlay; opening saves the current focus (a's field).
  const overlay = app.loop.popupHost?.overlay;
  expect(overlay).toBeDefined();
  overlay!.state.visible = true;
  const modal = new Group();
  modal.add(new Field('modal'));
  overlay!.add(modal);
  void app.loop.execView(modal);
  app.loop.renderRoot.flush();

  // Navigate while the modal is open — screen 'a' is disposed, its field unmounted.
  router.push('b');
  app.loop.renderRoot.flush();
  expect(firstA.field.mounted).toBe(false);

  // Close the modal: it restores its saved focus (a's now-disposed field) — a documented no-op, not a crash.
  expect(() => {
    app.loop.endModal(undefined);
    app.loop.renderRoot.flush();
  }).not.toThrow();
  expect(app.loop.getFocused()).not.toBe(firstA.field); // never the disposed screen's field
  expect(firstA.field.mounted).toBe(false);
});
