/**
 * Async modal helpers over {@link Dialog}: a message box, a yes/no confirmation, and a single-field
 * prompt. Each opens a centered modal, awaits the user's answer, and cleans itself up — so nobody
 * hand-writes centering math or teardown. They run against a minimal `{ loop, desktop }` host that an
 * `Application` from `createApplication()` satisfies directly.
 */
import { Text, Label, Input } from '../controls/index.js';
import type { Validator } from '../controls/index.js';
import { col, row, grow, fixed, cover, spacer } from '../view/index.js';
import type { View } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { EventLoop } from '../event/index.js';
import type { Desktop } from '../desktop/index.js';
import { Dialog } from './dialog.js';
import { okButton, cancelButton, yesButton, noButton, okCancelButtons } from './buttons.js';

/**
 * The minimal host a modal helper needs: an event loop to run the modal and a desktop to mount it
 * into. An `Application` from `createApplication()` satisfies this directly — pass the app itself, or
 * `{ loop: app.loop, desktop: app.desktop }`.
 */
export interface ModalDialogHost {
  /** Runs a view modally, resolving to the command that closed it. */
  loop: Pick<EventLoop, 'execView'>;
  /** The desktop the modal mounts into (and whose extent bounds it). */
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;
}

/** Options for {@link messageBox}. */
export interface MessageBoxOptions {
  /** Title centered in the top border. */
  title: string;
  /** The message body; the box sizes itself to fit. */
  text: string;
  /** `'ok'` (default) shows one OK button; `'okCancel'` shows OK + Cancel. */
  buttons?: 'ok' | 'okCancel';
}

/** Options for {@link inputBox}. */
export interface InputBoxOptions {
  /** Title centered in the top border. */
  title: string;
  /** Label shown above the field (supports `~X~` hotkey markup). */
  label: string;
  /** The two-way value signal the field reads and writes. */
  value: Signal<string>;
  /** Optional validator; OK is gated by the dialog's `valid()` sweep, which refocuses an invalid field. */
  validator?: Validator;
  /** A muted hint shown in the prompt field while it is empty; never part of the value. */
  placeholder?: string | Signal<string>;
}

/** The button band is two rows tall: a raised button face plus its drop shadow. */
const BUTTON_BAND_HEIGHT = 2;
/** Cells between the two buttons of a pair. */
const BUTTON_GAP = 2;

/**
 * Mount the dialog, run it modally, and remove it — even if `execView` rejects. Resolves to the
 * command string that closed the dialog. Shared by the helpers here and the editor's dialog builders;
 * intentionally not re-exported through the package barrel (an internal engine, not public API).
 *
 * @param host The modal host (`{ loop, desktop }`).
 * @param dlg  The dialog to run.
 * @returns The command that closed the dialog.
 */
export async function runDialog(host: ModalDialogHost, dlg: Dialog): Promise<string> {
  host.desktop.addWindow(dlg);
  try {
    return await host.loop.execView<string>(dlg as unknown as View);
  } finally {
    host.desktop.removeWindow(dlg);
  }
}

/**
 * Show a modal message box and wait for the user to dismiss it.
 *
 * With the default single OK button the box can still resolve `'cancel'` — `Dialog` is closable and
 * Esc-dismissible, and both resolve the modal to `Commands.cancel`. Callers that only inform the user
 * typically ignore the return value.
 *
 * @param host The modal host (an `Application`, or `{ loop, desktop }`).
 * @param o    Title, message text, and the button set.
 * @returns `'ok'` when OK is chosen, `'cancel'` on Cancel, Esc, or the frame close-box.
 * @example
 * await messageBox(app, { title: 'About', text: 'jsvision — classic terminal UI, reimagined' });
 * const answer = await messageBox(app, { title: 'Delete?', text: 'This cannot be undone.', buttons: 'okCancel' });
 * if (answer === 'ok') remove();
 */
export async function messageBox(host: ModalDialogHost, o: MessageBoxOptions): Promise<'ok' | 'cancel'> {
  const hasCancel = o.buttons === 'okCancel';
  // OK-only reuses the compact info-box geometry; OK/Cancel widens to fit two buttons.
  const width = Math.min(60, Math.max(hasCancel ? 40 : 24, o.text.length + 6));
  const height = hasCancel ? 9 : 7;

  const dlg = new Dialog({ title: o.title, width, height, centered: true });
  dlg.layout = { ...dlg.layout, padding: 0 };
  const buttons = hasCancel
    ? row({ justify: 'center', gap: BUTTON_GAP }, okButton(), cancelButton())
    : row({ justify: 'center' }, okButton());
  // The column covers the dialog box and insets a cell, so its content sits just inside the frame: the
  // message absorbs the leftover height, which keeps the button band on the bottom row at any size.
  dlg.add(cover(col({ padding: 1 }, grow(new Text(o.text)), fixed(buttons, BUTTON_BAND_HEIGHT))));

  const result = await runDialog(host, dlg);
  return result === 'ok' ? 'ok' : 'cancel';
}

/**
 * Ask a yes/no question modally.
 *
 * @param host The modal host (an `Application`, or `{ loop, desktop }`).
 * @param text The question; the box sizes itself to fit.
 * @returns `true` on Yes; `false` on No, Esc, or closing the box.
 * @example
 * if (await confirm(app, 'Discard unsaved changes?')) discard();
 */
export async function confirm(host: ModalDialogHost, text: string): Promise<boolean> {
  const width = Math.min(60, Math.max(40, text.length + 6));
  const dlg = new Dialog({ title: 'Confirm', width, height: 9, centered: true });
  dlg.layout = { ...dlg.layout, padding: 0 };
  dlg.add(
    cover(
      col(
        { padding: 1 },
        grow(new Text(text)),
        fixed(row({ justify: 'center', gap: BUTTON_GAP }, yesButton(), noButton()), BUTTON_BAND_HEIGHT),
      ),
    ),
  );

  const result = await runDialog(host, dlg);
  return result === 'yes';
}

/**
 * Prompt for a single line of text modally. An optional validator gates OK through the dialog's
 * `valid()` sweep, which keeps the box open and refocuses the field when the value is invalid.
 *
 * @param host The modal host (an `Application`, or `{ loop, desktop }`).
 * @param o    Title, field label (with optional `~X~` hotkey), the two-way value signal, and validator.
 * @returns The entered string on OK, or `null` if the user cancels.
 * @example
 * import { signal } from '@jsvision/ui';
 * const name = signal('');
 * const entered = await inputBox(app, { title: 'Rename', label: '~N~ew name', value: name });
 * if (entered !== null) rename(entered);
 */
export async function inputBox(host: ModalDialogHost, o: InputBoxOptions): Promise<string | null> {
  const width = Math.min(60, Math.max(40, o.label.length + 6));
  const dlg = new Dialog({ title: o.title, width, height: 9, centered: true });
  dlg.layout = { ...dlg.layout, padding: 0 };

  const input = new Input({ value: o.value, validator: o.validator, placeholder: o.placeholder });
  const [ok, cancel] = okCancelButtons();
  // Neither the caption nor the field reports a natural size, so both take an explicit one-row size —
  // left to size themselves they would collapse to nothing and be clipped away. The spacer below them
  // absorbs the slack that keeps the button band on the bottom row. The caption is added first for
  // reading order but is never focusable, so the field still leads the Tab order.
  dlg.add(
    cover(
      col(
        { padding: 1 },
        fixed(new Label(o.label, input), 1),
        fixed(input, 1),
        spacer(),
        fixed(row({ justify: 'center', gap: BUTTON_GAP }, ok, cancel), BUTTON_BAND_HEIGHT),
      ),
    ),
  );

  const result = await runDialog(host, dlg);
  return result === 'ok' ? o.value.peek() : null;
}
