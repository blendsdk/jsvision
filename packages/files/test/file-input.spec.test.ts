/**
 * Specification test (immutable oracle) — `FileInput` (ST-5/ST-14), a decode of `TFileInputLine`
 * (`extends Input`, `stddlg.cpp:69-92`).
 *
 * TV decode: on the `cmFileFocused` broadcast, and **while not itself the focused view** (`:78`), the
 * field mirrors the focused entry's name into its value; for a **directory** it appends the separator
 * + the owner's `wildCard` (`:83-88`) so the field reads `subdir/‹wildcard›`. Otherwise a plain
 * `TInputLine`. `.js` per NodeNext.
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

/** A focusable sibling so the FileInput can be made NOT-focused. */
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

// ST-5 — mirror the focused entry while NOT focused; dir → name + sep + wildcard.
test('ST-5: FileInput mirrors the focused file name; a directory appends sep + wildcard', () => {
  const value = signal('');
  const focused = signal<DirEntry | undefined>(undefined);
  const wildcard = signal('*.txt');
  const input = new FileInput({ value, focusedEntry: () => focused(), wildcard: () => wildcard(), sep: '/' });
  const sibling = new Focusable();
  const loop = mount(input, sibling);
  loop.focusView(sibling); // the input is NOT the focused view

  focused.set(fileEntry('report.txt'));
  expect(value()).toBe('report.txt'); // a file → bare name

  focused.set(dirEntry('subdir'));
  expect(value()).toBe('subdir/*.txt'); // a directory → name + sep + wildcard
});

// ST-5 — no mirror while the field itself is focused (the user is typing).
test('ST-5: FileInput does not mirror while it is the focused view', () => {
  const value = signal('typed-so-far');
  const focused = signal<DirEntry | undefined>(undefined);
  const input = new FileInput({ value, focusedEntry: () => focused(), wildcard: () => '*', sep: '/' });
  const sibling = new Focusable();
  const loop = mount(input, sibling);
  loop.focusView(input); // focus the input itself (Input is a focus leaf)

  focused.set(fileEntry('other.txt'));
  expect(value()).toBe('typed-so-far'); // unchanged — the not-focused guard (stddlg.cpp:78)
});

// ST-14 — a mirrored control-byte name renders sanitize-clean.
test('ST-14: FileInput renders a mirrored control-byte name sanitize-clean', () => {
  const value = signal('');
  const focused = signal<DirEntry | undefined>(undefined);
  const input = new FileInput({ value, focusedEntry: () => focused(), wildcard: () => '*', sep: '/' });
  const sibling = new Focusable();
  const loop = mount(input, sibling);
  loop.focusView(sibling);
  focused.set(fileEntry('\x1b[2Jevil.txt'));
  const buf = loop.renderRoot.buffer();
  for (let x = 0; x < 20; x += 1) expect(buf.get(x, 0)?.char).not.toBe('\x1b');
});
