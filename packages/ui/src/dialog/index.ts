/**
 * The modal/modeless dialog subsystem: the {@link Dialog} window plus the standard OK/Cancel/Yes/No
 * button presets. All symbols are re-exported through `@jsvision/ui`'s single entry point.
 */
export { Dialog } from './dialog.js';
export type { DialogOptions } from './dialog.js';
export { okButton, cancelButton, yesButton, noButton, okCancelButtons, yesNoButtons } from './buttons.js';
// Async modal helpers over Dialog. `runDialog` stays module-internal (imported directly where needed).
export { messageBox, confirm, inputBox } from './message-box.js';
export type { ModalDialogHost, MessageBoxOptions, InputBoxOptions } from './message-box.js';
