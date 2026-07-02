/**
 * `demo:controls-live` — a live, interactive Turbo Vision-style dialog for visually auditing the
 * RD-06 essential controls on a real terminal.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples demo:controls-live
 *
 * It builds the classic grey Turbo Vision **parameters dialog** (see `form.ts`) — a {@link Dialog}
 * hosting every Tier-1 leaf control at once so each can be checked against the original:
 *
 *   Text       a static header + a word-wrapped paragraph (`TStaticText`)
 *   Label      `~N~ame` / `~A~ge`, linked to their inputs (`TLabel` — Alt-letter jumps focus,
 *              the label brightens to `labelSelected` while its input is focused)
 *   Input      two `TInputLine`s with live validators — Name allows only letters/space
 *              (`filter`), Age only 0–150 (`range`); both scroll with `◄`/`►` when overfull
 *   CheckGroup Bold / Italic / Underline (`TCheckBoxes`, `[X]`)
 *   RadioGroup Left / Center / Right (`TRadioButtons`, `(•)`)
 *   Button     OK (default, `buttonDefault`), Cancel + Help (`button`), and a disabled Save
 *              (`buttonDisabled`) — all four button faces visible at once, each with its `▄█▀` shadow
 *
 * Interact: Tab / Shift-Tab move focus, Alt-N / Alt-A jump to a field, type into the inputs (watch
 * the validators reject live), Space / ↑ ↓ drive the check/radio groups, Enter (or click) fires the
 * default OK, F1 toggles the hint line (a reactive `Text`), and the echo line under the paragraph
 * updates live from the bound signals — the reactive repaint classic Turbo Vision did by hand.
 * F10 opens the menu; Alt-X, OK, or Cancel quits.
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly
 * as a consumer would. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createApplication, menuBar, subMenu, item, separator, statusLine, statusItem, Commands } from '@jsvision/ui';
import { CommandSink } from './dialog.js';
import { buildDialog, CMD_OK, CMD_CANCEL, CMD_HELP } from './form.js';

/** The system (≡) menu glyph. */
const SYSTEM_MENU = '≡';

/** Build the menu bar — a system menu plus Help, classic Turbo Vision layout. */
function buildMenuBar(): ReturnType<typeof menuBar> {
  return menuBar([
    subMenu(SYSTEM_MENU, [item('~H~elp hints', CMD_HELP, 'F1'), separator(), item('E~x~it', Commands.quit, 'Alt-X')]),
    subMenu('~H~elp', [item('~T~oggle hints', CMD_HELP, 'F1')]),
  ]);
}

/** Build the status line — global accelerators that fire regardless of focus. */
function buildStatusLine(): ReturnType<typeof statusLine> {
  return statusLine([
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    statusItem('~F1~ Hints', CMD_HELP, 'F1'),
    statusItem('~Tab~ Focus', Commands.next, 'Tab'),
  ]);
}

/** Compose, wire, and run the application until `quit`; returns the exit code. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:controls-live needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:controls-live\n' +
        '(For a headless, scripted walkthrough instead, use:  yarn workspace @jsvision/examples demo:controls)\n',
    );
    return 0;
  }

  // Auto-detect, forcing only SGR mouse + UTF-8. Box-drawing / half-block glyphs now derive from the
  // detected UTF-8 locale (HR-07/PA-9) instead of a manual override.
  const caps = resolveCapabilities({
    override: {
      mouse: { sgr: true, drag: true, wheel: true },
      unicode: { utf8: true },
    },
  }).profile;

  const app = createApplication({ caps, menuBar: buildMenuBar(), statusLine: buildStatusLine() });
  app.desktop.shadow = true; // Turbo Vision-style drop-shadow under the dialog

  const { dialog, firstInput, toggleHelp } = buildDialog();

  // Center the dialog on the desktop.
  const width = 58;
  const height = 19;
  const dw = app.desktop.bounds.width;
  const dh = app.desktop.bounds.height;
  dialog.layout.rect = {
    x: Math.max(0, Math.floor((dw - width) / 2)),
    y: Math.max(0, Math.floor((dh - height) / 2)),
    width: Math.min(width, dw),
    height: Math.min(height, dh),
  };

  // OK / Cancel quit; Help (F1 / button / menu) toggles the reactive hint line.
  const quit = (): void => app.loop.emitCommand(Commands.quit);
  app.desktop.add(new CommandSink({ [CMD_OK]: quit, [CMD_CANCEL]: quit, [CMD_HELP]: toggleHelp }));

  app.desktop.addWindow(dialog);
  app.loop.focusView(firstInput); // open with the Name field focused

  return app.run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
