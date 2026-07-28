/**
 * Specification tests for empty external paste events in the code editor.
 *
 * A delivered empty paste is routed normally but does not become a document mutation, even when
 * the active selection would be replaced by non-empty inserted text.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { PasteEvent } from '@jsvision/core';
import { createEventLoop, Group } from '@jsvision/ui';
import { expect, test, vi } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

function emptyPaste(): PasteEvent {
  return { type: 'paste', text: '', truncated: false };
}

function mountSelectedEditor() {
  const document = createDocumentModel({
    text: 'const preserved = true;',
    languageId: 'typescript',
    tabSize: 4,
  });
  document.setSelection({ anchor: 6, head: 15 });
  const controller = createCodeEditorController({ document });
  const onDocumentChange = vi.fn();
  const editor = new CodeEditor({ controller, onDocumentChange });
  const root = new Group();
  root.add(editor);
  const loop = createEventLoop(
    { width: 40, height: 8 },
    {
      caps,
      scheduleMicrotask: () => undefined,
    },
  );
  loop.mount(root);
  loop.focusView(editor);
  return { controller, document, editor, loop, onDocumentChange };
}

// Empty paste over a code selection preserves the document transaction state and causes no repaint.
test('CodeEditor treats empty paste over a selection as a mutation-free insertion no-op', () => {
  const { controller, document, editor, loop, onDocumentChange } = mountSelectedEditor();
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

  loop.dispatch(emptyPaste());

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
  expect(onDocumentChange).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
});
