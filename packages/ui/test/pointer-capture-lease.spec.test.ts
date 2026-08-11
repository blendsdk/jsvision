/**
 * Specification tests for the public pointer-capture lease contract.
 *
 * These expectations describe ownership behavior independently of the event-loop implementation:
 * capture generations are unique, replacement reports synchronous loss, and an obsolete lease
 * cannot release the current owner.
 */
import { resolveCapabilities } from '@jsvision/core';
import { expect, test } from 'vitest';
import { createEventLoop } from '../src/event/index.js';
import { Group, View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A mounted leaf used only as a stable capture identity. */
class CaptureLeaf extends View {
  override draw(_ctx: DrawContext): void {}
}

/** Mount two capture candidates and return their real event loop. */
function createCaptureFixture(): {
  readonly loop: ReturnType<typeof createEventLoop>;
  readonly first: CaptureLeaf;
  readonly second: CaptureLeaf;
} {
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  const first = new CaptureLeaf();
  const second = new CaptureLeaf();
  const root = new Group();
  root.add(first);
  root.add(second);
  loop.mount(root);
  return { loop, first, second };
}

// Each acquisition must identify one exact ownership generation so later work can prove staleness.
test('acquiring capture returns an active lease with a distinct generation', () => {
  const { loop, first, second } = createCaptureFixture();

  const firstLease = loop.acquireCapture(first, () => undefined);
  const secondLease = loop.acquireCapture(second, () => undefined);

  expect(Number.isSafeInteger(firstLease.generation)).toBe(true);
  expect(Number.isSafeInteger(secondLease.generation)).toBe(true);
  expect(secondLease.generation).not.toBe(firstLease.generation);
  expect(firstLease.active()).toBe(false);
  expect(secondLease.active()).toBe(true);
  expect(loop.hasCapture(second)).toBe(true);
});

// Replacement loss is synchronous: the old owner is inactive before acquisition returns.
test('replacing capture reports one synchronous replaced loss to the previous owner', () => {
  const { loop, first, second } = createCaptureFixture();
  const losses: string[] = [];
  const firstLease = loop.acquireCapture(first, (reason) => {
    losses.push(reason);
    expect(firstLease.active()).toBe(false);
    expect(loop.hasCapture(second)).toBe(true);
  });

  const secondLease = loop.acquireCapture(second, () => undefined);

  expect(losses).toEqual(['replaced']);
  expect(firstLease.active()).toBe(false);
  expect(secondLease.active()).toBe(true);
});

// A queued cleanup from an earlier gesture must never clear a newer capture generation.
test('releasing a stale lease is inert and leaves the replacement active', () => {
  const { loop, first, second } = createCaptureFixture();
  const firstLosses: string[] = [];
  const secondLosses: string[] = [];
  const firstLease = loop.acquireCapture(first, (reason) => firstLosses.push(reason));
  const secondLease = loop.acquireCapture(second, (reason) => secondLosses.push(reason));

  firstLease.release();

  expect(firstLosses).toEqual(['replaced']);
  expect(secondLosses).toEqual([]);
  expect(secondLease.active()).toBe(true);
  expect(loop.hasCapture(second)).toBe(true);
});
