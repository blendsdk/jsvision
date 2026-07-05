/**
 * `ChDirDialog` — the modal change-directory dialog (`extends Dialog`), a decode of `TChDirDialog`
 * (`tchdrdlg.cpp:37-140`).
 *
 * TV decode (GATE-1): `TDialog(TRect(16,2,64,20))` = **48×18**, gray, `wfGrow`. Composition at the
 * decoded dialog-local rects: a path `Input (3,3,42,4)` + a `~D~irectory name` label `(2,2,…)`; a
 * `DirList (3,6,33,16)` owning its vertical bar + a `~D~irectory tree` label `(2,5,…)`; the button
 * strip OK(`bfDefault`) `(35,6,45,8)`, Chdir `(35,9,45,11)`, Revert `(35,12,45,14)`, Help
 * `(35,15,45,17)`.
 *
 * Chdir descends the focused tree node (`cmChangeDir`); Revert restores the starting directory;
 * `valid(cmOK)` validates the path field as a readable directory — else the injected error box seam
 * (PA-3, like `FileDialog`); Cancel/Esc bypass. The path field reflects the current directory (a tree
 * select / Chdir / Revert updates it).
 *
 * GATE-2 AFTER-diff (`tchdrdlg.cpp:37-53`): dialog `16,2,64,20` = 48×18; `dirInput 3,3,42,4`;
 * `dirName` label `2,2,17,3` (width 15); `History 42,3,45,4`; OK `35,6,45,8` (`cmOK` → `Commands.ok`),
 * Chdir `35,9,45,11` (`cmChangeDir` → `onClick`), Revert `35,12,45,14`, Help `35,15,45,17`. TV splits
 * `dirList 3,6,32,16` (width 29) + a separate `TScrollBar 32,6,33,16`; jsvision's `DirList` owns its
 * bar, so its container spans `3,6,33,16` (width 30 = 29 rows + 1 bar) — the same footprint. No draw
 * mismatch. `.js` per NodeNext.
 */
import { Dialog, Button, Label, Input, History, signal, Commands } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { DirList } from '../list/dir-list.js';

/** Default recent-path history id (PA-9 — distinct from the file-dialog id so the MRU lists don't collide). */
const DIR_HISTORY_ID = 0x0f12;

/** Construction options for {@link ChDirDialog}. */
export interface ChDirDialogOptions {
  /** The filesystem seam. */
  fs: FileSystem;
  /** The current directory (default the seam's cwd `resolve('.')`). */
  directory?: Signal<string>;
  /** The dialog title (default `'Change Directory'`). */
  title?: string;
  /** The recent-path history id keying the shared MRU store (default the chdir-dialog id, PA-9). */
  historyId?: number;
  /** Raise the local error box (PA-3 runtime seam — wired by the opener/story). */
  showError?: (message: string) => void;
  /** Called when the dialog resolves — the absolute directory, or `null` on cancel. */
  onResolve?: (path: string | null) => void;
}

/** The modal change-directory dialog. */
export class ChDirDialog extends Dialog {
  /** The filesystem seam. */
  readonly fs: FileSystem;
  /** The current directory (shared with the tree). */
  readonly directory: Signal<string>;
  /** The path field value (reflects `directory`; the source of truth for `valid(cmOK)`). */
  readonly path: Signal<string>;
  /** The path input. */
  readonly pathInput: Input;
  /** The recent-path History dropdown over the path input (`42,3,45,4`). */
  readonly history: History;
  /** The directory tree. */
  readonly dirList: DirList;
  /** The button strip (OK/Chdir/Revert/Help). */
  readonly buttons: Button[] = [];
  /** The button labels (parallel to {@link buttons}). */
  readonly buttonLabels: string[] = [];
  private readonly startDir: string;
  private readonly resultPath: Signal<string | null> = signal<string | null>(null);
  private readonly showErrorSeam?: (message: string) => void;
  private readonly onResolveCb?: (path: string | null) => void;

  constructor(opts: ChDirDialogOptions) {
    super({ title: opts.title ?? 'Change Directory', width: 48, height: 18 });
    this.fs = opts.fs;
    this.directory = opts.directory ?? signal(opts.fs.resolve('.'));
    this.startDir = this.directory();
    this.path = signal(this.directory());
    this.showErrorSeam = opts.showError;
    this.onResolveCb = opts.onResolve;

    this.pathInput = new Input({ value: this.path });
    this.pathInput.layout = { position: 'absolute', rect: { x: 3, y: 3, width: 39, height: 1 } };
    this.history = new History({ link: this.pathInput, historyId: opts.historyId ?? DIR_HISTORY_ID });
    this.history.layout = { position: 'absolute', rect: { x: 42, y: 3, width: 3, height: 1 } };
    const nameLabel = new Label('~D~irectory name', this.pathInput);
    nameLabel.layout = { position: 'absolute', rect: { x: 2, y: 2, width: 15, height: 1 } };

    this.dirList = new DirList({ fs: this.fs, directory: this.directory, onChangeDir: (p) => this.directory.set(p) });
    this.dirList.layout = { position: 'absolute', rect: { x: 3, y: 6, width: 30, height: 10 } };
    const treeLabel = new Label('~D~irectory tree', this.dirList.rows);
    treeLabel.layout = { position: 'absolute', rect: { x: 2, y: 5, width: 15, height: 1 } };

    this.buildButtons();

    this.add(nameLabel);
    this.add(this.pathInput);
    this.add(this.history);
    this.add(treeLabel);
    this.add(this.dirList);
    for (const b of this.buttons) this.add(b);

    // Reflect the current directory into the path field (a tree select / Chdir / Revert updates it).
    this.onMount(() => {
      this.bind(
        () => this.directory(),
        (d) => this.path.set(d),
      );
    });
  }

  /** The resolved absolute directory, or `null` while unresolved / on cancel. */
  result(): string | null {
    return this.resultPath();
  }

  /** Descend into the focused tree node (the Chdir button). */
  chdir(): void {
    const node = this.dirList.focusedNode();
    if (node !== undefined) this.directory.set(node.path);
  }

  /** Restore the starting directory (the Revert button). */
  revert(): void {
    this.directory.set(this.startDir);
  }

  private buildButtons(): void {
    const specs: Array<{ label: string; command?: string; default?: boolean; onClick?: () => void }> = [
      { label: '~O~K', command: Commands.ok, default: true },
      { label: '~C~hdir', onClick: () => this.chdir() },
      { label: '~R~evert', onClick: () => this.revert() },
      { label: '~H~elp' },
    ];
    specs.forEach((s, i) => {
      const btn = new Button(s.label, { command: s.command, default: s.default, onClick: s.onClick });
      btn.layout = { position: 'absolute', rect: { x: 35, y: 6 + i * 3, width: 10, height: 2 } };
      this.buttons.push(btn);
      this.buttonLabels.push(s.label);
    });
  }

  /**
   * TV `TChDirDialog::valid` (`:112-140`): cancel bypasses; OK validates the path field as a readable
   * directory — resolve + close, else the error box + stay open.
   *
   * @param command The terminating command.
   * @returns Whether the dialog may close.
   */
  override valid(command: string): boolean {
    if (command === Commands.cancel) return true;
    if (command !== Commands.ok) return super.valid(command);
    this.firstInvalid = null;
    if (!super.valid(Commands.ok)) return false; // the DEF-16 child sweep
    const target = this.fs.resolve(this.path());
    if (this.statKind(target) !== 'dir') {
      this.showErrorSeam?.('Invalid directory');
      return false;
    }
    this.resultPath.set(target);
    this.directory.set(target);
    this.onResolveCb?.(target);
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
