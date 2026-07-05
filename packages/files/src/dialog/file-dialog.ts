/**
 * `FileDialog` — the modal open/save file dialog (`extends Dialog`), a decode of `TFileDialog`
 * (`tfildlg.cpp:58-351`).
 *
 * TV decode (GATE-1): `getRect TRect(15,1,64,20)` = **49×19**, `ofCentered | wfGrow`, min 49×19, the
 * gray dialog palette. Composition at the decoded dialog-local rects: `FileInput (3,3,31,4)` + a
 * caller `inputName` label `(2,2,…)`; `FileList (3,6,34,14)` (2-col, PA-14) handed its
 * **horizontal-bottom** list `ScrollBar (3,14,34,15)`; a `~F~iles` label `(2,5,…)`; the button strip
 * first at `(35,3,46,5)` each **+3 rows**; `FileInfoPane (1,16,48,18)`. Open-mode strip =
 * Open(`bfDefault`)/Cancel/Help; save-mode adds OK/Replace/Clear (PA-1).
 *
 * `valid()` (`:293-351`): `cmCancel` bypasses; else `isWild(name)` ⇒ split into dir + wildcard and
 * re-scan (stay open); a directory ⇒ enter it (stay open); a valid file ⇒ resolve to the absolute path
 * + close; else ⇒ the local error box + stay open. The error box is raised through the injected
 * `showError` seam (PA-3 runtime — a sync `valid()` can't itself `execView`). `.js` per NodeNext.
 */
import { Dialog, Button, Label, ScrollBar, signal, Commands } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { FileList } from '../list/file-list.js';
import { FileInput } from '../input/file-input.js';
import { FileInfoPane } from '../list/file-info-pane.js';
import { isWild } from '../fs/wildcard.js';

/** Construction options for {@link FileDialog}. */
export interface FileDialogOptions {
  /** The filesystem seam. */
  fs: FileSystem;
  /** The current directory (default the seam's cwd `resolve('.')`). */
  directory?: Signal<string>;
  /** The file wildcard (default `'*.*'`). */
  wildcard?: Signal<string>;
  /** The filename field value (default an internal empty signal). */
  filename?: Signal<string>;
  /** Save mode — the OK/Replace/Clear/Cancel/Help strip (default open mode: Open/Cancel/Help). */
  save?: boolean;
  /** The input label text (default `'~N~ame'`, caller-supplied per PF-004). */
  inputName?: string;
  /** The dialog title (default `'Open a File'` / `'Save File As'`). */
  title?: string;
  /** A caller predicate AND-ed with the wildcard (PA-10). */
  filter?: (entry: DirEntry) => boolean;
  /** Raise the local error box (PA-3 runtime seam — wired to `errorBox(host, …)` by the opener/story). */
  showError?: (message: string) => void;
  /** Called when the dialog resolves — the absolute path, or `null` on cancel. */
  onResolve?: (path: string | null) => void;
}

const stripTilde = (s: string): string => s.replace(/~/g, '');

/** The modal open/save file dialog. */
export class FileDialog extends Dialog {
  /** The filesystem seam. */
  readonly fs: FileSystem;
  /** The current directory (shared with the list + info pane). */
  readonly directory: Signal<string>;
  /** The active file wildcard. */
  readonly wildcard: Signal<string>;
  /** The filename field value (shared with the `FileInput`). */
  readonly filename: Signal<string>;
  /** The 2-column file listing. */
  readonly fileList: FileList;
  /** The filename input. */
  readonly fileInput: FileInput;
  /** The read-out info pane. */
  readonly fileInfoPane: FileInfoPane;
  /** The list's horizontal-bottom scroll bar (dialog-owned sibling, PA-14). */
  readonly listBar: ScrollBar;
  /** The button strip (open- or save-mode set). */
  readonly buttons: Button[] = [];
  /** The button labels (parallel to {@link buttons}), for composition assertions. */
  readonly buttonLabels: string[] = [];
  private readonly resultPath: Signal<string | null> = signal<string | null>(null);
  private readonly showErrorSeam?: (message: string) => void;
  private readonly onResolveCb?: (path: string | null) => void;

  constructor(opts: FileDialogOptions) {
    super({ title: opts.title ?? (opts.save ? 'Save File As' : 'Open a File'), width: 49, height: 19 });
    this.fs = opts.fs;
    this.directory = opts.directory ?? signal(opts.fs.resolve('.'));
    this.wildcard = opts.wildcard ?? signal('*.*');
    this.filename = opts.filename ?? signal('');
    this.showErrorSeam = opts.showError;
    this.onResolveCb = opts.onResolve;

    const focused = signal(0);
    // The list's bar — a dialog-owned absolute sibling, horizontal-rendered at the bottom (PA-14).
    this.listBar = new ScrollBar({ value: focused, orientation: 'horizontal' });
    this.listBar.layout = { position: 'absolute', rect: { x: 3, y: 14, width: 31, height: 1 } };
    this.fileList = new FileList({
      fs: this.fs,
      directory: this.directory,
      wildcard: this.wildcard,
      focused,
      bar: this.listBar,
      filter: opts.filter,
      onOpenEntry: (entry) => this.openEntry(entry),
    });
    this.fileList.layout = { position: 'absolute', rect: { x: 3, y: 6, width: 31, height: 8 } };

    this.fileInput = new FileInput({
      value: this.filename,
      focusedEntry: () => this.fileList.focusedEntry(),
      wildcard: () => this.wildcard(),
      sep: this.fs.sep,
    });
    this.fileInput.layout = { position: 'absolute', rect: { x: 3, y: 3, width: 28, height: 1 } };

    const inputName = opts.inputName ?? '~N~ame';
    const inputLabel = new Label(inputName, this.fileInput);
    inputLabel.layout = { position: 'absolute', rect: { x: 2, y: 2, width: Math.max(1, stripTilde(inputName).length), height: 1 } };
    const filesLabel = new Label('~F~iles', this.fileList.rows);
    filesLabel.layout = { position: 'absolute', rect: { x: 2, y: 5, width: 5, height: 1 } };

    this.fileInfoPane = new FileInfoPane({
      fs: this.fs,
      directory: () => this.directory(),
      wildcard: () => this.wildcard(),
      focusedEntry: () => this.fileList.focusedEntry(),
    });
    this.fileInfoPane.layout = { position: 'absolute', rect: { x: 1, y: 16, width: 47, height: 2 } };

    this.buildButtons(opts.save === true);

    // Compose (z-order): labels + input + list + bar + info pane + buttons.
    this.add(inputLabel);
    this.add(this.fileInput);
    this.add(filesLabel);
    this.add(this.fileList);
    this.add(this.listBar);
    this.add(this.fileInfoPane);
    for (const b of this.buttons) this.add(b);
  }

  /** The resolved absolute path, or `null` while unresolved / on cancel. */
  result(): string | null {
    return this.resultPath();
  }

  /** Load the focused entry's name into the field (save-mode Replace). */
  replace(): void {
    const entry = this.fileList.focusedEntry();
    if (entry !== undefined) this.filename.set(entry.name);
  }

  /** Empty the filename field (save-mode Clear). */
  clear(): void {
    this.filename.set('');
  }

  /** Build the mode-appropriate button strip (each 11×2, first at (35,3), +3 rows). */
  private buildButtons(save: boolean): void {
    const specs: Array<{ label: string; command?: string; default?: boolean; onClick?: () => void }> = save
      ? [
          { label: '~O~K', command: Commands.ok, default: true },
          { label: '~R~eplace', onClick: () => this.replace() },
          { label: '~C~lear', onClick: () => this.clear() },
          { label: '~C~ancel', command: Commands.cancel },
          { label: '~H~elp' },
        ]
      : [
          { label: '~O~pen', command: Commands.ok, default: true },
          { label: '~C~ancel', command: Commands.cancel },
          { label: '~H~elp' },
        ];
    specs.forEach((s, i) => {
      const btn = new Button(s.label, { command: s.command, default: s.default, onClick: s.onClick });
      btn.layout = { position: 'absolute', rect: { x: 35, y: 3 + i * 3, width: 11, height: 2 } };
      this.buttons.push(btn);
      this.buttonLabels.push(s.label);
    });
  }

  /** Enter/double-click on a list row: a directory enters it; a file resolves + closes (like OK). */
  private openEntry(entry: DirEntry): void {
    if (entry.kind === 'dir') {
      this.directory.set(this.fs.resolve(this.directory(), entry.name));
      this.filename.set('');
      return;
    }
    this.filename.set(entry.name);
    const full = this.fs.resolve(this.directory(), entry.name);
    if (this.resolveFileAt(full, entry.name) && this.modalHost !== null) {
      const host = this.modalHost;
      this.modalHost = null; // HR-37: release the host, mirroring Dialog.handleTerminating
      host.endModal(Commands.ok);
    }
  }

  /**
   * TV `TFileDialog::valid` (`:293-351`): cancel bypasses; OK runs the filename state machine.
   *
   * @param command The terminating command.
   * @returns Whether the dialog may close.
   */
  override valid(command: string): boolean {
    if (command === Commands.cancel) return true;
    if (command !== Commands.ok) return super.valid(command);
    this.firstInvalid = null; // reset before the branches that don't run the child sweep
    return this.resolveOrNavigate();
  }

  /** The wildcard / directory / valid-file / error branches of `valid(cmOK)`. */
  private resolveOrNavigate(): boolean {
    const raw = this.filename();
    const full = this.fs.resolve(this.directory(), raw);

    // 1. A wildcard ⇒ split into directory + pattern and re-scan (stay open).
    if (isWild(raw)) {
      this.directory.set(this.fs.dirname(full));
      this.wildcard.set(this.fs.basename(full));
      return false;
    }
    // 2. A directory ⇒ enter it (stay open).
    if (this.statKind(full) === 'dir') {
      this.directory.set(full);
      this.filename.set('');
      return false;
    }
    // 3. A hosted control invalid ⇒ veto + refocus (the DEF-16 child sweep).
    if (!super.valid(Commands.ok)) return false;
    // 4. A valid filename ⇒ resolve + close.
    return this.resolveFileAt(full, raw);
  }

  /** Resolve `full` to the result path, or raise the error box (stay open). */
  private resolveFileAt(full: string, raw: string): boolean {
    if (raw.length === 0) {
      this.showErrorSeam?.(`Invalid file name: '${raw}'`);
      return false;
    }
    // checkDirectory — the parent must exist and be a directory (`tfildlg.cpp:345`).
    if (this.statKind(this.fs.dirname(full)) !== 'dir') {
      this.showErrorSeam?.('Invalid drive or directory');
      return false;
    }
    this.resultPath.set(full);
    this.onResolveCb?.(full);
    return true;
  }

  /** A guarded `stat().kind`, or `undefined` if the path can't be stat-ed. */
  private statKind(path: string): DirEntry['kind'] | undefined {
    try {
      return this.fs.stat(path).kind;
    } catch {
      return undefined;
    }
  }
}
