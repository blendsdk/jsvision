/**
 * Implementation test (edge/internal + cross-platform) — `FileDialog` (`src/dialog/file-dialog.js`).
 *
 * Covers the `valid(cmOK)` state-machine branches not exercised by the spec: entering a directory
 * clears the filename (stays open), a directory-prefixed wildcard splits into directory + pattern, a
 * name under a non-existent parent raises "Invalid drive or directory", and the defensive empty-name
 * "Invalid file name" guard (reached when the directory itself is not a directory). Also the
 * `openEntry` list-activation (a dir enters, a file resolves + closes), save-mode `replace()`/
 * `clear()`, and the win32 seam. All branches transcribed from the source `resolveOrNavigate`/
 * `resolveFileAt`. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, createEventLoop, signal, Commands } from '@jsvision/ui';
import type { EventLoop, View } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const key = (k: string): KeyEvent => ({ type: 'key', key: k, ctrl: false, alt: false, shift: false });

function fsFixture(flavor: 'posix' | 'win32' = 'posix') {
  return createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'readme.txt': file({ size: 12 }),
          'App.ts': file({ size: 30 }),
          src: dir({ inner: dir() }),
        }),
      }),
    }),
    { flavor },
  );
}

function openFileDialog(dlg: FileDialog) {
  // Preserve the dialog's own layout (esp. `padding`) so bounds reflect production geometry.
  dlg.setLayout({ rect: { x: 0, y: 0, width: 49, height: 19 } });
  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: 49, height: 19 }, { caps });
  loop.mount(root);
  const promise = loop.execView<string>(dlg);
  return { loop, promise };
}

/**
 * A child's solved rectangle relative to the dialog's top-left. `View.bounds` is parent-relative, so
 * a child nested inside layout groups measures from that group; the composed origins give the real
 * dialog-local position, and `bounds` still gives the size.
 */
function rectIn(loop: EventLoop, dialog: View, child: View) {
  const root = loop.renderRoot;
  const origin = root.originOf(child)!;
  const base = root.originOf(dialog)!;
  return { x: origin.x - base.x, y: origin.y - base.y, width: child.bounds.width, height: child.bounds.height };
}

// Regression: the info pane once overwrote the right `║` and bottom `╚══╝` frame, a visible bleed
// caused by insetting the children twice. Nothing may sit on the border ring, so assert every child
// stays strictly inside the 49×19 frame: top-left ≥ (1,1), bottom-right ≤ (48,18).
test('impl: no child bleeds past the frame — the info-pane double-inset regression', () => {
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user') });
  const { loop } = openFileDialog(dlg);
  const W = 49;
  const H = 19;
  const children = [dlg.fileInput, dlg.history, dlg.fileList, dlg.listBar, dlg.fileInfoPane, ...dlg.buttons];
  for (const c of children) {
    const b = rectIn(loop, dlg, c);
    expect(b.x, `${c.constructor.name}.x`).toBeGreaterThanOrEqual(1);
    expect(b.y, `${c.constructor.name}.y`).toBeGreaterThanOrEqual(1);
    expect(b.x + b.width, `${c.constructor.name} right edge`).toBeLessThanOrEqual(W - 1);
    expect(b.y + b.height, `${c.constructor.name} bottom edge`).toBeLessThanOrEqual(H - 1);
  }
  // The info pane specifically must sit flush above the bottom border (rows 16–17, full inner width).
  expect(rectIn(loop, dlg, dlg.fileInfoPane)).toMatchObject({ x: 1, y: 16, width: 47, height: 2 });
});

test('impl: valid(OK) on a directory name enters it and clears the filename (stays open)', async () => {
  const filename = signal('');
  const directory = signal('/home/user');
  const dlg = new FileDialog({ fs: fsFixture(), directory, filename });
  const { loop, promise } = openFileDialog(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  filename.set('src'); // a subdirectory ⇒ enter it
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(directory()).toBe('/home/user/src');
  expect(filename()).toBe(''); // cleared on entering
});

test('impl: valid(OK) on a directory-prefixed wildcard splits into directory + pattern', async () => {
  const filename = signal('');
  const directory = signal('/home/user');
  const dlg = new FileDialog({ fs: fsFixture(), directory, wildcard: signal('*.*'), filename });
  const { loop, promise } = openFileDialog(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  filename.set('/home/user/*.ts'); // an absolute wildcard ⇒ split
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(directory()).toBe('/home/user');
  expect(dlg.wildcard()).toBe('*.ts');
});

test('impl: valid(OK) on a name under a non-existent parent raises "Invalid drive or directory"', async () => {
  const errors: string[] = [];
  const filename = signal('');
  const dlg = new FileDialog({
    fs: fsFixture(),
    directory: signal('/home/user'),
    filename,
    showError: (m) => errors.push(m),
  });
  const { loop, promise } = openFileDialog(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  filename.set('ghost/sub/x.txt'); // parent /home/user/ghost/sub does not exist
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(errors).toContain('Invalid drive or directory');
});

test('impl: the defensive empty-name "Invalid file name" guard (directory not a directory)', async () => {
  const errors: string[] = [];
  const filename = signal('');
  // directory points at a FILE, so the empty-name path skips the "enter directory" branch and reaches
  // resolveFileAt with raw="" — the defensive `raw.length === 0` guard (source line 249).
  const dlg = new FileDialog({
    fs: fsFixture(),
    directory: signal('/home/user/readme.txt'),
    filename,
    showError: (m) => errors.push(m),
  });
  const { loop, promise } = openFileDialog(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(errors.some((m) => m.startsWith('Invalid file name'))).toBe(true);
});

test('impl: openEntry — Enter on a directory row enters it and clears the filename', async () => {
  const filename = signal('');
  const directory = signal('/home/user');
  const dlg = new FileDialog({ fs: fsFixture(), directory, filename });
  const { loop, promise } = openFileDialog(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  // Entries sorted: App.ts, readme.txt (files) → src (dir) → ".."; focus 'src' and activate.
  loop.focusView(dlg.fileList.rows);
  const srcIdx = dlg.fileList.entries().findIndex((e) => e.name === 'src');
  dlg.fileList.focused.set(srcIdx);
  loop.dispatch(key('enter'));
  await Promise.resolve();
  expect(settled).toBe(false); // a directory activation stays open
  expect(directory()).toBe('/home/user/src');
  expect(filename()).toBe('');
});

test('impl: openEntry — Enter on a file row resolves the absolute path and closes', async () => {
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user') });
  const { loop, promise } = openFileDialog(dlg);
  loop.focusView(dlg.fileList.rows);
  const idx = dlg.fileList.entries().findIndex((e) => e.name === 'readme.txt');
  dlg.fileList.focused.set(idx);
  loop.dispatch(key('enter'));
  await expect(promise).resolves.toBe(Commands.ok);
  expect(dlg.result()).toBe('/home/user/readme.txt');
});

test('impl: save-mode replace()/clear()', () => {
  const filename = signal('draft.txt');
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user'), filename, save: true });
  openFileDialog(dlg);
  dlg.clear();
  expect(filename()).toBe('');
  dlg.fileList.focused.set(dlg.fileList.entries().findIndex((e) => e.name === 'App.ts'));
  dlg.replace();
  expect(filename()).toBe('App.ts'); // replace loads the focused entry's bare name
});

// —— CROSS-PLATFORM (task 7.2) ——

test('impl: win32 seam — a directory-prefixed wildcard split uses backslashes', async () => {
  const filename = signal('');
  const directory = signal('C:\\home\\user');
  const dlg = new FileDialog({ fs: fsFixture('win32'), directory, wildcard: signal('*.*'), filename });
  const { loop, promise } = openFileDialog(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  filename.set('C:\\home\\user\\*.ts');
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(directory()).toBe('C:\\home\\user');
  expect(dlg.wildcard()).toBe('*.ts');
});
