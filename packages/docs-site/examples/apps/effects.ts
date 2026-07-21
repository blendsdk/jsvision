/**
 * A full-screen animated effects canvas: a flying **starfield**, a sinusoidal **plasma** field, and
 * a bottom-up **fire**, each rendered cell-by-cell in truecolor. Press **1**, **2**, **3** to pick an
 * effect, or **Space** to cycle. The engine downsamples the colours to whatever the terminal
 * supports, so it is also a live tour of the colour engine and the damage-diff renderer.
 *
 * One ~12 fps timer bumps a shared frame counter the canvas binds to; a reactive `mode` signal picks
 * the effect, and the selector keys are bound app-wide through `demoApp`'s `keymap`. The timer is
 * registered with `ctx.onCleanup` (stopped on close) and `unref`'d (harmless in a headless mount).
 */
import { Window, signal, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { EffectView, EFFECTS } from '../../src/apps/effects/effect-view.js';

/** Command that advances to the next effect. */
const CMD_CYCLE = 'fx:cycle';
/** A no-op command the animation timer emits to flush one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';
/** Timer period in ms (~12 fps). */
const TICK_MS = 80;

export default defineExample({
  title: 'Starfield, plasma & fire',
  blurb: 'A full-screen truecolor effects canvas — flying starfield, plasma, and fire; 1/2/3 to pick, Space to cycle.',
  build: (ctx) => {
    // The three number keys select an effect directly; Space cycles to the next one. Bound app-wide,
    // since the shared demo chrome owns the menu bar.
    const app = demoApp(ctx, {
      keymap: createKeymap({ '1': 'fx:0', '2': 'fx:1', '3': 'fx:2', space: CMD_CYCLE }),
    });

    const frame = signal(0);
    const mode = signal(0);
    EFFECTS.forEach((_, i) => app.onCommand(`fx:${i}`, () => mode.set(i)));
    app.onCommand(CMD_CYCLE, () => mode.set((mode.peek() + 1) % EFFECTS.length));

    // A window covering the centre quarter of the desktop (half its width and height). The title
    // carries the controls; the window cannot be closed away (there is no File menu to reopen it).
    const { width: dw, height: dh } = app.desktop.bounds;
    const width = Math.max(24, Math.round(dw * 0.5));
    const height = Math.max(10, Math.round(dh * 0.5));
    const x = Math.floor((dw - width) / 2);
    const y = Math.floor((dh - height) / 2);
    const canvas = new Window('Effects — 1 Starfield · 2 Plasma · 3 Fire · Space cycles');
    canvas.closable = false;
    canvas.setLayout({ rect: { x, y, width, height } });
    canvas.add(
      new EffectView(
        () => frame(),
        () => mode(),
      ),
    );
    app.desktop.addWindow(canvas);

    const timer = setInterval(() => {
      frame.set(frame.peek() + 1);
      app.loop.emitCommand(CMD_REFRESH);
    }, TICK_MS);
    ctx.onCleanup?.(() => clearInterval(timer));
    if (typeof timer.unref === 'function') timer.unref();

    return app;
  },
});
