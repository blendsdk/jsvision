/**
 * `demo:matrix` — the famous *Matrix* "digital rain" as a live Turbo Vision-style desktop built on
 * `@jsvision/ui`. Each window holds its own field of falling green code ({@link MatrixRain}); open as
 * many as you like and arrange them like any other windows.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples demo:matrix
 *
 * Controls:
 *
 *   F7 new rain window · drag a title  move · corner grip  resize
 *   F2 zoom · F3 close · F4 tile · F5 cascade · F6 next · Tab focus · Alt-X quit
 *
 * One ~12 fps timer bumps a shared `frame` counter; every rain view is bound to it, so a single
 * timer animates all the windows at once — including ones opened later — with no manual redraw. The
 * whole desktop wears a green-on-black {@link matrixTheme}. Dev-only example, not part of the
 * published package; imported by name (`@jsvision/ui`) exactly as a consumer would. The `.js`
 * extension in import specifiers is required by NodeNext ESM resolution.
 */
import { resolveCapabilities } from '@jsvision/core';
import {
  createApplication,
  Window,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  Commands,
  signal,
} from '@jsvision/ui';
import { MatrixRain } from './matrix-rain.js';
import { matrixTheme } from './theme.js';

/** Command that opens a fresh rain window. */
const CMD_NEW = 'matrix:new';
/** A no-op command the animation timer emits to drive one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';

/** The system (≡) menu glyph. */
const SYSTEM_MENU = '≡';

/** Timer period in ms (~12 fps) — smooth streaming without burning CPU. */
const TICK_MS = 80;

/** Build the menu bar — a system menu (new/exit) plus the standard Window menu. */
function buildMenuBar(): ReturnType<typeof menuBar> {
  return menuBar([
    subMenu(SYSTEM_MENU, [item('~N~ew Rain', CMD_NEW, 'F7'), separator(), item('E~x~it', Commands.quit, 'Alt-X')]),
    subMenu('~W~indow', [
      item('~N~ext', Commands.next, 'F6'),
      item('~T~ile', Commands.tile, 'F4'),
      item('~C~ascade', Commands.cascade, 'F5'),
      item('~Z~oom', Commands.zoom, 'F2'),
      separator(),
      item('Cl~o~se', Commands.close, 'F3'),
    ]),
  ]);
}

/** Build the status line — global accelerators that fire regardless of focus. */
function buildStatusLine(): ReturnType<typeof statusLine> {
  return statusLine([
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    statusItem('~F7~ New', CMD_NEW, 'F7'),
    statusItem('~F2~ Zoom', Commands.zoom, 'F2'),
    statusItem('~F3~ Close', Commands.close, 'F3'),
    statusItem('~F4~ Tile', Commands.tile, 'F4'),
    statusItem('~F5~ Cascade', Commands.cascade, 'F5'),
    statusItem('~F6~ Next', Commands.next, 'F6'),
  ]);
}

/** Compose, wire, and run the application until `quit`; returns the exit code. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:matrix needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:matrix\n',
    );
    return 0;
  }

  // Auto-detect the terminal, forcing SGR mouse (so the host enables reporting) + UTF-8 (so the
  // katakana glyphs + box-drawing frames render, honestly falling back to ASCII otherwise).
  const caps = resolveCapabilities({
    override: { mouse: { sgr: true, drag: true, wheel: true }, unicode: { utf8: true } },
  }).profile;

  // The single signal the timer drives; every rain view binds to it.
  const frame = signal(0);

  const app = createApplication({
    caps,
    theme: matrixTheme,
    menuBar: buildMenuBar(),
    statusLine: buildStatusLine(),
  });
  app.desktop.shadow = true; // Turbo Vision-style drop-shadows under the windows

  // Running count of rain windows ever opened — drives the window number and cascade offset.
  let count = 0;

  /** Open one rain window at the given interior-relative rect and bind it to the shared frame. */
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

  // F7 / menu: open another rain window, cascaded within the live desktop, then reflow so the
  // late-added window gets a layout pass (a freshly added window is 0x0 until the next reflow).
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
  if (typeof timer.unref === 'function') timer.unref();

  try {
    return await app.run();
  } finally {
    clearInterval(timer);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
