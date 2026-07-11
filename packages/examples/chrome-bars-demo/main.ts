/**
 * `demo:chrome-bars` — the flexible app-shell chrome bars.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples demo:chrome-bars
 *
 * It composes a live application whose status line and menu bar pack through the layout engine:
 *
 *   - the **status line** is `‹Alt-X Exit›  ——— fill ———  ‹ProgressBar› ‹clock›` — a `spacer()`
 *     pushes an embedded `ProgressBar` and a command-less live clock to the right edge;
 *   - the **menu bar** is `File  ——— fill ———  Help` — a `menuSpacer()` right-aligns Help, and its
 *     dropdown still opens under the moved title.
 *
 * A ~1s timer advances the bar (wrapping) and ticks the clock; both repaint with no manual redraw.
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly
 * as a consumer would. The `.js` extension in import specifiers is required by NodeNext ESM
 * resolution.
 */
import {
  createApplication,
  Window,
  Text,
  menuBar,
  subMenu,
  item,
  menuSpacer,
  statusLine,
  statusItem,
  spacer,
  fixed,
  ProgressBar,
  Commands,
  signal,
} from '@jsvision/ui';

/** A demo-local command for the Help menu item. */
const CMD_HELP = 'help';
/** A no-op command the timer emits purely to drive one coalesced frame per tick. */
const CMD_REFRESH = '__refresh__';

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
/** Format a clock as `HH:MM:SS`. */
function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** Compose, wire, and run the application until `quit`; returns the exit code. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:chrome-bars needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:chrome-bars\n',
    );
    return 0;
  }

  const value = signal(0);
  const clock = signal(formatTime(new Date()));

  // Menu bar: File on the left, Help pushed to the right edge by a spacer (its popup follows the title).
  const bar = menuBar([
    subMenu('~F~ile', [item('E~x~it', Commands.quit, 'Alt-X')]),
    menuSpacer(),
    subMenu('~H~elp', [item('~A~bout', CMD_HELP, 'F1')]),
  ]);

  // Status line: Exit on the left, then fill, then a live ProgressBar + clock flush right.
  const status = statusLine([
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    spacer(),
    fixed(new ProgressBar({ value, caption: true }), 36),
    statusItem(() => clock()),
  ]);

  const app = createApplication({ menuBar: bar, statusLine: status });
  app.desktop.shadow = true;
  app.onCommand(CMD_HELP, () => {
    /* Help is wired only to show the right-aligned menu title opens its popup; no dialog here. */
  });

  const win = new Window('Flexible Chrome Bars');
  win.number = 1;
  win.layout.rect = { x: 2, y: 2, width: 48, height: 9 };
  const body = new Text(
    [
      'The status line and menu bar pack through the layout engine.',
      '',
      'spacer()      right-aligns the progress bar + clock',
      'menuSpacer()  pushes Help to the right edge',
      '',
      'Alt-X quits.',
    ].join('\n'),
  );
  body.layout = { size: { kind: 'fr', weight: 1 } };
  win.add(body);
  app.desktop.addWindow(win);

  // ~1s: advance the bar (wrapping) + tick the clock, then emit a no-op command to flush one frame.
  const timer = setInterval(() => {
    const next = value.peek() >= 1 ? 0 : Math.round((value.peek() + 0.1) * 10) / 10;
    value.set(next);
    clock.set(formatTime(new Date()));
    app.loop.emitCommand(CMD_REFRESH);
  }, 1000);
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
