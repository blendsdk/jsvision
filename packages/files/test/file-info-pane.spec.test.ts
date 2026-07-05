/**
 * Specification test (immutable oracle) — `FileInfoPane` (ST-6/ST-13/ST-14), a decode of
 * `TFileInfoPane::draw` (`stddlg.cpp:221-299`).
 *
 * TV decode: rect `(1,16,48,18)` = **47×2**, colour `getColor(1)` = the `fileInfo` role (`0x13`). Row 0
 * = the expanded `directory + wildCard` path at col 1. Row 1 = the focused entry name at col 1, then
 * **right-aligned** relative to `size.x`: size `@x-38`, month `@x-22` (`months[]` 3-letter), day `@x-18`
 * (2-digit), `,` `@x-16`, year `@x-15`, hour `@x-9` (12-hour, 2-digit), `:` `@x-7`, minute `@x-6`,
 * `am`/`pm` `@x-4`. **No attributes field.** Rows 2.. blank. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import { FileInfoPane } from '../src/list/file-info-pane.js';
import type { DirEntry } from '../src/fs/types.js';
import { createMemoryFs, dir } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 47;

function mount(pane: FileInfoPane) {
  pane.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: 2 } };
  const root = new Group();
  root.add(pane);
  const loop = createEventLoop({ width: W, height: 2 }, { caps });
  loop.mount(root);
  return loop;
}

const at = (buf: ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>, x: number, y: number) =>
  buf.get(x, y)?.char ?? ' ';
const span = (buf: ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>, x: number, y: number, n: number) =>
  Array.from({ length: n }, (_, i) => at(buf, x + i, y)).join('');

// ST-6 — row 0 = the search path; row 1 = name + right-aligned size/month/day/year/time/am-pm.
test('ST-6: FileInfoPane draws the path (row 0) + name & right-aligned fields (row 1)', () => {
  const directory = signal('/home/user');
  const wildcard = signal('*.txt');
  const entry: DirEntry = { name: 'App.ts', kind: 'file', size: 1234, mtime: new Date(2026, 6, 4, 9, 5, 0), hidden: false };
  const focused = signal<DirEntry | undefined>(entry);
  const pane = new FileInfoPane({ fs: createMemoryFs(dir()), directory: () => directory(), wildcard: () => wildcard(), focusedEntry: () => focused() });
  const loop = mount(pane);
  const buf = loop.renderRoot.buffer();

  // Row 0: the expanded "directory + wildcard" path at col 1.
  expect(span(buf, 1, 0, 16)).toBe('/home/user/*.txt');
  // Row 1: name at col 1; fields right-aligned to W=47.
  expect(span(buf, 1, 1, 6)).toBe('App.ts');
  expect(span(buf, W - 38, 1, 4)).toBe('1234'); // size @ x-38 = col 9
  expect(span(buf, W - 22, 1, 3)).toBe('Jul'); // month @ x-22 = col 25 (getMonth()=6 → Jul)
  expect(span(buf, W - 18, 1, 2)).toBe('04'); // day (2-digit) @ x-18 = col 29
  expect(at(buf, W - 16, 1)).toBe(','); // comma @ x-16 = col 31
  expect(span(buf, W - 15, 1, 4)).toBe('2026'); // year @ x-15 = col 32
  expect(span(buf, W - 9, 1, 2)).toBe('09'); // hour (12-hour, 2-digit) @ x-9 = col 38
  expect(at(buf, W - 7, 1)).toBe(':'); // colon @ x-7 = col 40
  expect(span(buf, W - 6, 1, 2)).toBe('05'); // minute @ x-6 = col 41
  expect(span(buf, W - 4, 1, 2)).toBe('am'); // 9:05 → am @ x-4 = col 43
});

// ST-13 — a broken symlink shows the name but no size/date (unresolved).
test('ST-13: FileInfoPane shows a broken link name with no size/date fields', () => {
  const entry: DirEntry = { name: 'dangling', kind: 'symlink', size: 0, mtime: new Date(0), hidden: false, broken: true };
  const pane = new FileInfoPane({
    fs: createMemoryFs(dir()),
    directory: () => '/home/user',
    wildcard: () => '*',
    focusedEntry: () => entry,
  });
  const loop = mount(pane);
  const buf = loop.renderRoot.buffer();
  expect(span(buf, 1, 1, 8)).toBe('dangling'); // the name is shown
  // No date fields: the year slot (col 32) is not a digit.
  expect('0123456789').not.toContain(at(buf, W - 15, 1));
});

// ST-14 — a control-byte directory path / name renders sanitize-clean.
test('ST-14: FileInfoPane renders control-byte path/name sanitize-clean', () => {
  const entry: DirEntry = { name: '\x1b[2Jx', kind: 'file', size: 1, mtime: new Date(2026, 0, 1, 1, 1, 0), hidden: false };
  const pane = new FileInfoPane({
    fs: createMemoryFs(dir()),
    directory: () => '/\x1b[2Jd',
    wildcard: () => '*',
    focusedEntry: () => entry,
  });
  const loop = mount(pane);
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 2; y += 1) for (let x = 0; x < W; x += 1) expect(at(buf, x, y)).not.toBe('\x1b');
});
