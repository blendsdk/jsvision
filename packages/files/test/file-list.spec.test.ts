/**
 * Specification test (immutable oracle) — `FileList` (ST-3/ST-4/ST-14), a decode of `TFileList`
 * (`extends ListView<DirEntry>`, `tfillist.cpp`).
 *
 * TV decode: `getText` (`tfillist.cpp:113-121`) appends the path separator to a directory name (NOT
 * `[NAME]` brackets, AR-247); the 2-column column-major layout + `│` divider is the PA-14 `numCols:2`
 * seam (proven cell-by-cell in `list-numcols.spec`); population/sort come from `scanDirectory`
 * (proven in `scan.spec`). This oracle covers the FileList integration: trailing-sep rows, reactive
 * re-scan, the hidden toggle + caller filter, focus/open broadcasts, and draw-time sanitize (AC-14).
 * `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, createEventLoop, ScrollBar, signal } from '@jsvision/ui';
import { FileList } from '../src/list/file-list.js';
import type { DirEntry } from '../src/fs/types.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const key = (k: string): KeyEvent => ({ type: 'key', key: k, ctrl: false, alt: false, shift: false });

function fsFixture() {
  return createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'readme.txt': file({ size: 12 }),
          'App.ts': file({ size: 30 }),
          '.hidden': file({ hidden: true }),
          src: dir(),
          other: dir({ deep: dir() }),
        }),
      }),
    }),
  );
}

/** Mount a FileList filling `w×h` (an injected bar ⇒ rows fill the full width) and focus it. */
function hosted(list: FileList, w: number, h: number) {
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  return loop;
}

/** The full text of buffer row `y`. */
function rowText(
  buf: ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>,
  y: number,
  w: number,
): string {
  let s = '';
  for (let x = 0; x < w; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

// ST-3 — directory rows carry a trailing separator (not [NAME]); files → dirs → ".." last.
test('ST-3: FileList rows append the path separator to directories, sorted files → dirs → ".."', () => {
  const directory = signal('/home/user');
  const bar = new ScrollBar({ value: signal(0), orientation: 'horizontal' });
  const list = new FileList({ fs: fsFixture(), directory, bar });
  const loop = hosted(list, 40, 8);
  const buf = () => loop.renderRoot.buffer();

  // Sorted: App.ts, readme.txt (files) → other, src (dirs, trailing "/") → ".." (trailing "/").
  expect(list.entries().map((e) => e.name)).toEqual(['App.ts', 'readme.txt', 'other', 'src', '..']);
  // Column 0 (rows 0..): App.ts, readme.txt, other/, src/, ../ ... 5 items in a height-8/2-col grid all
  // fit in column 0. The directory rows show a trailing '/'.
  expect(rowText(buf(), 2, 40)).toContain('other/'); // a directory row → trailing sep
  expect(rowText(buf(), 0, 40)).toContain('App.ts'); // a file row → no trailing sep
  expect(rowText(buf(), 0, 40)).not.toContain('App.ts/');
});

// ST-4 — reactive re-scan on directory change; the hidden toggle; a caller filter AND-ed.
test('ST-4: FileList re-scans on directory change, honours showHidden + a caller filter', () => {
  const directory = signal('/home/user');
  const showHidden = signal(false);
  const list = new FileList({ fs: fsFixture(), directory, showHidden });
  hosted(list, 40, 8);

  expect(list.entries().map((e) => e.name)).not.toContain('.hidden');
  showHidden.set(true);
  expect(list.entries().map((e) => e.name)).toContain('.hidden');

  // Change directory ⇒ re-scan (an inner dir with just `..`).
  directory.set('/home/user/other');
  expect(list.entries().map((e) => e.name)).toEqual(['deep', '..']);

  // A caller filter is AND-ed (removes `deep`).
  const filtered = new FileList({
    fs: fsFixture(),
    directory: signal('/home/user/other'),
    filter: (e: DirEntry) => e.name !== 'deep',
  });
  hosted(filtered, 40, 8);
  expect(filtered.entries().map((e) => e.name)).toEqual(['..']);
});

// ST-3/broadcast — the focused entry is exposed; Enter/activation broadcasts the open entry.
test('ST-3: FileList exposes the focused entry + broadcasts open on Enter', () => {
  const directory = signal('/home/user');
  const opened: DirEntry[] = [];
  const list = new FileList({ fs: fsFixture(), directory, onOpenEntry: (e) => opened.push(e) });
  const loop = hosted(list, 40, 8);

  expect(list.focusedEntry()?.name).toBe('App.ts'); // first row focused
  loop.dispatch(key('down'));
  expect(list.focusedEntry()?.name).toBe('readme.txt');
  loop.dispatch(key('down')); // → 'other' (a directory)
  loop.dispatch(key('enter'));
  expect(opened.map((e) => e.name)).toEqual(['other']);
});

// ST-14 — a filename carrying a control sequence renders sanitize-clean (no raw ESC reaches the buffer).
test('ST-14: FileList renders a control-byte filename sanitize-clean', () => {
  const directory = signal('/evil');
  const fs = createMemoryFs(dir({ evil: dir({ '\x1b[2Jevil.txt': file() }) }));
  const list = new FileList({ fs, directory });
  const loop = hosted(list, 40, 8);
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 40; x += 1) expect(buf.get(x, y)?.char).not.toBe('\x1b');
  }
});
