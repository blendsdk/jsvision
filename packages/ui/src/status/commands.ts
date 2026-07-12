/**
 * The standard command names an application recognises — quit, window-management, dialog answers,
 * clipboard, and editor undo/redo.
 *
 * Refer to these by constant rather than by string literal, so a typo is a compile error and the
 * available commands are discoverable. `createApplication` binds `Commands.quit` to end `run()`; the
 * window commands (`close`/`zoom`/`next`/`prev`/`cascade`/`tile`) are handled by the desktop. Wire
 * them to menu items or status-line items so those chrome elements can trigger them.
 */

/** The standard command names. */
export const Commands = {
  /** Quit the application (terminates `run()` with an exit code). */
  quit: 'quit',
  /** Close the active window. */
  close: 'close',
  /** Toggle maximize/restore on the active window. */
  zoom: 'zoom',
  /** Activate the next window in z-order. */
  next: 'next',
  /** Activate the previous window in z-order. */
  prev: 'prev',
  /** Cascade all windows from the top-left. */
  cascade: 'cascade',
  /** Tile all windows into a grid. */
  tile: 'tile',
  // Dialog-terminating commands — a `Dialog` catches these to resolve its `execView` promise.
  /** Accept a dialog; closes it after its `valid()` check passes. */
  ok: 'ok',
  /** Cancel a dialog; always closes, skipping the `valid()` check. */
  cancel: 'cancel',
  /** Affirmative dialog answer; gated by `valid()` like `ok`. */
  yes: 'yes',
  /** Negative dialog answer; gated by `valid()` like `ok`. */
  no: 'no',
  // Clipboard & selection commands — handled by the focused editable widget (an `Input` or an
  // `Editor`). The framework's default keymap raises them from Ctrl+A (select-all), Ctrl+C (copy),
  // Ctrl+X (cut), and Ctrl+V (paste), with the classic chords Ctrl+Insert (copy), Shift+Insert
  // (paste), and Shift+Delete (cut) as aliases. Registering an `onCommand` handler for any of these on
  // the loop or application intercepts it before the focused widget (the loop's command sink runs
  // first), so handle them app-wide only when you mean to override the in-widget clipboard.
  /** Select all text in the focused editable widget (Ctrl+A). */
  selectAll: 'selectAll',
  /** Cut the focused editable widget's selection to the clipboard (Ctrl+X, or classic Shift+Delete). */
  cut: 'cut',
  /** Copy the focused editable widget's selection to the clipboard (Ctrl+C, or classic Ctrl+Insert). */
  copy: 'copy',
  /** Paste the clipboard into the focused editable widget (Ctrl+V, or classic Shift+Insert). */
  paste: 'paste',
  // Editor undo/redo — the focused `Editor` handles both. Redo is command-only (there is no default
  // key chord for it), so bind it from a menu, status item, or app keymap if you want a shortcut.
  /** Undo the focused editor's last edit step. */
  undo: 'undo',
  /** Redo the focused editor's last undone step (command-only — no default key chord). */
  redo: 'redo',
} as const;

/** A standard shell command name (a value of {@link Commands}). */
export type CommandName = (typeof Commands)[keyof typeof Commands];
