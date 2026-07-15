/**
 * Specification test (immutable oracle) — the datagrid-showcase **shell navigation** oracle.
 *
 * Source: RD-15 AC #2 (navigation) + AC #6 (the walkthrough drives every demo). A bespoke headless
 * driver constructs the showcase (`createDatagridShowcase(caps)`) and drives its **real** navigation
 * command path — it never calls `run()` (which asserts a TTY). Each entry is dispatched via
 * `showcase.app.loop.emitCommand(story.id)` (routed to the shell's post-process `CommandSink` exactly
 * as a menu/sidebar selection is → `showStory`), and the painted canvas is read back from
 * `showcase.app.loop.renderRoot.buffer().rows()`. `runTick` repaints synchronously, so the buffer
 * reflects each swap immediately. Disposal is observed through the shell's read-only `disposedCount()`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, createRoot, Group } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { EditableDataGrid } from '@jsvision/datagrid';
import { createDatagridShowcase, SIDEBAR_W } from '../datagrid-showcase/shell.js';
import { STORIES } from '../datagrid-showcase/stories/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 80;
const H = 24;
/** The Foundation seed demo — the Phase-1 green gate (a real grid mounts in the shell). */
const SEED_ID = 'datagrid/foundation/sizing';

/**
 * Count non-blank cells strictly inside the story canvas interior — right of the sidebar and inside
 * the grey frame's four borders — so the assertion reflects demo content, not the always-painted
 * sidebar or window chrome.
 */
function canvasInteriorPainted(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (let y = 1; y < rows.length - 1; y += 1) {
    const row = rows[y];
    for (let x = SIDEBAR_W + 1; x < row.length - 1; x += 1) {
      if (row[x] !== undefined && row[x].char !== ' ') n += 1;
    }
  }
  return n;
}

/** Join the canvas interior into a single string, for the no-residue check. */
function canvasInteriorText(rows: readonly { char: string }[][]): string {
  let s = '';
  for (let y = 1; y < rows.length - 1; y += 1) {
    const row = rows[y];
    for (let x = SIDEBAR_W + 1; x < row.length - 1; x += 1) s += row[x]?.char ?? '';
    s += '\n';
  }
  return s;
}

/** Depth-first: does the subtree contain an instance of `Ctor`? */
function containsInstance(view: View, Ctor: new (...args: never[]) => unknown): boolean {
  if (view instanceof Ctor) return true;
  if (view instanceof Group) {
    for (const child of view.children) if (containsInstance(child, Ctor)) return true;
  }
  return false;
}

// ST-8 — the shell navigates to every registry entry through the real command path, and each swap
// paints the canvas.
test('ST-8: the shell navigates to every demo via emitCommand and paints the canvas', () => {
  const showcase = createDatagridShowcase(caps);
  showcase.app.loop.resize({ width: W, height: H }); // pin a deterministic viewport
  for (const story of STORIES) {
    showcase.app.loop.emitCommand(story.id);
    const rows = showcase.app.loop.renderRoot.buffer().rows();
    expect(canvasInteriorPainted(rows), `${story.id} painted nothing in the canvas`).toBeGreaterThan(0);
  }
});

// ST-9 — swapping stories disposes the previous reactive owner (observed via disposedCount) and the
// new content replaces the old with no residue.
test('ST-9: swapping demos disposes the previous owner and leaves no residue', () => {
  const showcase = createDatagridShowcase(caps);
  showcase.app.loop.resize({ width: W, height: H });
  const withRd = STORIES.filter((s) => s.rd !== undefined);
  const a = withRd[0];
  const b = withRd.find((s) => s.rd !== a.rd);
  expect(b, 'two demos with distinct RD chips exist').toBeTruthy();

  showcase.app.loop.emitCommand(a.id);
  const before = showcase.disposedCount();
  showcase.app.loop.emitCommand(b!.id);
  const after = showcase.disposedCount();
  expect(after, 'the previous demo owner was disposed on swap').toBeGreaterThan(before);

  const text = canvasInteriorText(showcase.app.loop.renderRoot.buffer().rows());
  expect(text, 'the new demo rendered its RD chip').toContain(`[${b!.rd}]`);
  expect(text, 'no residue from the previous demo').not.toContain(`[${a.rd}]`);
});

// ST-10 — the Foundation seed demo really builds an EditableDataGrid, and navigating to it through
// the shell paints (the Phase-1 vertical: a real grid mounts in the shell).
test('ST-10: the Foundation seed demo mounts a real EditableDataGrid, driven through the shell', () => {
  const seed = STORIES.find((s) => s.id === SEED_ID);
  expect(seed, `the seed demo "${SEED_ID}" is registered`).toBeTruthy();

  // Structural: the seed's build() constructs a real grid.
  createRoot((dispose) => {
    const view = seed!.build({ caps, width: 60, height: 16 });
    expect(containsInstance(view, EditableDataGrid), 'the seed builds an EditableDataGrid').toBe(true);
    dispose();
  });

  // Through the shell: navigate to it and paint.
  const showcase = createDatagridShowcase(caps);
  showcase.app.loop.resize({ width: W, height: H });
  showcase.app.loop.emitCommand(seed!.id);
  const rows = showcase.app.loop.renderRoot.buffer().rows();
  expect(canvasInteriorPainted(rows), 'the seed grid painted nothing in the canvas').toBeGreaterThan(0);
});
