/**
 * A two-column, scrolling file listing that stays in sync with a directory and wildcard. Directories
 * are shown with a trailing path separator (e.g. `src/`), files with their bare name, `..` last;
 * hidden files are omitted unless toggled on. Focusing a row exposes {@link focusedEntry} (so a
 * filename field or info pane can track it); pressing Enter or double-clicking activates the row.
 *
 * The listing re-scans reactively whenever its `directory`, `wildcard`, or `showHidden` signals
 * change. An unreadable directory simply shows an empty list. This is the listing embedded in
 * {@link FileDialog}; use it directly only when composing a custom file picker.
 */
import { ListView, ScrollBar, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DirEntry, FileSystem } from '../fs/types.js';
import { scanDirectory } from '../fs/scan.js';

/** Construction options for {@link FileList}. */
export interface FileListOptions {
  /** The filesystem to read through. */
  fs: FileSystem;
  /** The current directory; the list re-scans whenever it changes. */
  directory: Signal<string>;
  /** The file wildcard (default an internal `'*'` signal). Applies to files only. */
  wildcard?: Signal<string>;
  /** Whether hidden (dot) files are shown (default an internal `false` signal). */
  showHidden?: Signal<boolean>;
  /** An extra predicate AND-ed with the wildcard; off by default. */
  filter?: (entry: DirEntry) => boolean;
  /** The focused display index (default an internal signal at 0). */
  focused?: Signal<number>;
  /** The selected display index (default an internal signal at -1). */
  selected?: Signal<number>;
  /** A scroll bar to drive; when omitted the list owns its own vertical bar. */
  bar?: ScrollBar;
  /** Fired on Enter/double-click with the activated entry (enter a directory / resolve a file). */
  onOpenEntry?: (entry: DirEntry) => void;
  /** A command name emitted on activation, handled elsewhere (like {@link Button}). */
  command?: string;
}

/**
 * The two-column file listing, driven reactively by a directory scan.
 *
 * @example
 * import { Group, signal } from '@jsvision/ui';
 * import { FileList, nodeFileSystem } from '@jsvision/files';
 *
 * const directory = signal('/home/user');
 * const wildcard = signal('*.ts');
 * const list = new FileList({
 *   fs: nodeFileSystem,
 *   directory,
 *   wildcard,
 *   onOpenEntry: (entry) => {
 *     if (entry.kind === 'dir') directory.set(`/home/user/${entry.name}`);
 *     else console.log('open', entry.name);
 *   },
 * });
 * list.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 32, height: 8 } };
 * new Group().add(list);
 */
export class FileList extends ListView<DirEntry> {
  /** The current directory; changing it re-scans the listing. */
  readonly directory: Signal<string>;
  /** The active file wildcard. */
  readonly wildcard: Signal<string>;
  /** Whether hidden files are shown. */
  readonly showHidden: Signal<boolean>;
  /** The scanned, sorted entries currently displayed. */
  readonly entries: Signal<DirEntry[]>;
  /** The entry under the focus cursor, or `undefined` when the list is empty. Reactive. */
  readonly focusedEntry: () => DirEntry | undefined;
  private readonly fsSeam: FileSystem;

  constructor(opts: FileListOptions) {
    const wildcard = opts.wildcard ?? signal('*');
    const showHidden = opts.showHidden ?? signal(false);
    const entries = signal<DirEntry[]>([]);
    const onOpen = opts.onOpenEntry; // capture before super() — `this` isn't available yet
    super({
      items: entries,
      // Directories (including "..") render with a trailing separator; files render bare.
      getText: (e) => e.name + (e.kind === 'dir' ? opts.fs.sep : ''),
      focused: opts.focused,
      selected: opts.selected,
      numCols: 2,
      typeAhead: true,
      sorted: false, // scanDirectory already sorts (files, then dirs, then "..")
      bar: opts.bar,
      command: opts.command,
      onSelect: (_index, entry) => onOpen?.(entry), // Enter / double-click activates
    });
    this.fsSeam = opts.fs;
    this.directory = opts.directory;
    this.wildcard = wildcard;
    this.showHidden = showHidden;
    this.entries = entries;
    // Plain reactive accessor: read inside an effect it subscribes to `entries` + `focused`; read
    // bare it returns the current value.
    this.focusedEntry = () => this.entries()[this.focused()];

    // Re-scan reactively: any change to directory/wildcard/showHidden re-derives the sorted model.
    // Bound on mount (when the reactive scope exists), it runs once immediately and on every change;
    // an unreadable directory yields an empty list.
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
