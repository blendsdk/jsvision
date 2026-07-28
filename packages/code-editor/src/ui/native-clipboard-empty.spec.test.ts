/**
 * Specification test for a successful empty native read in CodeEditor.
 *
 * Native delivery uses the ordinary paste route, but an empty result clears stale canonical text
 * without replacing the active selection or creating document work.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createEventLoop, Group, View } from '@jsvision/ui';
import type { ClipboardTextReader, DispatchEvent, DrawContext, Size2D } from '@jsvision/ui';
import { expect, test, vi } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

async function drainMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

class ClipboardProbe extends View {
  override focusable = true;
  canonical = '';

  override measure(available: Size2D): Size2D {
    return available;
  }

  draw(_ctx: DrawContext): void {}

  override onEvent(ev: DispatchEvent): void {
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

// A successful empty native result preserves CodeEditor text, selection, history, and side effects.
test('successful empty native read is a mutation-free CodeEditor insertion and clears canonical text', async () => {
  const document = createDocumentModel({
    text: 'const preserved = true;',
    languageId: 'typescript',
    tabSize: 4,
  });
  document.setSelection({ anchor: 6, head: 15 });
  const controller = createCodeEditorController({ document });
  const onDocumentChange = vi.fn();
  const editor = new CodeEditor({ controller, onDocumentChange });
  const clipboard = new ClipboardProbe();
  const root = new Group();
  root.add(editor);
  root.add(clipboard);
  const reader: ClipboardTextReader = vi.fn(async () => '');
  const loop = createEventLoop(
    { width: 40, height: 8 },
    {
      caps,
      readClipboardText: reader,
      commands: ['paste', 'seed-clipboard', 'inspect-clipboard'],
    },
  );
  loop.mount(root);
  loop.focusView(clipboard);
  loop.emitCommand('seed-clipboard', 'stale local text');
  loop.focusView(editor);
  const before = {
    text: document.text,
    selection: document.selection,
    revision: document.snapshot.revision,
    undoDepth: document.undoDepth,
    redoDepth: document.redoDepth,
    parserRuns: controller.metrics.parserRuns,
    lspRequests: controller.metrics.lspRequests,
    assistanceRequests: controller.metrics.assistanceRequests,
  };
  const invalidate = vi.spyOn(editor, 'invalidate');

  loop.emitCommand('paste');
  await drainMicrotasks();

  expect({
    text: document.text,
    selection: document.selection,
    revision: document.snapshot.revision,
    undoDepth: document.undoDepth,
    redoDepth: document.redoDepth,
    parserRuns: controller.metrics.parserRuns,
    lspRequests: controller.metrics.lspRequests,
    assistanceRequests: controller.metrics.assistanceRequests,
  }).toEqual(before);
  expect(reader).toHaveBeenCalledOnce();
  expect(onDocumentChange).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  loop.focusView(clipboard);
  loop.emitCommand('inspect-clipboard');
  expect(clipboard.canonical).toBe('');
});
