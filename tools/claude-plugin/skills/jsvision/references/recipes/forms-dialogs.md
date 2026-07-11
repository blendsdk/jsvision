# Recipe: forms, dialogs & validation

A modal form with a validated field. Open it with `loop.execView(dialog)` — it resolves to the
terminating command (`'ok'` or `'cancel'`). The dialog's close-gate vetoes OK while a field is
invalid and only resolves once every field passes.

Key points:

- `new Input({ value, validator: range(0, 120) })` filters keystrokes live and blocks a bad OK.
- `okButton()` is the default button; `cancelButton()` and the frame close box resolve `'cancel'`.
- Never close a modal with `Window.close()` — it hangs the `execView` promise (gotcha 8). Let
  OK/Cancel resolve it.
- To drive it in a test: `loop.emitCommand('ok')`, then check the promise settled (or not, for a
  veto).

Full module: `packages/examples/recipes/form-dialog.ts`.

```ts
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
```
