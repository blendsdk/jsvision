/**
 * Specification test (immutable oracle) — closing the last window on the desktop repaints.
 *
 * The bug: on a desktop whose only window is a modal dialog, closing that dialog does not repaint —
 * the dialog closes internally on the first click, but the terminal keeps showing it until the next
 * input event happens to run a loop tick (the "click twice" symptom). The dialog is torn down from an
 * async `finally` (the `runDialog` shape: `execView(dlg).finally(() => desktop.removeWindow(dlg))`),
 * i.e. OUTSIDE any tick, and the loop only flushes a frame at tick end — so nothing repaints.
 *
 * This test asserts against the PAINTED frame (`loop.onFrame`), never a manual `renderRoot.flush()`.
 * The existing desktop suite force-paints with `flush()`, which masks this whole class of bug; a
 * flush-based test would stay green against the broken code.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { MouseEvent, ScreenBuffer } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Dialog, okButton } from '../src/dialog/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A 1-based SGR mouse event of the given kind at 0-based (x, y). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/**
 * Serialize every glyph of a frame into one searchable string. Snapshotting to a string matters:
 * `onFrame` hands over the LIVE buffer, which the loop mutates on the next flush — keeping the
 * reference would let a later frame overwrite the one under test.
 */
function frameText(buf: ScreenBuffer): string {
  let s = '';
  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) s += buf.get(x, y)?.char ?? ' ';
    s += '\n';
  }
  return s;
}

// The oracle: a modal dialog is the ONLY window; a single OK click closes it, and the emptied desktop
// must have repainted by the time the async teardown has run — the painted frame no longer shows it.
test('ST-1: closing the only window (async modal teardown) repaints the emptied desktop', async () => {
  const app = createApplication({ caps, viewport: { width: 60, height: 20 } });

  // Capture every PAINTED frame — the terminal's truth. Never call renderRoot.flush().
  let painted = '';
  app.loop.onFrame = (buf) => {
    painted = frameText(buf);
  };

  // A dialog is the only window. A known rect makes the OK button's cell deterministic; run it through
  // the exact runDialog shape — execView + an async `finally` that removes the window outside any tick.
  const dlg = new Dialog({ title: 'CLOSEME', rect: { x: 10, y: 4, width: 30, height: 9 } });
  const ok = okButton();
  ok.layout = { position: 'absolute', rect: { x: 8, y: 4, width: 12, height: 2 } };
  dlg.add(ok);
  app.desktop.addWindow(dlg);

  const closed = app.loop.execView<string>(dlg).finally(() => app.desktop.removeWindow(dlg));

  await Promise.resolve(); // let the modal open and paint its first frame

  // Precondition: the dialog is on the painted screen.
  expect(painted).toContain('CLOSEME');

  // A SINGLE click on OK. originOf gives the button's absolute screen cell after the open tick; +3 on
  // x lands safely inside a 12-wide button's clickable face (local x in [1, width-2], y = 0).
  const origin = app.loop.renderRoot.originOf(ok);
  expect(origin).not.toBeNull();
  const cx = (origin?.x ?? 0) + 3;
  const cy = origin?.y ?? 0;
  app.loop.dispatch(mouse('down', cx, cy));
  app.loop.dispatch(mouse('up', cx, cy));

  await closed; // the modal resolved; its async `finally` ran removeWindow OUTSIDE any tick

  // The regression: the emptied desktop must have repainted. The last PAINTED frame no longer shows
  // the dialog, and the whole area now reads the desktop fill pattern.
  expect(painted).not.toContain('CLOSEME');
  expect(painted).toContain(defaultTheme.desktop.pattern);
});
