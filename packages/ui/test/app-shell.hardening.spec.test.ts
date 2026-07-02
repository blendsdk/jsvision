/**
 * Specification tests (immutable oracles) — app-shell hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-14 + PA-13, plan docs 03-07-app-shell.md and
 * 07-testing-strategy.md (ST-3.e). A drag gesture whose pointer capture is lost externally (a modal
 * opened/closed mid-drag) must not teleport the window on the next desktop mouse-move. Real
 * `createApplication` desktop + window; expectations derive from the RD/PA, never the implementation.
 *
 * Later hardening phases append ST-4.a–b, ST-7.a–c,f–g to this file.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent, KeyEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { Commands } from '../src/status/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';
import { Dialog } from '../src/dialog/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A 1-based SGR mouse event of the given kind at 0-based absolute (x, y). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** A key event with the given name. */
function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** A post-process spy that records the commands routed to it (menu emit + close observation). */
class CommandSpy extends View {
  override postProcess = true;
  readonly commands: string[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

// ST-3.e — a gesture whose capture was cleared by a modal open/close does not move the window on the
// next desktop mouse-move; the stale gesture is cleared (HR-14/PA-13).
test('ST-3.e: a stale gesture (capture lost via a modal) never teleports the window', async () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } });
  const w = new Window('W');
  w.layout.rect = { x: 2, y: 2, width: 12, height: 6 };
  app.desktop.addWindow(w);

  // Begin a drag-move gesture (captures the pointer to the desktop).
  app.desktop.beginMove(w, { x: 0, y: 0 });
  const rectBefore = { ...w.layout.rect };

  // Open + close a modal WITHOUT a mouse-up — this clears the pointer capture (PA-5) but leaves the
  // desktop's `gesture` set.
  const dialog = new Group();
  app.desktop.add(dialog);
  const modal = app.loop.execView(dialog);
  app.loop.endModal('closed');
  await modal;

  // A desktop mouse-move over empty background (far from the window) must NOT move it.
  app.loop.dispatch(mouse('move', 30, 15));
  expect(w.layout.rect).toEqual(rectBefore); // no teleport — stale gesture cleared

  // The gesture is cleared, so a second move is also inert.
  app.loop.dispatch(mouse('move', 5, 5));
  expect(w.layout.rect).toEqual(rectBefore);
});

// ST-4.a — a `close` command removes the active window and re-focuses the next (HR-08).
test('ST-4.a: Commands.close removes the active window and focuses the next', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const a = new Window('A');
  a.layout.rect = { x: 0, y: 0, width: 18, height: 6 };
  app.desktop.addWindow(a);
  const b = new Window('B');
  b.layout.rect = { x: 20, y: 0, width: 18, height: 6 };
  app.desktop.addWindow(b); // added last → active
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(b);

  app.loop.emitCommand(Commands.close); // was dead before HR-08
  expect(app.desktop.children.includes(b)).toBe(false); // active window removed
  expect(app.desktop.activeWindow()).toBe(a); // next window focused
});

// ST-4.b — an inactive window's affordance columns are inert on the first click (raise+activate
// only); the second (now-active) click performs the action (HR-09 / tframe.cpp:150-193).
test('ST-4.b: an inactive window close box is inert on the first click, acts on the second', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const a = new Window('A');
  a.layout.rect = { x: 0, y: 0, width: 14, height: 6 };
  app.desktop.addWindow(a);
  const b = new Window('B');
  b.layout.rect = { x: 16, y: 0, width: 14, height: 6 };
  app.desktop.addWindow(b);
  app.desktop.raise(a); // A active, B inactive
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(a);

  // B's close box: window-local (2,0) → abs (16+2, 0) = (18,0) → 1-based (19,1).
  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 19, y: 1 });
  expect(app.desktop.children.includes(b)).toBe(true); // first click did NOT close
  expect(app.desktop.activeWindow()).toBe(b); // it raised+activated B

  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 19, y: 1 });
  expect(app.desktop.children.includes(b)).toBe(false); // second click (active) closes
});

// ST-4.b — the inactive zoom column is likewise inert on the first click (raise only, no zoom).
test('ST-4.b: an inactive window zoom box is inert on the first click', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const a = new Window('A');
  a.layout.rect = { x: 0, y: 0, width: 14, height: 6 };
  app.desktop.addWindow(a);
  const b = new Window('B');
  const bRect = { x: 16, y: 0, width: 14, height: 6 };
  b.layout.rect = { ...bRect };
  app.desktop.addWindow(b);
  app.desktop.raise(a); // A active, B inactive
  app.loop.renderRoot.flush();

  // B's zoom box: window-local (w-3, 0) = (11,0) → abs (16+11, 0) = (27,0) → 1-based (28,1).
  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 28, y: 1 });
  expect(b.layout.rect).toEqual(bRect); // not zoomed
  expect(app.desktop.activeWindow()).toBe(b); // only raised+activated
});

// ---------------------------------------------------------------------------
// ST-7.a — a bare top-level menu item emits+closes; Esc always closes (HR-35/PA-17)
// ---------------------------------------------------------------------------
test('ST-7.a: a bare top-level menu item — Enter emits + closes; Esc closes', () => {
  const bar = menuBar([subMenu('~F~ile', [item('~O~k', 'ok')]), item('~Q~uit', 'myquit')]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);

  app.loop.dispatch(key('f10')); // open File (top 0)
  app.loop.dispatch(key('right')); // File's item highlight ⇒ switch to the bare "Quit" (top 1)
  app.loop.dispatch(key('enter')); // bare item ⇒ emit + close
  expect(spy.commands).toContain('myquit');
  expect(bar.controller?.isOpen()).toBe(false);

  // Re-open, land on the bare item, Esc → always closes (no stuck-open menu).
  app.loop.dispatch(key('f10'));
  app.loop.dispatch(key('right'));
  app.loop.dispatch(key('escape'));
  expect(bar.controller?.isOpen()).toBe(false);
});

// ---------------------------------------------------------------------------
// ST-7.b — the outside-click catcher tracks a resize (HR-36)
// ---------------------------------------------------------------------------
test('ST-7.b: a click in a region exposed by a resize hits the catcher and closes the menu', () => {
  const bar = menuBar([subMenu('~F~ile', [item('~O~k', 'ok')]), subMenu('~E~dit', [item('~C~opy', 'copy')])]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width: 40, height: 20 } });

  app.loop.dispatch(key('f10')); // File open
  expect(bar.controller?.isOpen()).toBe(true);

  app.loop.resize({ width: 60, height: 30 }); // grow the viewport
  app.loop.dispatch(mouse('down', 55, 25)); // click in the newly-exposed region (outside the popup)
  expect(bar.controller?.isOpen()).toBe(false); // the resized catcher caught it and closed
});

// ---------------------------------------------------------------------------
// ST-7.f — one-click menu-title switch (HR-40)
// ---------------------------------------------------------------------------
test('ST-7.f: clicking another top-level title switches menus in one click', () => {
  const bar = menuBar([subMenu('~F~ile', [item('~O~k', 'ok')]), subMenu('~E~dit', [item('~C~opy', 'copy')])]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width: 40, height: 20 } });

  app.loop.dispatch(key('f10')); // File open (index 0)
  expect(bar.controller?.openIndex()).toBe(0);

  // Click the "Edit" title on the top row. Titles start at column 1 (TITLE_MARGIN); "File" spans a
  // few columns then "Edit" — click well inside the Edit title (x >= 8 is safely past File).
  app.loop.dispatch(mouse('down', 9, 0));
  expect(bar.controller?.openIndex()).toBe(1); // switched directly to Edit — one click
  expect(bar.controller?.isOpen()).toBe(true);
});

// ---------------------------------------------------------------------------
// ST-7.c — a retained dialog stops swallowing global Esc after its modal ends (HR-37)
// ---------------------------------------------------------------------------
test('ST-7.c: a dialog kept mounted after its modal ends no longer swallows a global Esc', async () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } });
  const dialog = new Dialog({ title: 'D', rect: { x: 5, y: 3, width: 20, height: 10 } });
  app.desktop.add(dialog); // added BEFORE the spy → swept first in the post-sweep
  const spy = new CommandSpyEsc();
  app.desktop.add(spy);

  const modal = app.loop.execView(dialog); // open modally (dialog.modalHost set)
  app.loop.dispatch(key('escape')); // Esc ⇒ cancel; modal ends, dialog stays mounted
  expect(await modal).toBe('cancel');

  // A later GLOBAL Esc must not be swallowed by the retained dialog (its modalHost is cleared, HR-37).
  app.loop.dispatch(key('escape'));
  expect(spy.escapes).toBeGreaterThan(0); // the Esc passed the dialog and reached the sibling spy
});

// ---------------------------------------------------------------------------
// ST-7.g — a zoomed window re-maximizes + restoredRect clamps on desktop resize (HR-41)
// ---------------------------------------------------------------------------
test('ST-7.g: on desktop resize a zoomed window re-maximizes; its restore rect stays on-screen', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } }); // no chrome ⇒ desktop = viewport
  const w = new Window('W');
  w.layout.rect = { x: 5, y: 3, width: 20, height: 10 };
  app.desktop.addWindow(w);

  w.zoom(); // maximize → restoredRect saved
  expect(w.layout.rect).toEqual({ x: 0, y: 0, width: 40, height: 20 });

  app.loop.resize({ width: 15, height: 8 }); // shrink the desktop below the restore rect
  expect(w.layout.rect).toEqual({ x: 0, y: 0, width: 15, height: 8 }); // re-maximized to the new desktop

  w.zoom(); // unzoom → lands on the clamped restore rect, fully on-screen
  const r = w.layout.rect;
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(15);
  expect(r.y + r.height).toBeLessThanOrEqual(8);
});

/** A post-process spy counting the Esc keys routed to it (HR-37 observation). */
class CommandSpyEsc extends View {
  override postProcess = true;
  escapes = 0;
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key' && ev.event.key === 'escape') this.escapes += 1;
  }
}
