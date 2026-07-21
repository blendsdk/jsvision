/**
 * Implementation test (edge/internal + sanitize) — `FileList` (`src/list/file-list.js`).
 *
 * Covers `getText`'s trailing separator for directories including the synthesized `..`, reactive
 * re-scan on `wildcard`/`showHidden` change, `focusedEntry` tracking under keyboard navigation, the
 * `<empty>` render for an empty listing, type-ahead prefix focus, and draw-time sanitize of a
 * control-byte filename. Assertions are derived from the source `getText` + the bound re-scan. `.js`
 * per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import { FileList } from '../src/list/file-list.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const key = (k: string): KeyEvent => ({ type: 'key', key: k, ctrl: false, alt: false, shift: false });

function hosted(list: FileList, w: number, h: number) {
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  return loop;
}

type Buf = ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>;
const span = (buf: Buf, x: number, y: number, n: number) =>
  Array.from({ length: n }, (_, i) => buf.get(x + i, y)?.char ?? ' ').join('');

test('impl: getText appends the separator to every directory row, incl. ".."', () => {
  // Files only + the synthesized ".." — no other subdirs, so col-0 rows are deterministic.
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ 'a.txt': file() }) }) }));
  const list = new FileList({ fs, directory: signal('/home/user') });
  const loop = hosted(list, 30, 8);
  const buf = loop.renderRoot.buffer();
  expect(list.entries().map((e) => e.name)).toEqual(['a.txt', '..']);
  expect(span(buf, 1, 0, 5)).toBe('a.txt'); // a file → bare name (no trailing sep)
  expect(span(buf, 1, 1, 3)).toBe('../'); // ".." is dir-like → trailing '/'
});

test('impl: reactive re-scan on wildcard change', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ 'App.ts': file(), 'readme.txt': file(), src: dir() }) }) }));
  const wildcard = signal('*.*');
  const list = new FileList({ fs, directory: signal('/home/user'), wildcard });
  hosted(list, 30, 8);
  expect(list.entries().map((e) => e.name)).toEqual(['App.ts', 'readme.txt', 'src', '..']);
  wildcard.set('*.ts'); // files re-filter; dirs stay
  expect(list.entries().map((e) => e.name)).toEqual(['App.ts', 'src', '..']);
});

test('impl: reactive re-scan on showHidden change', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ 'v.txt': file(), '.env': file({ hidden: true }) }) }) }));
  const showHidden = signal(false);
  const list = new FileList({ fs, directory: signal('/home/user'), showHidden });
  hosted(list, 30, 8);
  expect(list.entries().map((e) => e.name)).not.toContain('.env');
  showHidden.set(true);
  expect(list.entries().map((e) => e.name)).toContain('.env');
});

test('impl: focusedEntry tracks keyboard navigation', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ 'a.txt': file(), 'b.txt': file(), 'c.txt': file() }) }) }));
  const list = new FileList({ fs, directory: signal('/home/user') });
  const loop = hosted(list, 30, 10);
  expect(list.focusedEntry()?.name).toBe('a.txt');
  loop.dispatch(key('down'));
  expect(list.focusedEntry()?.name).toBe('b.txt');
  loop.dispatch(key('down'));
  expect(list.focusedEntry()?.name).toBe('c.txt');
});

test('impl: an empty listing renders "<empty>"', () => {
  const fs = createMemoryFs(dir({})); // an empty filesystem root ⇒ no entries, no ".."
  const list = new FileList({ fs, directory: signal('/') });
  const loop = hosted(list, 30, 8);
  expect(list.entries()).toEqual([]);
  expect(span(loop.renderRoot.buffer(), 1, 0, 7)).toBe('<empty>');
});

test('impl: type-ahead focuses the first getText prefix match', () => {
  const fs = createMemoryFs(
    dir({ home: dir({ user: dir({ 'apple.txt': file(), 'mango.txt': file(), zebra: dir() }) }) }),
  );
  const list = new FileList({ fs, directory: signal('/home/user') });
  const loop = hosted(list, 30, 10);
  expect(list.focusedEntry()?.name).toBe('apple.txt'); // first row
  loop.dispatch(key('m')); // type-ahead → 'mango.txt'
  expect(list.focusedEntry()?.name).toBe('mango.txt');
});

// —— SANITIZE (task 7.3/7.4) ——

test('impl: a control-byte filename renders sanitize-clean (no raw ESC cell)', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ '\x1b[2J\x07danger.txt': file() }) }) }));
  const list = new FileList({ fs, directory: signal('/home/user') });
  const loop = hosted(list, 40, 8);
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      expect(buf.get(x, y)?.char).not.toBe('\x1b');
      expect(buf.get(x, y)?.char).not.toBe('\x07');
    }
  }
});
