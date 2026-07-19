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
import {
  Dialog,
  Button,
  Label,
  Input,
  History,
  col,
  cover,
  fixed,
  grow,
  row,
  signal,
  spacer,
  Commands,
} from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { nodeFileSystem } from '../fs/node-fs.js';
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

  constructor(opts: ChDirDialogOptions) {
    super({ title: opts.title ?? 'Change Directory', width: 48, height: 18 });
    // Drag-resizable but floored at the design size. There is no reflow code to go with it: the body
    // below is a flex tree, so a resize re-solves every child in one layout pass.
    this.resizable = true;
    this.minWidth = 48;
    this.minHeight = 18;
    this.fs = opts.fs ?? nodeFileSystem;
    this.directory = opts.directory ?? signal(this.fs.resolve('.'));
    this.startDir = this.directory();
    this.path = signal(this.directory());
    this.showErrorSeam = opts.showError;
    this.onResolveCb = opts.onResolve;

    this.pathInput = new Input({ value: this.path });
    this.history = new History({ link: this.pathInput, historyId: opts.historyId ?? DIR_HISTORY_ID });
    const nameLabel = new Label('~D~irectory name', this.pathInput);

    this.dirList = new DirList({ fs: this.fs, directory: this.directory, onChangeDir: (p) => this.directory.set(p) });
    const treeLabel = new Label('~D~irectory tree', this.dirList.rows);

    this.buildButtons();

    // Every child below that cannot measure itself carries an explicit `fixed`/`grow` size. That is
    // not decoration: only `Text` and `Button` know their own intrinsic size, so any other widget
    // left to size automatically would collapse to nothing and vanish.
    //
    // A consequence worth knowing: the captions stretch to the full content column rather than
    // hugging their text, so the blank space beside a caption is part of its click zone and focuses
    // the control it labels. That is a more forgiving target, and it paints identically as long as
    // the label and dialog backgrounds match — which every shipped theme keeps in step.
    const pathRow = row(grow(this.pathInput), fixed(this.history, 3));
    const buttonCol = col({ gap: 1 }, ...this.buttons);

    // One padded column suffices here — unlike the file dialog, nothing spans the full frame width.
    this.add(
      cover(
        col(
          { padding: { top: 1, right: 2, bottom: 0, left: 2 } },
          fixed(nameLabel, 1),
          fixed(pathRow, 1),
          spacer({ fixed: 1 }),
          fixed(treeLabel, 1),
          // The tree takes whatever height is left, so it grows on resize.
          grow(row({ gap: 1 }, grow(this.dirList), fixed(buttonCol, 10))),
        ),
      ),
    );

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
    specs.forEach((s) => {
      const btn = new Button(s.label, { command: s.command, default: s.default, onClick: s.onClick });
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
