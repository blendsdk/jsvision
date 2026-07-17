/**
 * `demo:amiga-clock` — a live Turbo Vision-style desktop hosting three working clocks, each in its
 * own draggable/closable/zoomable window, built on `@jsvision/ui`.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples demo:amiga-clock
 *
 * The three windows are three takes on a clock, all live:
 *
 *   Analog     a round Workbench-style face with hour/minute/second hands ({@link AnalogClock})
 *   Digital    a big block-glyph HH:MM:SS with a blinking colon      ({@link DigitalClock})
 *   Boing      the Amiga boing ball, spinning + bouncing, time overlaid ({@link BoingClock})
 *
 * Window management is the standard shell:
 *
 *   drag a title  move · corner grip  resize · F2 zoom · F3 close
 *   F4 tile · F5 cascade · F6 next · Tab focus · Alt-X quit
 *
 * One ~12 fps timer bumps a `frame` counter (spin + bounce) and a `now` `Date` signal (the clocks);
 * the reactive `View`s bound to them repaint with no manual redraw — the thing classic Turbo Vision
 * had to drive by hand. Dev-only example, not part of the published package; imported by name
 * (`@jsvision/ui`) exactly as a consumer would. The `.js` extension in import specifiers is required
 * by NodeNext ESM resolution.
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
  SplitView,
  signal,
} from '@jsvision/ui';
import { AnalogClock } from './analog-clock.js';
import { DigitalClock } from './digital-clock.js';
import { BoingClock } from './boing-clock.js';

/** A no-op command the animation timer emits to drive one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';

/** The system (≡) menu glyph. */
const SYSTEM_MENU = '≡';

/** Timer period in ms (~12 fps) — smooth enough for the boing spin and a sweeping second hand. */
const TICK_MS = 80;

/** Build the menu bar — a system menu plus the standard Window menu. */
function buildMenuBar(): ReturnType<typeof menuBar> {
  return menuBar([
    subMenu(SYSTEM_MENU, [item('E~x~it', Commands.quit, 'Alt-X')]),
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
      'demo:amiga-clock needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:amiga-clock\n',
    );
    return 0;
  }

  // Auto-detect the terminal, forcing SGR mouse (so the host enables reporting) + UTF-8 (so the
  // box-drawing frames + block glyphs render, honestly falling back to ASCII otherwise).
  const caps = resolveCapabilities({
    override: { mouse: { sgr: true, drag: true, wheel: true }, unicode: { utf8: true } },
  }).profile;

  // Signals the timer drives; the reactive clock views bind to them.
  const frame = signal(0);
  const now = signal(new Date());

  const app = createApplication({ caps, menuBar: buildMenuBar(), statusLine: buildStatusLine() });
  app.desktop.shadow = true; // Turbo Vision-style drop-shadows under the windows

  const analog = new Window('Analog');
  analog.number = 1;
  analog.layout.rect = { x: 1, y: 1, width: 24, height: 13 };
  analog.add(new AnalogClock(() => now()));
  app.desktop.addWindow(analog);

  const digital = new Window('Digital');
  digital.number = 2;
  digital.layout.rect = { x: 27, y: 1, width: 33, height: 9 };
  digital.add(new DigitalClock(() => now()));
  app.desktop.addWindow(digital);

  const boing = new Window('Boing');
  boing.number = 3;
  boing.layout.rect = { x: 14, y: 8, width: 34, height: 15 };
  boing.add(
    new BoingClock(
      () => frame(),
      () => now(),
    ),
  );
  app.desktop.addWindow(boing);

  // A 4th window nests all three clocks in one SplitView grid — row:[ Analog | col:[ Digital / Boing ] ]
  // — using FRESH clock instances bound to the same now/frame closures, so they animate off the same
  // timer as the standalone windows above. This is the "a SplitView composes inside a Window" demo:
  // position:'fill' fills the window's padded interior, and dragging an interior divider hit-tests to
  // the splitter (the deepest view), never the window frame, so resize and window-move never collide.
  const clocks = new Window('Clocks');
  clocks.number = 4;
  clocks.layout.rect = { x: 4, y: 4, width: 60, height: 20 };
  const rightSizes = signal([1, 1]);
  const right = new SplitView({
    direction: 'col',
    children: [
      new DigitalClock(() => now()),
      new BoingClock(
        () => frame(),
        () => now(),
      ),
    ],
    sizes: rightSizes,
    minSize: [9, 9],
  });
  const gridSizes = signal([1, 1]);
  const grid = new SplitView({
    direction: 'row',
    children: [new AnalogClock(() => now()), right],
    sizes: gridSizes,
    minSize: [24, 24],
  });
  grid.layout = { position: 'fill' };
  clocks.add(grid);
  app.desktop.addWindow(clocks);

  // Bump the signals, then emit a no-op command so the loop flushes one coalesced frame per tick.
  const timer = setInterval(() => {
    frame.set(frame.peek() + 1);
    now.set(new Date());
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
