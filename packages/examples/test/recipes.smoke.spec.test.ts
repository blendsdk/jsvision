// Specification oracle for the four recipe apps + the example custom widget (ST-7…ST-11).
//
// Each recipe is a real module under packages/examples/recipes/, smoke-tested by mounting it headless
// and asserting it paints, plus one behavioral assertion per recipe (sort flip, modal veto→resolve,
// file contents shown + writes confined, progress 0→100 + browser mount, widget measure + repaint).
// Immutable oracle: if a module disagrees, the module is wrong — never the test.

import { existsSync } from 'node:fs';
import { createEventLoop, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { expect, test } from 'vitest';

import { buildPeopleGrid } from '../recipes/data-grid.js';
import { makeAgeForm } from '../recipes/form-dialog.js';
import { buildFileViewer } from '../recipes/file-tools.js';
import { buildDashboard, mountDashboardInBrowser } from '../recipes/live-dashboard.js';
import { Sparkline } from '../recipes/custom-widget.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Count cells that were actually painted (an empty view leaves only spaces). */
function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

/** Read a buffer row as a string (for repaint/content comparisons). */
function rowText(rows: readonly { char: string }[][], y: number): string {
  return (rows[y] ?? []).map((c) => c.char).join('');
}

function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

// ST-7 — data-driven & master-detail: a header click sorts, and the master-detail order flips.
test('ST-7: data-grid paints and a header click sorts the rows', () => {
  const app = buildPeopleGrid();
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(app.root);

  expect(paintedCells(loop.renderRoot.buffer().rows())).toBeGreaterThan(0);
  const firstBefore = app.sorted()[0].name;

  // Click the Name column header (leftmost column; screen (0,0) → 1-based mouse (2,1)).
  loop.dispatch(mouse('down', 2, 1));
  loop.dispatch(mouse('up', 2, 1));

  expect(app.grid.sort()).toEqual({ col: 0, dir: 'asc' });
  const firstAfter = app.sorted()[0].name;
  expect(firstAfter).not.toBe(firstBefore);
  expect(firstAfter).toBe('Ada'); // alphabetical minimum
});

// ST-8 — forms/modals/validation: OK is vetoed while a field is out of range, resolves once fixed.
test('ST-8: form-dialog vetoes OK on an invalid field then resolves to ok when corrected', async () => {
  const { dialog, value, input } = makeAgeForm();
  const root = dialog; // the dialog is its own mountable root here
  const loop = createEventLoop({ width: 44, height: 14 }, { caps });
  loop.mount(root);

  const promise = loop.execView<string>(dialog);
  let settled: string | undefined;
  void promise.then((r) => {
    settled = r;
  });

  value.set('150'); // out of range(0,120)
  loop.emitCommand('ok');
  await Promise.resolve();
  expect(settled).toBeUndefined(); // vetoed: modal stays open
  expect(loop.getFocused()).toBe(input); // focus moved to the invalid field

  value.set('42'); // now valid
  loop.emitCommand('ok');
  await expect(promise).resolves.toBe('ok');
});

// ST-9 — file & text tools: a seeded file is shown, and edits are confined to the virtual FS.
test('ST-9: file-tools shows a seeded file and confines writes to the virtual FS', () => {
  const app = buildFileViewer();
  const rr = createRenderRoot({ width: 44, height: 10 }, { caps });
  rr.mount(app.root);

  expect(paintedCells(rr.buffer().rows())).toBeGreaterThan(0);
  expect(app.memo.getText()).toContain('line one');

  app.save('edited in memory');
  expect(app.fs.readFile(app.path)).toBe('edited in memory'); // write went to the virtual FS
  expect(existsSync(app.path)).toBe(false); // …and never touched the real disk
});

// ST-10 — live/dashboard: the tick idiom drives progress 0→100, and the browser variant mounts.
test('ST-10: live-dashboard advances 0→100 and the browser variant mounts headlessly', () => {
  const dash = buildDashboard({ steps: 10 });
  const rr = createRenderRoot({ width: 40, height: 8 }, { caps });
  rr.mount(dash.root);
  expect(paintedCells(rr.buffer().rows())).toBeGreaterThan(0);

  for (let i = 0; i < 10; i += 1) dash.tick();
  rr.flush();
  expect(dash.value()).toBe(1); // 0 → 100%
  expect(dash.done()).toBe(true);

  // Browser variant: mount on a structural fake terminal (records host writes). No real browser,
  // no @xterm dependency — this still exercises mountApp → createBrowserHost → serialize → write.
  const writes: string[] = [];
  const term = {
    write: (d: string) => {
      writes.push(d);
    },
    onData: () => ({ dispose: () => undefined }),
    onResize: () => ({ dispose: () => undefined }),
  };
  const mounted = mountDashboardInBrowser(term);
  expect(writes.length).toBeGreaterThan(0); // mounted and painted a first frame
  expect(() => mounted.dispose()).not.toThrow();
});

// ST-11 — the example custom widget: measure() is non-zero and a bound-signal update repaints.
test('ST-11: Sparkline reports a non-zero measure and repaints on a data change', () => {
  const values = signal<number[]>([1, 2, 3, 4]);
  const spark = new Sparkline({ values });

  // `measure()` takes no arguments here: the Sparkline reports an intrinsic size, and the available
  // box it was previously handed was silently ignored.
  const size = spark.measure?.();
  expect(size?.width).toBeGreaterThan(0);
  expect(size?.height).toBeGreaterThan(0);

  const rr = createRenderRoot({ width: 20, height: 1 }, { caps });
  rr.mount(spark);
  const before = rowText(rr.buffer().rows(), 0);

  values.set([8, 1, 8, 1]); // a very different shape
  rr.flush();
  const after = rowText(rr.buffer().rows(), 0);
  expect(after).not.toBe(before); // the composed buffer changed (repaint)
});
