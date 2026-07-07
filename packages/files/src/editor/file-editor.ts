/**
 * `FileEditor` — the file binding over the RD-09 `FileSystem` seam: a faithful `TFileEditor` port
 * (RD-08 03-06, AR-249/AR-258). `@jsvision/ui` stays fs-free (plan-preflight PF-001).
 *
 * Decode (`tfiledtr.cpp`, re-verified 2026-07-07 @ 57b6f56):
 *   • `loadFile` (`:104-145`): a MISSING file ⇒ an empty buffer, still valid (`:107-111`); the
 *     content is stored VERBATIM (mixed EOLs intact, PF-008; the editor re-detects the ending).
 *   • `saveFile` (`:180-219`): with `efBackupFiles` (default ON, `editstat.cpp:24`) the backup
 *     name REPLACES the extension with `.bak` (`fnsplit`/`fnmerge`, `:186-190`) — unlink the
 *     stale `.bak` (ignore-missing, the first-save case) → rename the current file to it →
 *     write the buffer fresh; write/create failures route `edWriteError`/`edCreateError` through
 *     the seam and report `false`; success clears `modified` (`:214`).
 *   • `save`/`saveAs` (`:147-167`): untitled routes `edSaveAs`; a successful saveAs updates
 *     `fileName` — the `cmUpdateTitle` broadcast becomes the reactive signal the files
 *     `openFileInEditor` factory binds into `Window.title` (PF-013).
 *   • `valid(close/quit)` (`:264-291`): modified ⇒ `edSaveModify` (named) / `edSaveUntitled` —
 *     Yes → `save()`'s result, No → drop (`modified = false`, close), Cancel → abort.
 *   • `updateCommands` (`:257-262`): `cmSave`/`cmSaveAs` always enabled while active — they ride
 *     the files-owned `FileCommands` (PF-004).
 * `save`/`valid` are async because the seam is (PA-17); close paths await them.
 * GATE-2 AFTER-diff (2026-07-07): the load/save/backup/valid flows diffed against tfiledtr.cpp —
 * sequence, prompts, and defaults all match (FileEditor adds no drawing of its own).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Editor } from '@jsvision/ui';
import type { EditorOptions } from '@jsvision/ui';
import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { FileSystem } from '../fs/types.js';

/** Construction options (03-06). */
export interface FileEditorOptions extends EditorOptions {
  /** The filesystem seam (never touched outside it — RD §Security). */
  fs: FileSystem;
  /** The bound file path; `undefined` ⇒ untitled. */
  fileName?: string;
  /** Keep a `.bak` of the previous content on save (TV `efBackupFiles`; default true, AR-258). */
  backupFiles?: boolean;
  /** Forwarded to the editor's replace flow (TV `efPromptOnReplace`; default true, AR-258). */
  promptOnReplace?: boolean;
}

/** The file-bound editor (load/save/saveAs, `.bak` backups, modified-close prompts). */
export class FileEditor extends Editor {
  /** The bound path — reactive so `openFileInEditor` binds it into the window title (PF-013). */
  readonly fileName: Signal<string | undefined>;
  /** @internal The seam. */
  protected readonly fs: FileSystem;
  /** @internal TV `efBackupFiles`. */
  protected readonly backupFiles: boolean;

  constructor(options: FileEditorOptions) {
    super(options);
    this.fs = options.fs;
    this.fileName = signal(options.fileName);
    this.backupFiles = options.backupFiles ?? true;
    this.promptOnReplace = options.promptOnReplace ?? true;
  }

  /** Load the bound file — missing ⇒ empty + valid (decode `:107-111`); content verbatim. */
  loadFile(): void {
    const name = this.fileName();
    if (name === undefined) {
      this.setText('');
      return;
    }
    let text: string;
    try {
      text = this.fs.readFile(name);
    } catch {
      this.setText(''); // a missing file is a VALID empty buffer (no error box — decode)
      return;
    }
    this.setText(text);
  }

  /** Save — untitled routes {@link saveAs}; resolves `false` on cancel/error (decode `:147-153`). */
  async save(): Promise<boolean> {
    if (this.fileName() === undefined) return this.saveAs();
    return this.saveFile();
  }

  /** Prompt `edSaveAs` through the seam; a path answer rebinds + writes (decode `:155-167`). */
  async saveAs(): Promise<boolean> {
    const res = await this.dialog({ kind: 'saveAs', name: this.fileName() ?? '' });
    if (res.kind !== 'path' || res.path === null) return false;
    this.fileName.set(res.path); // the reactive cmUpdateTitle (PF-013)
    return this.saveFile();
  }

  /** The backup sequence + write (decode `:180-219`); routes seam errors, reports `false`. */
  saveFile(): boolean {
    const name = this.fileName();
    if (name === undefined) return false;
    try {
      if (this.backupFiles) {
        const bak = this.backupName(name);
        try {
          this.fs.unlink(bak); // remove the stale .bak; missing is the first-save case
        } catch {
          // ignore-missing (decode)
        }
        try {
          this.fs.rename(name, bak);
        } catch {
          // a missing original (first save of a new path) has nothing to back up
        }
      }
      this.fs.writeFile(name, this.getText()); // exactly the buffer bytes (round-trip, AC-15)
    } catch {
      void this.dialog({ kind: 'writeError', name });
      return false;
    }
    this.modified.set(false); // decode :214
    this.update();
    return true;
  }

  /** The modified-close prompt state machine (decode `:264-291`). */
  async valid(_command: 'close' | 'quit'): Promise<boolean> {
    if (!this.modified()) return true;
    const name = this.fileName();
    const res = await this.dialog(name === undefined ? { kind: 'saveUntitled' } : { kind: 'saveModify', name });
    const answer = res.kind === 'confirm' ? res.answer : 'cancel';
    if (answer === 'yes') return this.save();
    if (answer === 'no') {
      this.modified.set(false); // drop the changes (decode :283)
      this.update();
      return true;
    }
    return false;
  }

  /** @internal The TV backup name: the extension REPLACED with `.bak` (`fnmerge`, `:186-190`). */
  protected backupName(name: string): string {
    const dir = this.fs.dirname(name);
    const base = this.fs.basename(name);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    return this.fs.join(dir, `${stem}.bak`);
  }
}
