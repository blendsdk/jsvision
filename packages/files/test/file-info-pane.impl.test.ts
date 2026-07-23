/**
 * Implementation test (edge/internal + cross-platform + sanitize) — `FileInfoPane`
 * (`src/list/file-info-pane.js`).
 *
 * Covers the row-0 `resolve(directory, wildcard)` search path (incl. win32), the right-aligned
 * size/date/time fields at the exact `w-38/22/18/16/15/9/7/6/4` columns for a known mtime, the 12-hour
 * am/pm edges (midnight→12am, noon→12pm, afternoon→01pm), the broken-symlink name-only render, the
 * uniform `fileInfo` fill across every row, and draw-time sanitize. Columns transcribed from the
 * source draw. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop } from '@jsvision/ui';
import { FileInfoPane } from '../src/list/file-info-pane.js';
import type { FileInfoPaneOptions } from '../src/list/file-info-pane.js';
import type { DirEntry } from '../src/fs/types.js';
import { createMemoryFs, dir } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 47;

function mount(opts: FileInfoPaneOptions, h = 2) {
  const pane = new FileInfoPane(opts);
  pane.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: h } });
  const root = new Group();
  root.add(pane);
  const loop = createEventLoop({ width: W, height: h }, { caps });
  loop.mount(root);
  return loop;
}

type Buf = ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>;
const at = (buf: Buf, x: number, y: number) => buf.get(x, y)?.char ?? ' ';
const span = (buf: Buf, x: number, y: number, n: number) =>
  Array.from({ length: n }, (_, i) => at(buf, x + i, y)).join('');

test('impl: row-0 search path = resolve(directory, wildcard); exact field columns for a known mtime', () => {
  const entry: DirEntry = {
    name: 'main.cpp',
    kind: 'file',
    size: 42,
    mtime: new Date(2026, 11, 25, 0, 7, 0),
    hidden: false,
  };
  const loop = mount({
    fs: createMemoryFs(dir()),
    directory: () => '/src/lib',
    wildcard: () => '*.cpp',
    focusedEntry: () => entry,
  });
  const buf = loop.renderRoot.buffer();
  expect(span(buf, 1, 0, 14)).toBe('/src/lib/*.cpp');
  expect(span(buf, 1, 1, 8)).toBe('main.cpp'); // name at col 1
  expect(span(buf, W - 38, 1, 2)).toBe('42'); // size @ x-38
  expect(span(buf, W - 22, 1, 3)).toBe('Dec'); // month (getMonth 11) @ x-22
  expect(span(buf, W - 18, 1, 2)).toBe('25'); // day @ x-18
  expect(at(buf, W - 16, 1)).toBe(','); // comma @ x-16
  expect(span(buf, W - 15, 1, 4)).toBe('2026'); // year @ x-15
  expect(span(buf, W - 9, 1, 2)).toBe('12'); // hour: 00:07 → 12 (12-hour) @ x-9
  expect(at(buf, W - 7, 1)).toBe(':'); // colon @ x-7
  expect(span(buf, W - 6, 1, 2)).toBe('07'); // minute @ x-6
  expect(span(buf, W - 4, 1, 2)).toBe('am'); // midnight → am @ x-4
});

test('impl: 12-hour am/pm edges — noon → 12pm, afternoon → 01pm', () => {
  const noon: DirEntry = { name: 'x', kind: 'file', size: 1, mtime: new Date(2026, 0, 1, 12, 0, 0), hidden: false };
  let loop = mount({ fs: createMemoryFs(dir()), directory: () => '/', wildcard: () => '*', focusedEntry: () => noon });
  let buf = loop.renderRoot.buffer();
  expect(span(buf, W - 9, 1, 2)).toBe('12'); // 12:00 noon → 12
  expect(span(buf, W - 4, 1, 2)).toBe('pm');

  const afternoon: DirEntry = {
    name: 'x',
    kind: 'file',
    size: 1,
    mtime: new Date(2026, 0, 1, 13, 30, 0),
    hidden: false,
  };
  loop = mount({ fs: createMemoryFs(dir()), directory: () => '/', wildcard: () => '*', focusedEntry: () => afternoon });
  buf = loop.renderRoot.buffer();
  expect(span(buf, W - 9, 1, 2)).toBe('01'); // 13:30 → 01
  expect(span(buf, W - 6, 1, 2)).toBe('30');
  expect(span(buf, W - 4, 1, 2)).toBe('pm');
});

test('impl: a broken symlink shows the name only — no size/date/time fields', () => {
  const entry: DirEntry = {
    name: 'dangling',
    kind: 'symlink',
    size: 999,
    mtime: new Date(2026, 0, 1, 1, 1, 0),
    hidden: false,
    broken: true,
  };
  const loop = mount({
    fs: createMemoryFs(dir()),
    directory: () => '/home',
    wildcard: () => '*',
    focusedEntry: () => entry,
  });
  const buf = loop.renderRoot.buffer();
  expect(span(buf, 1, 1, 8)).toBe('dangling');
  expect(at(buf, W - 38, 1)).toBe(' '); // size slot blank (fields skipped)
  expect('0123456789').not.toContain(at(buf, W - 15, 1)); // year slot not a digit
});

test('impl: the whole pane is filled with the fileInfo style (uniform across rows)', () => {
  const entry: DirEntry = { name: 'a', kind: 'file', size: 1, mtime: new Date(0), hidden: false };
  const loop = mount(
    { fs: createMemoryFs(dir()), directory: () => '/x', wildcard: () => '*', focusedEntry: () => entry },
    4,
  );
  const buf = loop.renderRoot.buffer();
  const ref = buf.get(1, 0); // a filled text cell (path char) uses the fileInfo style
  // Every blank cell (rows 0..3) carries the same fg/bg as the text region — one uniform fill.
  for (const [x, y] of [
    [40, 0],
    [40, 1],
    [0, 2],
    [46, 3],
  ] as const) {
    expect(buf.get(x, y)?.fg).toBe(ref?.fg);
    expect(buf.get(x, y)?.bg).toBe(ref?.bg);
  }
});

// —— CROSS-PLATFORM (task 7.2) ——

test('impl: win32 seam — the row-0 path resolves with backslashes', () => {
  const loop = mount({
    fs: createMemoryFs(dir(), { flavor: 'win32' }),
    directory: () => 'C:\\proj',
    wildcard: () => '*.md',
    focusedEntry: () => undefined,
  });
  const buf = loop.renderRoot.buffer();
  expect(span(buf, 1, 0, 12)).toBe('C:\\proj\\*.md');
});

// —— SANITIZE (task 7.4) ——

test('impl: control bytes in the path/name render sanitize-clean', () => {
  const entry: DirEntry = {
    name: '\x1b[2Jx\x07',
    kind: 'file',
    size: 1,
    mtime: new Date(2026, 0, 1, 1, 1, 0),
    hidden: false,
  };
  const loop = mount({
    fs: createMemoryFs(dir()),
    directory: () => '/\x1bd',
    wildcard: () => '*\x07',
    focusedEntry: () => entry,
  });
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < W; x += 1) {
      expect(at(buf, x, y)).not.toBe('\x1b');
      expect(at(buf, x, y)).not.toBe('\x07');
    }
  }
});
