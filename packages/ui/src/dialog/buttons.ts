/**
 * Standard dialog-button presets — thin {@link Button} factories that emit the four standard
 * terminating commands (`Commands.ok` / `cancel` / `yes` / `no`). When a {@link Dialog} is shown
 * modally with `execView`, the returned promise resolves to the command string of the button that
 * closed it.
 *
 * Faces use the tilde hotkey convention (`~O~K` marks `O` as the `Alt`+hotkey); the OK and Yes
 * buttons are the dialog `default`, so they also activate on `Enter` when the key is otherwise
 * unconsumed.
 */
import { Button } from '../controls/index.js';
import { Commands } from '../status/index.js';

/**
 * An OK button — the dialog default; emits `Commands.ok` when activated.
 *
 * @returns A {@link Button} labelled `OK`.
 * @example
 * import { Dialog, okButton, cancelButton, createEventLoop, at } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const dialog = new Dialog({ title: ' Confirm ', width: 30, height: 8 });
 * const ok = at(okButton(), 6, 4, 10, 2);
 * dialog.add(ok);
 * dialog.add(cancelButton());
 *
 * const loop = createEventLoop({ width: 40, height: 12 }, { caps });
 * loop.mount(dialog);
 * const command = await loop.execView<string>(dialog); // 'ok' when OK is pressed
 */
export function okButton(): Button {
  return new Button('~O~K', { command: Commands.ok, default: true });
}

/**
 * A Cancel button — emits `Commands.cancel` (the same command Esc and the frame close-box resolve to).
 *
 * @returns A {@link Button} labelled `Cancel`.
 * @example
 * import { cancelButton, at } from '@jsvision/ui';
 * const cancel = at(cancelButton(), 18, 4, 12, 2);
 * dialog.add(cancel);
 */
export function cancelButton(): Button {
  return new Button('~C~ancel', { command: Commands.cancel });
}

/**
 * A Yes button — the dialog default; emits `Commands.yes` when activated.
 *
 * @returns A {@link Button} labelled `Yes`.
 * @example
 * import { yesButton, noButton } from '@jsvision/ui';
 * dialog.add(yesButton()); // default; also activates on Enter
 * dialog.add(noButton());
 */
export function yesButton(): Button {
  return new Button('~Y~es', { command: Commands.yes, default: true });
}

/**
 * A No button — emits `Commands.no` when activated.
 *
 * @returns A {@link Button} labelled `No`.
 * @example
 * import { noButton } from '@jsvision/ui';
 * dialog.add(noButton()); // emits Commands.no
 */
export function noButton(): Button {
  return new Button('~N~o', { command: Commands.no });
}

/**
 * The OK + Cancel pair, in tab/z order (OK first).
 *
 * @returns A `[okButton, cancelButton]` tuple ready to lay out and add.
 * @example
 * import { okCancelButtons, at } from '@jsvision/ui';
 * const [ok, cancel] = okCancelButtons();
 * at(ok, 6, 4, 10, 2);
 * at(cancel, 18, 4, 12, 2);
 * dialog.add(ok);
 * dialog.add(cancel);
 */
export function okCancelButtons(): [Button, Button] {
  return [okButton(), cancelButton()];
}

/**
 * The Yes + No pair, in tab/z order (Yes first).
 *
 * @returns A `[yesButton, noButton]` tuple ready to lay out and add.
 * @example
 * import { yesNoButtons, at } from '@jsvision/ui';
 * const [yes, no] = yesNoButtons();
 * at(yes, 6, 4, 10, 2);
 * at(no, 18, 4, 10, 2);
 * dialog.add(yes);
 * dialog.add(no);
 */
export function yesNoButtons(): [Button, Button] {
  return [yesButton(), noButton()];
}
