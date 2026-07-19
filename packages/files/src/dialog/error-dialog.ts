/**
 * A small, self-contained modal error box: a gray dialog showing a message plus an OK button. The
 * file dialogs use it to report a bad filename or an unreadable directory, but you can call it for
 * any error. The message is sanitized when drawn, so it is safe to pass user- or error-derived text.
 * The dialog that raised it stays open underneath (modals nest last-in-first-out).
 *
 * The box sizes itself to its message: wide enough for the text within a 24–60 column range, then
 * tall enough for however many lines the message wraps to at that width. A long message is therefore
 * shown in full rather than truncated at the first row.
 */
import { Dialog, Text, okButton, col, cover, fixed, grow, row, wrapText } from '@jsvision/ui';
import type { View, EventLoop, Desktop } from '@jsvision/ui';

/**
 * The minimal host a modal needs: an event loop that can run a view modally and a desktop to mount it
 * into. The result of `createApplication` satisfies this. Because running a view modally does not
 * mount it, callers add it to the desktop, run it, then remove it in a `finally`.
 */
export interface ExecHost {
  /** Runs a view modally, resolving to the command that closed it. */
  loop: Pick<EventLoop, 'execView'>;
  /** The desktop the modal is mounted into (added before, removed after). */
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow'>;
}

/**
 * Show a modal error box with a message and an OK button; resolves once the user closes it (OK or Esc).
 *
 * @param host    A host that can run a view modally — the `createApplication` result works directly.
 * @param message The error text to show; it is sanitized when drawn.
 * @returns A promise that resolves when the box is dismissed.
 * @example
 * import { createApplication } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { errorBox } from '@jsvision/files';
 *
 * const caps = resolveCapabilities({ env: process.env, platform: process.platform }).profile;
 * const app = createApplication({ caps });
 *
 * await errorBox(app, "Invalid file name: 'a/b'");
 */
export async function errorBox(host: ExecHost, message: string): Promise<void> {
  const width = Math.min(60, Math.max(24, message.length + 6));
  // The dialog's padded frame interior is two columns narrower than the box, so wrap to that to learn
  // how many rows the message really needs. Measuring it here rather than letting the text view
  // self-size is deliberate: a view reports its unwrapped line count, which would size the box for one
  // row and silently clip everything past the first line.
  const height = wrapText(message, width - 2).length + 4; // + frame (2) + button band (2)
  const dlg = new Dialog({ title: 'Error', width, height, centered: true });

  const ok = okButton();
  dlg.add(cover(col(grow(new Text(message)), fixed(row({ justify: 'center' }, ok), 2))));

  host.desktop.addWindow(dlg);
  try {
    await host.loop.execView<string>(dlg as unknown as View);
  } finally {
    host.desktop.removeWindow(dlg);
  }
}
