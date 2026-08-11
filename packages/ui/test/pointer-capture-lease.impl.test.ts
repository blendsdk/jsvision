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

/** The implementation-owned slot whose null state proves target and callback references were detached. */
interface CaptureOwnerState {
  capture: unknown;
}

/** Narrow a loop by inspecting its runtime state without an unsafe type assertion. */
function exposesCaptureGenerationState(loop: EventLoop): loop is EventLoop & CaptureGenerationState {
  return (
    'lastCaptureGeneration' in loop &&
    typeof loop.lastCaptureGeneration === 'number' &&
    Number.isSafeInteger(loop.lastCaptureGeneration)
  );
}

/** Narrow a loop to the internal owner slot used only by disposal-retention assertions. */
function exposesCaptureOwnerState(loop: EventLoop): loop is EventLoop & CaptureOwnerState {
  return 'capture' in loop;
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

test('mounting a replacement root loses old capture before old view cleanup', () => {
  const { loop, first } = createFixture();
  const order: string[] = [];
  first.onCleanup(() => order.push(`cleanup:${String(first.mounted)}`));
  const lease = loop.acquireCapture(first, (reason) => {
    order.push(`loss:${reason}:${String(first.mounted)}`);
  });
  const replacementRoot = new Group();
  const replacement = new CaptureLeaf();
  replacementRoot.add(replacement);

  loop.mount(replacementRoot);

  expect(order).toEqual(['loss:unmounted:true', 'cleanup:true']);
  expect(first.mounted).toBe(false);
  expect(replacement.mounted).toBe(true);
  expect(lease.active()).toBe(false);
  expect(loop.acquireCapture(replacement, () => undefined).active()).toBe(true);
});

test('render-root unmount loses capture synchronously and remains idempotent', () => {
  const { loop, root, first } = createFixture();
  const losses: PointerCaptureLossReason[] = [];
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));

  loop.renderRoot.unmount();
  loop.renderRoot.unmount();

  expect(losses).toEqual(['unmounted']);
  expect(lease.active()).toBe(false);
  expect(root.mounted).toBe(false);
  expect(first.mounted).toBe(false);
});

test('ancestor removal reports loss while ancestry and mounted state are still intact', () => {
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  const root = new Group();
  const ancestor = new Group();
  const target = new CaptureLeaf();
  const order: string[] = [];
  ancestor.add(target);
  root.add(ancestor);
  loop.mount(root);
  target.onCleanup(() => order.push(`cleanup:${String(target.parent === ancestor)}:${String(target.mounted)}`));
  loop.acquireCapture(target, (reason) => {
    order.push(`loss:${reason}:${String(target.parent === ancestor)}:${String(target.mounted)}`);
  });

  root.remove(ancestor);

  expect(order).toEqual(['loss:unmounted:true:true', 'cleanup:true:true']);
  expect(target.mounted).toBe(false);
  expect(target.parent).toBeNull();
});

test('direct disposal detaches owner references before mounted view cleanup', () => {
  const { loop, first } = createFixture();
  if (!exposesCaptureOwnerState(loop)) {
    throw new Error('event loop does not expose the implementation capture owner state');
  }
  const order: string[] = [];
  first.onCleanup(() => order.push(`cleanup:${String(loop.capture === null)}`));
  const lease = loop.acquireCapture(first, (reason) => {
    order.push(`loss:${reason}:${String(loop.capture === null)}`);
  });

  loop.dispose();
  loop.dispose();

  expect(order).toEqual(['loss:disposed:true', 'cleanup:true']);
  expect(loop.capture).toBeNull();
  expect(lease.active()).toBe(false);
  expect(first.mounted).toBe(false);
});
