/**
 * Specification tests for the explicit native-paste command boundary.
 *
 * Application handlers retain first refusal, a configured reader handles only otherwise-unconsumed
 * paste commands, active modal scope remains authoritative, and direct terminal paste events stay
 * separate from host reads.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { PasteEvent } from '@jsvision/core';
import { expect, test, vi } from 'vitest';

import { createApplication } from '../src/app/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { ClipboardTextReader } from '../src/index.js';
import type { Size2D } from '../src/layout/index.js';
import { Commands } from '../src/status/index.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

async function drainMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
}

class PasteProbe extends View {
  override focusable = true;
  readonly commands: string[] = [];
  readonly pastes: PasteEvent[] = [];
  readonly canonicalDuringPaste: string[] = [];

  override measure(available: Size2D): Size2D {
    return available;
  }

  draw(_ctx: DrawContext): void {}

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'paste') {
      this.pastes.push(ev.event);
      this.canonicalDuringPaste.push(ev.readClipboard?.() ?? '');
    } else if (ev.event.type === 'command') {
      this.commands.push(ev.event.command);
    }
  }
}

function mountProbe(reader?: ClipboardTextReader) {
  const probe = new PasteProbe();
  probe.setLayout({ size: { kind: 'fr', weight: 1 } });
  const root = new Group();
  root.add(probe);
  const loop = createEventLoop(
    { width: 30, height: 5 },
    {
      caps,
      commands: [...Object.values(Commands), 'ordinary-command'],
      readClipboardText: reader,
    },
  );
  loop.mount(root);
  loop.focusView(probe);
  return { loop, probe, root };
}

// An application-level paste handler consumes the command before any configured reader can run.
test('an existing Application paste handler retains interception precedence', async () => {
  const probe = new PasteProbe();
  const reader: ClipboardTextReader = vi.fn(async () => 'must not be read');
  const app = createApplication({
    caps,
    viewport: { width: 30, height: 5 },
    content: probe,
    readClipboardText: reader,
  });
  const handled = vi.fn();
  app.onCommand(Commands.paste, handled);
  app.loop.focusView(probe);

  app.loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(handled).toHaveBeenCalledOnce();
  expect(reader).not.toHaveBeenCalled();
  expect(probe.pastes).toHaveLength(0);
});

// An otherwise-unhandled explicit paste command invokes its configured reader exactly once.
test('an unhandled configured paste command starts exactly one native read', async () => {
  const reader: ClipboardTextReader = vi.fn(() => 'native text');
  const { loop, probe } = mountProbe(reader);

  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(reader).toHaveBeenCalledOnce();
  expect(probe.pastes.map((event) => event.text)).toEqual(['native text']);
});

// Configuring a reader affects only paste; unrelated command registration and delivery stay intact.
test('a configured reader leaves every non-paste command unchanged', async () => {
  const reader: ClipboardTextReader = vi.fn(() => 'unused');
  const { loop } = mountProbe(reader);
  const ordinary = vi.fn();
  loop.onCommand('ordinary-command', ordinary);

  loop.emitCommand('ordinary-command');
  await drainMicrotasks();

  expect(ordinary).toHaveBeenCalledOnce();
  expect(reader).not.toHaveBeenCalled();
});

// Reader installation makes paste available over an empty local clipboard; removal restores policy.
test('reader installation controls paste availability independently of empty canonical state', async () => {
  const reader: ClipboardTextReader = vi.fn(() => 'available');
  const { loop, probe } = mountProbe();
  loop.enableCommand(Commands.paste, false);
  expect(loop.isCommandEnabled(Commands.paste)).toBe(false);

  loop.readClipboardText = reader;
  expect(loop.isCommandEnabled(Commands.paste)).toBe(true);
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();
  expect(probe.pastes.map((event) => event.text)).toEqual(['available']);

  loop.readClipboardText = undefined;
  expect(loop.isCommandEnabled(Commands.paste)).toBe(false);
});

// While a modal is active, outer application handlers are inert and native paste targets the modal.
test('active modal scope owns an unhandled native paste command', async () => {
  const reader: ClipboardTextReader = vi.fn(async () => 'modal text');
  const outer = new PasteProbe();
  const modalLeaf = new PasteProbe();
  const modal = new Group();
  modal.add(modalLeaf);
  const root = new Group();
  root.add(outer);
  root.add(modal);
  const loop = createEventLoop(
    { width: 30, height: 8 },
    { caps, readClipboardText: reader, commands: Object.values(Commands) },
  );
  loop.mount(root);
  loop.focusView(outer);
  const appHandler = vi.fn();
  loop.onCommand(Commands.paste, appHandler);

  void loop.execView(modal);
  expect(loop.getFocused()).toBe(modalLeaf);
  loop.emitCommand(Commands.paste);
  await drainMicrotasks();

  expect(appHandler).not.toHaveBeenCalled();
  expect(reader).toHaveBeenCalledOnce();
  expect(outer.pastes).toHaveLength(0);
  expect(modalLeaf.pastes.map((event) => event.text)).toEqual(['modal text']);
});

// A decoded PasteEvent never calls the native reader and preserves its truncation bit end to end.
test('direct PasteEvent delivery stays separate from native reads and retains metadata', async () => {
  const reader: ClipboardTextReader = vi.fn(async () => 'reader text');
  const { loop, probe } = mountProbe(reader);
  const terminalPaste: PasteEvent = {
    type: 'paste',
    text: 'terminal bracketed text',
    truncated: true,
  };

  loop.dispatch(terminalPaste);
  await drainMicrotasks();

  expect(reader).not.toHaveBeenCalled();
  expect(probe.pastes).toEqual([terminalPaste]);
  expect(probe.canonicalDuringPaste).toEqual(['terminal bracketed text']);
});
