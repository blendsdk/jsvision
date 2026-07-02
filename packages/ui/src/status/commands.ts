/**
 * Standard shell command-name constants (RD-05 AR-76 / AR-85).
 *
 * Bind shell actions by constant, not by string literal, so a typo is a compile error and the set is
 * discoverable. `Application` passes `Object.values(Commands)` as the loop's `commands` hint and
 * binds `'quit'` to terminate `run()`; the window-manager commands (`close`/`zoom`/`next`/`prev`/
 * `cascade`/`tile`) are handled by the Desktop's post-process `onEvent` (03-02). `resize`/`move` are
 * deliberately omitted until a keyboard window mode exists (AR-85 / PF-004).
 */

/** The standard shell command names. */
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
  // --- RD-11 standard dialog-terminating commands (TV `cmOK`/`cmCancel`/`cmYes`/`cmNo`,
  // `views.h:44`; PA-12). A `Dialog` catches these to resolve its `execView` promise. -------------
  /** Accept a dialog (TV `cmOK`); resolves the modal after the `valid()` gate passes. */
  ok: 'ok',
  /** Cancel a dialog (TV `cmCancel`); always closes, bypassing the `valid()` gate (PA-7). */
  cancel: 'cancel',
  /** Affirmative dialog answer (TV `cmYes`); gated by `valid()` like `ok`. */
  yes: 'yes',
  /** Negative dialog answer (TV `cmNo`); gated by `valid()` like `ok`. */
  no: 'no',
  // --- RD-07 clipboard commands (TV `cmCut`/`cmCopy`/`cmPaste`, `tinputli.cpp:469-489`; PA-7). The
  // focused `Input` handles these; the SIGINT-safe DOS chords Ctrl+Ins/Shift+Ins/Shift+Del map to them.
  /** Cut the Input selection to the clipboard (TV `cmCut`; Shift+Delete). */
  cut: 'cut',
  /** Copy the Input selection to the clipboard (TV `cmCopy`; Ctrl+Insert). */
  copy: 'copy',
  /** Paste the clipboard into the focused Input (TV `cmPaste`; Shift+Insert). */
  paste: 'paste',
} as const;

/** A standard shell command name (a value of {@link Commands}). */
export type CommandName = (typeof Commands)[keyof typeof Commands];
