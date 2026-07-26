/**
 * Async modal helpers over {@link Dialog}: a message box, a yes/no confirmation, and a single-field
 * prompt. Each opens a centered modal, awaits the user's answer, and cleans itself up — so nobody
 * hand-writes centering math or teardown. They run against a minimal
 * `{ loop, desktop, i18n }` host that an `Application` from `createApplication()` satisfies
 * directly.
 */
import type { I18n } from '@jsvision/i18n';
import { Text, Label, Input, buttonGroup, measureButtonGroup } from '../controls/index.js';
import type { Validator, Button } from '../controls/index.js';
import { stringWidth } from '../controls/measure.js';
import { frameTitleMinimumWidth } from '../window/index.js';
import { col, row, grow, fixed, cover, spacer } from '../view/index.js';
import type { View } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { EventLoop } from '../event/index.js';
import type { Desktop } from '../desktop/index.js';
import { Dialog } from './dialog.js';
import { okButton, cancelButton, yesButton, noButton, okCancelButtons } from './buttons.js';

/**
 * The minimal host a modal helper needs: an event loop to run the modal, a desktop to mount it into,
 * and the service that owns framework text. An `Application` from `createApplication()` satisfies
 * this directly; passing the app itself keeps those seams together.
 */
export interface ModalDialogHost {
  /** Translation service for package-owned dialog text. */
  readonly i18n: I18n;
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

/** Standard button face width, so a pair of short buttons reads as a matched set. */
const BUTTON_WIDTH = 10;
/** Cells between adjacent buttons in a band. */
const BUTTON_GAP = 2;
/** Rows between wrapped button rows. */
const BUTTON_ROW_GAP = 1;
/** Frame and body side insets between a dialog edge and its content. */
const DIALOG_HORIZONTAL_CHROME = 6;
/**
 * Body inset within a dialog's interior: a blank row under the title and a two-column side gutter, so
 * text never touches the border. No bottom inset — the button band sits on the last interior row.
 *
 * Shared with the editor's dialog builders so every modal in the SDK keeps the same inner margins;
 * intentionally not re-exported through the package barrel (an internal convention, not public API).
 */
export const DIALOG_BODY_PADDING = { top: 1, right: 2, bottom: 0, left: 2 } as const;

/**
 * A centered band of equal-width buttons, sized as a fixed two-row block. Give it the last slot of a
 * column whose earlier children absorb the leftover height, and it lands on the dialog's bottom row.
 *
 * Shared with the editor's dialog builders; intentionally not re-exported through the package barrel.
 *
 * @param buttons The buttons to lay out, left to right in activation order.
 * @returns A sized row ready to drop into a dialog body column.
 */
export function buttonBand(...buttons: Button[]): View {
  return buttonBandFor(buttons, buttons.length);
}

/**
 * Compose a fixed-height action band with a caller-selected wrapping column count.
 *
 * Kept separate from {@link buttonBand} so historical internal callers retain the variadic shape
 * while translated surfaces can choose a viewport-aware wrapping policy.
 */
export function buttonBandFor(buttons: readonly Button[], maxColumns: number): View {
  const options = {
    minimumButtonWidth: BUTTON_WIDTH,
    gap: BUTTON_GAP,
    rowGap: BUTTON_ROW_GAP,
    maxColumns: Math.max(1, maxColumns),
  };
  const metrics = measureButtonGroup(buttons, options);
  const group = fixed(buttonGroup(buttons, options), metrics.width);
  return fixed(row({ justify: 'center' }, group), metrics.height);
}

/** Intrinsic and viewport-bounded geometry for one framework-owned dialog. */
export interface FrameworkDialogGeometry {
  /** Final dialog width after intrinsic expansion and desktop clamping. */
  readonly width: number;
  /** Final dialog height after button wrapping and desktop clamping. */
  readonly height: number;
  /** Maximum number of action buttons placed on one row. */
  readonly buttonColumns: number;
}

/**
 * Resolve a compact dialog's terminal-cell geometry from all framework-owned text and actions.
 *
 * Preferred dimensions preserve the historical English layout. Wider translations expand the
 * dialog while space is available. When the desktop is narrower, the action group wraps at the
 * largest complete column count that fits; the hard desktop remains the final clipping boundary.
 *
 * @param host Modal host whose desktop supplies the hard viewport boundary.
 * @param preferred Historical compact width and height.
 * @param textWidths Display-cell widths of titles, captions, and caller text.
 * @param buttons Complete framework-owned action group.
 * @param maximumTextDialogWidth Optional compatibility cap applied only to text-driven expansion.
 * @returns Resolved surface size and wrapping column count.
 */
export function frameworkDialogGeometry(
  host: ModalDialogHost,
  preferred: { width: number; height: number },
  textWidths: readonly number[],
  buttons: readonly Button[],
  maximumTextDialogWidth = Number.MAX_SAFE_INTEGER,
): FrameworkDialogGeometry {
  const unwrapped = measureButtonGroup(buttons, {
    minimumButtonWidth: BUTTON_WIDTH,
    gap: BUTTON_GAP,
    rowGap: BUTTON_ROW_GAP,
  });
  const desiredWidth = Math.max(
    preferred.width,
    ...textWidths.map((width) => Math.min(maximumTextDialogWidth, width + DIALOG_HORIZONTAL_CHROME)),
    unwrapped.width + DIALOG_HORIZONTAL_CHROME,
  );
  const width = Math.max(1, Math.min(desiredWidth, host.desktop.bounds.width));
  const contentWidth = Math.max(1, width - DIALOG_HORIZONTAL_CHROME);
  const buttonColumns =
    buttons.length === 0
      ? 1
      : Math.max(
          1,
          Math.min(buttons.length, Math.floor((contentWidth + BUTTON_GAP) / (unwrapped.buttonWidth + BUTTON_GAP))),
        );
  const wrapped = measureButtonGroup(buttons, {
    minimumButtonWidth: BUTTON_WIDTH,
    gap: BUTTON_GAP,
    rowGap: BUTTON_ROW_GAP,
    maxColumns: buttonColumns,
  });
  const extraRows = Math.max(0, wrapped.height - 2);
  const height = Math.max(1, Math.min(preferred.height + extraRows, host.desktop.bounds.height));
  return { width, height, buttonColumns };
}

/**
 * Mount the dialog, run it modally, and remove it — even if `execView` rejects. Resolves to the
 * command string that closed the dialog. Shared by the helpers here and the editor's dialog builders;
 * intentionally not re-exported through the package barrel (an internal engine, not public API).
 *
 * @param host The modal host (an `Application`, or `{ loop, desktop, i18n }`).
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
 * @param host The modal host (an `Application`, or `{ loop, desktop, i18n }`).
 * @param o    Title, message text, and the button set.
 * @returns `'ok'` when OK is chosen, `'cancel'` on Cancel, Esc, or the frame close-box.
 * @example
 * import { createApplication, messageBox } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * function remove(): void {
 *   // Delete the selected item.
 * }
 *
 * await messageBox(app, { title: 'About', text: 'jsvision — classic terminal UI, reimagined' });
 * const answer = await messageBox(app, { title: 'Delete?', text: 'This cannot be undone.', buttons: 'okCancel' });
 * if (answer === 'ok') remove();
 */
export async function messageBox(host: ModalDialogHost, o: MessageBoxOptions): Promise<'ok' | 'cancel'> {
  const hasCancel = o.buttons === 'okCancel';
  const buttons = hasCancel ? [okButton(host.i18n), cancelButton(host.i18n)] : [okButton(host.i18n)];
  const geometry = frameworkDialogGeometry(
    host,
    { width: hasCancel ? 40 : 24, height: hasCancel ? 9 : 7 },
    [frameTitleMinimumWidth(o.title) - DIALOG_HORIZONTAL_CHROME, stringWidth(o.text)],
    buttons,
    60,
  );

  const dlg = new Dialog({ title: o.title, width: geometry.width, height: geometry.height, centered: true });
  // The column covers the dialog's interior, so the message takes the height the button band leaves.
  dlg.add(
    cover(
      col({ padding: DIALOG_BODY_PADDING }, grow(new Text(o.text)), buttonBandFor(buttons, geometry.buttonColumns)),
    ),
  );

  const result = await runDialog(host, dlg);
  return result === 'ok' ? 'ok' : 'cancel';
}

/**
 * Ask a yes/no question modally.
 *
 * @param host The modal host (an `Application`, or `{ loop, desktop, i18n }`).
 * @param text The question; the box sizes itself to fit.
 * @returns `true` on Yes; `false` on No, Esc, or closing the box.
 * @example
 * import { createApplication, confirm } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * function discard(): void {
 *   // Drop the unsaved edits.
 * }
 *
 * if (await confirm(app, 'Discard unsaved changes?')) discard();
 */
export async function confirm(host: ModalDialogHost, text: string): Promise<boolean> {
  const title = host.i18n.t('ui.dialog.confirm.title', { defaultMessage: 'Confirm' });
  const buttons = [yesButton(host.i18n), noButton(host.i18n)];
  const geometry = frameworkDialogGeometry(
    host,
    { width: 40, height: 9 },
    [frameTitleMinimumWidth(title) - DIALOG_HORIZONTAL_CHROME, stringWidth(text)],
    buttons,
    60,
  );
  const dlg = new Dialog({
    title,
    width: geometry.width,
    height: geometry.height,
    centered: true,
  });
  dlg.add(
    cover(col({ padding: DIALOG_BODY_PADDING }, grow(new Text(text)), buttonBandFor(buttons, geometry.buttonColumns))),
  );

  const result = await runDialog(host, dlg);
  return result === 'yes';
}

/**
 * Prompt for a single line of text modally. An optional validator gates OK through the dialog's
 * `valid()` sweep, which keeps the box open and refocuses the field when the value is invalid.
 *
 * @param host The modal host (an `Application`, or `{ loop, desktop, i18n }`).
 * @param o    Title, field label (with optional `~X~` hotkey), the two-way value signal, and validator.
 * @returns The entered string on OK, or `null` if the user cancels.
 * @example
 * import { createApplication, inputBox, signal } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * function rename(newName: string): void {
 *   // Apply the new name to the selected item.
 * }
 *
 * const name = signal('');
 * const entered = await inputBox(app, { title: 'Rename', label: '~N~ew name', value: name });
 * if (entered !== null) rename(entered);
 */
export async function inputBox(host: ModalDialogHost, o: InputBoxOptions): Promise<string | null> {
  const input = new Input({ value: o.value, validator: o.validator, placeholder: o.placeholder });
  const [ok, cancel] = okCancelButtons(host.i18n);
  const buttons = [ok, cancel];
  const geometry = frameworkDialogGeometry(
    host,
    { width: 40, height: 9 },
    [frameTitleMinimumWidth(o.title) - DIALOG_HORIZONTAL_CHROME, stringWidth(o.label)],
    buttons,
    60,
  );
  const dlg = new Dialog({ title: o.title, width: geometry.width, height: geometry.height, centered: true });
  // Neither the caption nor the field reports a natural size, so both take an explicit one-row size —
  // left to size themselves they would collapse to nothing and be clipped away. The spacer below them
  // absorbs the slack that keeps the button band on the bottom row. The caption is added first for
  // reading order but is never focusable, so the field still leads the Tab order.
  dlg.add(
    cover(
      col(
        { padding: DIALOG_BODY_PADDING },
        fixed(new Label(o.label, input), 1),
        fixed(input, 1),
        spacer(),
        buttonBandFor(buttons, geometry.buttonColumns),
      ),
    ),
  );

  const result = await runDialog(host, dlg);
  return result === 'ok' ? o.value.peek() : null;
}
