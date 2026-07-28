/**
 * Specification tests for continuous focus-route identity during asynchronous native paste.
 *
 * A stable captured route receives one result. Focus transitions, leave-and-return cycles, route
 * replacement, and loss of visible/enabled/focusable eligibility discard settled host text without
 * canonical adoption or a settlement repaint.
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

interface FocusScene {
  readonly loop: ReturnType<typeof createEventLoop>;
  readonly root: Group;
  readonly branch: Group;
  readonly target: PasteProbe;
  readonly other: PasteProbe;
  readonly pending: Deferred<string>;
  readonly reader: ClipboardTextReader;
  readonly frames: ReturnType<typeof vi.fn>;
}

function focusScene(): FocusScene {
  const pending = deferred<string>();
  const reader: ClipboardTextReader = vi.fn(() => pending.promise);
  const target = new PasteProbe();
  const other = new PasteProbe();
  const branch = new Group();
  branch.add(target);
  const root = new Group();
  root.add(branch);
  root.add(other);
  const loop = createEventLoop(
    { width: 40, height: 8 },
    {
      caps,
      readClipboardText: reader,
      commands: [...Object.values(Commands), 'seed-clipboard', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(target);
  loop.emitCommand('seed-clipboard', 'original canonical');
  const frames = vi.fn();
  loop.onFrame = frames;
  return { loop, root, branch, target, other, pending, reader, frames };
}

async function startRequest(scene: FocusScene): Promise<void> {
  scene.loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(scene.reader).toHaveBeenCalledOnce();
  scene.frames.mockClear();
}

function inspectFrom(loop: ReturnType<typeof createEventLoop>, probe: PasteProbe): string {
  loop.focusView(probe);
  loop.emitCommand('inspect-clipboard');
  return probe.canonical;
}

// An unchanged mounted focus route receives, adopts, and paints one settled native result.
test('stable focused route receives one native paste result', async () => {
  const scene = focusScene();
  await startRequest(scene);

  scene.pending.resolve('stable delivery');
  await drainMicrotasks();

  expect(scene.target.pastes.map((event) => event.text)).toEqual(['stable delivery']);
  expect(scene.frames).toHaveBeenCalledOnce();
  expect(inspectFrom(scene.loop, scene.target)).toBe('stable delivery');
});

// Moving focus to another leaf before settlement discards text without adoption or settlement paint.
test('focus change discards pending native paste', async () => {
  const scene = focusScene();
  await startRequest(scene);
  scene.loop.focusView(scene.other);
  scene.frames.mockClear();

  scene.pending.resolve('stale focus result');
  await drainMicrotasks();

  expect(scene.target.pastes).toHaveLength(0);
  expect(scene.other.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFrom(scene.loop, scene.other)).toBe('original canonical');
});

// Leaving and returning to the same leaf still invalidates the continuously-active destination.
test('focus away then back discards pending native paste', async () => {
  const scene = focusScene();
  await startRequest(scene);
  scene.loop.focusView(scene.other);
  scene.loop.focusView(scene.target);
  scene.frames.mockClear();

  scene.pending.resolve('leave-return result');
  await drainMicrotasks();

  expect(scene.target.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFrom(scene.loop, scene.target)).toBe('original canonical');
});

// Replacing an ancestor and reusing the same focused leaf cannot revive the captured route.
test('ancestor replacement with the same leaf discards pending native paste', async () => {
  const scene = focusScene();
  await startRequest(scene);
  scene.root.remove(scene.branch);
  scene.branch.remove(scene.target);
  const replacement = new Group();
  replacement.add(scene.target);
  scene.root.add(replacement);
  scene.loop.focusView(scene.target);
  scene.frames.mockClear();

  scene.pending.resolve('reparented result');
  await drainMicrotasks();

  expect(scene.target.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFrom(scene.loop, scene.target)).toBe('original canonical');
});

const ineligibleCases: ReadonlyArray<{
  readonly name: string;
  readonly mutate: (scene: FocusScene) => void;
}> = [
  {
    name: 'hidden leaf',
    mutate: (scene) => {
      scene.target.state.visible = false;
    },
  },
  {
    name: 'disabled leaf',
    mutate: (scene) => {
      scene.target.state.disabled = true;
    },
  },
  {
    name: 'unfocusable leaf',
    mutate: (scene) => {
      scene.target.focusable = false;
    },
  },
  {
    name: 'hidden ancestor',
    mutate: (scene) => {
      scene.branch.state.visible = false;
    },
  },
  {
    name: 'disabled ancestor',
    mutate: (scene) => {
      scene.branch.state.disabled = true;
    },
  },
];

// Any captured route member that becomes ineligible causes a silent stale-result discard.
test.each(ineligibleCases)('$name discards pending native paste', async ({ mutate }) => {
  const scene = focusScene();
  await startRequest(scene);
  mutate(scene);
  scene.frames.mockClear();

  scene.pending.resolve('ineligible result');
  await drainMicrotasks();

  expect(scene.target.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFrom(scene.loop, scene.other)).toBe('original canonical');
});
