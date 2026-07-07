/**
 * The files-owned registry-level file commands (RD-08 03-06; PA-15 as amended by plan-preflight
 * PF-004): the TV decode places `cmSave`/`cmSaveAs` handling + greying in `TFileEditor`
 * (`tfiledtr.cpp:257-262`), and the fs-free ui `Editor` has no save behavior to bind — so the
 * constants live HERE, not in ui's `EditorCommands`. The tvedit clone binds its File menu to
 * them; greying rides the `updateCommands` decode (PA-4: always enabled while active).
 */

/** The registry-level file command names. */
export const FileCommands = {
  /** Save the focused file editor (TV `cmSave`; F2 in the tvedit clone). */
  save: 'save',
  /** Save under a new name via `edSaveAs` (TV `cmSaveAs`). */
  saveAs: 'saveAs',
  /** Open a file (TV `cmOpen`; F3). */
  open: 'open',
  /** New untitled editor window (TV `cmNew`). */
  new: 'new',
} as const;
