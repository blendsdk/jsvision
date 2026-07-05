/**
 * The local error dialog (PA-3) — a minimal modal gray `Dialog` used by `FileDialog`/`ChDirDialog` on a
 * failed `valid()`. **Not** a `TMsgBox` cell-by-cell decode (a faithful shared `messageBox` is a
 * separate future RD); it is a contained extension, so no GATE diff.
 *
 * The message is the faithful TV string (`"Invalid file name: '%s'"`, `"Invalid drive or directory"`,
 * `"Invalid directory"`); it is sanitized at the draw boundary (`Text`, AC-14 — no stack detail). The
 * parent dialog stays open underneath (nested LIFO modality via `execView`). `.js` per NodeNext.
 */
import { Dialog, Text, okButton } from '@jsvision/ui';
import type { View, EventLoop, Desktop } from '@jsvision/ui';

/**
 * An `execView`-capable host: the `createApplication` result (`{ loop, desktop }`), or any shape
 * exposing the modal open + desktop mounting the shipped lifecycle needs (PA-8). Because `execView`
 * does not mount the view, the caller **adds it to the desktop → `execView` → removes it** in `finally`.
 */
export interface ExecHost {
  /** The event loop's modal seam (`execView` resolves to the terminating command, AR-108). */
  loop: Pick<EventLoop, 'execView'>;
  /** The desktop the modal is mounted into (add before / remove after `execView`). */
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow'>;
}

/**
 * Show a small modal error box with `message` + an OK button; resolves when OK/Esc closes it.
 *
 * @param host    The execView-capable app handle.
 * @param message The (already faithful) error string; sanitized at draw.
 */
export async function errorBox(host: ExecHost, message: string): Promise<void> {
  const width = Math.min(60, Math.max(24, message.length + 6));
  const height = 7;
  const dlg = new Dialog({ title: 'Error', width, height, centered: true });

  const text = new Text(message);
  text.layout = { position: 'absolute', rect: { x: 2, y: 2, width: width - 4, height: 1 } };
  const ok = okButton();
  ok.layout = { position: 'absolute', rect: { x: Math.max(2, Math.floor((width - 10) / 2)), y: height - 3, width: 10, height: 2 } };
  dlg.add(text);
  dlg.add(ok);

  host.desktop.addWindow(dlg);
  try {
    await host.loop.execView<string>(dlg as unknown as View);
  } finally {
    host.desktop.removeWindow(dlg);
  }
}
