/**
 * Specification test (immutable oracle) — Tier-1 paint-smoke.
 *
 * Every registered example, built through the demo shell at a fixed 80×24
 * truecolor viewport and read from the app's own render root, must paint a
 * non-empty frame: it composes without throwing and renders something. This is
 * the mechanical "the example exists and draws" gate for the whole seed set.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createRoot } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { demoShell } from '../src/demo-shell.js';
import { EXAMPLES } from '../examples/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const VP = { width: 80, height: 24 };

/** Count the non-blank cells in the app's composed frame. */
function paintedCells(app: Application): number {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .reduce((total, row) => total + row.filter((cell) => cell.char.trim() !== '').length, 0);
}

test('ST-2: every seed example paints a non-empty frame', async () => {
  // Guard against a vacuous pass — the seed set must actually be registered.
  expect(EXAMPLES.length).toBeGreaterThan(0);
  for (const entry of EXAMPLES) {
    const def = (await entry.load()).default;
    createRoot((dispose) => {
      const app = demoShell({
        build: (ctx) => def.build(ctx),
        title: def.title,
        kind: entry.kind,
        caps,
        viewport: VP,
      });
      // An `app`-kind example is returned by the shell as-is (never resized) — force one compose
      // so its first frame settles before we read it.
      app.loop.resize(VP);
      expect(paintedCells(app), `${entry.id} paints something`).toBeGreaterThan(0);
      dispose();
    });
  }
});
