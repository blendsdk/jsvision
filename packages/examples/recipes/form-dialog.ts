// Recipe: a validated modal form.
//
// A `Dialog` with a range-validated `Input` and default OK / Cancel buttons. The dialog's close-gate
// vetoes OK while a field is invalid (focus snaps back to it) and only resolves once every field is
// valid — the standard modal-form lifecycle. Run it with `loop.execView(dialog)`.

import { cancelButton, Dialog, Input, Label, okButton, range, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';

// #region example
/** Handles for the age-form recipe. */
export interface AgeForm {
  /** The modal dialog — open with `loop.execView(dialog)` (resolves to `'ok'` or `'cancel'`). */
  dialog: Dialog;
  /** The two-way text value of the age field. */
  value: Signal<string>;
  /** The age input; focus lands here when OK is vetoed by the range validator. */
  input: Input;
}

/**
 * Build a modal age form: a labelled {@link Input} guarded by `range(0, 120)`, with default OK and
 * Cancel buttons. OK is vetoed while the value is out of range (focus returns to the field); Cancel
 * and the frame close box always resolve to `'cancel'`.
 *
 * Never close such a dialog with `Window.close()` — that removes the view without ending modality and
 * leaves the `execView` promise hanging. Let OK/Cancel resolve it.
 *
 * @returns The form handles (see {@link AgeForm}).
 * @example
 * const { dialog, value } = makeAgeForm();
 * app.desktop.addWindow(dialog);
 * const result = await app.loop.execView(dialog); // 'ok' | 'cancel'
 * if (result === 'ok') console.log('age is', Number(value()));
 */
export function makeAgeForm(): AgeForm {
  const value = signal('');
  const input = new Input({ value, validator: range(0, 120) });
  input.layout = { position: 'absolute', rect: { x: 8, y: 1, width: 20, height: 1 } };

  const label = new Label('~A~ge:', input);
  label.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 6, height: 1 } };

  const ok = okButton();
  ok.layout = { position: 'absolute', rect: { x: 6, y: 4, width: 10, height: 2 } };
  const cancel = cancelButton();
  cancel.layout = { position: 'absolute', rect: { x: 18, y: 4, width: 12, height: 2 } };

  const dialog = new Dialog({ title: 'Enter age' });
  dialog.layout = { ...dialog.layout, rect: { x: 4, y: 3, width: 36, height: 9 } };
  dialog.add(label);
  dialog.add(input);
  dialog.add(ok);
  dialog.add(cancel);

  return { dialog, value, input };
}
// #endregion example
