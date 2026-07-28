/**
 * Specification tests for host-neutral clipboard configuration and outbound compatibility.
 *
 * Applications and direct loops accept the same optional raw-text callbacks. Copy and cut commit
 * locally before best-effort host notification, while an omitted adapter retains synchronous local
 * clipboard behavior and the capability-gated terminal fallback.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, Logger, PasteEvent } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { createApplication } from '../src/app/index.js';
import type { ApplicationOptions } from '../src/app/index.js';
import { Input } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { ClipboardTextReader, ClipboardTextWriter, EventLoopOptions } from '../src/index.js';
import { signal } from '../src/reactive/index.js';
import { Commands } from '../src/status/index.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './app-shell.fixtures.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const clipboardCaps = {
  ...caps,
  osc: { ...caps.osc, clipboard52: true },
};

function key(value: string, modifiers: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: value, ctrl: false, alt: false, shift: false, ...modifiers };
}

function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false };
}

async function drainMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
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

  draw(_ctx: DrawContext): void {}

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'paste') {
      this.pastes.push(ev.event);
      this.canonicalDuringPaste.push(ev.readClipboard?.() ?? '');
      return;
    }
    if (ev.event.type !== 'command') return;
    if (ev.event.command === 'copy-fixture') {
      ev.setClipboard?.(String(ev.event.arg ?? ''));
      ev.handled = true;
    } else if (ev.event.command === 'inspect-clipboard') {
      this.canonical = ev.readClipboard?.() ?? '';
      ev.handled = true;
    }
  }
}

function mountProbe(options: Omit<EventLoopOptions, 'caps'> = {}) {
  const probe = new ClipboardProbe();
  probe.setLayout({ size: { kind: 'fr', weight: 1 } });
  const root = new Group();
  root.add(probe);
  const loop = createEventLoop(
    { width: 30, height: 5 },
    { caps, commands: [...Object.values(Commands), 'copy-fixture', 'inspect-clipboard'], ...options },
  );
  loop.mount(root);
  loop.focusView(probe);
  return { loop, probe };
}

function inspectCanonical(loop: ReturnType<typeof createEventLoop>, probe: ClipboardProbe): string {
  loop.emitCommand('inspect-clipboard');
  return probe.canonical;
}

function osc52(text: string): string {
  return `\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`;
}

// A direct loop accepts a synchronous reader and asynchronous writer through its typed options.
test('direct EventLoop configuration exposes symmetric sync-read and async-write callbacks', async () => {
  const writer: ClipboardTextWriter = vi.fn(async (_text: string) => undefined);
  const reader: ClipboardTextReader = vi.fn(() => 'direct read');
  const options: EventLoopOptions = { caps, writeClipboardText: writer, readClipboardText: reader };
  const { loop, probe } = mountProbe(options);

  loop.emitCommand('copy-fixture', 'direct write');
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(writer).toHaveBeenCalledOnce();
  expect(writer).toHaveBeenCalledWith('direct write');
  expect(reader).toHaveBeenCalledOnce();
  expect(probe.pastes.map((event) => event.text)).toEqual(['direct read']);
});

// Application options thread an asynchronous reader and synchronous writer to the composed loop.
test('Application configuration threads async-read and sync-write callbacks to its EventLoop', async () => {
  const probe = new ClipboardProbe();
  const writer: ClipboardTextWriter = vi.fn((_text: string) => undefined);
  const reader: ClipboardTextReader = vi.fn(async () => 'application read');
  const options: ApplicationOptions = {
    caps,
    viewport: { width: 30, height: 5 },
    content: probe,
    writeClipboardText: writer,
    readClipboardText: reader,
  };
  const app = createApplication(options);
  app.loop.focusView(probe);

  app.loop.emitCommand('copy-fixture', 'application write');
  app.loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(writer).toHaveBeenCalledOnce();
  expect(writer).toHaveBeenCalledWith('application write');
  expect(reader).toHaveBeenCalledOnce();
  expect(probe.pastes.map((event) => event.text)).toEqual(['application read']);
});

// Copy and cut send exact raw Unicode text once each and retain the same local value for later paste.
test('copy and cut commit exact raw text locally before notifying the configured writer', () => {
  const raw = 'café 🧪';
  const value = signal(raw);
  const input = new Input({ value });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  const root = new Group();
  root.add(input);
  const writer: ClipboardTextWriter = vi.fn((_text: string) => undefined);
  const loop = createEventLoop(
    { width: 30, height: 3 },
    { caps, writeClipboardText: writer, commands: Object.values(Commands) },
  );
  loop.mount(root);
  loop.focusView(input);

  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true }));
  expect(value()).toBe(raw);
  loop.dispatch(key('x', { ctrl: true }));
  expect(value()).toBe('');
  loop.dispatch(key('v', { ctrl: true }));

  expect(writer).toHaveBeenCalledTimes(2);
  expect(writer).toHaveBeenNthCalledWith(1, raw);
  expect(writer).toHaveBeenNthCalledWith(2, raw);
  expect(value()).toBe(raw);
});

// A synchronous writer failure cannot roll back canonical text and reveals no payload or exception.
test('synchronous writer failure preserves canonical text and emits one payload-free warning', () => {
  const payload = 'clipboard-payload-SENTINEL';
  const hostDetail = 'writer-error-SENTINEL';
  const { logger, warnings } = recordingLogger();
  const writer: ClipboardTextWriter = () => {
    throw new Error(hostDetail);
  };
  const { loop, probe } = mountProbe({ logger, writeClipboardText: writer });

  expect(() => loop.emitCommand('copy-fixture', payload)).not.toThrow();

  expect(inspectCanonical(loop, probe)).toBe(payload);
  expect(warnings).toEqual([{ component: 'clipboard', message: 'host clipboard write failed', fields: undefined }]);
  expect(JSON.stringify(warnings)).not.toContain(payload);
  expect(JSON.stringify(warnings)).not.toContain(hostDetail);
});

// An asynchronous writer rejection has the same payload-free behavior and never rolls state back.
test('asynchronous writer rejection preserves canonical text and emits one payload-free warning', async () => {
  const payload = 'async-payload-SENTINEL';
  const hostDetail = 'async-writer-error-SENTINEL';
  const { logger, warnings } = recordingLogger();
  const writer: ClipboardTextWriter = async () => {
    throw new Error(hostDetail);
  };
  const { loop, probe } = mountProbe({ logger, writeClipboardText: writer });

  loop.emitCommand('copy-fixture', payload);
  await drainMicrotasks();

  expect(inspectCanonical(loop, probe)).toBe(payload);
  expect(warnings).toEqual([{ component: 'clipboard', message: 'host clipboard write failed', fields: undefined }]);
  expect(JSON.stringify(warnings)).not.toContain(payload);
  expect(JSON.stringify(warnings)).not.toContain(hostDetail);
});

// Omitting adapters retains app-local copy/paste, OSC 52 output, and explicit command disabling.
test('no-adapter copy and paste retain local behavior, OSC fallback, and disabled-command semantics', () => {
  const value = signal('legacy');
  const input = new Input({ value });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  const root = new Group();
  root.add(input);
  const loop = createEventLoop({ width: 20, height: 3 }, { caps: clipboardCaps, commands: Object.values(Commands) });
  const writes: string[] = [];
  loop.writeClipboard = (sequence) => writes.push(sequence);
  loop.mount(root);
  loop.focusView(input);

  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true }));
  expect(writes).toEqual([osc52('legacy')]);
  loop.dispatch(key('backspace'));
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('legacy');

  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('backspace'));
  loop.enableCommand(Commands.paste, false);
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('');
});

// A direct terminal PasteEvent remains a local canonical source when no native reader is configured.
test('no-reader direct PasteEvent adoption remains available to a later local paste command', () => {
  const { loop, probe } = mountProbe();

  loop.dispatch(paste('terminal text'));
  expect(inspectCanonical(loop, probe)).toBe('terminal text');
  expect(probe.pastes).toEqual([{ type: 'paste', text: 'terminal text', truncated: false }]);
});

// A configured Application writer remains authoritative during run and prevents OSC duplication.
test('Application run preserves its configured writer instead of installing OSC fallback', async () => {
  const value = signal('configured host');
  const inputView = new Input({ value });
  const writer: ClipboardTextWriter = vi.fn((_text: string) => undefined);
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  const app = createApplication({
    caps: clipboardCaps,
    content: inputView,
    viewport: { width: 30, height: 4 },
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    warnAmbiguousWidth: false,
    writeClipboardText: writer,
  });
  const runPromise = app.run();
  app.loop.focusView(inputView);

  app.loop.dispatch(key('a', { ctrl: true }));
  app.loop.dispatch(key('c', { ctrl: true }));

  expect(writer).toHaveBeenCalledOnce();
  expect(writer).toHaveBeenCalledWith('configured host');
  expect(output.data).not.toContain(osc52('configured host'));
  app.loop.emitCommand(Commands.quit);
  await runPromise;
});

// An Application with no writer still installs the capability-gated OSC fallback during run.
test('Application run without a writer retains capability-gated OSC fallback', async () => {
  const value = signal('terminal fallback');
  const inputView = new Input({ value });
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  const app = createApplication({
    caps: clipboardCaps,
    content: inputView,
    viewport: { width: 30, height: 4 },
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    warnAmbiguousWidth: false,
  });
  const runPromise = app.run();
  app.loop.focusView(inputView);

  app.loop.dispatch(key('a', { ctrl: true }));
  app.loop.dispatch(key('c', { ctrl: true }));

  expect(output.data).toContain(osc52('terminal fallback'));
  app.loop.emitCommand(Commands.quit);
  await runPromise;
});
