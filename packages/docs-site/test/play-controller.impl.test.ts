/**
 * Implementation tests for the Play controller: the Reset / size / depth
 * re-mount seam, idempotent close, and the one-dialog singleton.
 */
import { test, expect } from 'vitest';
import type { ExampleContext } from '../examples/_contract.js';
import { createPlayController } from '../src/play/play-controller.js';
import { fakeEntry, headlessFactory, markerContent } from './helpers/play-harness.js';

const EL = { tagName: 'div' };

test('the app is built at the terminal size (terminal-driven), not the size fallback', async () => {
  const f = headlessFactory(100, 30); // the terminal is 100×30
  const built: { width: number; height: number }[] = [];
  const entry = fakeEntry('minimal', (ctx: ExampleContext) => {
    built.push({ width: ctx.width, height: ctx.height });
    return markerContent();
  });
  // The 80×24 `size` is only a fallback for a terminal that reports no cols/rows; the real terminal wins.
  const controller = createPlayController({ entry, createTerminal: f.createTerminal, size: { width: 80, height: 24 } });

  await controller.open(EL);
  expect(built.at(-1), 'built at the terminal 100×30, not the 80×24 fallback').toEqual({ width: 100, height: 30 });

  // Re-mount (Reset / depth change) rebuilds at the terminal's current size, preserving the depth merge.
  await controller.remount({ depth: '16' });
  expect(built.at(-1)).toEqual({ width: 100, height: 30 });

  controller.close();
});

test('double close is a no-op', async () => {
  const f = headlessFactory();
  const controller = createPlayController({
    entry: fakeEntry('minimal', () => markerContent()),
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
    entry: fakeEntry('minimal', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  const c2 = createPlayController({
    entry: fakeEntry('minimal', () => markerContent()),
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
