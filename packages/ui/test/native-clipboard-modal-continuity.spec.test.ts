/**
 * Specification tests for continuous modal-scope identity during asynchronous native paste.
 *
 * A stable modal destination receives its result. Opening, closing, replacing, or churning the
 * captured modal destination makes pending work stale even when focus later returns to the same
 * object.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { PasteEvent } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { createEventLoop } from '../src/event/index.js';
import type { ClipboardTextReader } from '../src/index.js';
import type { Size2D } from '../src/layout/index.js';
import { Commands } from '../src/status/index.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

async function drainMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

class PasteProbe extends View {
  override focusable = true;
  readonly pastes: PasteEvent[] = [];
  canonical = '';

  override measure(available: Size2D): Size2D {
    return available;
  }

  draw(_ctx: DrawContext): void {}

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'paste') {
      this.pastes.push(ev.event);
      return;
    }
    if (ev.event.type !== 'command') return;
    if (ev.event.command === 'seed-clipboard') {
      ev.setClipboard?.(String(ev.event.arg ?? ''));
      ev.handled = true;
    } else if (ev.event.command === 'inspect-clipboard') {
      this.canonical = ev.readClipboard?.() ?? '';
      ev.handled = true;
    }
  }
}

function modalScene() {
  const pending = deferred<string>();
  const reader: ClipboardTextReader = vi.fn(() => pending.promise);
  const outer = new PasteProbe();
  const firstLeaf = new PasteProbe();
  const firstOther = new PasteProbe();
  const firstModal = new Group();
  firstModal.add(firstLeaf);
  firstModal.add(firstOther);
  const secondLeaf = new PasteProbe();
  const secondModal = new Group();
  secondModal.add(secondLeaf);
  const root = new Group();
  root.add(outer);
  root.add(firstModal);
  root.add(secondModal);
  const loop = createEventLoop(
    { width: 40, height: 10 },
    {
      caps,
      readClipboardText: reader,
      commands: [...Object.values(Commands), 'seed-clipboard', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(outer);
  loop.emitCommand('seed-clipboard', 'original canonical');
  const frames = vi.fn();
  loop.onFrame = frames;
  return {
    loop,
    reader,
    pending,
    frames,
    outer,
    firstModal,
    firstLeaf,
    firstOther,
    secondModal,
    secondLeaf,
  };
}

async function startRequest(scene: ReturnType<typeof modalScene>): Promise<void> {
  scene.loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(scene.reader).toHaveBeenCalledOnce();
  scene.frames.mockClear();
}

function inspectFocused(loop: ReturnType<typeof createEventLoop>, probe: PasteProbe): string {
  loop.emitCommand('inspect-clipboard');
  return probe.canonical;
}

// An unchanged active modal and focused route receive exactly one settled native paste.
test('stable modal destination receives native paste inside the modal', async () => {
  const scene = modalScene();
  void scene.loop.execView(scene.firstModal);
  expect(scene.loop.getFocused()).toBe(scene.firstLeaf);
  await startRequest(scene);

  scene.pending.resolve('stable modal result');
  await drainMicrotasks();

  expect(scene.outer.pastes).toHaveLength(0);
  expect(scene.firstLeaf.pastes.map((event) => event.text)).toEqual(['stable modal result']);
  expect(scene.frames).toHaveBeenCalledOnce();
  expect(inspectFocused(scene.loop, scene.firstLeaf)).toBe('stable modal result');
});

// Opening a modal after an outer request invalidates the captured application scope.
test('opening a modal discards an outer pending native paste', async () => {
  const scene = modalScene();
  await startRequest(scene);
  void scene.loop.execView(scene.firstModal);
  scene.frames.mockClear();

  scene.pending.resolve('stale outer result');
  await drainMicrotasks();

  expect(scene.outer.pastes).toHaveLength(0);
  expect(scene.firstLeaf.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFocused(scene.loop, scene.firstLeaf)).toBe('original canonical');
});

// Closing a modal before its request settles invalidates the captured modal scope.
test('closing a modal discards its pending native paste', async () => {
  const scene = modalScene();
  void scene.loop.execView(scene.firstModal);
  await startRequest(scene);
  scene.loop.endModal('closed');
  scene.frames.mockClear();

  scene.pending.resolve('closed modal result');
  await drainMicrotasks();

  expect(scene.firstLeaf.pastes).toHaveLength(0);
  expect(scene.outer.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFocused(scene.loop, scene.outer)).toBe('original canonical');
});

// Replacing one modal with another cannot redirect or revive the first modal's pending request.
test('modal replacement discards pending native paste', async () => {
  const scene = modalScene();
  void scene.loop.execView(scene.firstModal);
  await startRequest(scene);
  scene.loop.endModal('replace');
  void scene.loop.execView(scene.secondModal);
  scene.frames.mockClear();

  scene.pending.resolve('replaced modal result');
  await drainMicrotasks();

  expect(scene.firstLeaf.pastes).toHaveLength(0);
  expect(scene.secondLeaf.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFocused(scene.loop, scene.secondLeaf)).toBe('original canonical');
});

// Focus churn inside one modal invalidates the destination even when it returns to the same leaf.
test('same-modal focus away and back discards pending native paste', async () => {
  const scene = modalScene();
  void scene.loop.execView(scene.firstModal);
  await startRequest(scene);
  scene.loop.focusView(scene.firstOther);
  scene.loop.focusView(scene.firstLeaf);
  scene.frames.mockClear();

  scene.pending.resolve('same-scope churn result');
  await drainMicrotasks();

  expect(scene.firstLeaf.pastes).toHaveLength(0);
  expect(scene.firstOther.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFocused(scene.loop, scene.firstLeaf)).toBe('original canonical');
});
