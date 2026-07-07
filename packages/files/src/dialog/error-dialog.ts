/**
 * A small, self-contained modal error box: a gray dialog showing a one-line message plus an OK button.
 * The file dialogs use it to report a bad filename or an unreadable directory, but you can call it for
 * any short error. The message is sanitized when drawn, so it is safe to pass user- or error-derived
 * text. The dialog that raised it stays open underneath (modals nest last-in-first-out).
 */
import { Dialog, Text, okButton } from '@jsvision/ui';
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
  const height = 7;
  const dlg = new Dialog({ title: 'Error', width, height, centered: true });

  const text = new Text(message);
  text.layout = { position: 'absolute', rect: { x: 2, y: 2, width: width - 4, height: 1 } };
  const ok = okButton();
  ok.layout = {
    position: 'absolute',
    rect: { x: Math.max(2, Math.floor((width - 10) / 2)), y: height - 3, width: 10, height: 2 },
  };
  dlg.add(text);
  dlg.add(ok);

  host.desktop.addWindow(dlg);
  try {
    await host.loop.execView<string>(dlg as unknown as View);
  } finally {
    host.desktop.removeWindow(dlg);
  }
}
