/**
 * Implementation tests for the Play controller: the Reset / size / depth
 * re-mount seam, idempotent close, and the one-dialog singleton.
 */
import { test, expect } from 'vitest';
import type { ExampleContext } from '../examples/_contract.js';
import { createPlayController } from '../src/play/play-controller.js';
import { fakeEntry, headlessFactory, markerContent } from './helpers/play-harness.js';

const EL = { tagName: 'div' };

test('remount merges size/depth and preserves unspecified params', async () => {
  const f = headlessFactory(100, 30);
  const built: { width: number; height: number }[] = [];
  const entry = fakeEntry('minimal', (ctx: ExampleContext) => {
    built.push({ width: ctx.width, height: ctx.height });
    return markerContent();
  });
  const controller = createPlayController({ entry, createTerminal: f.createTerminal, size: { width: 80, height: 24 } });

  await controller.open(EL);
  expect(built.at(-1)).toEqual({ width: 80, height: 24 });

  await controller.remount({ size: { width: 100, height: 30 } });
  expect(built.at(-1)).toEqual({ width: 100, height: 30 });

  // A depth-only re-mount preserves the previously-set size (param merge, not replace).
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
