/**
 * A passive, two-row read-out that sits below a file dialog's listing. The first row shows the current
 * search path (directory joined with the active wildcard); the second shows the focused entry's name
 * on the left and its size, date, and 12-hour time right-aligned. A broken symlink shows only its
 * name. It draws nothing else and takes no input — it just reflects whatever the three accessors
 * return, repainting whenever they change.
 *
 * This is the info pane embedded in {@link FileDialog}; use it directly only when composing a custom
 * file picker.
 */
import { View } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';

/** 3-letter month names, 0-indexed to match `Date.getMonth()`. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Two-digit, zero-padded. */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Construction options for {@link FileInfoPane}. */
export interface FileInfoPaneOptions {
  /** The filesystem to read through (used to expand the search path). */
  fs: FileSystem;
  /** The current directory shown, with the wildcard, on row 0. */
  directory: () => string;
  /** The active wildcard, appended to the row-0 search path. */
  wildcard: () => string;
  /** The focused entry shown on row 1, or `undefined` when the list is empty. */
  focusedEntry: () => DirEntry | undefined;
}

/**
 * The file-info read-out pane (search path + focused-entry name/size/date/time).
 *
 * @example
 * import { at, Group, signal } from '@jsvision/ui';
 * import { FileInfoPane, nodeFileSystem } from '@jsvision/files';
 * import type { DirEntry } from '@jsvision/files';
 *
 * const directory = signal('/home/user');
 * const focused = signal<DirEntry | undefined>(undefined);
 * const pane = at(
 *   new FileInfoPane({
 *     fs: nodeFileSystem,
 *     directory: () => directory(),
 *     wildcard: () => '*.ts',
 *     focusedEntry: () => focused(),
 *   }),
 *   0,
 *   0,
 *   47,
 *   2,
 * );
 * new Group().add(pane);
 */
export class FileInfoPane extends View {
  private readonly fsSeam: FileSystem;
  private readonly directory: () => string;
  private readonly wildcard: () => string;
  private readonly focusedEntry: () => DirEntry | undefined;

  constructor(opts: FileInfoPaneOptions) {
    super();
    this.fsSeam = opts.fs;
    this.directory = opts.directory;
    this.wildcard = opts.wildcard;
    this.focusedEntry = opts.focusedEntry;
    // Repaint when the path, wildcard, or focused entry changes (draw() is not auto-tracked).
    this.onMount(() => {
      this.bind(() => {
        this.directory();
        this.wildcard();
        this.focusedEntry();
      });
    });
  }

  override draw(ctx: DrawContext): void {
    const w = ctx.size.width;
    const style = ctx.color('fileInfo');

    // Row 0 — the expanded "directory + wildcard" search path (sanitized by ctx.text).
    ctx.fillRect(0, 0, w, 1, ' ', style);
    ctx.text(1, 0, this.fsSeam.resolve(this.directory(), this.wildcard()), style);

    // Row 1 — the focused entry name + right-aligned size/date/time.
    ctx.fillRect(0, 1, w, 1, ' ', style);
    const entry = this.focusedEntry();
    if (entry !== undefined && entry.name.length > 0) {
      ctx.text(1, 1, entry.name, style);
      // A broken link shows only its name; the size/date/time fields also need enough width to fit.
      if (!entry.broken && w >= 39) {
        const d = entry.mtime;
        ctx.text(w - 38, 1, String(entry.size), style);
        ctx.text(w - 22, 1, MONTHS[d.getMonth()] ?? '', style);
        ctx.text(w - 18, 1, pad2(d.getDate()), style);
        ctx.text(w - 16, 1, ',', style);
        ctx.text(w - 15, 1, String(d.getFullYear()), style);
        let hour = d.getHours();
        const pm = hour >= 12;
        hour %= 12;
        if (hour === 0) hour = 12;
        ctx.text(w - 9, 1, pad2(hour), style);
        ctx.text(w - 7, 1, ':', style);
        ctx.text(w - 6, 1, pad2(d.getMinutes()), style);
        ctx.text(w - 4, 1, pm ? 'pm' : 'am', style);
      }
    }

    // Any rows below the first two are blank-filled.
    for (let y = 2; y < ctx.size.height; y += 1) ctx.fillRect(0, y, w, 1, ' ', style);
  }
}
