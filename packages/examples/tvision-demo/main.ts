/**
 * `demo:tvision` — a live, interactive Turbo Vision-style desktop built on `@jsvision/ui`.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples demo:tvision
 *
 * It composes a full application — the classic blue patterned desktop, a grey menu bar with red
 * hotkeys, a grey status line, and framed/movable/resizable/zoomable windows with active/inactive
 * theming — and wires the host so it is fully interactive:
 *
 *   F10 / Alt-letter  open menus      drag a title   move a window     ◢ corner   resize
 *   F2 zoom · F3 close · F4 tile · F5 cascade · F6 next · Tab focus · F1 about · Alt-X quit
 *
 * It also shows three things classic Turbo Vision could not: a **24-bit truecolor** gradient window
 * (the engine downsamples to your terminal's depth), a **live, signal-driven** clock + animation
 * that repaints with no manual redraw, and an **About** modal via `execView`/`endModal`.
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly
 * as a consumer would. The `.js` extension in import specifiers is required by NodeNext ESM
 * resolution.
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
import { GradientView, LiveView, HelpView, AboutDialog, CommandSink } from './widgets.js';

/** Demo-local command names (not built-in shell commands). */
const CMD_ABOUT = 'about';
/** A no-op command the animation timer emits purely to drive one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';

/** The system (≡) menu glyph. */
const SYSTEM_MENU = '≡';

/** The Welcome window's help text (two-space-indented rows render blue). */
const HELP_LINES = [
  'Turbo Vision, reimagined',
  'in TypeScript.',
  '',
  '  F10      menu bar',
  '  drag     move a window',
  '  corner   resize a window',
  '  F2       zoom',
  '  F4 / F5  tile / cascade',
  '  F6       next window',
  '  Tab      cycle focus',
  '  F1       about',
  '  Alt-X    quit',
];

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a clock as `HH:MM:SS`. */
function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** Build the menu bar — a system menu plus Window and Help, classic Turbo Vision layout. */
function buildMenuBar(): ReturnType<typeof menuBar> {
  return menuBar([
    subMenu(SYSTEM_MENU, [item('~A~bout', CMD_ABOUT, 'F1'), separator(), item('E~x~it', Commands.quit, 'Alt-X')]),
    subMenu('~W~indow', [
      item('~N~ext', Commands.next, 'F6'),
      item('~P~rev', Commands.prev),
      item('~T~ile', Commands.tile, 'F4'),
      item('~C~ascade', Commands.cascade, 'F5'),
      item('~Z~oom', Commands.zoom, 'F2'),
      separator(),
      item('Cl~o~se', Commands.close, 'F3'),
    ]),
    subMenu('~H~elp', [item('~A~bout', CMD_ABOUT, 'F1')]),
  ]);
}

/** Build the status line — global accelerators that fire regardless of focus. */
function buildStatusLine(): ReturnType<typeof statusLine> {
  return statusLine([
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    statusItem('~F1~ About', CMD_ABOUT, 'F1'),
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
      'demo:tvision needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:tvision\n',
    );
    return 0;
  }

  // Auto-detect the terminal, but force SGR mouse on so the host enables mouse reporting — the demo
  // is about interactivity, and conservative auto-detection often leaves `mouse.sgr` false.
  const caps = resolveCapabilities({ override: { mouse: { sgr: true, drag: true, wheel: true } } }).profile;

  // Signals the animation timer drives; the reactive views bind to them.
  const frame = signal(0);
  const clock = signal(formatTime(new Date()));

  const app = createApplication({ caps, menuBar: buildMenuBar(), statusLine: buildStatusLine() });

  // About modal: a hidden command sink turns the `about` command into an `execView` modal.
  const openAbout = (): void => {
    const dialogWidth = 46;
    const dialogHeight = 9;
    const dw = app.desktop.bounds.width;
    const dh = app.desktop.bounds.height;
    const width = Math.min(dialogWidth, dw);
    const height = Math.min(dialogHeight, dh);
    const rect = {
      x: Math.max(0, Math.floor((dw - width) / 2)),
      y: Math.max(0, Math.floor((dh - height) / 2)),
      width,
      height,
    };
    const dialog = new AboutDialog(() => {
      app.loop.endModal(undefined);
      app.desktop.remove(dialog);
      app.loop.emitCommand(CMD_REFRESH); // reflect the removal in the next coalesced frame
    });
    dialog.layout = { position: 'absolute', rect };
    app.desktop.add(dialog);
    void app.loop.execView(dialog).catch(() => undefined);
  };
  app.desktop.add(new CommandSink({ [CMD_ABOUT]: openAbout }));

  // Three staggered windows: help, a truecolor gradient, and a live reactive gadget.
  const help = new Window('Welcome');
  help.number = 1;
  help.layout.rect = { x: 1, y: 1, width: 30, height: 14 };
  help.add(new HelpView(HELP_LINES));
  app.desktop.addWindow(help);

  const gradient = new Window('True Color');
  gradient.number = 2;
  gradient.layout.rect = { x: 33, y: 1, width: 30, height: 12 };
  gradient.add(new GradientView(() => frame()));
  app.desktop.addWindow(gradient);

  const live = new Window('Live');
  live.number = 3;
  live.layout.rect = { x: 20, y: 9, width: 26, height: 11 };
  live.add(
    new LiveView(
      () => clock(),
      () => frame(),
    ),
  );
  app.desktop.addWindow(live);

  // ~10 fps: bump the signals, then emit a no-op command so the loop flushes one coalesced frame.
  const timer = setInterval(() => {
    frame.set(frame.peek() + 1);
    clock.set(formatTime(new Date()));
    app.loop.emitCommand(CMD_REFRESH);
  }, 100);
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
