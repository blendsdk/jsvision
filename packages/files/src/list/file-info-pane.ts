/**
 * `FileInfoPane` — the passive read-out below a file dialog (`extends View`), a decode of
 * `TFileInfoPane::draw` (`stddlg.cpp:221-299`).
 *
 * TV decode (GATE-1): rect `(1,16,48,18)` = **47×2**, colour `getColor(1)` = the `fileInfo` role
 * (`0x13` cyan-on-blue; the full palette chain is recorded in the core theme + PA-6). Row 0 = the
 * expanded `directory + wildCard` search path at col 1. Row 1 = the focused entry name at col 1, then
 * **right-aligned** relative to `size.x`: size `@x-38`, month `@x-22` (3-letter `months[]`), day
 * `@x-18` (2-digit), `,` `@x-16`, year `@x-15`, hour `@x-9` (12-hour, 2-digit), `:` `@x-7`, minute
 * `@x-6`, `am`/`pm` `@x-4`. **No attributes field** (AR-247). Rows 2.. blank. A broken symlink shows the
 * name only (AC-13); every field is sanitized at the draw boundary (AC-14).
 *
 * GATE-2 AFTER-diff (`stddlg.cpp:221-299`): the whole pane is filled with `getColor(1)` (`moveChar(0,'
 * ',color,size.x)` per row), text at col 1, size/date/time right-aligned at the exact `size.x-N`
 * columns (38/22/18/16/15/9/7/6/4). No attributes field. No draw mismatch. `.js` per NodeNext.
 */
import { View } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';

/** 3-letter month names (0-indexed, matching `Date.getMonth()`; TV `months[]` `stddlg.cpp:230`). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Two-digit, zero-padded (TV pads a value < 10 with a leading `'0'`). */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Construction options for {@link FileInfoPane}. */
export interface FileInfoPaneOptions {
  /** The filesystem seam (for `resolve`). */
  fs: FileSystem;
  /** The current directory (row 0, with the wildcard). */
  directory: () => string;
  /** The active wildcard (appended to the row-0 search path). */
  wildcard: () => string;
  /** The focused entry (row 1), or `undefined` when the list is empty. */
  focusedEntry: () => DirEntry | undefined;
}

/** The file-info read-out pane (path + focused-entry name/size/date/time). */
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
      // A broken link shows the name only (AC-13); the fields need room (bounds-check, AC/security).
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

    // Rows 2.. — blank-filled (TV `writeLine(0, 2, size.x, size.y-2)`).
    for (let y = 2; y < ctx.size.height; y += 1) ctx.fillRect(0, y, w, 1, ' ', style);
  }
}
