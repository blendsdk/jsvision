/**
 * The modal change-directory dialog: a path field with a recent-paths dropdown, a directory tree, and
 * an OK/Chdir/Revert/Help button strip. Chdir descends into the focused tree node; Revert restores the
 * directory the dialog opened on; OK validates the path field as a readable directory (raising an
 * error box otherwise) and closes with it. The path field always mirrors the current directory, so
 * navigating the tree, Chdir, or Revert all keep it in sync. Cancel and Esc close without changing
 * anything. It reads through an injectable {@link FileSystem} and is drag-resizable.
 *
 * Prefer the {@link changeDir} opener for the common "prompt and get a directory" case; construct
 * `ChDirDialog` directly only when embedding or customizing it.
 */
import { Dialog, Button, Label, Input, History, signal, Commands } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { nodeFileSystem } from '../fs/node-fs.js';
import { GrowMode } from './grow.js';
import type { GrowItem } from './grow-dialog.js';
import { applyGrowMode, captureGrowItems } from './grow-dialog.js';
import { DirList } from '../list/dir-list.js';

/** The default recent-path history id — distinct from the file dialog so their lists don't mix. */
const DIR_HISTORY_ID = 0x0f12;

/** Construction options for {@link ChDirDialog}. */
export interface ChDirDialogOptions {
  /** The filesystem to read through (default {@link nodeFileSystem}). */
  fs?: FileSystem;
  /** The current directory (default the filesystem's cwd). Shared with the tree. */
  directory?: Signal<string>;
  /** The dialog title (default `'Change Directory'`). */
  title?: string;
  /** The id keying this dialog's recent-path history (default a chdir id distinct from the file dialog). */
  historyId?: number;
  /** Called to show an error (unreadable directory). Wire it to {@link errorBox} in an app. */
  showError?: (message: string) => void;
  /** Called when the dialog resolves — with the chosen absolute directory, or `null` on cancel. */
  onResolve?: (path: string | null) => void;
}

/**
 * The modal change-directory dialog.
 *
 * @example
 * import { createApplication, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { ChDirDialog, errorBox, nodeFileSystem } from '@jsvision/files';
 *
 * const caps = resolveCapabilities({ env: process.env, platform: process.platform }).profile;
 * const app = createApplication({ caps });
 *
 * const dlg = new ChDirDialog({
 *   fs: nodeFileSystem,
 *   showError: (msg) => void errorBox(app, msg),
 * });
 * app.desktop.addWindow(dlg);
 * const command = await app.loop.execView<string>(dlg);
 * const dir = command === Commands.ok ? dlg.result() : null;
 * app.desktop.removeWindow(dlg);
 */
export class ChDirDialog extends Dialog {
  /** The filesystem this dialog reads through. */
  readonly fs: FileSystem;
  /** The current directory, shared with the tree. */
  readonly directory: Signal<string>;
  /** The path field value; it mirrors {@link directory} and is what OK validates. */
  readonly path: Signal<string>;
  /** The path input. */
  readonly pathInput: Input;
  /** The recent-path history dropdown beside the path input. */
  readonly history: History;
  /** The directory tree. */
  readonly dirList: DirList;
  /** The button strip (OK/Chdir/Revert/Help). */
  readonly buttons: Button[] = [];
  /** The button labels, parallel to {@link buttons}. */
  readonly buttonLabels: string[] = [];
  private readonly startDir: string;
  private readonly resultPath: Signal<string | null> = signal<string | null>(null);
  private readonly showErrorSeam?: (message: string) => void;
  private readonly onResolveCb?: (path: string | null) => void;
  /** The resize-reflow table (children + design rects + grow flags), replayed on drag-resize. */
  private readonly growItems: GrowItem[];

  constructor(opts: ChDirDialogOptions) {
    super({ title: opts.title ?? 'Change Directory', width: 48, height: 18 });
    // Drag-resizable but floored at the design size, so children only ever grow (see onResized()).
    this.resizable = true;
    this.minWidth = 48;
    this.minHeight = 18;
    // The children are placed at absolute rects measured from the outer frame (at row/col 0). Zero the
    // base Dialog's padding:1 inset so they aren't pushed in by (1,1) and made to overwrite the border
    // (see FileDialog for the same reasoning).
    this.layout = { ...this.layout, padding: 0 };
    this.fs = opts.fs ?? nodeFileSystem;
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

    // The resize-reflow table, captured at the design size and replayed by onResized(). Fixed-position
    // labels are omitted. The tree (which owns its scroll bar) grows both ways; the field grows wide;
    // the buttons stay pinned to the right edge.
    this.growItems = captureGrowItems([
      [this.pathInput, GrowMode.HiX],
      [this.history, GrowMode.LoX | GrowMode.HiX],
      [this.dirList, GrowMode.HiX | GrowMode.HiY],
      ...this.buttons.map((b): [Button, number] => [b, GrowMode.LoX | GrowMode.HiX]),
    ]);

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

  /** Reflow the children to track the frame when the dialog is drag-resized. */
  override onResized(): void {
    if (this.layout.rect !== undefined) {
      applyGrowMode(this.growItems, this.layout.rect, this.minWidth, this.minHeight);
    }
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
   * Decide whether the dialog may close. Cancel always closes; OK validates the path field as a
   * readable directory — resolving and closing on success, or raising the error box and staying open.
   *
   * @param command The command trying to close the dialog.
   * @returns `true` to close, `false` to stay open.
   */
  override valid(command: string): boolean {
    if (command === Commands.cancel) return true;
    if (command !== Commands.ok) return super.valid(command);
    this.firstInvalid = null;
    if (!super.valid(Commands.ok)) return false; // the base dialog's field-validation sweep
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
