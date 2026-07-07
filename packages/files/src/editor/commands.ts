/**
 * The command names for the file operations, for wiring a menu or status bar to a file editor. Save
 * behaviour lives on {@link FileEditor} (the base editor package is filesystem-free), so these names
 * are defined here alongside it. Bind your File menu items to these and handle them in your app.
 *
 * @example
 * import { menuBar, subMenu, item } from '@jsvision/ui';
 * import { FileCommands } from '@jsvision/files';
 *
 * const bar = menuBar([
 *   subMenu('~F~ile', [
 *     item('~N~ew', FileCommands.new),
 *     item('~O~pen', FileCommands.open),
 *     item('~S~ave', FileCommands.save),
 *     item('Save ~a~s', FileCommands.saveAs),
 *   ]),
 * ]);
 */
export const FileCommands = {
  /** Save the focused file editor. */
  save: 'save',
  /** Save the focused file editor under a new name (prompts for a path). */
  saveAs: 'saveAs',
  /** Open an existing file. */
  open: 'open',
  /** Create a new untitled editor window. */
  new: 'new',
} as const;
