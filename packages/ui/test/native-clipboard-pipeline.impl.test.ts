/**
 * Implementation hardening for native clipboard scheduler state.
 *
 * The public specifications cover observable delivery. These cases pin the internal command-version
 * notification and the queue's pre-start stale check so runtime adapter changes and abandoned jobs
 * cannot leave misleading affordances or launch unnecessary host reads.
 */
import { PASTE_CAP_BYTES, resolveCapabilities } from '@jsvision/core';
import type { Logger, PasteEvent } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { createApplication } from '../src/app/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { ClipboardTextReader, ModalHost, ModalHostAware } from '../src/index.js';
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

  draw(_ctx: DrawContext): void {}

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'paste') {
      this.pastes.push(event.event);
      return;
    }
    if (event.event.type !== 'command') return;
    if (event.event.command === 'seed-clipboard') {
      event.setClipboard?.(String(event.event.arg ?? ''));
      event.handled = true;
    } else if (event.event.command === 'inspect-clipboard') {
      this.canonical = event.readClipboard?.() ?? '';
      event.handled = true;
    }
  }
}

class ModalPasteProbe extends PasteProbe implements ModalHostAware {
  modalHost: ModalHost | null = null;

  attachModalHost(host: ModalHost): void {
    this.modalHost = host;
  }
}

test('runtime reader identity changes notify command affordances without altering the registry override', () => {
  const loop = createEventLoop({ width: 20, height: 4 }, { caps });
  const reader: ClipboardTextReader = () => 'runtime';
  loop.enableCommand(Commands.paste, false);
  const disabledVersion = loop.commandsVersion();

  loop.readClipboardText = reader;
  expect(loop.commandsVersion()).toBe(disabledVersion + 1);
  expect(loop.isCommandEnabled(Commands.paste)).toBe(true);

  loop.readClipboardText = reader;
  expect(loop.commandsVersion()).toBe(disabledVersion + 1);

  loop.readClipboardText = undefined;
  expect(loop.commandsVersion()).toBe(disabledVersion + 2);
  expect(loop.isCommandEnabled(Commands.paste)).toBe(false);
});

test('a native paste command with no focused destination never starts the host reader', async () => {
  const reader: ClipboardTextReader = vi.fn(() => 'unused');
  const loop = createEventLoop({ width: 20, height: 4 }, { caps, readClipboardText: reader });
  loop.mount(new Group());

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(reader).not.toHaveBeenCalled();
});

test('a queued request that becomes stale is skipped before starting another host read', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const reader: ClipboardTextReader = vi
    .fn<ClipboardTextReader>()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  const target = new PasteProbe();
  const other = new PasteProbe();
  const root = new Group();
  root.add(target);
  root.add(other);
  const loop = createEventLoop({ width: 20, height: 4 }, { caps, readClipboardText: reader });
  loop.mount(root);
  loop.focusView(target);

  loop.emitCommand(Commands.paste);
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledOnce();

  loop.focusView(other);
  first.resolve('stale first result');
  await drainMicrotasks();

  expect(reader).toHaveBeenCalledOnce();
  expect(target.pastes).toHaveLength(0);
  expect(other.pastes).toHaveLength(0);
});

test('a delivery-side host callback failure is normalized and the next queued read still runs', async () => {
  const reader: ClipboardTextReader = vi
    .fn<ClipboardTextReader>()
    .mockReturnValueOnce('first')
    .mockReturnValueOnce('second');
  const target = new PasteProbe();
  const root = new Group();
  root.add(target);
  const loop = createEventLoop({ width: 20, height: 4 }, { caps, readClipboardText: reader });
  loop.mount(root);
  loop.focusView(target);
  loop.onFrame = vi
    .fn()
    .mockImplementationOnce(() => {
      throw new Error('host-frame-failure-SENTINEL');
    })
    .mockImplementation(() => undefined);

  loop.emitCommand(Commands.paste);
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(reader).toHaveBeenCalledTimes(2);
  expect(target.pastes.map((event) => event.text)).toEqual(['first', 'second']);
});

test('reader failure delivers an oversized canonical fallback unchanged', async () => {
  const canonical = 'x'.repeat(PASTE_CAP_BYTES + 1);
  const reader: ClipboardTextReader = () => {
    throw new Error('read-failure-SENTINEL');
  };
  const target = new PasteProbe();
  const root = new Group();
  root.add(target);
  const loop = createEventLoop(
    { width: 20, height: 4 },
    {
      caps,
      readClipboardText: reader,
      commands: ['inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(target);
  loop.dispatch({ type: 'paste', text: canonical, truncated: false });
  target.pastes.splice(0);

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(target.pastes).toEqual([{ type: 'paste', text: canonical, truncated: false }]);
  loop.emitCommand('inspect-clipboard');
  expect(target.canonical).toBe(canonical);
});

test('a reentrant throwing read-warning sink invalidates fallback delivery safely', async () => {
  const target = new PasteProbe();
  const other = new PasteProbe();
  const root = new Group();
  root.add(target);
  root.add(other);
  const loopReference: { current?: ReturnType<typeof createEventLoop> } = {};
  const logger: Logger = {
    enabled: true,
    debug: () => undefined,
    info: () => undefined,
    warn: () => {
      loopReference.current?.focusView(other);
      throw new Error('logger-failure-SENTINEL');
    },
    error: () => undefined,
    entries: () => [],
    close: () => undefined,
  };
  const loop = createEventLoop(
    { width: 20, height: 4 },
    {
      caps,
      logger,
      readClipboardText: () => Promise.reject(new Error('read-failure-SENTINEL')),
    },
  );
  loopReference.current = loop;
  loop.mount(root);
  loop.focusView(target);

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(loop.getFocused()).toBe(other);
  expect(target.pastes).toHaveLength(0);
  expect(other.pastes).toHaveLength(0);
});

test('application shutdown invalidates an in-flight read before terminal restoration yields', async () => {
  const pending = deferred<string>();
  const reader: ClipboardTextReader = vi.fn(() => pending.promise);
  const target = new PasteProbe();
  const app = createApplication({
    caps,
    content: target,
    viewport: { width: 20, height: 4 },
    runtime: new FakeRuntimeAdapter(),
    input: new FakeInput().asInput(),
    output: new CaptureStream().asOutput(),
    warnAmbiguousWidth: false,
    readClipboardText: reader,
  });
  const runPromise = app.run();
  app.loop.focusView(target);
  app.loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledOnce();

  app.loop.emitCommand(Commands.quit);
  pending.resolve('settled during host stop');
  await runPromise;
  await drainMicrotasks();

  expect(target.pastes).toHaveLength(0);
});

test('a modal host observes reader-aware paste availability', () => {
  const modal = new ModalPasteProbe();
  const root = new Group();
  root.add(modal);
  const loop = createEventLoop(
    { width: 20, height: 4 },
    {
      caps,
      readClipboardText: () => 'available',
    },
  );
  loop.mount(root);
  loop.enableCommand(Commands.paste, false);

  void loop.execView(modal);

  expect(modal.modalHost?.isCommandEnabled(Commands.paste)).toBe(true);
});
