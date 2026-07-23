/**
 * `demo:tvision` — a live, interactive Turbo Vision-style desktop built on `@jsvision/ui`.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples demo:tvision
 *
 * It composes a full application faithful to Turbo Vision's default palette — the steel blue-grey
 * patterned desktop (`cpAppColor` 0x71), a grey menu bar + status line with red hotkeys, blue
 * (`cpBlueWindow`) windows with white active / lightGray inactive frames and brightGreen close/zoom
 * icons, a greyed (disabled) "Save" menu item, and two-column drop-shadows — and wires the host so it
 * is fully interactive:
 *
 *   F10 / Alt-letter  open menus      drag a title   move a window     ─┘ grip    resize
 *   F2 zoom · F3 close · F4 tile · F5 cascade · F6 next · Tab focus · F1 about · Alt-X quit
 *
 * It also shows three things classic Turbo Vision could not: a **24-bit truecolor** gradient window
 * (the engine downsamples to your terminal's depth), a **live, signal-driven** clock + animation
 * that repaints with no manual redraw, and a zero-ceremony **About** box via `messageBox`.
 *
 * It doubles as the flagship proof of the convenience layer: zero-config capabilities (no `caps`
 * prologue), a single-package import surface (everything from `@jsvision/ui`), `app.onCommand` for the
 * About command (no invisible view), and `messageBox` for the About box (no manual modal ceremony).
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly
 * as a consumer would. The `.js` extension in import specifiers is required by NodeNext ESM
 * resolution.
 */
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
  messageBox,
} from '@jsvision/ui';
import { GradientView, LiveView, HelpView } from './widgets.js';

/** Demo-local command names (not built-in shell commands). */
const CMD_ABOUT = 'about';
/** A deliberately-disabled command, to show the greyed (no-accent) menu-item state for the audit. */
const CMD_SAVE = 'save';
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
    subMenu(SYSTEM_MENU, [
      item('~A~bout', CMD_ABOUT, 'F1'),
      item('~S~ave', CMD_SAVE, 'Ctrl+S'), // disabled below — shows the greyed item state
      separator(),
      item('E~x~it', Commands.quit, 'Alt-X'),
    ]),
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

  // Signals the animation timer drives; the reactive views bind to them.
  const frame = signal(0);
  const clock = signal(formatTime(new Date()));

  // Zero-config: capabilities are auto-detected from the terminal — no `caps` prologue, and every
  // symbol imports from the single `@jsvision/ui` package. The `░` desktop and `╔═╗`/`┌─┐` frames
  // render under a UTF-8 locale and honestly fall back to ASCII otherwise.
  const app = createApplication({ menuBar: buildMenuBar(), statusLine: buildStatusLine() });
  app.desktop.shadow = true; // Turbo Vision-style drop-shadows under the windows
  app.loop.enableCommand(CMD_SAVE, false); // grey out "Save" so the disabled menu-item state is visible

  // About box: `app.onCommand` handles the `about` command directly (no invisible sink view), and
  // `messageBox` runs the modal — sizing, centering, and teardown are all handled for you.
  app.onCommand(CMD_ABOUT, () => {
    void messageBox(app, { title: 'About', text: 'jsvision — Turbo Vision, reimagined' });
  });

  // Three staggered windows: help, a truecolor gradient, and a live reactive gadget.
  const help = new Window('Welcome');
  help.number = 1;
  help.setLayout({ rect: { x: 1, y: 1, width: 30, height: 14 } });
  help.add(new HelpView(HELP_LINES));
  app.desktop.addWindow(help);

  const gradient = new Window('True Color');
  gradient.number = 2;
  gradient.setLayout({ rect: { x: 33, y: 1, width: 30, height: 12 } });
  gradient.add(new GradientView(() => frame()));
  app.desktop.addWindow(gradient);

  const live = new Window('Live');
  live.number = 3;
  live.setLayout({ rect: { x: 20, y: 9, width: 26, height: 11 } });
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
