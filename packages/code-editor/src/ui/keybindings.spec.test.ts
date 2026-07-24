import { describe, expect, it } from 'vitest';

import {
  CodeEditor,
  CodeEditorKeyBindingConflictError,
  createCodeEditorController,
  createDocumentModel,
} from '../index.js';

/** Creates a controller used to verify construction compatibility and key routing. */
function createController() {
  return createCodeEditorController({
    document: createDocumentModel({
      text: 'first\nsecond',
      uri: 'file:///workspace/keybindings.ts',
      languageId: 'typescript',
    }),
  });
}

describe('canonical keybinding registration', () => {
  it('should preserve valid legacy construction and public exports', () => {
    // Existing callers with a non-conflicting custom binding must remain source-compatible.
    const controller = createController();
    const editor = new CodeEditor({
      controller,
      keyBindings: { 'Ctrl+J': 'cursor.documentEnd' },
    });

    expect(editor.routeKey({ key: 'j', ctrl: true })).toEqual({ handled: true, owner: 'editor' });
    expect(Number(controller.document.selection.head)).toBe(controller.document.text.length);
    expect(CodeEditor).toBeTypeOf('function');
    expect(CodeEditorKeyBindingConflictError).toBeTypeOf('function');
  });

  it('should identify both commands when canonical bindings collide', () => {
    // Canonically equivalent bindings must fail with the displaced and incoming command names.
    expect(
      () =>
        new CodeEditor({
          controller: createController(),
          keyBindings: { 'ctrl+end': 'assist' },
        }),
    ).toThrowError(
      expect.objectContaining({
        name: 'CodeEditorKeyBindingConflictError',
        binding: 'Ctrl+End',
        existingCommand: 'cursor.documentEnd',
        incomingCommand: 'assist',
      }),
    );
  });

  it('should allow only an exact explicit displacement override', () => {
    // An override may displace only the exact command already registered on that canonical binding.
    const overriddenController = createController();
    const overridden = new CodeEditor({
      controller: overriddenController,
      keyBindings: { 'ctrl+end': 'assist' },
      keyBindingOverrides: { 'CTRL+END': 'cursor.documentEnd' },
    });
    expect(overridden.routeKey({ key: 'End', ctrl: true })).toEqual({ handled: true, owner: 'editor' });
    expect(overriddenController.metrics.assistanceRequests).toBe(1);

    expect(
      () =>
        new CodeEditor({
          controller: createController(),
          keyBindings: { 'Ctrl+End': 'assist' },
          keyBindingOverrides: { 'Ctrl+End': 'search.open' },
        }),
    ).toThrowError(CodeEditorKeyBindingConflictError);
  });
});
