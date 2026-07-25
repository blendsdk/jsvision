import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
} from '../index.js';
import { CodeEditorAssistanceView } from './assistance.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

describe('assistance placement implementation', () => {
  it('should restore the preferred popup size after a narrow viewport expands', () => {
    const popup = new CodeEditorAssistanceView();
    popup.show(['a completion label that needs space']);
    const preferredWidth = popup.layout.rect?.width;

    popup.placeAtCaret({ x: 3, y: 1 }, { width: 10, height: 3 });
    expect(popup.layout.rect).toMatchObject({ width: 10, height: 3 });

    popup.placeAtCaret({ x: 3, y: 1 }, { width: 50, height: 10 });
    expect(popup.layout.rect).toMatchObject({ x: 3, y: 2, width: preferredWidth, height: 3 });
  });

  it('should place an asynchronous completion from the latest projected viewport', async () => {
    const uri = 'file:///workspace/async-placement.ts';
    const text = 'first\nsecond\nthird\nfourth';
    const document = createDocumentModel({ text, uri, languageId: 'typescript' });
    document.setSelection({ anchor: text.length, head: text.length });
    const session = createInProcessLspSession({ capabilities: { completion: true } });
    const coordinator = createCodeEditorLspCoordinator({ document, session, uri, languageId: 'typescript' });
    const editor = new CodeEditor({
      controller: createCodeEditorController({ document, lsp: coordinator }),
      lineNumbers: true,
    });
    await coordinator.open();

    editor.project({ width: 50, height: 10, caps });
    const completion = coordinator.requestCompletion({ line: 3, character: 6 });
    const latestFrame = editor.project({ width: 30, height: 4, caps });
    session.respond(completion.requestId, {
      items: [{ label: 'latestCompletion', insertText: 'latestCompletion' }],
    });
    await completion.settled;

    const rect = editor.assistanceView.layout.rect;
    expect(editor.assistanceView.state.visible).toBe(true);
    expect(rect).toMatchObject({
      x: latestFrame.caret.x,
      y: latestFrame.caret.y - (rect?.height ?? 0),
    });
    expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(30);
    expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(4);
  });
});
