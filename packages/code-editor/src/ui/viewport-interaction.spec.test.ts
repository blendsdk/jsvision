import { createDecoderState, decode, resolveCapabilities, type MouseEvent, type WheelEvent } from '@jsvision/core';
import { createEventLoop, Group } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';
import { CodeEditorWindow } from './code-editor-window.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Creates a real mounted editor so input, layout, and repainting use the public event-loop path. */
function mountEditor(
  text: string,
  options: {
    readonly width?: number;
    readonly height?: number;
    readonly lineNumbers?: boolean;
    readonly languageId?: 'plain' | 'javascript' | 'typescript' | 'postgresql';
  } = {},
) {
  const width = options.width ?? 16;
  const height = options.height ?? 4;
  const controller = createCodeEditorController({
    document: createDocumentModel({
      text,
      languageId: options.languageId ?? 'typescript',
      tabSize: 4,
    }),
  });
  const editor = new CodeEditor({ controller, lineNumbers: options.lineNumbers });
  editor.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const root = new Group();
  root.add(editor);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.focusView(editor);
  return { controller, editor, loop, width, height };
}

/** Creates a left-button event in the terminal's one-based coordinate space. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Creates an unmodified vertical wheel event in one-based terminal coordinates. */
function wheel(dir: WheelEvent['dir'], x = 1, y = 1): WheelEvent {
  return { type: 'wheel', dir, x, y, shift: false, alt: false, ctrl: false };
}

/** Reads the visible terminal characters from the editor event loop. */
function visibleText(loop: ReturnType<typeof createEventLoop>): string {
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Returns the selected source text through the public document selection. */
function selectedText(controller: ReturnType<typeof createCodeEditorController>): string {
  const { anchor, head } = controller.document.selection;
  const from = Math.min(Number(anchor), Number(head));
  const to = Math.max(Number(anchor), Number(head));
  return controller.document.text.slice(from, to);
}

describe('viewport geometry and scrolling', () => {
  it('ST-01 re-fits reusable window chrome after both growing and shrinking', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({ text: 'one\ntwo\nthree', languageId: 'plain' }),
    });
    const window = new CodeEditorWindow({ controller });
    const root = new Group();
    root.add(window);
    const loop = createEventLoop({ width: 40, height: 12 }, { caps });
    window.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 10 } });
    loop.mount(root);

    for (const rect of [
      { x: 1, y: 1, width: 36, height: 10 },
      { x: 2, y: 1, width: 12, height: 6 },
    ]) {
      window.setLayout({ rect });
      window.onResized();
      loop.renderRoot.flush();

      expect(window.editor.layout.rect).toEqual({
        x: 1,
        y: 1,
        width: rect.width - 2,
        height: rect.height - 3,
      });
      expect(window.horizontalScrollBar.layout.rect).toEqual({
        x: 1,
        y: rect.height - 2,
        width: rect.width - 2,
        height: 1,
      });
      expect(window.verticalScrollBar.layout.rect).toEqual({
        x: rect.width - 1,
        y: 1,
        width: 1,
        height: rect.height - 3,
      });
      expect(window.statusView.layout.rect).toEqual({
        x: 1,
        y: rect.height - 1,
        width: rect.width - 2,
        height: 1,
      });
      for (const child of [window.editor, window.horizontalScrollBar, window.verticalScrollBar, window.statusView]) {
        const childRect = child.layout.rect;
        expect(childRect).toBeDefined();
        if (childRect === undefined) throw new Error('window chrome must use an absolute rectangle');
        expect(childRect.x + childRect.width).toBeLessThanOrEqual(rect.width);
        expect(childRect.y + childRect.height).toBeLessThanOrEqual(rect.height);
      }
    }
  });

  it('ST-02 updates visual and logical overflow ranges after editing and clamps stale offsets', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({ text: 'short', languageId: 'plain', tabSize: 4 }),
    });
    const window = new CodeEditorWindow({ controller, lineNumbers: true });
    window.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 8 } });
    const root = new Group();
    root.add(window);
    const loop = createEventLoop({ width: 16, height: 8 }, { caps });
    loop.mount(root);
    loop.focusView(window.editor);

    expect(window.editor.scroll.x()).toBe(0);
    expect(window.editor.scroll.y()).toBe(0);
    window.editor.routeKey({ key: 'a', ctrl: true });
    window.editor.insertText(`\t界${'x'.repeat(30)}\nline\nline\nline\nline\nline\nline`);
    window.editor.scroll.x.set(10_000);
    window.editor.scroll.y.set(10_000);
    loop.renderRoot.flush();

    expect(window.editor.scroll.x()).toBeGreaterThan(0);
    expect(window.editor.scroll.x()).toBeLessThan(10_000);
    expect(window.editor.scroll.y()).toBeGreaterThan(0);
    expect(window.editor.scroll.y()).toBeLessThan(10_000);

    window.editor.routeKey({ key: 'a', ctrl: true });
    window.editor.insertText('fits');
    loop.renderRoot.flush();
    expect(window.editor.scroll.x()).toBe(0);
    expect(window.editor.scroll.y()).toBe(0);
  });

  it('ST-03 repaints projected content for wheel and independent axis changes', () => {
    const { editor, loop } = mountEditor(
      ['zero-abcdefghijk', 'one-abcdefghijk', 'two-abcdefghijk', 'three-abcdefghijk', 'four-abcdefghijk'].join('\n'),
      { width: 10, height: 2 },
    );
    const initial = visibleText(loop);

    loop.dispatch(wheel('down'));
    expect(editor.scroll.y()).toBe(3);
    expect(editor.scroll.x()).toBe(0);
    expect(visibleText(loop)).not.toBe(initial);
    expect(visibleText(loop)).toContain('three');

    const verticalText = visibleText(loop);
    const verticalOffset = editor.scroll.y();
    editor.scroll.x.set(5);
    loop.renderRoot.flush();
    expect(editor.scroll.y()).toBe(verticalOffset);
    expect(visibleText(loop)).not.toBe(verticalText);
    expect(visibleText(loop)).toContain('abcdefgh');
  });
});

describe('caret-follow scrolling', () => {
  it('ST-04 minimally follows keyboard navigation, typing, history, search, and completion', () => {
    const { controller, editor, loop, width, height } = mountEditor(
      ['alpha', 'target', 'third', 'fourth', 'fifth', 'sixth'].join('\n'),
      { width: 9, height: 2 },
    );

    loop.dispatch({ type: 'key', key: 'end', ctrl: true, alt: false, shift: false });
    expect(editor.scroll.y()).toBe(4);
    expect(editor.desiredCaret()).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });

    loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
    loop.dispatch({ type: 'key', key: 'x', codepoint: 120, ctrl: false, alt: false, shift: false });
    expect(editor.scroll.y()).toBe(5);
    expect(editor.desiredCaret()?.x).toBeLessThan(width);
    expect(editor.desiredCaret()?.y).toBeLessThan(height);

    loop.dispatch({ type: 'key', key: 'z', ctrl: true, alt: false, shift: false });
    loop.dispatch({ type: 'key', key: 'y', ctrl: true, alt: false, shift: false });
    expect(editor.desiredCaret()).not.toBeNull();

    editor.setSearchQuery('target');
    editor.routeKey({ key: 'F3' });
    expect(selectedText(controller)).toBe('target');
    expect(editor.scroll.y()).toBeLessThanOrEqual(1);

    editor.openCompletion([{ label: 'replacement', insertText: 'replacement' }]);
    editor.routeKey({ key: 'Enter' });
    expect(editor.desiredCaret()).not.toBeNull();
  });
});

describe('mouse source selection', () => {
  it('ST-05 places the caret, captures drag selection, edge-scrolls, and stops on release', () => {
    const { controller, editor, loop } = mountEditor('alpha\nbravo\ncharlie\ndelta\necho', {
      width: 10,
      height: 3,
    });

    loop.dispatch(mouse('down', 3, 1));
    expect(controller.document.selection).toMatchObject({ anchor: 2, head: 2 });

    loop.dispatch(mouse('drag', 4, 2));
    expect(selectedText(controller)).toBe('pha\nbra');

    const beforeEdge = editor.scroll.y();
    loop.dispatch(mouse('drag', 4, 5));
    expect(editor.scroll.y()).toBe(beforeEdge + 1);
    expect(Number(controller.document.selection.head)).toBeGreaterThan(9);

    loop.dispatch(mouse('up', 4, 5));
    const released = controller.document.selection;
    loop.dispatch(mouse('drag', 1, 1));
    expect(controller.document.selection).toEqual(released);
  });

  it('ST-06 double-clicks Unicode identifiers and homogeneous punctuation with gutter and scroll offsets', () => {
    const identifier = mountEditor('xx αβ_gamma += value', {
      width: 18,
      height: 2,
      lineNumbers: true,
    });
    identifier.editor.scroll.x.set(2);
    identifier.loop.renderRoot.flush();

    identifier.loop.dispatch(mouse('down', 5, 1));
    identifier.loop.dispatch(mouse('up', 5, 1));
    identifier.loop.dispatch(mouse('down', 5, 1));
    expect(selectedText(identifier.controller)).toBe('αβ_gamma');

    const punctuation = mountEditor('value += other', { width: 18, height: 2 });
    punctuation.loop.dispatch(mouse('down', 7, 1));
    punctuation.loop.dispatch(mouse('up', 7, 1));
    punctuation.loop.dispatch(mouse('down', 7, 1));
    expect(selectedText(punctuation.controller)).toBe('+=');

    punctuation.loop.dispatch(mouse('down', 6, 1));
    punctuation.loop.dispatch(mouse('up', 6, 1));
    punctuation.loop.dispatch(mouse('down', 6, 1));
    expect(selectedText(punctuation.controller)).toBe('');
  });
});

describe('terminal input and hostile boundaries', () => {
  it('ST-07 routes raw Ctrl+/ through a mounted editor and toggles the selected comments', () => {
    const { controller, loop } = mountEditor('one\ntwo', {
      languageId: 'typescript',
      width: 20,
      height: 3,
    });
    controller.document.setSelection({ anchor: 0, head: 7 });
    const decoded = decode(Uint8Array.from([0x1f]), createDecoderState());

    expect(decoded.events).toHaveLength(1);
    expect(decoded.events[0]).toMatchObject({
      type: 'key',
      key: '/',
      ctrl: true,
      alt: false,
      shift: false,
    });
    const event = decoded.events[0];
    if (event !== undefined) loop.dispatch(event);
    expect(controller.document.text).toBe('// one\n// two');
  });

  it('ST-08 bounds hostile text, empty documents, narrow viewports, and extreme content extents', () => {
    const fixtures = ['', '\t界\u001b[31m\u0000', 'x'.repeat(20_000), `${'line\n'.repeat(20_000)}tail`];
    for (const text of fixtures) {
      const { controller, editor } = mountEditor(text, { width: 3, height: 1, lineNumbers: true });
      editor.scroll.x.set(Number.MAX_SAFE_INTEGER);
      editor.scroll.y.set(Number.MAX_SAFE_INTEGER);
      const frame = editor.project({ width: 3, height: 1, caps });
      expect(frame.cells).toHaveLength(1);
      expect(frame.cells[0]).toHaveLength(3);
      expect(frame.cells.flat().every((cell) => !/[\u0000-\u001f\u007f]/u.test(cell.text))).toBe(true);
      for (const cell of frame.cells.flat()) {
        if (cell.documentOffset !== undefined) {
          expect(cell.documentOffset).toBeGreaterThanOrEqual(0);
          expect(cell.documentOffset).toBeLessThanOrEqual(controller.document.text.length);
        }
      }
      expect(editor.scroll.x()).toBeGreaterThanOrEqual(0);
      expect(editor.scroll.y()).toBeGreaterThanOrEqual(0);
    }
  });
});
