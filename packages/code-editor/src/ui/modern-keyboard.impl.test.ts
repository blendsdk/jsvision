import { Commands, type DispatchEvent } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

/** Creates one editor for keyboard edge-case coverage. */
function createEditor(
  text: string,
  readOnly = false,
): {
  readonly controller: ReturnType<typeof createCodeEditorController>;
  readonly editor: CodeEditor;
} {
  const controller = createCodeEditorController({
    document: createDocumentModel({ text, languageId: 'typescript', tabSize: 4, readOnly }),
  });
  return { controller, editor: new CodeEditor({ controller }) };
}

/** Creates the smallest direct command envelope needed by the view contract. */
function commandEvent(command: string, clipboard = ''): DispatchEvent {
  return {
    event: { type: 'command', command },
    handled: false,
    readClipboard: () => clipboard,
  };
}

describe('modern keyboard edge behavior', () => {
  it('excludes a trailing line when the selection ends at its start', () => {
    const { controller, editor } = createEditor('one\ntwo\nthree');
    controller.document.setSelection({ anchor: 0, head: 8 });

    editor.routeKey({ key: 'Tab' });

    expect(controller.document.text).toBe('    one\n    two\nthree');
  });

  it('preserves reverse selection direction through multiline indentation', () => {
    const { controller, editor } = createEditor('one\ntwo');
    controller.document.setSelection({ anchor: 7, head: 0 });

    editor.routeKey({ key: 'Tab' });

    expect(Number(controller.document.selection.anchor)).toBeGreaterThan(Number(controller.document.selection.head));
  });

  it('leaves a read-only document unchanged for mutating keyboard commands', () => {
    const { controller, editor } = createEditor('value', true);
    controller.document.setSelection({ anchor: 0, head: 5 });

    editor.routeKey({ key: 'Tab' });
    editor.routeKey({ key: '/', ctrl: true });
    editor.onEvent(commandEvent(Commands.cut));

    expect(controller.document.text).toBe('value');
    expect(controller.document.undoDepth).toBe(0);
  });

  it('consumes an empty clipboard paste without creating a revision', () => {
    const { controller, editor } = createEditor('value');
    const revision = controller.document.identity.revision;
    const event = commandEvent(Commands.paste);

    editor.onEvent(event);

    expect(event.handled).toBe(true);
    expect(controller.document.identity.revision).toBe(revision);
  });

  it('comments only nonblank selected lines at their shared indentation', () => {
    const { controller, editor } = createEditor('  one\n\n    two');
    controller.document.setSelection({ anchor: 0, head: controller.document.text.length });

    editor.routeKey({ key: '/', ctrl: true });

    expect(controller.document.text).toBe('  // one\n\n  //   two');
  });

  it('crosses punctuation and Unicode word runs in both directions without stalling', () => {
    const { controller, editor } = createEditor('foo.bar + λ');
    const positions: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      editor.routeKey({ key: 'ArrowRight', ctrl: true });
      positions.push(Number(controller.document.selection.head));
    }
    expect(positions).toEqual([3, 4, 8, 10, 11, 11]);

    editor.routeKey({ key: 'ArrowLeft', ctrl: true, shift: true });
    expect(controller.document.selection).toMatchObject({ anchor: 11, head: 10 });
    editor.routeKey({ key: 'ArrowLeft', ctrl: true });
    editor.routeKey({ key: 'ArrowLeft', ctrl: true });
    editor.routeKey({ key: 'ArrowLeft', ctrl: true });
    editor.routeKey({ key: 'ArrowLeft', ctrl: true });
    editor.routeKey({ key: 'ArrowLeft', ctrl: true });
    expect(Number(controller.document.selection.head)).toBe(0);
  });

  it('uses visual columns for smart tabs after tabs and wide graphemes', () => {
    for (const fixture of [
      { text: '\tvalue', caret: 1, expected: '\t    value' },
      { text: '界value', caret: 1, expected: '界  value' },
    ]) {
      const { controller, editor } = createEditor(fixture.text);
      controller.document.setSelection({ anchor: fixture.caret, head: fixture.caret });

      editor.routeKey({ key: 'Tab' });

      expect(controller.document.text).toBe(fixture.expected);
    }
  });

  it('dedents one visual level while preserving residual mixed whitespace', () => {
    const { controller, editor } = createEditor('\t  value');
    controller.document.setSelection({ anchor: 3, head: 3 });

    editor.routeKey({ key: 'Tab', shift: true });

    expect(controller.document.text).toBe('  value');
  });
});
