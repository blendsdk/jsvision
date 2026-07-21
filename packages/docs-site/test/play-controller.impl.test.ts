/**
 * Implementation tests for the Play controller: the Reset / size / depth
 * re-mount seam, idempotent close, and the one-dialog singleton.
 */
import { test, expect } from 'vitest';
import type { ExampleContext } from '../examples/_contract.js';
import { createPlayController } from '../src/play/play-controller.js';
import { fakeEntry, headlessFactory, markerContent } from './helpers/play-harness.js';

const EL = { tagName: 'div' };

test('the app viewport is terminal-driven (derived from the real cols/rows), not the size fallback', async () => {
  const f = headlessFactory(100, 30); // the terminal is 100×30
  const built: { width: number; height: number }[] = [];
  const entry = fakeEntry('component', (ctx: ExampleContext) => {
    built.push({ width: ctx.width, height: ctx.height });
    return markerContent();
  });
  // The 80×24 `size` is only a fallback for a terminal that reports no cols/rows; the real terminal wins.
  const controller = createPlayController({ entry, createTerminal: f.createTerminal, size: { width: 80, height: 24 } });

  await controller.open(EL);
  // A component is built at its stage-window interior, which is derived from the terminal's real
  // 100×30 (interior ≈ 96×25). That interior is wider/taller than the whole 80×24 fallback viewport,
  // so exceeding it proves the terminal drove the size — not the hardcoded fallback (interior ≈ 76×19).
  expect(built.at(-1)!.width, 'terminal-driven (100-col terminal), not the 80-col fallback').toBeGreaterThan(80);
  expect(built.at(-1)!.height, 'terminal-driven (30-row terminal), not the 24-row fallback').toBeGreaterThan(24);

  // Re-mount (Reset / depth change) rebuilds at the terminal's current size, preserving the depth merge.
  await controller.remount({ depth: '16' });
  expect(built.at(-1)!.width).toBeGreaterThan(80);
  expect(built.at(-1)!.height).toBeGreaterThan(24);

  controller.close();
});

test('close runs every teardown an example registered via ctx.onCleanup', async () => {
  const f = headlessFactory();
  let cleaned = 0;
  const entry = fakeEntry('component', (ctx: ExampleContext) => {
    ctx.onCleanup?.(() => {
      cleaned += 1;
    });
    return markerContent();
  });
  const controller = createPlayController({ entry, createTerminal: f.createTerminal });

  await controller.open(EL);
  expect(cleaned).toBe(0); // not run while open
  controller.close();
  expect(cleaned).toBe(1); // run once on close

  // A fresh open registers a fresh cleanup; the previous one does not fire again.
  await controller.open(EL);
  controller.close();
  expect(cleaned).toBe(2);
});

test('a re-mount (size/depth change) runs the prior example teardown before rebuilding', async () => {
  const f = headlessFactory();
  let cleaned = 0;
  const entry = fakeEntry('component', (ctx: ExampleContext) => {
    ctx.onCleanup?.(() => {
      cleaned += 1;
    });
    return markerContent();
  });
  const controller = createPlayController({ entry, createTerminal: f.createTerminal });

  await controller.open(EL);
  await controller.remount({ depth: '16' }); // close (runs teardown) then re-open
  expect(cleaned).toBe(1);
  controller.close();
  expect(cleaned).toBe(2);
});

test('double close is a no-op', async () => {
  const f = headlessFactory();
  const controller = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  await controller.open(EL);
  controller.close();
  expect(f.live()).toBe(0);
  expect(() => controller.close()).not.toThrow();
  expect(controller.isOpen).toBe(false);
  expect(f.live()).toBe(0);
});

test('the singleton disposes the previously-active controller on a new open', async () => {
  const f = headlessFactory();
  const c1 = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  const c2 = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  await c1.open(EL);
  await c2.open(EL);
  expect(c1.isOpen).toBe(false);
  expect(c2.isOpen).toBe(true);
  expect(f.live()).toBe(1);
  c2.close();
  expect(f.live()).toBe(0);
});
