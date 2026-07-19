/**
 * Specification test (immutable oracle) — Tab-traversal order of `ChDirDialog`.
 *
 * The dialog is being recomposed from hand-placed absolute children into nested flex containers.
 * Child *positions* may move; the **order the user Tabs through the focusable controls must not**.
 * This oracle pins that order, so the recomposition is provably behavior-invariant on the one axis
 * that nesting is most likely to disturb.
 *
 * The expectation derives from the dialog's documented composition read top-to-bottom: the path
 * field, then the directory tree, then the OK/Chdir/Revert/Help strip. Focus lands on leaves, so the
 * tree's Tab stop is its inner rows view rather than the `DirList` container. The recent-paths
 * `History` and both `Label`s are decorations that are never Tab stops. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import type { EventLoop, View } from '@jsvision/ui';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { createMemoryFs, dir } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function fsFixture() {
  return createMemoryFs(dir({ home: dir({ user: dir({ src: dir(), docs: dir() }) }) }));
}

/** Mount a ChDirDialog at its design size and run it modally. */
function openChDirDialog(dlg: ChDirDialog): EventLoop {
  dlg.layout = { ...dlg.layout, rect: { x: 0, y: 0, width: 48, height: 18 } };
  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: 48, height: 18 }, { caps });
  loop.mount(root);
  void loop.execView<string>(dlg);
  return loop;
}

/**
 * A stable, position-independent name for a focusable view: matched by identity against the dialog's
 * named fields, so it does not depend on where the view sits in the child tree.
 */
function namer(dlg: ChDirDialog): (v: View | null) => string {
  const names = new Map<View, string>([
    [dlg.pathInput, 'pathInput'],
    [dlg.dirList, 'dirList'],
    [dlg.dirList.rows, 'dirList.rows'],
    [dlg.history, 'history'],
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

// ST-FE02 — path field → tree → OK → Chdir → Revert → Help, then wraps.
test('ST-FE02: ChDirDialog Tab-traverses [pathInput, tree, OK, Chdir, Revert, Help]', () => {
  const dlg = new ChDirDialog({ fs: fsFixture(), directory: signal('/home/user') });
  const loop = openChDirDialog(dlg);

  expect(focusRing(loop, namer(dlg))).toEqual([
    'pathInput',
    'dirList.rows',
    'btn:~O~K',
    'btn:~C~hdir',
    'btn:~R~evert',
    'btn:~H~elp',
  ]);
});

// ST-FE02 — the History dropdown and both Labels are decorations, never Tab stops.
test('ST-FE02: the History dropdown is not in the ChDirDialog Tab ring', () => {
  const dlg = new ChDirDialog({ fs: fsFixture(), directory: signal('/home/user') });
  const loop = openChDirDialog(dlg);

  const ring = focusRing(loop, namer(dlg));
  expect(ring).not.toContain('history');
  expect(ring).not.toContain('Label');
  // Every entry is a control the dialog names — nothing anonymous slipped into the ring.
  expect(ring.every((n) => n === 'pathInput' || n === 'dirList.rows' || n.startsWith('btn:'))).toBe(true);
});
