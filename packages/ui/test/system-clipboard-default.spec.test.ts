/**
 * Specification tests for zero-configuration system clipboard integration.
 *
 * A real terminal application enables native text copy and paste when `run()` starts. Applications
 * can explicitly opt out, and applications that provide their own host callbacks retain complete
 * control over the clipboard boundary.
 */
import { resolveCapabilities } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { createApplication } from '../src/app/index.js';
import { Editor } from '../src/editor/index.js';
import type { ClipboardTextReader, ClipboardTextWriter } from '../src/event/index.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './app-shell.fixtures.js';

const nativeClipboard = vi.hoisted(() => ({
  reads: [] as string[],
  writes: [] as string[],
}));

vi.mock('clipboardy', () => ({
  default: {
    read: vi.fn(async () => nativeClipboard.reads.shift() ?? ''),
    write: vi.fn(async (text: string) => {
      nativeClipboard.writes.push(text);
    }),
  },
}));

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', altScreen: true },
}).profile;

/** Advance clipboard adapter promise continuations without adding a timer. */
async function drainMicrotasks(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

/** Create an application backed by deterministic TTY and runtime doubles. */
function createTtyApplication(
  options: {
    readonly systemClipboard?: boolean;
    readonly readClipboardText?: ClipboardTextReader;
    readonly writeClipboardText?: ClipboardTextWriter;
  } = {},
) {
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  input.isTTY = true;
  output.isTTY = true;
  const editor = new Editor();
  editor.setText('copy café 😀');
  const app = createApplication({
    caps,
    content: editor,
    viewport: { width: 40, height: 5 },
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    warnAmbiguousWidth: false,
    ...options,
  });
  app.loop.focusView(editor);
  return { app, editor, input, output };
}

test('run enables exact native copy and paste without application clipboard configuration', async () => {
  nativeClipboard.reads.splice(0, nativeClipboard.reads.length, 'desktop\r\n第二行');
  nativeClipboard.writes.splice(0);
  const { app, editor } = createTtyApplication();
  const running = app.run();

  editor.execute('selectAll');
  app.loop.dispatch({ type: 'key', key: 'c', ctrl: true, alt: false, shift: false });
  app.loop.dispatch({ type: 'key', key: 'v', ctrl: true, alt: false, shift: false });
  await drainMicrotasks();

  expect(nativeClipboard.writes).toEqual(['copy café 😀']);
  expect(editor.getText()).toBe('desktop\n第二行');

  app.loop.emitCommand('quit');
  await running;
});

test('systemClipboard false preserves local and terminal fallback without installing a native reader', async () => {
  const { app } = createTtyApplication({ systemClipboard: false });
  const running = app.run();

  expect(app.loop.readClipboardText).toBeUndefined();

  app.loop.emitCommand('quit');
  await running;
});

test('explicit host callbacks take precedence over the automatic system clipboard pair', async () => {
  const readClipboardText: ClipboardTextReader = vi.fn(async () => 'custom');
  const writeClipboardText: ClipboardTextWriter = vi.fn(async (_text) => undefined);
  const { app } = createTtyApplication({ readClipboardText, writeClipboardText });
  const running = app.run();

  expect(app.loop.readClipboardText).toBe(readClipboardText);
  expect(app.loop.writeClipboardText).toBe(writeClipboardText);

  app.loop.emitCommand('quit');
  await running;
});

test('an explicit reader alone suppresses the automatic system clipboard pair', async () => {
  const readClipboardText: ClipboardTextReader = vi.fn(async () => 'custom');
  nativeClipboard.writes.splice(0);
  const { app, editor } = createTtyApplication({ readClipboardText });
  const running = app.run();

  expect(app.loop.readClipboardText).toBe(readClipboardText);
  editor.execute('selectAll');
  app.loop.dispatch({ type: 'key', key: 'c', ctrl: true, alt: false, shift: false });
  await drainMicrotasks();
  expect(nativeClipboard.writes).toEqual([]);

  app.loop.emitCommand('quit');
  await running;
});

test('an explicit writer alone suppresses the automatic system clipboard pair', async () => {
  const writeClipboardText: ClipboardTextWriter = vi.fn(async (_text) => undefined);
  const { app } = createTtyApplication({ writeClipboardText });
  const running = app.run();

  expect(app.loop.readClipboardText).toBeUndefined();
  expect(app.loop.writeClipboardText).toBe(writeClipboardText);

  app.loop.emitCommand('quit');
  await running;
});

test('a failed non-TTY launch does not install automatic clipboard callbacks', async () => {
  const { app, input, output } = createTtyApplication();
  input.isTTY = false;
  output.isTTY = false;

  await expect(app.run()).rejects.toThrow(/interactive TTY/);
  expect(app.loop.readClipboardText).toBeUndefined();
  expect(app.loop.writeClipboardText).toBeUndefined();
});
