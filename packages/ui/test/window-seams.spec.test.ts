/**
 * Specification tests (immutable oracles) — RD-08 Phase-1 `Window` reactive seams (ST-27, seam half).
 *
 * Source: RD-08 → ST-27 (codeops/features/jsvision-ui/plans/editor-family/07-testing-strategy.md)
 * and the seam design in 03-04-memo-indicator-editwindow.md §"Additive `Window` seams (PA-3/PA-19)":
 *   • `Window.dragging: Signal<boolean>` — TV's `sfDragging` made reactive. The Desktop writes it:
 *     `true` in `beginMove`/`beginResize`/`beginResizeLeft`, `false` at BOTH gesture-clear sites
 *     (mouse-up AND the stale-capture abort).
 *   • `Window.active: Signal<boolean>` — TV's `sfActive` made reactive, Desktop-maintained on
 *     raise/focus-change/add/remove; `drawFrame` and the Phase-7 EditWindow gadgets share it.
 *   • Manager-less defaults: `active` true, `dragging` false (03-04 §Error Handling), so a
 *     standalone window renders and hosts gadgets without a Desktop.
 *   • `Commands.undo`/`Commands.redo` exist as registry-level additive constants (RD-08 PF-003,
 *     register PA-15 — command-only redo rides these, PA-1).
 * The gadget half of ST-27 (bars + indicator hidden while inactive) lands with Phase 7's
 * `edit-window.spec`. Expectations derive from the plan documents, never the implementation.
 *
 * Trace: RD-08 03-04 §seams · PA-3 / PA-19 / PF-003 · ST-27 (seam half).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { Commands } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function shellApp(width: number, height: number) {
  return createApplication({ caps, viewport: { width, height } });
}

/** A 1-based SGR mouse event of the given kind at absolute 0-based (x, y). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** Add a window at a rect and return it. */
function addWindow(
  app: ReturnType<typeof shellApp>,
  title: string,
  rect: { x: number; y: number; width: number; height: number },
): Window {
  const w = new Window(title);
  w.setLayout({ rect });
  app.desktop.addWindow(w);
  return w;
}

// ST-27 (seam half) / PA-3 — dragging flips true at gesture begin and false at the mouse-up clear site.
test('ST-27: dragging goes true on a title drag-move begin and false on mouse-up', () => {
  const app = shellApp(40, 12);
  const w = addWindow(app, 'W', { x: 5, y: 2, width: 12, height: 5 });
  app.loop.renderRoot.flush();
  expect(w.dragging()).toBe(false); // resting

  app.loop.dispatch(mouse('down', 11, 2)); // grab the title (window-local (6,0))
  expect(w.dragging()).toBe(true); // gesture live → the Indicator's ─ state (TV sfDragging)

  app.loop.dispatch(mouse('drag', 15, 5));
  expect(w.dragging()).toBe(true); // still live mid-drag

  app.loop.dispatch(mouse('up', 15, 5));
  expect(w.dragging()).toBe(false); // clear site 1: mouse-up
});

// ST-27 (seam half) / PA-3 — both resize gestures also raise the drag state (TV drags via dragView too).
test('ST-27: dragging goes true during SE-corner and SW left-grow resize gestures', () => {
  const app = shellApp(40, 16);
  const w = addWindow(app, 'W', { x: 0, y: 0, width: 14, height: 8 });
  app.loop.renderRoot.flush();

  // SE corner grip at window-local (13,7).
  app.loop.dispatch(mouse('down', 13, 7));
  expect(w.dragging()).toBe(true);
  app.loop.dispatch(mouse('up', 20, 10));
  expect(w.dragging()).toBe(false);

  // SW left-grow grip at window-local (0, h−1) — the RD-10 resize-left zone.
  // `rect` is only absent for a non-absolute box; addWindow always places this window absolutely.
  const rect = w.layout.rect;
  if (rect === undefined) throw new Error('expected the window to have an absolute layout rect');
  app.loop.dispatch(mouse('down', rect.x, rect.y + rect.height - 1));
  expect(w.dragging()).toBe(true);
  app.loop.dispatch(mouse('up', rect.x, rect.y + rect.height - 1));
  expect(w.dragging()).toBe(false);
});

// ST-27 (seam half) / PA-3 — the SECOND clear site: a stale (externally lost) capture aborts the
// gesture on the next mouse event and must clear `dragging` too (desktop HR-14 abort path).
test('ST-27: dragging clears at the stale-capture abort site', () => {
  const app = shellApp(40, 12);
  const w = addWindow(app, 'W', { x: 5, y: 2, width: 12, height: 5 });
  app.loop.renderRoot.flush();

  app.loop.dispatch(mouse('down', 11, 2)); // begin the title drag
  expect(w.dragging()).toBe(true);

  app.loop.releaseCapture(); // the capture is lost externally (modal opened/closed mid-drag, …)
  const before = { ...w.layout.rect };
  app.loop.dispatch(mouse('drag', 30, 8)); // next mouse event hits the stale-gesture abort
  expect(w.dragging()).toBe(false); // clear site 2: stale-capture abort
  expect(w.layout.rect).toEqual(before); // and the window never teleported
});

// ST-27 (seam half) / PA-19 — active tracks raise / focus-change / remove.
test('ST-27: active tracks raise-on-click and re-focus after closing the active window', () => {
  const app = shellApp(40, 12);
  const a = addWindow(app, 'A', { x: 0, y: 0, width: 14, height: 6 });
  const b = addWindow(app, 'B', { x: 16, y: 0, width: 12, height: 6 });
  app.loop.renderRoot.flush();

  expect(b.active()).toBe(true); // added last ⇒ raised ⇒ active
  expect(a.active()).toBe(false); // deactivated by b's raise

  app.loop.dispatch(mouse('down', 3, 2)); // click a's interior → raise-on-click
  expect(a.active()).toBe(true);
  expect(b.active()).toBe(false);

  a.close(); // remove the active window → the next top-most becomes active
  expect(b.active()).toBe(true);
});

// 03-04 §Error Handling — manager-less defaults keep a standalone window fully functional.
test('ST-27: a manager-less window defaults to active=true, dragging=false', () => {
  const w = new Window('standalone');
  expect(w.active()).toBe(true); // gadgets visible standalone (PA-19 / plan AC-1)
  expect(w.dragging()).toBe(false);
});

// RD-08 PF-003 / PA-15 — the two additive registry-level command constants exist.
test('PF-003: Commands.undo and Commands.redo are registry constants', () => {
  expect(Commands.undo).toBe('undo');
  expect(Commands.redo).toBe('redo');
  const values = Object.values(Commands);
  expect(values).toContain('undo');
  expect(values).toContain('redo');
});
