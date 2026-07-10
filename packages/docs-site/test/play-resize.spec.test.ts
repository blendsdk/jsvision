/**
 * Specification test (immutable oracle) — Play resize: the composed app viewport
 * must track the TERMINAL's real size, not a hardcoded preset.
 *
 *  - ST-A1: opening onto a terminal larger than the old 80×24 default builds the
 *    app at the terminal's real size — its status line paints on the terminal's
 *    true last row, proving no viewport/terminal desync (bug #1).
 *  - ST-A1 (resize): resizing the emulator repaints the app at the new size live
 *    (mountApp routes `onResize → loop.resize`), with no remount.
 *
 * The tell is the status line: a full-chrome app paints it on the app's bottom
 * row. If the app were built at 80×24 while the terminal is 100×30, that row lands
 * at 23 and the terminal's rows 24–29 stay blank.
 */
import { test, expect } from 'vitest';
import { createPlayController } from '../src/play/play-controller.js';
import { fakeEntry, flushTerminal, headlessFactory, markerContent, rowText } from './helpers/play-harness.js';

const EL = { tagName: 'div' };

test('ST-A1: the app viewport matches the terminal size on open (not a hardcoded preset)', async () => {
  const f = headlessFactory(100, 30); // larger than the legacy 80×24 default
  const controller = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  await controller.open(EL);
  const real = f.lastReal()!;
  await flushTerminal(real);
  // The app fills the whole terminal → its status line sits on the terminal's true last row (29),
  // not at row 23 (where an 80×24 frame would end, leaving rows 24–29 blank).
  expect(rowText(real, 29).trim().length, 'status line painted on the terminal last row').toBeGreaterThan(0);
  controller.close();
});

test('ST-A1 (resize): a terminal resize repaints the app at the new size, live', async () => {
  const f = headlessFactory(80, 24);
  const controller = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  await controller.open(EL);
  const real = f.lastReal()!;
  await flushTerminal(real);
  expect(rowText(real, 23).trim().length, 'status line on the initial last row').toBeGreaterThan(0);

  // Grow the emulator (adds blank rows, no scroll-into-scrollback). onResize → loop.resize repaints
  // the app at 90×28, so the status line moves to the new last row (27) — a row an 80×24 app,
  // having never tracked the resize, would leave blank.
  real.resize(90, 28);
  await flushTerminal(real);
  expect(rowText(real, 27).trim().length, 'status line tracked to the new last row').toBeGreaterThan(0);
  controller.close();
});
