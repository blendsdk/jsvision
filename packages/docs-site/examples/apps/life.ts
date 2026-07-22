/**
 * Conway's Game of Life as a live desktop app: a board that evolves one generation per frame while
 * running. **Space** plays/pauses, **S** steps one generation while paused, **R** reseeds at random,
 * **C** clears — and you can **click or drag on the board to draw** your own cells (try a glider).
 *
 * One ~12 fps timer bumps a shared frame counter the board binds to; a `playing` signal gates the
 * evolution, and the control keys are bound app-wide through `demoApp`'s `keymap`. The timer is
 * registered with `ctx.onCleanup` (stopped on close) and `unref`'d (harmless in a headless mount).
 */
import { Window, signal, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { LifeView } from '../../src/apps/life/life-view.js';

const CMD_PLAY = 'life:play';
const CMD_STEP = 'life:step';
const CMD_CLEAR = 'life:clear';
const CMD_RANDOM = 'life:random';
/** A no-op command the animation timer emits to flush one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';
/** Timer period in ms (~12 fps). */
const TICK_MS = 80;

export default defineExample({
  title: 'Game of Life',
  blurb: "Conway's Game of Life — Space plays/pauses, S steps, R reseeds, C clears; click the board to draw.",
  build: (ctx) => {
    const app = demoApp(ctx, {
      keymap: createKeymap({ space: CMD_PLAY, s: CMD_STEP, c: CMD_CLEAR, r: CMD_RANDOM }),
    });

    const frame = signal(0);
    const playing = signal(true);
    const board = new LifeView(
      () => frame(),
      () => playing(),
    );

    app.onCommand(CMD_PLAY, () => playing.set(!playing.peek()));
    app.onCommand(CMD_STEP, () => {
      playing.set(false); // stepping implies paused, so a step is a single, visible generation
      board.stepOnce();
    });
    app.onCommand(CMD_CLEAR, () => {
      playing.set(false);
      board.clear();
    });
    app.onCommand(CMD_RANDOM, () => board.randomize());

    // One window over the centre of the desktop — big enough for interesting patterns, framed by the
    // grey canvas. The title carries the controls; it cannot be closed away (no File menu).
    const { width: dw, height: dh } = app.desktop.bounds;
    const width = Math.max(30, Math.round(dw * 0.8));
    const height = Math.max(14, Math.round(dh * 0.85));
    const x = Math.floor((dw - width) / 2);
    const y = Math.floor((dh - height) / 2);
    const win = new Window('Life — Space play/pause · S step · R random · C clear · drag to draw');
    win.closable = false;
    win.setLayout({ rect: { x, y, width, height } });
    win.add(board);
    app.desktop.addWindow(win);

    const timer = setInterval(() => {
      frame.set(frame.peek() + 1);
      app.loop.emitCommand(CMD_REFRESH);
    }, TICK_MS);
    ctx.onCleanup?.(() => clearInterval(timer));
    if (typeof timer.unref === 'function') timer.unref();

    return app;
  },
});
