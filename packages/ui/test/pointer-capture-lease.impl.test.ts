/**
 * Implementation tests for pointer-capture allocation, callback ordering, and cleanup retention.
 *
 * These cases complement the public contract suite with internal edge evidence that would be
 * impractical to reach through ordinary pointer input, especially safe-integer exhaustion.
 */
import { resolveCapabilities } from '@jsvision/core';
import { expect, test } from 'vitest';
import { createEventLoop } from '../src/event/index.js';
import type { EventLoop } from '../src/event/index.js';
import { Group, View } from '../src/view/index.js';
import type { DrawContext, PointerCaptureLease, PointerCaptureLossReason } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A mounted identity that can own capture without adding widget behavior. */
class CaptureLeaf extends View {
  override draw(_ctx: DrawContext): void {}
}

/** The implementation-only allocator state used to position one test at numeric exhaustion. */
interface CaptureGenerationState {
  lastCaptureGeneration: number;
}

/** Narrow a loop by inspecting its runtime state without an unsafe type assertion. */
function exposesCaptureGenerationState(loop: EventLoop): loop is EventLoop & CaptureGenerationState {
  return (
    'lastCaptureGeneration' in loop &&
    typeof loop.lastCaptureGeneration === 'number' &&
    Number.isSafeInteger(loop.lastCaptureGeneration)
  );
}

/** Build a mounted loop with three independently addressable capture targets. */
function createFixture(): {
  readonly loop: EventLoop;
  readonly root: Group;
  readonly first: CaptureLeaf;
  readonly second: CaptureLeaf;
  readonly third: CaptureLeaf;
} {
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  const root = new Group();
  const first = new CaptureLeaf();
  const second = new CaptureLeaf();
  const third = new CaptureLeaf();
  root.add(first);
  root.add(second);
  root.add(third);
  loop.mount(root);
  return { loop, root, first, second, third };
}

test('generation exhaustion fails closed instead of rolling over or replacing the owner', () => {
  const { loop, first, second } = createFixture();
  if (!exposesCaptureGenerationState(loop)) {
    throw new Error('event loop does not expose the implementation generation state');
  }
  loop.lastCaptureGeneration = Number.MAX_SAFE_INTEGER - 1;
  const losses: PointerCaptureLossReason[] = [];
  const finalLease = loop.acquireCapture(first, (reason) => losses.push(reason));

  expect(finalLease.generation).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => loop.acquireCapture(second, () => undefined)).toThrow(RangeError);
  expect(finalLease.active()).toBe(true);
  expect(losses).toEqual([]);
});

test('replacement installs its candidate before the old callback may reentrantly replace it', () => {
  const { loop, first, second, third } = createFixture();
  const order: string[] = [];
  let nestedLease: PointerCaptureLease | undefined;

  const firstLease: PointerCaptureLease = loop.acquireCapture(first, (reason) => {
    order.push(`first:${reason}:${String(firstLease.active())}`);
    nestedLease = loop.acquireCapture(third, (nestedReason) => order.push(`third:${nestedReason}`));
    order.push(`nested:${String(nestedLease.active())}`);
  });
  const candidateLease = loop.acquireCapture(second, (reason) => order.push(`second:${reason}`));

  expect(order).toEqual(['first:replaced:false', 'second:replaced', 'nested:true']);
  expect(candidateLease.active()).toBe(false);
  expect(nestedLease?.active()).toBe(true);
});

test('lifecycle loss rejects callback reacquisition until the boundary completes', () => {
  const { loop, first, second } = createFixture();
  const losses: PointerCaptureLossReason[] = [];
  loop.acquireCapture(first, (reason) => {
    losses.push(reason);
    expect(() => loop.acquireCapture(second, () => undefined)).toThrow(
      'pointer capture is unavailable during lifecycle teardown',
    );
  });

  loop.notifyCaptureLost();

  expect(losses).toEqual(['host-lost']);
  const nextLease = loop.acquireCapture(second, () => undefined);
  expect(nextLease.active()).toBe(true);
});

test('repeated loss sources notify one generation only once', () => {
  const { loop, root, first } = createFixture();
  const losses: PointerCaptureLossReason[] = [];
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));

  lease.release();
  lease.release();
  loop.releaseCapture();
  loop.notifyCaptureLost();
  root.remove(first);
  loop.stop();
  loop.dispose();

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['released']);
});

test('anonymous legacy capture and lease capture replace each other through one owner slot', () => {
  const { loop, first, second } = createFixture();
  const losses: PointerCaptureLossReason[] = [];

  loop.setCapture(first);
  loop.setCapture(second);
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));
  loop.setCapture(second);

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['replaced']);
  loop.releaseCapture();

  const nextLease = loop.acquireCapture(first, (reason) => losses.push(reason));
  expect(nextLease.active()).toBe(true);
  nextLease.release();
  expect(losses).toEqual(['replaced', 'released']);
});

test('repeated capture and release retain no callbacks that fire on later unmount', () => {
  const { loop, root, first } = createFixture();
  const losses: PointerCaptureLossReason[] = [];

  for (let index = 0; index < 1_000; index += 1) {
    loop.acquireCapture(first, (reason) => losses.push(reason)).release();
  }
  const current = loop.acquireCapture(first, (reason) => losses.push(reason));

  root.unmount();
  root.unmount();
  loop.dispose();

  expect(current.active()).toBe(false);
  expect(losses).toHaveLength(1_001);
  expect(losses.slice(0, -1).every((reason) => reason === 'released')).toBe(true);
  expect(losses.at(-1)).toBe('unmounted');
});
