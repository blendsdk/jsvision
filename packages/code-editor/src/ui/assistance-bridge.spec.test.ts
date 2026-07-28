import { describe, expect, it } from 'vitest';

import { CodeEditor, createCodeEditorController, createDocumentModel } from '../index.js';

/** Creates a focused editor through the package's public construction APIs. */
function createEditor(text = 'con') {
  const controller = createCodeEditorController({
    document: createDocumentModel({
      text,
      uri: 'file:///workspace/assistance.ts',
      languageId: 'typescript',
    }),
  });
  const editor = new CodeEditor({ controller });
  editor.focus();
  return { controller, editor };
}

describe('shared assistance presentation', () => {
  it('should bound and sanitize manual completion in the authoritative popup model', () => {
    // Manual completion must retain only bounded inert rows in the same presentation used by providers.
    const { controller } = createEditor();
    const hostileItems = Array.from({ length: 40 }, (_, index) => ({
      label: `candidate-${index}\u001B[2J\u0007`,
      detail: `<img src="file:///secret-${index}">`,
      insertText: `candidate${index}`,
    }));

    controller.openCompletion(hostileItems);

    const completion = controller.presentation.assistance.completion;
    expect(completion?.items).toHaveLength(12);
    expect(JSON.stringify(completion)).not.toMatch(/\u001B|\u0007/);
    expect(completion?.selected).toBe(0);
  });

  it('should give manual and compatibility completion identical navigation and dismissal', () => {
    // The legacy view method must delegate to the controller model without creating parallel popup state.
    const { controller, editor } = createEditor();
    const items = [
      { label: 'console', insertText: 'console' },
      { label: 'constant', insertText: 'constant' },
    ];

    editor.openCompletion(items);
    const compatibilitySnapshot = controller.presentation;
    expect(compatibilitySnapshot.assistance.completion?.items.map((item) => item.label)).toEqual([
      'console',
      'constant',
    ]);
    expect(editor.routeKey({ key: 'ArrowDown' })).toEqual({ handled: true, owner: 'completion' });
    expect(controller.presentation.assistance.completion?.selected).toBe(1);
    expect(editor.routeKey({ key: 'Escape' })).toEqual({ handled: true, owner: 'dismissal' });
    expect(controller.presentation.assistance.completion).toBeUndefined();
    expect(editor.focusState).toBe('focused');

    controller.openCompletion(items);
    expect(controller.presentation.assistance.completion?.items).toEqual(
      compatibilitySnapshot.assistance.completion?.items,
    );
    controller.dismissAssistance();
    expect(controller.presentation.assistance.completion).toBeUndefined();
    expect(editor.focusState).toBe('focused');
  });
});
