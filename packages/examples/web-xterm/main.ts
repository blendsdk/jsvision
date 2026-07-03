/**
 * `demo:web` browser entry — mounts the jsvision Turbo Vision app (`app.ts`) into
 * an [xterm.js](https://xtermjs.org) terminal via the browser host (`browser-host.ts`).
 *
 * The wiring is the browser mirror of `@jsvision/ui`'s native `run()` (`app/run.ts`):
 * point the loop's frame/caret sinks at the host, feed host input into `loop.dispatch`,
 * and map terminal resize to `loop.resize`. The event loop is fully synchronous
 * (`runTick` drains + flushes inline per dispatch), so no Node event-loop primitive
 * is involved — a browser `setInterval` drives the clock.
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { createBrowserHost } from './browser-host.js';
import { buildApp, formatTime, WEB_CAPS, CMD_TICK } from './app.js';

/**
 * Load xterm's WebGL renderer. It rasterizes box-drawing (`┌─┐│└┘`) and block/shade
 * glyphs (`█▄▀▒`) with its own built-in geometry — crisp and gap-free regardless of
 * the system monospace font's coverage — which is exactly what a TUI's frame chrome
 * needs. Falls back silently to the DOM renderer if WebGL is unavailable.
 */
function enableWebgl(term: Terminal): void {
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => addon.dispose());
    term.loadAddon(addon);
  } catch {
    /* no WebGL (headless/blocklisted GPU) — the DOM renderer still draws Unicode via the font */
  }
}

/** DOS-flavoured xterm theme so the browser terminal reads like a real console. */
const TERMINAL_THEME = {
  background: '#0000aa', // matches nothing jsvision draws over — the desktop fills every cell
  foreground: '#aaaaaa',
  cursor: '#aaaaaa',
};

function boot(): void {
  const mount = document.getElementById('terminal');
  if (mount === null) throw new Error('web-xterm: #terminal mount point missing');

  const term = new Terminal({
    fontFamily: '"Cascadia Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace',
    fontSize: 15,
    cursorBlink: true,
    allowProposedApi: true,
    theme: TERMINAL_THEME,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(mount);
  enableWebgl(term); // must load after open() (needs the canvas)
  fit.fit();

  // Compose the app at xterm's measured grid; the first host resize corrects any drift.
  const { app, clock } = buildApp({ width: term.cols, height: term.rows });
  const loop = app.loop;

  const host = createBrowserHost({
    term,
    caps: WEB_CAPS,
    onInput: (event) => loop.dispatch(event),
  });

  // Point the loop's output sinks at the host (the browser mirror of run.ts).
  loop.onFrame = (buffer) => host.render(buffer);
  loop.onCaret = (cell) => host.setCaret(cell);
  loop.writeClipboard = (seq) => term.write(seq);

  host.start();
  host.render(loop.renderRoot.buffer()); // paint the first frame
  loop.refreshCaret(); // position the initial caret (the first render is not a loop tick)

  // Terminal → app resize, and window → terminal refit.
  term.onResize(({ cols, rows }) => loop.resize({ width: cols, height: rows }));
  window.addEventListener('resize', () => fit.fit());

  // The live clock: update the signal, then emit a no-op command so the loop paints one frame.
  const tick = (): void => {
    clock.set(formatTime(new Date()));
    loop.emitCommand(CMD_TICK);
  };
  tick();
  window.setInterval(tick, 1000);

  term.focus();
}

boot();
