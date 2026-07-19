/**
 * Specification test (immutable oracle) — Tab-traversal order of `FileDialog`.
 *
 * The dialog is being recomposed from hand-placed absolute children into nested flex containers.
 * Child *positions* may move; the **order the user Tabs through the focusable controls must not**.
 * This oracle pins that order, so the recomposition is provably behavior-invariant on the one axis
 * that nesting is most likely to disturb.
 *
 * The expectation derives from the dialog's documented composition read top-to-bottom, left-to-right:
 * the filename field, then the listing, then the button strip in the order the mode's strip declares.
 * Focus lands on leaves, so the listing's Tab stop is its inner rows view rather than the `FileList`
 * container. The recent-paths `History`, the listing's scroll bar, and both `Label`s are decorations
 * that are never Tab stops — the bar is driven by the listing, not by the keyboard.
 *
 * Focus is driven through the PUBLIC loop surface (`focusNext`/`getFocused`), and each focusable is
 * named by identity against the dialog's own fields rather than by child index or geometry — so the
 * naming survives the move into nested groups. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import type { EventLoop, View } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function fsFixture() {
  return createMemoryFs(dir({ home: dir({ user: dir({ 'readme.txt': file({ size: 12 }), src: dir() }) }) }));
}

/** Mount a FileDialog at its design size and run it modally. */
function openFileDialog(dlg: FileDialog): EventLoop {
  dlg.layout = { ...dlg.layout, rect: { x: 0, y: 0, width: 49, height: 19 } };
  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: 49, height: 19 }, { caps });
  loop.mount(root);
  void loop.execView<string>(dlg);
  return loop;
}

/**
 * A stable, position-independent name for a focusable view: matched by identity against the dialog's
 * named fields, so it does not depend on where the view sits in the child tree.
 */
function namer(dlg: FileDialog): (v: View | null) => string {
  const names = new Map<View, string>([
    [dlg.fileInput, 'fileInput'],
    [dlg.fileList, 'fileList'],
    [dlg.fileList.rows, 'fileList.rows'],
    [dlg.listBar, 'listBar'],
  ]);
  dlg.buttons.forEach((b, i) => names.set(b, `btn:${dlg.buttonLabels[i]}`));
  return (v) => (v === null ? '<none>' : (names.get(v) ?? v.constructor.name));
}

/**
 * The dialog's focusable ring in Tab order, starting from whatever the modal focused on open.
 * Walks `focusNext()` until focus returns to the start, so the result is the complete cycle.
 */
function focusRing(loop: EventLoop, name: (v: View | null) => string, max = 16): string[] {
  const start = loop.getFocused();
  const ring = [name(start)];
  for (let i = 0; i < max; i++) {
    loop.focusNext();
    const current = loop.getFocused();
    if (current === start) return ring;
    ring.push(name(current));
  }
  return ring; // no wrap within `max` — returned as-is so the assertion shows the runaway order
}

// ST-FE01 — open mode: field → listing → Open → Cancel → Help, then wraps.
test('ST-FE01: FileDialog Tab-traverses [fileInput, listing, Open, Cancel, Help]', () => {
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user') });
  const loop = openFileDialog(dlg);

  expect(focusRing(loop, namer(dlg))).toEqual([
    'fileInput',
    'fileList.rows',
    'btn:~O~pen',
    'btn:~C~ancel',
    'btn:~H~elp',
  ]);
});

// ST-FE01 — save mode: the same prefix, followed by the five-button save strip.
test('ST-FE01: save-mode FileDialog Tab-traverses the full OK/Replace/Clear/Cancel/Help strip', () => {
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user'), save: true });
  const loop = openFileDialog(dlg);

  expect(focusRing(loop, namer(dlg))).toEqual([
    'fileInput',
    'fileList.rows',
    'btn:~O~K',
    'btn:~R~eplace',
    'btn:~C~lear',
    'btn:~C~ancel',
    'btn:~H~elp',
  ]);
});

// ST-FE01 — the History dropdown, the scroll bar, and both Labels are decorations, never Tab stops.
test('ST-FE01: the History dropdown and the listing scroll bar are not in the FileDialog Tab ring', () => {
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user') });
  const loop = openFileDialog(dlg);

  const ring = focusRing(loop, namer(dlg));
  expect(ring).not.toContain('History');
  expect(ring).not.toContain('Label');
  expect(ring).not.toContain('listBar');
  // Every entry is a control the dialog names — nothing anonymous slipped into the ring.
  expect(ring.every((n) => n === 'fileInput' || n === 'fileList.rows' || n.startsWith('btn:'))).toBe(true);
});
