import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

/** Creates an editor whose projected caret can be compared with its assistance popup. */
function createEditor(text: string, head: number): CodeEditor {
  const document = createDocumentModel({
    text,
    uri: 'file:///workspace/assistance.ts',
    languageId: 'typescript',
  });
  document.setSelection({ anchor: head, head });
  return new CodeEditor({
    controller: createCodeEditorController({ document }),
    lineNumbers: true,
  });
}

describe('caret-aware assistance placement', () => {
  it('should anchor below the projected caret after gutter and horizontal scrolling', () => {
    // Assistance must use the rendered caret cell, including gutter, tab, and scroll geometry.
    const editor = createEditor('\tconst exceptionallyLongName = value;', 10);
    editor.resizeViewport(30, 6);
    editor.scroll.x.set(8);
    const frame = editor.project({ width: 30, height: 6, caps });

    editor.openCompletion([{ label: 'completion', insertText: 'completion' }]);

    expect(frame.caret.visible).toBe(true);
    expect(editor.assistanceView.layout.rect).toMatchObject({
      x: frame.caret.x,
      y: frame.caret.y + 1,
    });
  });

  it('should flip above the caret when the popup does not fit below it', () => {
    // Assistance near the viewport bottom must remain fully visible without covering the caret.
    const text = 'first\nsecond\nthird\nfourth\nfifth\nsixth';
    const editor = createEditor(text, text.length);
    const frame = editor.project({ width: 24, height: 6, caps });

    editor.openCompletion([
      { label: 'alpha', insertText: 'alpha' },
      { label: 'beta', insertText: 'beta' },
    ]);

    const rect = editor.assistanceView.layout.rect;
    expect(frame.caret.y).toBe(5);
    expect(rect).toBeDefined();
    expect(rect?.y).toBe(frame.caret.y - (rect?.height ?? 0));
    expect((rect?.y ?? -1) + (rect?.height ?? 0)).toBeLessThanOrEqual(frame.caret.y);
  });

  it('should reposition and clamp the popup when the projected viewport changes', () => {
    // Resize and scroll changes must keep visible assistance inside the latest editor viewport.
    const editor = createEditor('const value = anotherVeryLongIdentifier;', 14);
    editor.project({ width: 30, height: 5, caps });
    editor.openCompletion([{ label: 'a rather long completion label', insertText: 'replacement' }]);

    const frame = editor.project({ width: 12, height: 3, caps });
    const rect = editor.assistanceView.layout.rect;

    expect(rect).toBeDefined();
    expect(rect?.x).toBe(Math.max(0, Math.min(frame.caret.x, 12 - (rect?.width ?? 0))));
    expect(rect?.x).toBeGreaterThanOrEqual(0);
    expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(12);
    expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(3);
  });
});
