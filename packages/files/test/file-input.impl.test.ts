/**
 * Implementation test (edge/internal + sanitize) — `FileInput` (`src/input/file-input.js`).
 *
 * Covers the focus-gated mirror (mirrors only while NOT the focused view), the untracked wildcard
 * read (a wildcard change alone never re-mirrors, but a fresh focus uses the current wildcard), the
 * `undefined` focused entry as a no-op, the file-vs-directory mirror shapes, and draw-time sanitize
 * of a mirrored control-byte name. Derived from the bound `focusedEntry` reader + the not-focused
 * guard in the source (`stddlg.cpp:78`). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View, createEventLoop, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { FileInput } from '../src/input/file-input.js';
import type { DirEntry } from '../src/fs/types.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const fileEntry = (name: string): DirEntry => ({ name, kind: 'file', size: 0, mtime: new Date(0), hidden: false });
const dirEntry = (name: string): DirEntry => ({ name, kind: 'dir', size: 0, mtime: new Date(0), hidden: false });

class Focusable extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

function mount(input: FileInput, sibling: Focusable) {
  input.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 1 } };
  sibling.layout = { position: 'absolute', rect: { x: 0, y: 1, width: 20, height: 1 } };
  const root = new Group();
  root.add(input);
  root.add(sibling);
  const loop = createEventLoop({ width: 20, height: 2 }, { caps });
  loop.mount(root);
  return loop;
}

test('impl: a wildcard change alone never re-mirrors; a fresh focus uses the current wildcard', () => {
  const value = signal('');
  const focused = signal<DirEntry | undefined>(undefined);
  const wildcard = signal('*.txt');
  const input = new FileInput({ value, focusedEntry: () => focused(), wildcard: () => wildcard(), sep: '/' });
  const sibling = new Focusable();
  const loop = mount(input, sibling);
  loop.focusView(sibling); // the input is NOT focused

  focused.set(dirEntry('subdir'));
  expect(value()).toBe('subdir/*.txt');

  wildcard.set('*.md'); // wildcard change alone must NOT re-mirror (untracked read)
  expect(value()).toBe('subdir/*.txt');

  focused.set(dirEntry('other')); // a fresh focus reads the CURRENT wildcard untracked
  expect(value()).toBe('other/*.md');
});

test('impl: an undefined focused entry is a no-op (leaves the value untouched)', () => {
  const value = signal('kept');
  const focused = signal<DirEntry | undefined>(fileEntry('seed.txt'));
  const input = new FileInput({ value, focusedEntry: () => focused(), wildcard: () => '*', sep: '/' });
  const sibling = new Focusable();
  const loop = mount(input, sibling);
  loop.focusView(sibling);
  expect(value()).toBe('seed.txt'); // mirrored the seed
  focused.set(undefined); // no entry ⇒ early return, value unchanged
  expect(value()).toBe('seed.txt');
});

test('impl: a file mirrors the bare name, a directory appends sep + wildcard', () => {
  const value = signal('');
  const focused = signal<DirEntry | undefined>(undefined);
  const input = new FileInput({ value, focusedEntry: () => focused(), wildcard: () => '*.cpp', sep: '/' });
  const sibling = new Focusable();
  const loop = mount(input, sibling);
  loop.focusView(sibling);
  focused.set(fileEntry('main.cpp'));
  expect(value()).toBe('main.cpp');
  focused.set(dirEntry('include'));
  expect(value()).toBe('include/*.cpp');
});

// —— SANITIZE (task 7.4) ——

test('impl: a mirrored control-byte name renders sanitize-clean', () => {
  const value = signal('');
  const focused = signal<DirEntry | undefined>(undefined);
  const input = new FileInput({ value, focusedEntry: () => focused(), wildcard: () => '*', sep: '/' });
  const sibling = new Focusable();
  const loop = mount(input, sibling);
  loop.focusView(sibling);
  focused.set(fileEntry('\x1b]0;title\x07oops.txt'));
  const buf = loop.renderRoot.buffer();
  for (let x = 0; x < 20; x += 1) {
    expect(buf.get(x, 0)?.char).not.toBe('\x1b');
    expect(buf.get(x, 0)?.char).not.toBe('\x07');
  }
});
