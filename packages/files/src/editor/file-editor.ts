/**
 * A text {@link Editor} bound to a file through an injectable {@link FileSystem}: it can load, save,
 * "save as", keep a `.bak` backup, and prompt before discarding unsaved changes on close. Because the
 * base editor package touches no filesystem, this is where all file behaviour lives.
 *
 * Behaviour worth knowing:
 *   - Loading a missing file yields an empty, valid, unmodified buffer (no error) — handy for "new".
 *   - Content is loaded and saved verbatim, so mixed line endings survive a round-trip.
 *   - Saving an untitled buffer routes through "save as" to obtain a path first.
 *   - With backups on (the default), each save moves the current file to `<name>.bak` before writing.
 *   - {@link save}, {@link saveAs}, and {@link valid} are async because save prompts and the
 *     filesystem may be — close paths must await them.
 *
 * Prefer {@link openFileInEditor} to open a file in a ready-made window; construct `FileEditor`
 * directly only when hosting it yourself.
 */
import { Editor } from '@jsvision/ui';
import type { EditorOptions } from '@jsvision/ui';
import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { FileSystem } from '../fs/types.js';

/** Construction options for {@link FileEditor}. */
export interface FileEditorOptions extends EditorOptions {
  /** The filesystem to read and write through (the only path to disk). */
  fs: FileSystem;
  /** The bound file path; omit for an untitled buffer. */
  fileName?: string;
  /** Keep a `.bak` of the previous content on each save (default `true`). */
  backupFiles?: boolean;
  /** Prompt before overwriting during the editor's replace flow (default `true`). */
  promptOnReplace?: boolean;
}

/**
 * The file-bound editor (load/save/saveAs, `.bak` backups, modified-close prompts).
 *
 * @example
 * import { FileEditor, nodeFileSystem } from '@jsvision/files';
 *
 * const editor = new FileEditor({ fs: nodeFileSystem, fileName: '/home/user/notes.txt' });
 * editor.loadFile();          // empty + valid if the file does not exist yet
 * editor.setText('hello\n');
 * const saved = await editor.save(); // true on success; writes notes.txt (and notes.bak)
 */
export class FileEditor extends Editor {
  /** The bound path, as a reactive signal so a window title can track it (a "save as" retitles). */
  readonly fileName: Signal<string | undefined>;
  /** @internal The filesystem. */
  protected readonly fs: FileSystem;
  /** @internal Whether saves keep a `.bak`. */
  protected readonly backupFiles: boolean;

  constructor(options: FileEditorOptions) {
    super(options);
    this.fs = options.fs;
    this.fileName = signal(options.fileName);
    this.backupFiles = options.backupFiles ?? true;
    this.promptOnReplace = options.promptOnReplace ?? true;
  }

  /** Load the bound file into the buffer. A missing file yields an empty, valid buffer; no error. */
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
      this.setText(''); // treat a missing file as a valid empty buffer (a "new" file)
      return;
    }
    this.setText(text);
  }

  /** Save the buffer; an untitled buffer routes through {@link saveAs}. Resolves `false` on cancel/error. */
  async save(): Promise<boolean> {
    if (this.fileName() === undefined) return this.saveAs();
    return this.saveFile();
  }

  /** Prompt for a path; a chosen path rebinds {@link fileName} (retitling the window) and writes. */
  async saveAs(): Promise<boolean> {
    const res = await this.dialog({ kind: 'saveAs', name: this.fileName() ?? '' });
    if (res.kind !== 'path' || res.path === null) return false;
    this.fileName.set(res.path); // rebind so a hosting window title updates
    return this.saveFile();
  }

  /** Back up the previous content (if enabled) then write the buffer. Reports an error and returns `false`. */
  saveFile(): boolean {
    const name = this.fileName();
    if (name === undefined) return false;
    try {
      if (this.backupFiles) {
        const bak = this.backupName(name);
        try {
          this.fs.unlink(bak); // remove a stale .bak; on the first save there is none
        } catch {
          // nothing to remove
        }
        try {
          this.fs.rename(name, bak);
        } catch {
          // the first save of a brand-new path has no original to back up
        }
      }
      this.fs.writeFile(name, this.getText()); // write exactly the buffer's bytes
    } catch {
      void this.dialog({ kind: 'writeError', name });
      return false;
    }
    this.modified.set(false); // a successful save clears the modified flag
    this.update();
    return true;
  }

  /**
   * The prompt shown when closing a modified buffer: Yes saves (returning its result), No discards and
   * closes, Cancel keeps the buffer open. An unmodified buffer closes immediately.
   */
  async valid(_command: 'close' | 'quit'): Promise<boolean> {
    if (!this.modified()) return true;
    const name = this.fileName();
    const res = await this.dialog(name === undefined ? { kind: 'saveUntitled' } : { kind: 'saveModify', name });
    const answer = res.kind === 'confirm' ? res.answer : 'cancel';
    if (answer === 'yes') return this.save();
    if (answer === 'no') {
      this.modified.set(false); // discard the changes so the close proceeds
      this.update();
      return true;
    }
    return false;
  }

  /** @internal The backup path: the bound name with its extension replaced by `.bak`. */
  protected backupName(name: string): string {
    const dir = this.fs.dirname(name);
    const base = this.fs.basename(name);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    return this.fs.join(dir, `${stem}.bak`);
  }
}
