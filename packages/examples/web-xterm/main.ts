/**
 * `demo:web` browser entry — mounts the jsvision app (`app.ts`) into an
 * [xterm.js](https://xtermjs.org) terminal via `@jsvision/web`'s `mountApp`.
 *
 * `mountApp` is the browser mirror of `@jsvision/ui`'s native `run()`: it wires the loop's
 * frame/caret/clipboard sinks to the terminal, starts the host, paints the first frame, maps terminal
 * resize to `loop.resize`, and focuses. The demo keeps only the browser-specific niceties `mountApp`
 * deliberately leaves to the caller — the WebGL renderer, the fit addon, and the `setInterval` clock.
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { mountApp } from '@jsvision/web';
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

  // Wire the app to the terminal in one call: host, sinks, first frame, resize→loop, and focus.
  mountApp({ element: mount, app, caps: WEB_CAPS, term });

  // Window → terminal refit (the fit addon then fires term.onResize → loop.resize, handled by mountApp).
  window.addEventListener('resize', () => fit.fit());

  // The live clock: update the signal, then emit a no-op command so the loop paints one frame.
  const tick = (): void => {
    clock.set(formatTime(new Date()));
    app.loop.emitCommand(CMD_TICK);
  };
  tick();
  window.setInterval(tick, 1000);
}

boot();
