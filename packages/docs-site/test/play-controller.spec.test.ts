/**
 * Specification test (immutable oracle) — the Play controller: the plain-TS
 * lifecycle behind the client-only Play component.
 *
 *  - `open` lazily loads the example, builds it in the demo shell, mounts it onto
 *    a terminal, and paints a non-empty first frame (with the shared chrome).
 *  - 20× open/close leaks no terminal instances (every terminal is disposed).
 *  - Key-reclaim is attached while open (F10 reaches the TUI) and detached on
 *    close (F10 returns to the browser).
 *  - A one-dialog singleton keeps at most one terminal live.
 *  - A throwing example signals an error panel, stays closed, and cleans up.
 */
import { test, expect } from 'vitest';
import { createPlayController } from '../src/play/play-controller.js';
import {
  fakeEntry,
  fakeKeyTarget,
  flushTerminal,
  hasContent,
  headlessFactory,
  keydownEvent,
  markerContent,
  rowText,
} from './helpers/play-harness.js';

const EL = { tagName: 'div' };

test('ST-6: open paints a non-empty first frame to the terminal', async () => {
  const f = headlessFactory();
  const controller = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  await controller.open(EL);
  expect(controller.isOpen).toBe(true);
  const real = f.lastReal();
  expect(real).not.toBeNull();
  await flushTerminal(real!);
  expect(hasContent(real!)).toBe(true);
  controller.close();
});

test('ST-7: open paints the shared menu bar and a status line', async () => {
  const f = headlessFactory();
  const controller = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  await controller.open(EL);
  const real = f.lastReal()!;
  await flushTerminal(real);
  expect(rowText(real, 0)).toContain('View'); // the shared View menu (Theme/Depth)
  expect(rowText(real, real.rows - 1).trim().length).toBeGreaterThan(0); // a hints status line
  controller.close();
});

test('ST-8: open/close 20 times leaks no terminal instances', async () => {
  const f = headlessFactory();
  const controller = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
  });
  for (let i = 0; i < 20; i += 1) {
    await controller.open(EL);
    expect(f.live()).toBe(1);
    controller.close();
    expect(f.live()).toBe(0);
  }
  expect(f.live()).toBe(0);
});

test('ST-10: F10 is reclaimed while open+focused and released after close', async () => {
  const f = headlessFactory();
  const target = fakeKeyTarget();
  const controller = createPlayController({
    entry: fakeEntry('component', () => markerContent()),
    createTerminal: f.createTerminal,
    reclaimTarget: target,
    isFocused: () => controller.isOpen,
  });
  await controller.open(EL);
  const down = keydownEvent('F10');
  target.fire('keydown', down);
  expect(down.defaultPrevented).toBe(true);

  controller.close();
  const down2 = keydownEvent('F10');
  target.fire('keydown', down2);
  expect(down2.defaultPrevented).toBe(false);
});

test('ST-14: opening a second controller closes the first (at most one live terminal)', async () => {
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
  expect(f.live()).toBe(1);
  await c2.open(EL);
  expect(c1.isOpen).toBe(false);
  expect(f.live()).toBe(1); // only c2 is live
  c2.close();
  expect(f.live()).toBe(0);
});

test('ST-14: a throwing example signals an error panel, stays closed, and cleans up', async () => {
  const f = headlessFactory();
  const errors: string[] = [];
  const controller = createPlayController({
    entry: fakeEntry('component', () => {
      throw new Error('boom');
    }),
    createTerminal: f.createTerminal,
    onError: (message) => errors.push(message),
  });
  await controller.open(EL);
  expect(controller.isOpen).toBe(false);
  expect(errors).toContain('boom');
  expect(f.live()).toBe(0); // the terminal created before build() is disposed when build() throws
  expect(() => controller.close()).not.toThrow();
  expect(controller.isOpen).toBe(false);
});
