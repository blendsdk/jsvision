import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';
import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';
import { CodeEditorWindow } from './code-editor-window.js';
import { projectCodeEditor } from './projection.js';

const caps = resolveCapabilities({
  override: { colorDepth: '16', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

function editor(text = 'one\ntwo') {
  return new CodeEditor({
    controller: createCodeEditorController({
      document: createDocumentModel({ text, languageId: 'javascript', uri: 'file:///frame.js' }),
    }),
  });
}

describe('CodeEditor terminal implementation', () => {
  it('produces deterministic clipped frames across resize and hostile controls', () => {
    const view = editor('a\u001b[31m\t界\nsecond');
    view.focus();
    const first = view.project({ width: 8, height: 2, caps });
    const repeated = view.project({ width: 8, height: 2, caps });
    const narrow = view.project({ width: 2, height: 1, caps });

    expect(repeated.cells).toEqual(first.cells);
    expect(repeated.caret).toEqual(first.caret);
    expect(repeated.cellSignature).toBe(first.cellSignature);
    expect(narrow.cells).toHaveLength(1);
    expect(narrow.cells[0]).toHaveLength(2);
    expect(first.cells.flat().every((cell) => !/[\u0000-\u001f\u007f]/u.test(cell.text))).toBe(true);
  });

  it('shows a fixed one-based gutter while preserving narrow-editor text space', () => {
    const view = new CodeEditor({
      controller: createCodeEditorController({
        document: createDocumentModel({ text: 'first\nsecond', languageId: 'plain', uri: 'file:///gutter.txt' }),
      }),
      lineNumbers: true,
    });
    const normal = view.project({ width: 20, height: 2, caps });
    const narrow = view.project({ width: 5, height: 1, caps });

    expect(
      normal.cells[0]
        ?.slice(0, 3)
        .map((cell) => cell.text)
        .join(''),
    ).toBe('1 >');
    expect(
      normal.cells[1]
        ?.slice(0, 3)
        .map((cell) => cell.text)
        .join(''),
    ).toBe('2 │');
    expect(normal.cellAtDocumentOffset(0)?.text).toBe('f');
    expect(normal.caret.x).toBe(3);
    expect(narrow.cells[0]?.map((cell) => cell.text).join('')).toBe('first');
  });

  it('keeps command bindings replaceable and restores editor routing after dismissal', () => {
    const view = new CodeEditor({
      controller: createCodeEditorController({ document: createDocumentModel({ text: 'x' }) }),
      keyBindings: { 'Ctrl+K': 'cursor.documentEnd' },
    });
    view.openModal({ kind: 'chooser' });

    expect(view.routeKey({ key: 'Escape' }).owner).toBe('dismissal');
    expect(view.routeKey({ key: 'k', ctrl: true }).owner).toBe('editor');
    expect(view.routeKey({ key: 'z', text: 'z' }).owner).toBe('text');
    expect(view.controller.document.text).toBe('xz');
  });

  it('accepts lowercase terminal key names for ordinary editing and navigation', () => {
    const view = editor('ab');

    view.routeKey({ key: 'right' });
    view.routeKey({ key: ' ', text: ' ' });
    view.routeKey({ key: 'enter' });
    view.routeKey({ key: 'tab' });
    view.routeKey({ key: 'backspace' });
    view.routeKey({ key: 'left' });
    view.routeKey({ key: 'delete' });

    expect(view.controller.document.text).toBe('a \n  b');
    expect(Number(view.controller.document.selection.head)).toBe(5);
  });

  it('drops syntax spans as soon as an edit makes their document identity stale', () => {
    const view = editor('const value = 1;');
    const identity = view.controller.document.identity;
    view.controller.setLanguageResult({
      identity,
      adapterId: 'test',
      generation: 1,
      state: 'ready',
      syntax: [{ from: 0, to: 5, category: 'keyword' }],
      folds: [],
      brackets: [],
    });

    expect(view.controller.languageResult?.syntax).toHaveLength(1);
    view.routeKey({ key: 'space' });

    expect(view.controller.document.text.startsWith(' ')).toBe(true);
    expect(view.controller.languageResult).toBeUndefined();
  });

  it('bounds completion and snippet input without consuming unrelated keys', () => {
    const view = editor('word');
    view.openCompletion(
      Array.from({ length: 600 }, (_, index) => ({ label: `item-${index}`, insertText: 'accepted' })),
    );
    expect(view.routeKey({ key: 'Enter' }).owner).toBe('completion');
    view.startSnippet(Array.from({ length: 200 }, () => ({ from: 0, to: 0 })));
    expect(view.routeKey({ key: 'Tab' }).owner).toBe('snippet');
    expect(view.routeKey({ key: 'F9' })).toEqual({ handled: false, owner: 'unhandled' });
  });

  it('rejects oversized frames and visualizes C1 controls', () => {
    const view = editor(`safe\u009b31m`);
    expect(() => projectCodeEditor({ controller: view.controller, width: 2_000, height: 500, caps })).toThrow(
      /cell limit/u,
    );
    const frame = view.project({ width: 16, height: 1, caps });
    expect(frame.cells.flat().some((cell) => cell.text === '\u009b')).toBe(false);
  });

  it('snapshots hostile completion items without invoking getters', () => {
    const view = editor('word');
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'label', {
      enumerable: true,
      get() {
        throw new Error('must not execute');
      },
    });
    expect(() => view.openCompletion([hostile as never])).not.toThrow();
    expect(view.routeKey({ key: 'Enter' }).owner).toBe('completion');
    expect(view.controller.document.text).toBe('word');
  });

  it('composes actual window chrome and keeps large-document viewport work bounded', () => {
    const text = `${'line\n'.repeat(50_000)}tail`;
    const controller = createCodeEditorController({
      document: createDocumentModel({ text, languageId: 'plain' }),
    });
    controller.document.setSelection({ anchor: text.length, head: text.length });
    const window = new CodeEditorWindow({ controller });
    expect(window.children).toEqual(
      expect.arrayContaining([window.editor, window.horizontalScrollBar, window.verticalScrollBar, window.statusView]),
    );
    const started = performance.now();
    window.editor.project({ width: 120, height: 30, caps });
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('contains rejected host callbacks and retains focus after denied close', async () => {
    const view = new CodeEditor({
      controller: createCodeEditorController({
        document: createDocumentModel({ text: 'x' }),
        host: async () => {
          throw new Error('host failure');
        },
      }),
    });
    view.focus();
    view.execute('close');
    await view.whenIdle();
    expect(view.focusState).toBe('focused');
  });
});
