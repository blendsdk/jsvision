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
import type { I18n } from '@jsvision/i18n';
import type { Signal } from '@jsvision/ui';
import {
  Button,
  Commands,
  Dialog,
  History,
  Label,
  ScrollBar,
  buttonColumn,
  measureButtonGroup,
  col,
  cover,
  fixed,
  frameTitleMinimumWidth,
  grow,
  row,
  signal,
  spacer,
  stringWidth,
} from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { nodeFileSystem } from '../fs/node-fs.js';
import { isWild } from '../fs/wildcard.js';
import { FileInput } from '../input/file-input.js';
import { createEnglishFilesI18n, FILES_ENGLISH_CATALOG } from '../i18n/catalog.js';
import { filesAcceleratorLabel } from '../i18n/label.js';
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
  /** Translation service for package-owned labels; defaults to an isolated English service. */
  i18n?: I18n;
  /** An extra predicate AND-ed with the wildcard when listing files. */
  filter?: (entry: DirEntry) => boolean;
  /** The id keying this dialog's recent-path history (default a file-dialog id distinct from chdir). */
  historyId?: number;
  /** Called to show an error (bad filename / directory). Wire it to {@link errorBox} in an app. */
  showError?: (message: string) => void;
  /** Called when the dialog resolves — with the chosen absolute path, or `null` on cancel. */
  onResolve?: (path: string | null) => void;
}

/** The default recent-path history id — distinct from the chdir dialog so their lists don't mix. */
const FILE_HISTORY_ID = 0x0f11;

/** Resolve the complete mode-specific action label set before dialog geometry is chosen. */
function fileActionLabels(i18n: I18n, save: boolean): string[] {
  const keys: Array<keyof typeof FILES_ENGLISH_CATALOG.messages> = save
    ? ['files.action.ok', 'files.action.replace', 'files.action.clear', 'files.action.cancel', 'files.action.help']
    : ['files.action.open', 'files.action.cancel', 'files.action.help'];
  return keys.map((key) => {
    const english = FILES_ENGLISH_CATALOG.messages[key];
    if (typeof english !== 'string') throw new TypeError(`Files label ${key} must be text.`);
    return filesAcceleratorLabel(i18n, key, english);
  });
}

/** Resolve one Files label before geometry is chosen. */
function fileLabel(i18n: I18n, key: keyof typeof FILES_ENGLISH_CATALOG.messages): string {
  const english = FILES_ENGLISH_CATALOG.messages[key];
  if (typeof english !== 'string') throw new TypeError(`Files label ${key} must be text.`);
  return filesAcceleratorLabel(i18n, key, english);
}

/** Minimum width needed by fixed-position translated metadata in the two-row information pane. */
function infoPaneMinimumWidth(i18n: I18n): number {
  const monthKeys = [
    'files.info.month.january.short',
    'files.info.month.february.short',
    'files.info.month.march.short',
    'files.info.month.april.short',
    'files.info.month.may.short',
    'files.info.month.june.short',
    'files.info.month.july.short',
    'files.info.month.august.short',
    'files.info.month.september.short',
    'files.info.month.october.short',
    'files.info.month.november.short',
    'files.info.month.december.short',
  ] as const;
  const widestMonth = Math.max(
    ...monthKeys.map((key) => stringWidth(i18n.t(key, { defaultMessage: FILES_ENGLISH_CATALOG.messages[key] }))),
  );
  const widestPeriod = Math.max(
    stringWidth(i18n.t('files.info.time.am', { defaultMessage: FILES_ENGLISH_CATALOG.messages['files.info.time.am'] })),
    stringWidth(i18n.t('files.info.time.pm', { defaultMessage: FILES_ENGLISH_CATALOG.messages['files.info.time.pm'] })),
  );
  return 49 + Math.max(0, widestMonth - 3) + Math.max(0, widestPeriod - 2);
}

/**
 * The modal open/save file dialog.
 *
 * @example
 * import { createApplication, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { FileDialog, errorBox, nodeFileSystem } from '@jsvision/files';
 *
 * const caps = resolveCapabilities().profile; // ambient: reads process.env + process.platform
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
  /** Translation service used for package-owned dialog text. */
  readonly i18n: I18n;
  private readonly resultPath: Signal<string | null> = signal<string | null>(null);
  private readonly showErrorSeam?: (message: string) => void;
  private readonly onResolveCb?: (path: string | null) => void;

  constructor(opts: FileDialogOptions) {
    const i18n = opts.i18n ?? createEnglishFilesI18n();
    const save = opts.save === true;
    const title =
      opts.title ??
      (save
        ? i18n.t('files.dialog.save-as.title', {
            defaultMessage: FILES_ENGLISH_CATALOG.messages['files.dialog.save-as.title'],
          })
        : i18n.t('files.dialog.open.title', {
            defaultMessage: FILES_ENGLISH_CATALOG.messages['files.dialog.open.title'],
          }));
    const inputLabelText = opts.inputName ?? fileLabel(i18n, 'files.field.name');
    const filesLabelText = fileLabel(i18n, 'files.field.list');
    const actionLabels = fileActionLabels(i18n, save);
    const actionMetrics = measureButtonGroup(
      actionLabels.map((label) => new Button(label)),
      { minimumButtonWidth: 11, maxColumns: 1, rowGap: 1 },
    );
    const width = Math.max(
      49,
      actionMetrics.buttonWidth + 27,
      frameTitleMinimumWidth(title),
      stringWidth(inputLabelText) + 6,
      stringWidth(filesLabelText) + 6,
      infoPaneMinimumWidth(i18n),
    );
    super({
      title,
      width,
      height: 19,
    });
    // Drag-resizable but floored at the design size. There is no reflow code to go with it: the body
    // below is a flex tree, so a resize re-solves every child in one layout pass.
    this.resizable = true;
    this.minWidth = width;
    this.minHeight = 19;
    this.i18n = i18n;
    this.fs = opts.fs ?? nodeFileSystem;
    this.directory = opts.directory ?? signal(this.fs.resolve('.'));
    this.wildcard = opts.wildcard ?? signal('*.*');
    this.filename = opts.filename ?? signal('');
    this.showErrorSeam = opts.showError;
    this.onResolveCb = opts.onResolve;

    const focused = signal(0);
    // The listing's scroll bar is owned by the dialog and placed as a horizontal bar under the list.
    this.listBar = new ScrollBar({ value: focused, orientation: 'horizontal' });
    this.fileList = new FileList({
      fs: this.fs,
      directory: this.directory,
      wildcard: this.wildcard,
      focused,
      bar: this.listBar,
      filter: opts.filter,
      onOpenEntry: (entry) => this.openEntry(entry),
    });

    this.fileInput = new FileInput({
      value: this.filename,
      focusedEntry: () => this.fileList.focusedEntry(),
      wildcard: () => this.wildcard(),
      sep: this.fs.sep,
    });
    this.history = new History({ link: this.fileInput, historyId: opts.historyId ?? FILE_HISTORY_ID });

    const inputLabel = new Label(inputLabelText, this.fileInput);
    const filesLabel = new Label(filesLabelText, this.fileList.rows);

    this.fileInfoPane = new FileInfoPane({
      fs: this.fs,
      directory: () => this.directory(),
      wildcard: () => this.wildcard(),
      focusedEntry: () => this.fileList.focusedEntry(),
      i18n: this.i18n,
    });

    this.buildButtons(save, actionLabels);

    // Every child below that cannot measure itself carries an explicit `fixed`/`grow` size. That is
    // not decoration: only `Text` and `Button` know their own intrinsic size, so any other widget
    // left to size automatically would collapse to nothing and vanish.
    //
    // A consequence worth knowing: the captions stretch to the full content column rather than
    // hugging their text, so the blank space beside a caption is part of its click zone and focuses
    // the control it labels. That is a more forgiving target, and it paints identically as long as
    // the label and dialog backgrounds match — which every shipped theme keeps in step.
    const inputRow = row(grow(this.fileInput), fixed(this.history, 3));
    const leftCol = col(
      fixed(inputLabel, 1),
      fixed(inputRow, 1),
      spacer({ fixed: 1 }),
      fixed(filesLabel, 1),
      grow(this.fileList), // the listing absorbs whatever height is left, so it grows on resize
      fixed(this.listBar, 1),
    );
    // The buttons start one row below the filename field, matching the field's own top inset.
    const buttonCol = col(
      { padding: { top: 1, right: 0, bottom: 0, left: 0 } },
      buttonColumn(this.buttons, { minimumButtonWidth: 11, gap: 1 }),
    );
    const buttonWidth = actionMetrics.buttonWidth;

    // The outer column is unpadded so the info pane can span the full frame interior; the inner one
    // carries the side inset the rest of the content needs.
    this.add(
      cover(
        col(
          grow(
            col(
              { padding: { top: 1, right: 2, bottom: 0, left: 2 } },
              grow(row({ gap: 1 }, grow(leftCol), fixed(buttonCol, buttonWidth))),
            ),
          ),
          fixed(this.fileInfoPane, 2),
        ),
      ),
    );
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

  /** Build the mode-appropriate button strip; the layout below places and sizes it. */
  private buildButtons(save: boolean, labels: readonly string[]): void {
    const specs: Array<{ command?: string; default?: boolean; onClick?: () => void }> = save
      ? [
          { command: Commands.ok, default: true },
          { onClick: () => this.replace() },
          { onClick: () => this.clear() },
          { command: Commands.cancel },
          {},
        ]
      : [{ command: Commands.ok, default: true }, { command: Commands.cancel }, {}];
    specs.forEach((spec, index) => {
      const label = labels[index];
      if (label === undefined) throw new RangeError('File dialog action labels must match the selected mode.');
      const btn = new Button(label, {
        command: spec.command,
        default: spec.default,
        onClick: spec.onClick,
      });
      this.buttons.push(btn);
      this.buttonLabels.push(label);
    });
  }

  /** Resolve one Files-owned message with its canonical English fallback. */
  private text(key: keyof typeof FILES_ENGLISH_CATALOG.messages): string {
    return this.i18n.t(key, { defaultMessage: FILES_ENGLISH_CATALOG.messages[key] });
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
    // Empty input resolves to the current directory. Treat it as a filename error before the
    // directory branch so OK cannot silently navigate to the directory already being displayed.
    if (raw.length === 0) return this.resolveFileAt(full, raw);
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
      this.showErrorSeam?.(
        this.i18n.t('files.error.invalid-file-name', {
          defaultMessage: FILES_ENGLISH_CATALOG.messages['files.error.invalid-file-name'],
          params: { name: raw },
        }),
      );
      return false;
    }
    // The parent directory must exist and be a directory for the path to be valid.
    if (this.statKind(this.fs.dirname(full)) !== 'dir') {
      this.showErrorSeam?.(this.text('files.error.invalid-drive-directory'));
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
