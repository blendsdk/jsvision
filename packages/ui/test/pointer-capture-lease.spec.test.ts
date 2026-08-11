/**
 * Specification tests for the public pointer-capture lease contract.
 *
 * These expectations describe ownership behavior independently of the event-loop implementation:
 * capture generations are unique, replacement reports synchronous loss, and an obsolete lease
 * cannot release the current owner.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { expect, test } from 'vitest';
import { createApplication } from '../src/app/index.js';
import { Input, Slider } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ScrollBar } from '../src/scroll/index.js';
import { Group, View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { Window } from '../src/window/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A mounted leaf used only as a stable capture identity. */
class CaptureLeaf extends View {
  override draw(_ctx: DrawContext): void {}
}

/** Build a primary-button mouse report from zero-based terminal coordinates. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** Mount two capture candidates and return their real event loop. */
function createCaptureFixture(): {
  readonly loop: ReturnType<typeof createEventLoop>;
  readonly root: Group;
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
  return { loop, root, first, second };
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
});

// Replacement loss is synchronous: the old owner is inactive before acquisition returns.
test('replacing capture reports one synchronous replaced loss to the previous owner', () => {
  const { loop, first, second } = createCaptureFixture();
  const losses: string[] = [];
  const firstLease = loop.acquireCapture(first, (reason) => {
    losses.push(reason);
    expect(firstLease.active()).toBe(false);
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
});

// Entering and leaving modal scope both invalidate capture before the modal transition returns.
test('modal boundaries synchronously report capture loss', () => {
  const { loop, root, first, second } = createCaptureFixture();
  const modal = new CaptureLeaf();
  root.add(modal);
  const losses: string[] = [];
  const firstLease = loop.acquireCapture(first, (reason) => losses.push(reason));

  void loop.execView(modal);

  expect(firstLease.active()).toBe(false);
  expect(losses).toEqual(['modal']);

  const modalLease = loop.acquireCapture(second, (reason) => losses.push(reason));
  loop.endModal('done');

  expect(modalLease.active()).toBe(false);
  expect(losses).toEqual(['modal', 'modal']);
});

// Capture loss must not wait for another pointer event after its exact target leaves the tree.
test('removing the captured target reports unmounted before remove returns', () => {
  const { loop, root, first } = createCaptureFixture();
  const losses: string[] = [];
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));

  root.remove(first);

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['unmounted']);
});

// Removing any captured target's ancestor is equivalent to removing the target itself.
test('removing a captured target ancestor reports unmounted without later input', () => {
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  const root = new Group();
  const ancestor = new Group();
  const target = new CaptureLeaf();
  ancestor.add(target);
  root.add(ancestor);
  loop.mount(root);
  const losses: string[] = [];
  const lease = loop.acquireCapture(target, (reason) => losses.push(reason));

  root.remove(ancestor);

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['unmounted']);
});

// A decoded host focus-loss report invalidates capture before ordinary event routing completes.
test('decoded focus loss reports host-lost synchronously', () => {
  const { loop, first } = createCaptureFixture();
  const losses: string[] = [];
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));

  loop.dispatch({ type: 'focus', focused: false });

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['host-lost']);
});

// Hosts without decoded focus reporting retain an explicit, synchronous capture-loss ingress.
test('explicit host loss reports host-lost synchronously', () => {
  const { loop, first } = createCaptureFixture();
  const losses: string[] = [];
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));

  loop.notifyCaptureLost();

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['host-lost']);
});

// Direct stop owns the terminal reason; later disposal must not emit a second loss notification.
test('stop followed by dispose reports stopped exactly once', () => {
  const { loop, first } = createCaptureFixture();
  const losses: string[] = [];
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));

  loop.stop();
  loop.dispose();

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['stopped']);
});

// Disposal without a prior stop owns its distinct reason and remains idempotent.
test('direct dispose reports disposed exactly once', () => {
  const { loop, first } = createCaptureFixture();
  const losses: string[] = [];
  const lease = loop.acquireCapture(first, (reason) => losses.push(reason));

  loop.dispose();
  loop.dispose();

  expect(lease.active()).toBe(false);
  expect(losses).toEqual(['disposed']);
});

// Application cleanup failures must not escape the loop or prevent a replacement from becoming active.
test('a throwing loss handler is isolated from capture replacement', () => {
  const { loop, first, second } = createCaptureFixture();
  loop.acquireCapture(first, () => {
    throw new Error('capture cleanup failed');
  });

  let replacement: ReturnType<typeof loop.acquireCapture> | undefined;
  expect(() => {
    replacement = loop.acquireCapture(second, () => undefined);
  }).not.toThrow();

  expect(replacement?.active()).toBe(true);
});

// Reentrant acquisition becomes the newest owner and cannot be overwritten after the old callback returns.
test('reentrant acquisition from a loss handler preserves the newest generation', () => {
  const { loop, root, first, second } = createCaptureFixture();
  const third = new CaptureLeaf();
  root.add(third);
  const losses: string[] = [];
  let reentrantLease: ReturnType<typeof loop.acquireCapture> | undefined;
  loop.acquireCapture(first, (reason) => {
    losses.push(`first:${reason}`);
    reentrantLease = loop.acquireCapture(third, (nestedReason) => losses.push(`third:${nestedReason}`));
  });

  const replacedDuringCallback = loop.acquireCapture(second, (reason) => losses.push(`second:${reason}`));

  expect(losses).toEqual(['first:replaced', 'second:replaced']);
  expect(replacedDuringCallback.active()).toBe(false);
  expect(reentrantLease?.active()).toBe(true);
});

// Existing Slider gestures must keep using the dispatch envelope's set/release capture helpers.
test('legacy capture helpers preserve Slider drag and commit behavior', () => {
  const value = signal(0);
  const commits: number[] = [];
  const slider = new Slider({ value, min: 0, max: 100, onChange: (next) => commits.push(next) });
  slider.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 11, height: 1 } });
  const loop = createEventLoop({ width: 11, height: 1 }, { caps });
  loop.mount(slider);

  loop.dispatch(mouse('down', 10, 0));
  loop.dispatch(mouse('drag', 5, 0));
  loop.dispatch(mouse('up', 5, 0));

  expect(value()).toBe(50);
  expect(commits).toEqual([50]);
});

// Existing ScrollBar gestures must retain off-axis capture and release through mouse-up.
test('legacy capture helpers preserve ScrollBar thumb dragging', () => {
  const value = signal(5);
  const scrollBar = new ScrollBar({ value, min: 0, max: 10 });
  const loop = createEventLoop({ width: 1, height: 8 }, { caps });
  loop.mount(scrollBar);

  loop.dispatch(mouse('down', 0, 4));
  loop.dispatch(mouse('drag', 0, 6));
  loop.dispatch(mouse('up', 0, 6));

  expect(value()).toBe(10);
});

// Existing Input selection must remain captured while the pointer extends the selected range.
test('legacy capture helpers preserve Input pointer selection', () => {
  const value = signal('hello world');
  const input = new Input({ value });
  input.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 15, height: 1 } });
  const loop = createEventLoop({ width: 15, height: 2 }, { caps });
  loop.mount(input);
  loop.focusView(input);

  loop.dispatch(mouse('down', 3, 0));
  loop.dispatch(mouse('drag', 8, 0));
  loop.dispatch(mouse('up', 8, 0));

  expect(input.selection).toEqual({ start: 2, end: 7 });
});

// Desktop uses hasCapture to abandon an externally released window gesture before applying movement.
test('legacy capture query preserves Desktop stale-gesture cancellation', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const window = new Window('Capture compatibility');
  window.setLayout({ rect: { x: 5, y: 2, width: 18, height: 5 } });
  app.desktop.addWindow(window);
  app.loop.renderRoot.flush();

  app.loop.dispatch(mouse('down', 12, 2));
  expect(window.dragging()).toBe(true);
  app.loop.releaseCapture();
  const before = window.layout.rect === undefined ? undefined : { ...window.layout.rect };
  app.loop.dispatch(mouse('drag', 30, 8));

  expect(window.dragging()).toBe(false);
  expect(window.layout.rect).toEqual(before);
});
