/**
 * The *Matrix* "digital rain" as a windowing desktop: three windows, each a field of falling green
 * code, on a green-on-black theme. Move, resize, zoom, tile, or cascade them like any other windows;
 * **F7** opens one more.
 *
 * One ~12 fps timer bumps a single shared `frame` counter that every rain view binds to, so one
 * timer animates every window at once — including ones opened later with F7. The timer is registered
 * with `ctx.onCleanup` so it stops when the example closes, and `unref`'d so a headless mount never
 * keeps the process alive. F7 is bound with an app-wide `keymap` (it fires regardless of which window
 * has focus) rather than a menu item, since the shared demo chrome owns the menu bar.
 */
import { Window, signal, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { MatrixRain } from '../../src/apps/matrix/matrix-rain.js';
import { matrixTheme } from '../../src/apps/matrix/theme.js';

/** Command that opens a fresh rain window, bound to F7 app-wide. */
const CMD_NEW = 'matrix:new';
/** A no-op command the animation timer emits to flush one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';
/** Timer period in ms (~12 fps) — smooth streaming without burning CPU. */
const TICK_MS = 80;

export default defineExample({
  title: 'Matrix rain',
  blurb: 'The Matrix digital rain as a windowing desktop — three fields of falling green code, F7 for more.',
  build: (ctx) => {
    const app = demoApp(ctx, { windowMenu: true, keymap: createKeymap({ f7: CMD_NEW }) });
    app.setTheme(matrixTheme); // green-on-black, over the shared demo chrome.
    app.desktop.shadow = true;

    // The single signal the timer drives; every rain view binds to it.
    const frame = signal(0);

    // Running count of rain windows ever opened — drives the window number and the cascade offset.
    let count = 0;

    /** Open one rain window at the given rect, bound to the shared frame. */
    const openRain = (rect: { x: number; y: number; width: number; height: number }): void => {
      count += 1;
      const win = new Window(`Matrix ${count}`);
      win.number = count;
      win.setLayout({ rect });
      win.add(new MatrixRain(() => frame()));
      app.desktop.addWindow(win);
    };

    // Three staggered windows to start.
    openRain({ x: 1, y: 1, width: 34, height: 13 });
    openRain({ x: 20, y: 4, width: 34, height: 13 });
    openRain({ x: 39, y: 2, width: 34, height: 14 });

    // F7: open another rain window, cascaded within the live desktop, then reflow so the late-added
    // window gets a layout pass (a freshly added window is 0×0 until the next reflow).
    app.onCommand(CMD_NEW, () => {
      const buffer = app.loop.renderRoot.buffer();
      const size = { width: buffer.width, height: buffer.height };
      const w = Math.min(36, Math.max(20, Math.floor(size.width * 0.4)));
      const h = Math.min(16, Math.max(8, Math.floor(size.height * 0.5)));
      const off = count * 2;
      const x = 1 + (off % Math.max(1, size.width - w - 1));
      const y = 1 + (off % Math.max(1, size.height - h - 2));
      openRain({ x, y, width: w, height: h });
      app.loop.resize(size);
    });

    // Bump the frame, then emit a no-op command so the loop flushes one coalesced frame per tick.
    const timer = setInterval(() => {
      frame.set(frame.peek() + 1);
      app.loop.emitCommand(CMD_REFRESH);
    }, TICK_MS);
    // Stop on close (the browser) and stay harmless in a headless mount (Node lets the process exit).
    ctx.onCleanup?.(() => clearInterval(timer));
    if (typeof timer.unref === 'function') timer.unref();

    return app;
  },
});
