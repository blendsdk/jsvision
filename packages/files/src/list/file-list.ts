/**
 * `FileList` — the 2-column virtual-scroll file listing (`extends ListView<DirEntry>`), a decode of
 * `TFileList` (`source/tvision/tfillist.cpp`).
 *
 * TV decode (GATE-1):
 *   • **Class** — `TFileList : TSortedListBox`; ctor `TSortedListBox(bounds, 2, aScrollBar)`
 *     (`tfillist.cpp:64`) ⇒ **2 columns** with the dialog-supplied scrollbar (PA-14 `numCols:2` +
 *     the injectable-bar seam).
 *   • **`getText`** (`tfillist.cpp:113-121`) — the entry `name`; a **directory** gets a **trailing
 *     path separator** appended (`strcat(dest, "\\")`), platform-corrected to `fs.sep`. **NOT**
 *     `[NAME]` brackets (AR-247).
 *   • **Population + sort** — `scanDirectory`/`compareEntries` (`tfillist.cpp:159-240`,
 *     `tfilecol.cpp:40-56`): files A–Z → dirs A–Z → `..` last; hidden excluded unless toggled; dirs
 *     never wildcard-filtered. The scan is a reactive derivation of `directory`/`wildcard`/`showHidden`.
 *   • **Broadcasts** — focusing a row exposes {@link focusedEntry} (the `FileInput`/`FileInfoPane`
 *     track it, `cmFileFocused`); Enter/double-click fires `onOpenEntry` (`cmFileDoubleClicked`).
 *
 * The 2-column column-major layout + `│` divider lives in `@jsvision/ui`'s `ListRows` (PA-14), not
 * duplicated here. Names are sanitized at the draw boundary (`ctx.text`, AC-14). `.js` per NodeNext.
 */
import { ListView, ScrollBar, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { scanDirectory } from '../fs/scan.js';

/** Construction options for {@link FileList}. */
export interface FileListOptions {
  /** The filesystem seam. */
  fs: FileSystem;
  /** The current directory (shared with the owning dialog; the list re-scans on change). */
  directory: Signal<string>;
  /** The file wildcard (default an internal `'*'` signal). */
  wildcard?: Signal<string>;
  /** The reveal-hidden toggle (default an internal `false` signal, AC-4). */
  showHidden?: Signal<boolean>;
  /** A caller predicate AND-ed with the wildcard (PA-10); off by default. */
  filter?: (entry: DirEntry) => boolean;
  /** The focused display index (default an internal signal at 0). */
  focused?: Signal<number>;
  /** The selected display index (default an internal signal at -1). */
  selected?: Signal<number>;
  /** An injected/placed scroll bar (the dialog's horizontal-bottom bar); default an owned vertical bar. */
  bar?: ScrollBar;
  /** Fired on Enter/double-click activation with the opened entry (enter a dir / resolve a file). */
  onOpenEntry?: (entry: DirEntry) => void;
  /** A command emitted on activation (like `Button`). */
  command?: string;
}

/** The 2-column TV file listing over a reactive `scanDirectory` derivation. */
export class FileList extends ListView<DirEntry> {
  /** The current directory (re-scanned on change). */
  readonly directory: Signal<string>;
  /** The active file wildcard. */
  readonly wildcard: Signal<string>;
  /** The reveal-hidden toggle. */
  readonly showHidden: Signal<boolean>;
  /** The scanned, sorted entries (a writable signal kept in sync with the seam scan). */
  readonly entries: Signal<DirEntry[]>;
  /** The currently-focused entry (tracked by `FileInput`/`FileInfoPane`), or `undefined` when empty. */
  readonly focusedEntry: () => DirEntry | undefined;
  private readonly fsSeam: FileSystem;

  constructor(opts: FileListOptions) {
    const wildcard = opts.wildcard ?? signal('*');
    const showHidden = opts.showHidden ?? signal(false);
    const entries = signal<DirEntry[]>([]);
    const onOpen = opts.onOpenEntry; // capture before super() (no `this` access pre-super)
    super({
      items: entries,
      // TV getText (tfillist.cpp:113-121): dir → trailing sep (incl. ".."); a file → bare name.
      getText: (e) => e.name + (e.kind === 'dir' ? opts.fs.sep : ''),
      focused: opts.focused,
      selected: opts.selected,
      numCols: 2, // TSortedListBox(bounds, 2, sb) — PA-14
      typeAhead: true,
      sorted: false, // scanDirectory pre-sorts (compareEntries is not ascending getText)
      bar: opts.bar,
      command: opts.command,
      onSelect: (_index, entry) => onOpen?.(entry), // Enter/double-click → open (cmFileDoubleClicked)
    });
    this.fsSeam = opts.fs;
    this.directory = opts.directory;
    this.wildcard = wildcard;
    this.showHidden = showHidden;
    this.entries = entries;
    // A plain reactive accessor (not a `computed` — no owner-less computation): reading it in an effect
    // subscribes to `entries` + `focused`; reading it bare returns the current value.
    this.focusedEntry = () => this.entries()[this.focused()];

    // Reactive re-scan: a `directory`/`wildcard`/`showHidden` change re-derives the sorted model. The
    // scan is the owned `bind` reader (no un-owned computed); it runs immediately on mount and on every
    // dependency change. An unreadable directory yields an empty list (the dialog surfaces the error
    // box, AC-12).
    const filter = opts.filter;
    this.onMount(() => {
      this.bind(
        () => {
          try {
            return scanDirectory(this.fsSeam, this.directory(), {
              wildcard: this.wildcard(),
              showHidden: this.showHidden(),
              filter,
            });
          } catch {
            return [] as DirEntry[];
          }
        },
        (list) => this.entries.set(list),
      );
    });
  }
}
