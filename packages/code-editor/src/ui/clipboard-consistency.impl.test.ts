/**
 * Implementation coverage for CodeEditor integration with the visible clipboard projection.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Commands, Editor, Group, createEventLoop } from '@jsvision/ui';
import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

test('CodeEditor copy immediately refreshes a mounted clipboard projection', () => {
  const clipboard = new Editor();
  const projectionHost = new Editor({ clipboard });
  const controller = createCodeEditorController({
    document: createDocumentModel({ text: 'copied', languageId: 'typescript', tabSize: 4 }),
  });
  const codeEditor = new CodeEditor({ controller });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  projectionHost.setLayout({ size: { kind: 'fixed', cells: 1 } });
  codeEditor.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(projectionHost);
  root.add(codeEditor);
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const loop = createEventLoop({ width: 40, height: 8 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(codeEditor);
  loop.enableCommand(Commands.copy, true);
  controller.document.setSelection({ anchor: 0, head: 6 });
  expect(loop.getFocused()).toBe(codeEditor);
  expect(controller.document.selection).toEqual({ anchor: 0, head: 6 });

  loop.dispatch({ type: 'command', command: Commands.copy });

  expect(clipboard.getText()).toBe('copied');
  expect(clipboard.selectionText()).toBe('copied');
});
