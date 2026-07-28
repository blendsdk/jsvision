/**
 * Specification oracle for the native clipboard boundary used by the interactive tvedit demo.
 *
 * The operating-system clipboard is a true external dependency, so every case supplies fake async
 * methods. The adapter must preserve raw strings, remain lazy, and let the UI event loop own
 * ordering, lifecycle cancellation, fallback, and payload-free diagnostics.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { Logger, PasteEvent } from '@jsvision/core';
import { createApplication, createEventLoop, Commands, Group, View } from '@jsvision/ui';
import type { DispatchEvent, DrawContext } from '@jsvision/ui';
import { afterEach, expect, test, vi } from 'vitest';

import { createTveditClipboardAdapter } from '../tvedit-demo/native-clipboard.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

afterEach(() => vi.restoreAllMocks());

/** Advance promise continuations without introducing a timer or touching a platform clipboard. */
async function drainMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

/** A manually settled promise used to prove serialized, non-blocking native reads. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

/** Create a promise whose fulfillment remains under the test's control. */
function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

/** Focusable witness that can seed, inspect, and receive the event loop's canonical clipboard. */
class ClipboardProbe extends View {
  override focusable = true;
  readonly pastes: PasteEvent[] = [];
  canonical = '';

  override draw(_ctx: DrawContext): void {}

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'paste') {
      this.pastes.push(event.event);
      return;
    }
    if (event.event.type !== 'command') return;
    if (event.event.command === 'copy-test-text') {
      event.setClipboard?.(String(event.event.arg ?? ''));
      event.handled = true;
    } else if (event.event.command === 'inspect-test-text') {
      this.canonical = event.readClipboard?.() ?? '';
      event.handled = true;
    }
  }
}

/** Build a real focused event loop around one clipboard witness. */
function mountProbe(adapter: ReturnType<typeof createTveditClipboardAdapter>, logger?: Logger) {
  const probe = new ClipboardProbe();
  const root = new Group();
  root.add(probe);
  const loop = createEventLoop(
    { width: 30, height: 5 },
    {
      caps,
      logger,
      ...adapter,
      commands: [...Object.values(Commands), 'copy-test-text', 'inspect-test-text'],
    },
  );
  loop.mount(root);
  loop.focusView(probe);
  return { loop, probe };
}

// The adapter is a transparent async text boundary: no encoding, newline conversion, or sync API.
test('delegates exact raw Unicode, line endings, and empty text through async methods only', async () => {
  const writes: string[] = [];
  const reads = ['café\r\n第二行\n😀e\u0301', '', 'lone\rreturn'];
  const methods = {
    read: vi.fn(async () => reads.shift() ?? ''),
    write: vi.fn(async (text: string) => {
      writes.push(text);
    }),
    readSync: vi.fn(() => 'forbidden'),
    writeSync: vi.fn((_text: string) => undefined),
  };
  const adapter = createTveditClipboardAdapter(methods);
  const rawWrites = ['café\r\n第二行\n😀e\u0301', '', 'lone\rreturn'];

  for (const text of rawWrites) await adapter.writeClipboardText(text);
  const rawReads = [
    await adapter.readClipboardText(),
    await adapter.readClipboardText(),
    await adapter.readClipboardText(),
  ];

  expect(writes).toEqual(rawWrites);
  expect(rawReads).toEqual(['café\r\n第二行\n😀e\u0301', '', 'lone\rreturn']);
  expect(methods.readSync).not.toHaveBeenCalled();
  expect(methods.writeSync).not.toHaveBeenCalled();
});

// Factory creation and first-frame composition are lazy and never launch a platform helper.
test('headless first-frame composition does not invoke either clipboard callback', () => {
  const methods = {
    read: vi.fn(async () => 'must remain unread'),
    write: vi.fn(async (_text: string) => undefined),
  };
  const adapter = createTveditClipboardAdapter(methods);
  const app = createApplication({
    caps,
    content: new ClipboardProbe(),
    viewport: { width: 30, height: 5 },
    requireTty: false,
    ...adapter,
  });

  app.loop.renderRoot.flush();

  expect(methods.read).not.toHaveBeenCalled();
  expect(methods.write).not.toHaveBeenCalled();
});

// Adapter promises remain observable by the UI boundary; the adapter neither catches nor logs them.
test('propagates read and write rejections without logging payloads itself', async () => {
  const readError = new Error('READ-ADAPTER-SECRET-SENTINEL');
  const writeError = new Error('WRITE-ADAPTER-SECRET-SENTINEL');
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const adapter = createTveditClipboardAdapter({
    read: () => Promise.reject(readError),
    write: () => Promise.reject(writeError),
  });

  await expect(adapter.readClipboardText()).rejects.toBe(readError);
  await expect(adapter.writeClipboardText('clipboard-payload-SENTINEL')).rejects.toBe(writeError);
  expect(consoleWarn).not.toHaveBeenCalled();
  expect(consoleError).not.toHaveBeenCalled();
});

// The real UI scheduler serializes injected reads and returns from a gesture before either settles.
test('configured reads remain non-blocking and start one at a time in gesture order', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const methods = {
    read: vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise),
    write: vi.fn(async (_text: string) => undefined),
  };
  const { loop, probe } = mountProbe(createTveditClipboardAdapter(methods));

  loop.emitCommand(Commands.paste);
  loop.emitCommand(Commands.paste);
  expect(probe.pastes).toHaveLength(0);
  await drainMicrotasks();
  expect(methods.read).toHaveBeenCalledOnce();

  first.resolve('first\r\n😀');
  await drainMicrotasks();
  expect(methods.read).toHaveBeenCalledTimes(2);
  expect(probe.pastes.map((event) => event.text)).toEqual(['first\r\n😀']);

  second.resolve('');
  await drainMicrotasks();
  expect(probe.pastes.map((event) => event.text)).toEqual(['first\r\n😀', '']);
});

// A late helper result cannot revive a stopped headless/event-loop lifecycle.
test('a never-ready reader does not block stop and its late result is discarded', async () => {
  const pending = deferred<string>();
  const methods = {
    read: vi.fn(() => pending.promise),
    write: vi.fn(async (_text: string) => undefined),
  };
  const { loop, probe } = mountProbe(createTveditClipboardAdapter(methods));

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(methods.read).toHaveBeenCalledOnce();

  loop.stop();
  pending.resolve('late clipboard payload');
  await drainMicrotasks();

  expect(probe.pastes).toHaveLength(0);
});

// Missing-helper failures degrade through the canonical fallback and expose no error or payload.
test('headless helper failures preserve usability with payload-free diagnostics', async () => {
  const clipboardPayload = 'local-fallback-SECRET-SENTINEL';
  const helperError = 'missing-display-SECRET-SENTINEL';
  const warnings: Array<{
    readonly component: string;
    readonly message: string;
    readonly fields: Record<string, unknown> | undefined;
  }> = [];
  const logger: Logger = {
    enabled: true,
    debug: () => undefined,
    info: () => undefined,
    warn: (component, message, fields) => warnings.push({ component, message, fields }),
    error: () => undefined,
    entries: () => [],
    close: () => undefined,
  };
  const methods = {
    read: vi.fn(() => Promise.reject(new Error(helperError))),
    write: vi.fn(() => Promise.reject(new Error(helperError))),
  };
  const { loop, probe } = mountProbe(createTveditClipboardAdapter(methods), logger);

  loop.emitCommand('copy-test-text', clipboardPayload);
  await drainMicrotasks();
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  loop.emitCommand('inspect-test-text');

  expect(probe.pastes.map((event) => event.text)).toEqual([clipboardPayload]);
  expect(probe.canonical).toBe(clipboardPayload);
  expect(methods.write).toHaveBeenCalledWith(clipboardPayload);
  expect(methods.read).toHaveBeenCalledOnce();
  expect(warnings.map(({ component, message }) => ({ component, message }))).toEqual([
    { component: 'clipboard', message: 'host clipboard write failed' },
    { component: 'clipboard', message: 'host clipboard read failed' },
  ]);
  expect(JSON.stringify(warnings)).not.toContain(helperError);
  expect(JSON.stringify(warnings)).not.toContain(clipboardPayload);
});
