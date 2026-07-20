/**
 * Smoke test — the `demo:layout-dsl` playground composition (`layout-dsl-playground/playground.ts`).
 *
 * Only the pure module is imported (never `main.ts`, which self-executes and would `process.exit`).
 * Asserts the preview builds + mounts + paints in both modes, that `applyKey` cycles/toggles the
 * state, and that the same reactive-rebuild wiring `main.ts` uses swaps the preview tree live when a
 * parameter changes. Frames are driven through a deferred scheduler + `drain()` so the stack corner
 * self-correct settles deterministically. The `.js` extension is required by NodeNext resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createRenderRoot, createRoot, Group } from '@jsvision/ui';
import {
  createState,
  snapshot,
  applyKey,
  buildPreviewTree,
  formatLegend,
  MODES,
} from '../layout-dsl-playground/playground.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Count painted (non-space) cells. */
function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

/** Mount a view under a deferred scheduler and drain pending frames to convergence. */
function mountAndDrain(view: Group, width = 60, height = 16) {
  // Held on an object rather than in a bare `let`: a local only ever assigned from inside the
  // scheduler closure keeps its initial flow type, so the guarded read below would narrow to `never`.
  const scheduled: { frame: (() => void) | null } = { frame: null };
  const drainOnce = (): void => {
    let guard = 0;
    while (scheduled.frame !== null) {
      const run = scheduled.frame;
      scheduled.frame = null;
      run();
      if (++guard > 50) throw new Error('did not converge');
    }
  };
  const rr = createRenderRoot(
    { width, height },
    {
      caps,
      schedule: (f) => {
        scheduled.frame = f;
      },
    },
  );
  rr.mount(view);
  drainOnce();
  return { rr, drain: drainOnce };
}

test('the flow preview builds, mounts, and paints', () => {
  createRoot((dispose) => {
    const tree = buildPreviewTree({
      mode: 0,
      direction: 0,
      justify: 1,
      align: 3,
      sizing: 2,
      gap: 1,
      padding: 0,
      centered: false,
      corners: false,
    });
    const { rr } = mountAndDrain(tree);
    expect(paintedCells(rr.buffer().rows())).toBeGreaterThan(0);
    dispose();
  });
});

test('the stack preview builds, mounts, settles, and paints', () => {
  createRoot((dispose) => {
    const tree = buildPreviewTree({
      mode: 1,
      direction: 0,
      justify: 0,
      align: 3,
      sizing: 0,
      gap: 0,
      padding: 0,
      centered: true,
      corners: true,
    });
    const { rr } = mountAndDrain(tree);
    expect(paintedCells(rr.buffer().rows())).toBeGreaterThan(0);
    dispose();
  });
});

test('applyKey cycles parameters and toggles overlays; unknown keys are ignored', () => {
  const s = createState();
  const dir0 = s.direction.peek();
  expect(applyKey(s, 'd')).toBe(true);
  expect(s.direction.peek()).toBe((dir0 + 1) % 2);

  const cen0 = s.centered.peek();
  expect(applyKey(s, 'c')).toBe(true);
  expect(s.centered.peek()).toBe(!cen0);

  // gap cycles 0..4 and wraps.
  s.gap.set(4);
  expect(applyKey(s, 'g')).toBe(true);
  expect(s.gap.peek()).toBe(0);

  expect(applyKey(s, 'z')).toBe(false); // unmapped
});

test('the preview rebuilds reactively when a parameter changes (the live behavior)', () => {
  createRoot((dispose) => {
    const state = createState();
    const host = new Group();
    host.layout = { padding: 1 };
    host.onMount(() => {
      host.bind(
        () => snapshot(state),
        (p) => {
          for (const child of [...host.children]) host.remove(child);
          const tree = buildPreviewTree(p);
          tree.layout = { ...tree.layout, position: 'fill' };
          host.add(tree);
        },
        { relayout: true },
      );
    });
    const { rr, drain } = mountAndDrain(host);
    expect(host.children.length).toBe(1);
    const first = host.children[0];

    applyKey(state, 'm'); // flow → stack: the reader re-runs and swaps the tree
    drain();
    expect(host.children.length).toBe(1);
    expect(host.children[0]).not.toBe(first); // a fresh tree instance
    expect(paintedCells(rr.buffer().rows())).toBeGreaterThan(0);
    dispose();
  });
});

test('formatLegend reflects the current parameter values', () => {
  const s = createState();
  const legend = formatLegend(snapshot(s));
  expect(legend).toContain('LAYOUT DSL');
  expect(legend).toContain(`Mode ......... ${MODES[0]}`); // default mode = flow
  expect(legend).toContain('[q] Quit');
});
