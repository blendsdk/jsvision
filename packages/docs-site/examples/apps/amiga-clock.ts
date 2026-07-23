/**
 * A little desktop of live clocks: an analog Workbench-style face, a big block-glyph digital
 * readout with a blinking colon, the bouncing Amiga boing ball with the time overlaid, and a fourth
 * window nesting all three in a draggable split grid. Every window is movable, resizable, zoomable,
 * and closable — the standard windowing shell, running unchanged in the browser.
 *
 * One ~12 fps timer bumps a `frame` counter (the spin and bounce) and a `now` date signal (the
 * clocks); the reactive views bound to them repaint with no manual redraw. The timer is registered
 * with `ctx.onCleanup`, so it stops the moment the example is closed, and `unref`'d so a headless
 * mount never keeps the process alive.
 */
import { Window, SplitView, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { AnalogClock } from '../../src/apps/amiga-clock/analog-clock.js';
import { DigitalClock } from '../../src/apps/amiga-clock/digital-clock.js';
import { BoingClock } from '../../src/apps/amiga-clock/boing-clock.js';

/** A no-op command the animation timer emits to flush one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';
/** Timer period in ms (~12 fps) — smooth enough for the boing spin and a sweeping second hand. */
const TICK_MS = 80;

export default defineExample({
  title: 'Amiga clock',
  blurb:
    'A desktop of live clocks — analog, digital, and the bouncing Amiga boing ball — in movable, resizable windows.',
  build: (ctx) => {
    const app = demoApp(ctx, { windowMenu: true });
    app.desktop.shadow = true; // Turbo Vision-style drop-shadows under the windows.

    // Signals the timer drives; the reactive clock views bind to them.
    const frame = signal(0);
    const now = signal(new Date());

    const analog = new Window('Analog');
    analog.number = 1;
    analog.setLayout({ rect: { x: 1, y: 1, width: 24, height: 13 } });
    analog.add(new AnalogClock(() => now()));
    app.desktop.addWindow(analog);

    const digital = new Window('Digital');
    digital.number = 2;
    digital.setLayout({ rect: { x: 27, y: 1, width: 33, height: 9 } });
    digital.add(new DigitalClock(() => now()));
    app.desktop.addWindow(digital);

    const boing = new Window('Boing');
    boing.number = 3;
    boing.setLayout({ rect: { x: 14, y: 8, width: 34, height: 15 } });
    boing.add(
      new BoingClock(
        () => frame(),
        () => now(),
      ),
    );
    app.desktop.addWindow(boing);

    // A fourth window nests fresh clock instances in one SplitView grid — row:[ Analog | col:[ Digital
    // / Boing ] ] — bound to the same signals, so they animate off the same timer. `position:'fill'`
    // fills the window's padded interior; dragging an interior divider hit-tests to the splitter (the
    // deepest view), never the window frame, so resize and window-move never collide.
    const clocks = new Window('Clocks');
    clocks.number = 4;
    clocks.setLayout({ rect: { x: 4, y: 4, width: 60, height: 20 } });
    const right = new SplitView({
      direction: 'col',
      children: [
        new DigitalClock(() => now()),
        new BoingClock(
          () => frame(),
          () => now(),
        ),
      ],
      sizes: signal([1, 1]),
      minSize: [9, 9],
    });
    const grid = new SplitView({
      direction: 'row',
      children: [new AnalogClock(() => now()), right],
      sizes: signal([1, 1]),
      minSize: [24, 24],
    });
    grid.setLayout({ position: 'fill' });
    clocks.add(grid);
    app.desktop.addWindow(clocks);

    // Bump the signals, then emit a no-op command so the loop flushes one coalesced frame per tick.
    const timer = setInterval(() => {
      frame.set(frame.peek() + 1);
      now.set(new Date());
      app.loop.emitCommand(CMD_REFRESH);
    }, TICK_MS);
    // Stop on close (the browser) and stay harmless in a headless mount (Node lets the process exit).
    ctx.onCleanup?.(() => clearInterval(timer));
    if (typeof timer.unref === 'function') timer.unref();

    return app;
  },
});
