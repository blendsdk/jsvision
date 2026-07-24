import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: '16' },
}).profile;

/** Creates a standalone editor for direct viewport-state inspection. */
function editor(text: string, options: { readonly lineNumbers?: boolean; readonly tabSize?: number } = {}): CodeEditor {
  return new CodeEditor({
    controller: createCodeEditorController({
      document: createDocumentModel({
        text,
        languageId: 'plain',
        tabSize: options.tabSize ?? 4,
      }),
    }),
    lineNumbers: options.lineNumbers,
  });
}

describe('viewport implementation edges', () => {
  it('reports gutter-aware exact ranges and clamps them after document shrink', () => {
    const view = editor('0123456789\nsecond', { lineNumbers: true });
    view.project({ width: 11, height: 2, caps });

    expect(view.viewportMetrics).toMatchObject({
      gutterWidth: 3,
      textWidth: 8,
      maxScrollX: 3,
      maxScrollY: 0,
    });

    view.scroll.x.set(3);
    view.controller.document.setSelection({ anchor: 0, head: view.controller.document.text.length });
    view.insertText('fit');
    expect(view.viewportMetrics.maxScrollX).toBe(0);
    expect(view.scroll.x()).toBe(0);
  });

  it('preserves manual scrolling until a caret-changing action requests tracking', () => {
    const view = editor('zero\none\ntwo\nthree\nfour');
    view.project({ width: 8, height: 2, caps });
    view.scroll.y.set(3);
    view.project({ width: 8, height: 2, caps });
    expect(view.scroll.y()).toBe(3);

    view.routeKey({ key: 'ArrowDown' });
    expect(view.scroll.y()).toBe(1);
    view.project({ width: 8, height: 2, caps });
    expect(view.desiredCaret()).not.toBeNull();
  });

  it('rejects invalid host dimensions without corrupting prior viewport metrics', () => {
    const view = editor('source');
    view.resizeViewport(20, 4);
    const before = view.viewportMetrics;

    expect(() => view.resizeViewport(-1, 4)).toThrow(RangeError);
    expect(() => view.resizeViewport(20, 501)).toThrow(RangeError);
    expect(view.viewportMetrics).toEqual(before);
  });

  it('leaves selection and event ownership unchanged for non-primary mouse buttons', () => {
    const view = editor('source text');
    view.project({ width: 20, height: 2, caps });
    const before = view.controller.document.selection;
    const event = {
      event: { type: 'mouse', kind: 'down', button: 2, x: 3, y: 1 } as const,
      handled: false,
      local: { x: 2, y: 0 },
    };

    view.onEvent(event);

    expect(event.handled).toBe(false);
    expect(view.controller.document.selection).toEqual(before);
  });

  it('keeps Unicode projection, caret geometry, and horizontal ranges on one cell model', () => {
    const view = editor(`—e\u0301👩‍💻x`);
    view.project({ width: 4, height: 1, caps });

    expect(view.viewportMetrics.maxScrollX).toBe(2);
    view.execute('cursor.documentEnd');
    const frame = view.project({ width: 4, height: 1, caps });

    expect(view.scroll.x()).toBe(2);
    expect(frame.caret).toMatchObject({ visible: true, x: 3, y: 0 });
    expect(frame.cells[0]?.filter((cell) => cell.documentOffset !== undefined)).toHaveLength(3);
  });

  it('edge-scrolls a captured gutter selection one visual cell per left drag', () => {
    const view = editor('0123456789abcdefghij', { lineNumbers: true });
    view.project({ width: 12, height: 2, caps });
    view.scroll.x.set(10);
    view.project({ width: 12, height: 2, caps });
    let captured = false;

    view.onEvent({
      event: { type: 'mouse', kind: 'down', button: 0, x: 9, y: 1 },
      handled: false,
      local: { x: 8, y: 0 },
      setCapture: () => {
        captured = true;
      },
    });
    view.onEvent({
      event: { type: 'mouse', kind: 'drag', button: 0, x: 0, y: 1 },
      handled: false,
      local: { x: -1, y: 0 },
      hasCapture: () => captured,
    });

    expect(view.scroll.x()).toBe(9);
    expect(Number(view.controller.document.selection.head)).toBe(9);
    expect(Number(view.controller.document.selection.anchor)).toBeGreaterThan(9);

    view.onEvent({
      event: { type: 'mouse', kind: 'up', button: 0, x: 0, y: 1 },
      handled: false,
      local: { x: -1, y: 0 },
      releaseCapture: () => {
        captured = false;
      },
    });
    expect(captured).toBe(false);
  });
});
