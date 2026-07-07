/**
 * The classic modal open/save file dialog: a filename field with a recent-paths dropdown, a
 * two-column file listing with a scroll bar, a `Files` label, a read-out info pane, and a button strip
 * (Open/Cancel/Help, or OK/Replace/Clear/Cancel/Help in save mode). It reads and writes through an
 * injectable {@link FileSystem}, so it runs against real disk or a virtual tree.
 *
 * How it resolves — driven by {@link valid} when OK is pressed:
 *   - a wildcard (e.g. `*.ts`) re-filters the listing and the dialog stays open;
 *   - a directory name descends into it and stays open;
 *   - a valid filename resolves to its absolute path and the dialog closes;
 *   - anything else raises an error box (via the {@link FileDialogOptions.showError} callback) and
 *     stays open.
 *
 * The dialog is drag-resizable but never smaller than its design size; its children reflow as it
 * grows. Prefer the {@link openFile} opener for the common "prompt and get a path" case; construct
 * `FileDialog` directly only when you need to embed or customize it.
 */
import type { Signal } from '@jsvision/ui';
import { Button, Commands, Dialog, History, Label, ScrollBar, signal } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { nodeFileSystem } from '../fs/node-fs.js';
import { isWild } from '../fs/wildcard.js';
import { GrowMode } from './grow.js';
import type { GrowItem } from './grow-dialog.js';
import { applyGrowMode, captureGrowItems } from './grow-dialog.js';
import { FileInput } from '../input/file-input.js';
import { FileInfoPane } from '../list/file-info-pane.js';
import { FileList } from '../list/file-list.js';

/** Construction options for {@link FileDialog}. */
export interface FileDialogOptions {
  /** The filesystem to read and write through (default {@link nodeFileSystem}). */
  fs?: FileSystem;
  /** The current directory (default the filesystem's cwd). Shared with the listing and info pane. */
  directory?: Signal<string>;
  /** The file wildcard (default `'*.*'`). */
  wildcard?: Signal<string>;
  /** The filename field value (default an internal empty signal). */
  filename?: Signal<string>;
  /** Save mode — shows the OK/Replace/Clear/Cancel/Help strip instead of Open/Cancel/Help. */
  save?: boolean;
  /** The filename label text (default `'~N~ame'`; wrap the hotkey letter in tildes). */
  inputName?: string;
  /** The dialog title (default `'Open a File'`, or `'Save File As'` in save mode). */
  title?: string;
  /** An extra predicate AND-ed with the wildcard when listing files. */
  filter?: (entry: DirEntry) => boolean;
  /** The id keying this dialog's recent-path history (default a file-dialog id distinct from chdir). */
  historyId?: number;
  /** Called to show an error (bad filename / directory). Wire it to {@link errorBox} in an app. */
  showError?: (message: string) => void;
  /** Called when the dialog resolves — with the chosen absolute path, or `null` on cancel. */
  onResolve?: (path: string | null) => void;
}

const stripTilde = (s: string): string => s.replace(/~/g, '');

/** The default recent-path history id — distinct from the chdir dialog so their lists don't mix. */
const FILE_HISTORY_ID = 0x0f11;

/**
 * The modal open/save file dialog.
 *
 * @example
 * import { createApplication, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { FileDialog, errorBox, nodeFileSystem } from '@jsvision/files';
 *
 * const caps = resolveCapabilities({ env: process.env, platform: process.platform }).profile;
 * const app = createApplication({ caps });
 *
 * const dlg = new FileDialog({
 *   fs: nodeFileSystem,
 *   showError: (msg) => void errorBox(app, msg),
 * });
 * app.desktop.addWindow(dlg);
 * const command = await app.loop.execView<string>(dlg);
 * const path = command === Commands.ok ? dlg.result() : null;
 * app.desktop.removeWindow(dlg);
 */
export class FileDialog extends Dialog {
  /** The filesystem this dialog reads and writes through. */
  readonly fs: FileSystem;
  /** The current directory, shared with the listing and info pane. */
  readonly directory: Signal<string>;
  /** The active file wildcard. */
  readonly wildcard: Signal<string>;
  /** The filename field value, shared with {@link fileInput}. */
  readonly filename: Signal<string>;
  /** The two-column file listing. */
  readonly fileList: FileList;
  /** The filename input. */
  readonly fileInput: FileInput;
  /** The recent-path history dropdown beside the filename input. */
  readonly history: History;
  /** The read-out info pane below the listing. */
  readonly fileInfoPane: FileInfoPane;
  /** The listing's horizontal scroll bar (owned by the dialog, placed under the list). */
  readonly listBar: ScrollBar;
  /** The button strip (open- or save-mode set). */
  readonly buttons: Button[] = [];
  /** The button labels, parallel to {@link buttons}. */
  readonly buttonLabels: string[] = [];
  private readonly resultPath: Signal<string | null> = signal<string | null>(null);
  private readonly showErrorSeam?: (message: string) => void;
  private readonly onResolveCb?: (path: string | null) => void;
  /** The resize-reflow table (children + design rects + grow flags), replayed on drag-resize. */
  private readonly growItems: GrowItem[];

  constructor(opts: FileDialogOptions) {
    super({ title: opts.title ?? (opts.save ? 'Save File As' : 'Open a File'), width: 49, height: 19 });
    // The children below are placed at absolute rects measured from the dialog's outer frame (which
    // sits at row/col 0). The base Dialog defaults to a padding:1 inset (handy for message-box style
    // dialogs); applied here it would double-count the frame and push every child in by (1,1), so the
    // info pane would overwrite the right and bottom border. Zero it so the rects land exactly.
    this.layout = { ...this.layout, padding: 0 };
    // Drag-resizable but floored at the design size, so children only ever grow (never shrink below
    // the layout below). They track the growing frame in onResized() via the growItems table.
    this.resizable = true;
    this.minWidth = 49;
    this.minHeight = 19;
    this.fs = opts.fs ?? nodeFileSystem;
    this.directory = opts.directory ?? signal(this.fs.resolve('.'));
    this.wildcard = opts.wildcard ?? signal('*.*');
    this.filename = opts.filename ?? signal('');
    this.showErrorSeam = opts.showError;
    this.onResolveCb = opts.onResolve;

    const focused = signal(0);
    // The listing's scroll bar is owned by the dialog and placed as a horizontal bar under the list.
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
    this.history = new History({ link: this.fileInput, historyId: opts.historyId ?? FILE_HISTORY_ID });
    this.history.layout = { position: 'absolute', rect: { x: 31, y: 3, width: 3, height: 1 } };

    const inputName = opts.inputName ?? '~N~ame';
    const inputLabel = new Label(inputName, this.fileInput);
    // Width = the label's display length plus 3 (a trailing gap before the field).
    inputLabel.layout = {
      position: 'absolute',
      rect: { x: 2, y: 2, width: 3 + stripTilde(inputName).length, height: 1 },
    };
    const filesLabel = new Label('~F~iles', this.fileList.rows);
    filesLabel.layout = { position: 'absolute', rect: { x: 2, y: 5, width: 6, height: 1 } };

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
    this.add(this.history);
    this.add(filesLabel);
    this.add(this.fileList);
    this.add(this.listBar);
    this.add(this.fileInfoPane);
    for (const b of this.buttons) this.add(b);

    // The resize-reflow table, captured at the design size and replayed by onResized(). Fixed-position
    // labels are omitted (they never move).
    this.growItems = captureGrowItems([
      [this.fileInput, GrowMode.HiX], // filename field — widens
      [this.history, GrowMode.LoX | GrowMode.HiX], // history icon — rides the field's right edge
      [this.fileList, GrowMode.HiX | GrowMode.HiY], // listing — grows both ways
      [this.listBar, GrowMode.LoY | GrowMode.HiX | GrowMode.HiY], // bar — tracks the list bottom, widens
      [this.fileInfoPane, GrowMode.All & ~GrowMode.LoX], // info pane — pinned left, flush bottom, full width
      ...this.buttons.map((b): [Button, number] => [b, GrowMode.LoX | GrowMode.HiX]), // pinned to the right edge
    ]);
  }

  /** Reflow the children to track the frame when the dialog is drag-resized. */
  override onResized(): void {
    if (this.layout.rect !== undefined) {
      applyGrowMode(this.growItems, this.layout.rect, this.minWidth, this.minHeight);
    }
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
      this.modalHost = null; // release the host before ending the modal, so it isn't ended twice
      host.endModal(Commands.ok);
    }
  }

  /**
   * Decide whether the dialog may close for a terminating command. Cancel always closes; OK runs the
   * filename state machine (wildcard re-filters, a directory descends, a valid file resolves, an
   * invalid entry raises the error box). Other commands defer to the base dialog.
   *
   * @param command The command trying to close the dialog.
   * @returns `true` to close, `false` to stay open.
   */
  override valid(command: string): boolean {
    if (command === Commands.cancel) return true;
    if (command !== Commands.ok) return super.valid(command);
    this.firstInvalid = null; // reset before the branches that skip the field-validation sweep
    return this.resolveOrNavigate();
  }

  /** The wildcard / directory / valid-file / error branches taken when OK is pressed. */
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
    // 3. A hosted field is invalid ⇒ veto and refocus it (the base dialog's field-validation sweep).
    if (!super.valid(Commands.ok)) return false;
    // 4. A valid filename ⇒ resolve + close.
    return this.resolveFileAt(full, raw);
  }

  /** Resolve `full` to the result path, or raise the error box and stay open. */
  private resolveFileAt(full: string, raw: string): boolean {
    if (raw.length === 0) {
      this.showErrorSeam?.(`Invalid file name: '${raw}'`);
      return false;
    }
    // The parent directory must exist and be a directory for the path to be valid.
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
