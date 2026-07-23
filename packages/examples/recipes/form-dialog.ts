// Recipe: a validated modal form.
//
// A `Dialog` with a range-validated `Input` and default OK / Cancel buttons. The dialog's close-gate
// vetoes OK while a field is invalid (focus snaps back to it) and only resolves once every field is
// valid — the standard modal-form lifecycle. Run it with `loop.execView(dialog)`.

import { cancelButton, col, Dialog, fixed, Input, Label, okButton, range, row, signal } from '@jsvision/ui';
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
  const label = new Label('~A~ge:', input);

  // Compose the interior with the layout DSL: a labelled-field row above a centered button row. The
  // form reflows itself from these flex rules, so it adapts to the dialog size instead of pinning
  // every child to a hand-computed rect. Absolute placement here is reserved for the dialog frame
  // itself (below).
  const fieldRow = row({ gap: 1 }, fixed(label, 6), fixed(input, 20));
  const buttonRow = row({ gap: 2, justify: 'center' }, fixed(okButton(), 10), fixed(cancelButton(), 12));

  const dialog = new Dialog({ title: 'Enter age' });
  // A dialog places its own frame on the desktop by rect — one of the few sanctioned absolute cases.
  dialog.setLayout({ rect: { x: 4, y: 3, width: 36, height: 9 } });
  dialog.add(col({ gap: 1, fill: true }, fixed(fieldRow, 1), fixed(buttonRow, 2)));

  return { dialog, value, input };
}
// #endregion example
