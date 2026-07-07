/**
 * The file-editor pieces: the file-bound {@link FileEditor}, the {@link openFileInEditor} factory that
 * opens a file in a ready-made window, and the {@link FileCommands} names for menu/status wiring.
 */
export { FileEditor } from './file-editor.js';
export type { FileEditorOptions } from './file-editor.js';
export { openFileInEditor } from './open-file.js';
export type { OpenFileInEditorOptions } from './open-file.js';
export { FileCommands } from './commands.js';
