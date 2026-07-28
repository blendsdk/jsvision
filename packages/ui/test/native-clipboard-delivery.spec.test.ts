/**
 * Specification tests for native read outcomes and serialized delivery.
 *
 * Accepted results are bounded and adopted before one ordinary paste dispatch. Empty success clears
 * stale state without editing, failures warn generically and use the canonical value at ordered
 * delivery, and the queue starts only one host read at a time.
 */
import { PASTE_CAP_BYTES, resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, Logger, PasteEvent } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { Input } from '../src/controls/index.js';
import { Editor } from '../src/editor/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { ClipboardTextReader, EventLoopOptions } from '../src/index.js';
import type { Size2D } from '../src/layout/index.js';
import { signal } from '../src/reactive/index.js';
import { Commands } from '../src/status/index.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

function key(value: string, modifiers: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: value, ctrl: false, alt: false, shift: false, ...modifiers };
}

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

class ClipboardProbe extends View {
  override focusable = true;
  readonly pastes: PasteEvent[] = [];
  readonly canonicalDuringPaste: string[] = [];
  canonical = '';

  override measure(available: Size2D): Size2D {
    return available;
  }

  draw(_ctx: DrawContext): void {}

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'paste') {
      this.pastes.push(ev.event);
      this.canonicalDuringPaste.push(ev.readClipboard?.() ?? '');
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

function mountProbe(reader: ClipboardTextReader, logger?: Logger) {
  const probe = new ClipboardProbe();
  probe.setLayout({ size: { kind: 'fr', weight: 1 } });
  const root = new Group();
  root.add(probe);
  const loop = createEventLoop(
    { width: 40, height: 6 },
    {
      caps,
      logger,
      readClipboardText: reader,
      commands: [...Object.values(Commands), 'seed-clipboard', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(probe);
  return { loop, probe };
}

function seedCanonical(loop: ReturnType<typeof createEventLoop>, text: string): void {
  loop.emitCommand('seed-clipboard', text);
}

function inspectCanonical(loop: ReturnType<typeof createEventLoop>, probe: ClipboardProbe): string {
  loop.emitCommand('inspect-clipboard');
  return probe.canonical;
}

function warning(): WarningRecord {
  return { component: 'clipboard', message: 'host clipboard read failed', fields: undefined };
}

// Successful native text remains raw, is canonical during delivery, and causes one dispatch paint.
test('successful Unicode and multiline text is adopted before one ordinary paste delivery', async () => {
  const raw = 'café\r\n第二行\n😀e\u0301';
  const reader: ClipboardTextReader = vi.fn(async () => raw);
  const { loop, probe } = mountProbe(reader);
  const frames = vi.fn();
  loop.onFrame = frames;

  loop.emitCommand(Commands.paste);
  expect(probe.pastes).toHaveLength(0);
  await drainMicrotasks();

  expect(reader).toHaveBeenCalledOnce();
  expect(probe.pastes).toEqual([{ type: 'paste', text: raw, truncated: false }]);
  expect(probe.canonicalDuringPaste).toEqual([raw]);
  expect(frames).toHaveBeenCalledOnce();
});

// Successful over-cap host text becomes the longest valid UTF-8 prefix with truncation metadata.
test('successful oversized text is bounded before canonical adoption and delivery', async () => {
  const prefix = `${'a'.repeat(PASTE_CAP_BYTES - 3)}界`;
  const source = `${prefix}😀discarded`;
  const reader: ClipboardTextReader = () => source;
  const { loop, probe } = mountProbe(reader);

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(probe.pastes).toHaveLength(1);
  expect(probe.pastes[0]).toEqual({ type: 'paste', text: prefix, truncated: true });
  expect(probe.canonicalDuringPaste).toEqual([prefix]);
  expect(new TextEncoder().encode(prefix).byteLength).toBe(PASTE_CAP_BYTES);
  expect(prefix).not.toContain('\uFFFD');
});

// Successful empty read clears stale canonical text without changing an Input selection or value.
test('successful empty read is a non-destructive Input insertion and clears stale canonical text', async () => {
  const reader: ClipboardTextReader = vi.fn(async () => '');
  const value = signal('preserve input');
  const input = new Input({ value });
  const clipboard = new ClipboardProbe();
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  clipboard.setLayout({ size: { kind: 'fixed', cells: 1 } });
  const root = new Group();
  root.add(input);
  root.add(clipboard);
  const loop = createEventLoop(
    { width: 30, height: 4 },
    {
      caps,
      readClipboardText: reader,
      commands: [...Object.values(Commands), 'seed-clipboard', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(clipboard);
  seedCanonical(loop, 'stale local text');
  loop.focusView(input);
  loop.dispatch(key('a', { ctrl: true }));
  const selection = { ...input.selection };

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(value()).toBe('preserve input');
  expect(input.selection).toEqual(selection);
  expect(reader).toHaveBeenCalledOnce();
  loop.focusView(clipboard);
  expect(inspectCanonical(loop, clipboard)).toBe('');
});

// Successful empty read preserves Editor content, selection, modified state, and empty undo history.
test('successful empty read is a history-free Editor insertion and clears stale canonical text', async () => {
  const reader: ClipboardTextReader = vi.fn(() => '');
  const editor = new Editor();
  editor.setText('preserve editor');
  const clipboard = new ClipboardProbe();
  editor.setLayout({ size: { kind: 'fr', weight: 1 } });
  clipboard.setLayout({ size: { kind: 'fixed', cells: 1 } });
  const root = new Group();
  root.add(editor);
  root.add(clipboard);
  const loop = createEventLoop(
    { width: 30, height: 6 },
    {
      caps,
      readClipboardText: reader,
      commands: [...Object.values(Commands), 'seed-clipboard', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(clipboard);
  seedCanonical(loop, 'stale local text');
  loop.focusView(editor);
  loop.dispatch(key('a', { ctrl: true }));
  const selection = editor.selectionText();

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(editor.getText()).toBe('preserve editor');
  expect(editor.selectionText()).toBe(selection);
  expect(editor.canUndo()).toBe(false);
  expect(editor.modified()).toBe(false);
  loop.focusView(clipboard);
  expect(inspectCanonical(loop, clipboard)).toBe('');
});

// A synchronous reader throw warns once without details and delivers the existing fallback once.
test('synchronous read failure warns generically and delivers canonical fallback once', async () => {
  const detail = 'sync-read-error-SENTINEL';
  const { logger, warnings } = recordingLogger();
  const reader: ClipboardTextReader = () => {
    throw new Error(detail);
  };
  const { loop, probe } = mountProbe(reader, logger);
  seedCanonical(loop, 'fallback');

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(probe.pastes.map((event) => event.text)).toEqual(['fallback']);
  expect(warnings).toEqual([warning()]);
  expect(JSON.stringify(warnings)).not.toContain(detail);
  expect(JSON.stringify(warnings)).not.toContain('fallback');
});

// A non-string host result is treated as one payload-free read failure and uses local fallback.
test('non-string read result warns generically and delivers canonical fallback once', async () => {
  const { logger, warnings } = recordingLogger();
  const options: EventLoopOptions = {
    caps,
    logger,
    readClipboardText: () => 'placeholder',
    commands: [...Object.values(Commands), 'seed-clipboard'],
  };
  Object.defineProperty(options, 'readClipboardText', { value: () => 42 });
  const probe = new ClipboardProbe();
  const root = new Group();
  root.add(probe);
  const loop = createEventLoop({ width: 30, height: 5 }, options);
  loop.mount(root);
  loop.focusView(probe);
  seedCanonical(loop, 'fallback');

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(probe.pastes.map((event) => event.text)).toEqual(['fallback']);
  expect(warnings).toEqual([warning()]);
  expect(JSON.stringify(warnings)).not.toContain('42');
});

// Deferred reads start one at a time and deliver in gesture order even if the later promise is ready.
test('serialized reads deliver first gesture then second gesture with one active callback', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  second.resolve('second');
  const reader: ClipboardTextReader = vi
    .fn<ClipboardTextReader>()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  const { loop, probe } = mountProbe(reader);

  loop.emitCommand(Commands.paste);
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledTimes(1);
  expect(probe.pastes).toHaveLength(0);

  first.resolve('first');
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledTimes(2);
  expect(probe.pastes.map((event) => event.text)).toEqual(['first', 'second']);
});

// A later rejected job uses an earlier ordered success as fallback and does not poison the queue.
test('rejected read uses current ordered fallback and the following queued read still succeeds', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const third = deferred<string>();
  const { logger, warnings } = recordingLogger();
  const reader: ClipboardTextReader = vi
    .fn<ClipboardTextReader>()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise)
    .mockImplementationOnce(() => third.promise);
  const { loop, probe } = mountProbe(reader, logger);
  seedCanonical(loop, 'original fallback');

  loop.emitCommand(Commands.paste);
  loop.emitCommand(Commands.paste);
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledTimes(1);

  first.resolve('earlier success');
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledTimes(2);
  second.reject(new Error('rejection-detail-SENTINEL'));
  await drainMicrotasks();
  expect(reader).toHaveBeenCalledTimes(3);
  third.resolve('queue recovered');
  await drainMicrotasks();

  expect(probe.pastes.map((event) => event.text)).toEqual(['earlier success', 'earlier success', 'queue recovered']);
  expect(warnings).toEqual([warning()]);
  expect(inspectCanonical(loop, probe)).toBe('queue recovered');
  expect(JSON.stringify(warnings)).not.toContain('rejection-detail-SENTINEL');
});
