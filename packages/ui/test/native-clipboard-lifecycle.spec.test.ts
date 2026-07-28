/**
 * Specification tests for mount-incarnation and lifecycle safety of native clipboard work.
 *
 * Unmount/remount and terminal lifecycle transitions permanently invalidate captured requests.
 * Late fulfillment or rejection cannot adopt, dispatch, warn, repaint, start queued work, or retain
 * host callback references after teardown.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { Logger, PasteEvent } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { createApplication } from '../src/app/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { ClipboardTextReader, ClipboardTextWriter } from '../src/index.js';
import type { Size2D } from '../src/layout/index.js';
import { Commands } from '../src/status/index.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './app-shell.fixtures.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

async function drainMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

interface WarningRecord {
  readonly component: string;
  readonly message: string;
  readonly fields: Record<string, unknown> | undefined;
}

function recordingLogger(): { readonly logger: Logger; readonly warnings: WarningRecord[] } {
  const warnings: WarningRecord[] = [];
  const logger: Logger = {
    enabled: true,
    debug: () => undefined,
    info: () => undefined,
    warn: (component, message, fields) => warnings.push({ component, message, fields }),
    error: () => undefined,
    entries: () => [],
    close: () => undefined,
  };
  return { logger, warnings };
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
    if (ev.event.command === 'seed-clipboard' || ev.event.command === 'copy-host') {
      ev.setClipboard?.(String(ev.event.arg ?? ''));
      ev.handled = true;
    } else if (ev.event.command === 'inspect-clipboard') {
      this.canonical = ev.readClipboard?.() ?? '';
      ev.handled = true;
    }
  }
}

function lifecycleScene(reader: ClipboardTextReader, logger?: Logger) {
  const target = new PasteProbe();
  const observer = new PasteProbe();
  const branch = new Group();
  branch.add(target);
  const root = new Group();
  root.add(branch);
  root.add(observer);
  const loop = createEventLoop(
    { width: 40, height: 8 },
    {
      caps,
      logger,
      readClipboardText: reader,
      commands: [...Object.values(Commands), 'seed-clipboard', 'copy-host', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(target);
  loop.emitCommand('seed-clipboard', 'original canonical');
  const frames = vi.fn();
  loop.onFrame = frames;
  return { loop, root, branch, target, observer, frames };
}

async function startRequest(
  loop: ReturnType<typeof createEventLoop>,
  reader: ClipboardTextReader,
  frames: ReturnType<typeof vi.fn>,
): Promise<void> {
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledOnce();
  frames.mockClear();
}

function inspectFrom(loop: ReturnType<typeof createEventLoop>, probe: PasteProbe): string {
  loop.focusView(probe);
  loop.emitCommand('inspect-clipboard');
  return probe.canonical;
}

// Removing the captured leaf before settlement discards its result without adoption or repaint.
test('unmounting the target discards pending native paste', async () => {
  const pending = deferred<string>();
  const reader: ClipboardTextReader = vi.fn(() => pending.promise);
  const scene = lifecycleScene(reader);
  await startRequest(scene.loop, reader, scene.frames);
  scene.branch.remove(scene.target);
  scene.loop.focusView(scene.observer);
  scene.frames.mockClear();

  pending.resolve('unmounted result');
  await drainMicrotasks();

  expect(scene.target.pastes).toHaveLength(0);
  expect(scene.observer.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFrom(scene.loop, scene.observer)).toBe('original canonical');
});

// Removing and re-adding the same object creates a new mount incarnation that cannot revive work.
test('same-object remount discards pending native paste', async () => {
  const pending = deferred<string>();
  const reader: ClipboardTextReader = vi.fn(() => pending.promise);
  const scene = lifecycleScene(reader);
  await startRequest(scene.loop, reader, scene.frames);
  scene.branch.remove(scene.target);
  scene.branch.add(scene.target);
  scene.loop.focusView(scene.target);
  scene.frames.mockClear();

  pending.resolve('remounted result');
  await drainMicrotasks();

  expect(scene.target.pastes).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFrom(scene.loop, scene.target)).toBe('original canonical');
});

// Stopping the loop suppresses a late reader rejection, including warning, adoption, and repaint.
test('stop makes late reader rejection completely inert', async () => {
  const pending = deferred<string>();
  const { logger, warnings } = recordingLogger();
  const reader: ClipboardTextReader = vi.fn(() => pending.promise);
  const scene = lifecycleScene(reader, logger);
  await startRequest(scene.loop, reader, scene.frames);
  scene.loop.stop();
  scene.frames.mockClear();

  pending.reject(new Error('late-read-error-SENTINEL'));
  await drainMicrotasks();

  expect(scene.target.pastes).toHaveLength(0);
  expect(warnings).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(inspectFrom(scene.loop, scene.target)).toBe('original canonical');
});

// Disposal prevents a settled in-flight request from starting the next queued native read.
test('dispose cancels in-flight delivery and prevents queued reader startup', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const { logger, warnings } = recordingLogger();
  const reader: ClipboardTextReader = vi
    .fn<ClipboardTextReader>()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  const scene = lifecycleScene(reader, logger);

  scene.loop.emitCommand(Commands.paste);
  scene.loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledOnce();
  scene.loop.dispose();
  scene.frames.mockClear();

  first.resolve('disposed result');
  await drainMicrotasks();

  expect(reader).toHaveBeenCalledOnce();
  expect(scene.target.pastes).toHaveLength(0);
  expect(warnings).toHaveLength(0);
  expect(scene.frames).not.toHaveBeenCalled();
  expect(scene.loop.readClipboardText).toBeUndefined();
});

// Application run teardown detaches callbacks before a pending read settles.
test('Application teardown drops late native read settlement and clears runtime callback references', async () => {
  const pending = deferred<string>();
  const reader: ClipboardTextReader = vi.fn(() => pending.promise);
  const target = new PasteProbe();
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  const app = createApplication({
    caps,
    content: target,
    viewport: { width: 40, height: 8 },
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    warnAmbiguousWidth: false,
    readClipboardText: reader,
  });
  const runPromise = app.run();
  app.loop.focusView(target);
  app.loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledOnce();

  app.loop.emitCommand(Commands.quit);
  await runPromise;
  pending.resolve('post-teardown result');
  await drainMicrotasks();

  expect(target.pastes).toHaveLength(0);
  expect(app.loop.readClipboardText).toBeUndefined();
  expect(app.loop.writeClipboardText).toBeUndefined();
  expect(app.loop.onFrame).toBeUndefined();
  expect(app.loop.onCaret).toBeUndefined();
});

// A writer promise rejected after stop produces no diagnostic and leaves canonical state committed.
test('stop suppresses a late writer rejection without rolling back canonical text', async () => {
  const pending = deferred<void>();
  const { logger, warnings } = recordingLogger();
  const writer: ClipboardTextWriter = vi.fn(() => pending.promise);
  const target = new PasteProbe();
  const root = new Group();
  root.add(target);
  const loop = createEventLoop(
    { width: 30, height: 5 },
    {
      caps,
      logger,
      writeClipboardText: writer,
      commands: ['copy-host', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(target);
  loop.emitCommand('copy-host', 'committed before stop');
  expect(writer).toHaveBeenCalledOnce();
  loop.stop();

  pending.reject(new Error('late-writer-error-SENTINEL'));
  await drainMicrotasks();

  expect(warnings).toHaveLength(0);
  expect(inspectFrom(loop, target)).toBe('committed before stop');
});
