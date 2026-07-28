import { describe, expect, it, vi } from 'vitest';

import { CodeEditor, createCodeEditorController, createDocumentModel } from '../index.js';

/** Creates a focused real editor without any provider or host dependencies. */
function createSearchHarness(
  text: string,
  options: {
    readonly readOnly?: boolean;
    readonly limits?: {
      readonly documentBytes?: number;
      readonly editsPerTransaction?: number;
      readonly replacementBytes?: number;
    };
  } = {},
) {
  const document = createDocumentModel({
    text,
    uri: 'file:///workspace/search.txt',
    languageId: 'plain',
    readOnly: options.readOnly,
    limits: options.limits
      ? {
          ...(options.limits.documentBytes === undefined ? {} : { maxDocumentBytes: options.limits.documentBytes }),
          ...(options.limits.editsPerTransaction === undefined
            ? {}
            : { maxEditsPerTransaction: options.limits.editsPerTransaction }),
        }
      : undefined,
  });
  const controller = createCodeEditorController({ document, limits: options.limits });
  const editor = new CodeEditor({ controller });
  editor.focus();
  return { controller, document, editor };
}

function selectedText(document: ReturnType<typeof createDocumentModel>) {
  const from = Math.min(Number(document.selection.anchor), Number(document.selection.head));
  const to = Math.max(Number(document.selection.anchor), Number(document.selection.head));
  return document.text.slice(from, to);
}

function enterText(editor: CodeEditor, text: string) {
  for (const character of text) {
    expect(editor.routeKey({ key: character, text: character })).toMatchObject({ handled: true });
  }
}

describe('keyboard search', () => {
  it('accepts literal keyboard text, cycles both directions, and wraps without losing the query', () => {
    // Search treats punctuation as inert literal text and cycles over the bounded match set.
    const { document, editor } = createSearchHarness('a.* middle a.*');

    expect(editor.routeKey({ key: 'f', ctrl: true })).toEqual({ handled: true, owner: 'editor' });
    enterText(editor, 'a.*');
    expect(editor.searchState).toEqual({
      open: true,
      replace: false,
      activeField: 'query',
      query: 'a.*',
      replacement: '',
      caseSensitive: false,
      current: 1,
      total: 2,
    });

    editor.routeKey({ key: 'Enter' });
    const afterFirstNext = document.selection;
    expect(selectedText(document)).toBe('a.*');
    editor.routeKey({ key: 'F3' });
    const afterSecondNext = document.selection;
    expect(selectedText(document)).toBe('a.*');
    expect(afterSecondNext).not.toEqual(afterFirstNext);
    editor.routeKey({ key: 'F3' });
    expect(document.selection).toEqual(afterFirstNext);

    editor.routeKey({ key: 'F3', shift: true });
    expect(document.selection).toEqual(afterSecondNext);
    editor.routeKey({ key: 'Enter', shift: true });
    expect(document.selection).toEqual(afterFirstNext);
    expect(editor.searchState.query).toBe('a.*');
  });

  it('keeps absent and empty searches inert, then dismisses to editor focus with Escape', () => {
    // Navigation without a query changes no document state, while dismissal restores text input to the editor.
    const { document, editor } = createSearchHarness('alpha beta');
    const beforeMissing = {
      selection: document.selection,
      revision: document.identity.revision,
      undoDepth: document.undoDepth,
    };
    editor.execute('search.next');
    editor.execute('search.previous');
    expect({
      selection: document.selection,
      revision: document.identity.revision,
      undoDepth: document.undoDepth,
    }).toEqual(beforeMissing);

    editor.routeKey({ key: 'f', ctrl: true });
    editor.routeKey({ key: 'Enter' });
    editor.routeKey({ key: 'Enter', shift: true });
    expect({
      selection: document.selection,
      revision: document.identity.revision,
      undoDepth: document.undoDepth,
    }).toEqual(beforeMissing);

    expect(editor.routeKey({ key: 'Escape' })).toMatchObject({ handled: true });
    expect(editor.searchState.open).toBe(false);
    expect(editor.focusState).toBe('focused');
    expect(editor.routeKey({ key: '!', text: '!' })).toEqual({ handled: true, owner: 'text' });
    expect(document.text).toBe('!alpha beta');
  });

  it('routes replace-modal fields and preserves the documented default bindings', () => {
    // Replace search owns field editing and traversal while replacement commands remain independently callable.
    const { editor } = createSearchHarness('foo foo');

    expect(editor.routeKey({ key: 'h', ctrl: true })).toMatchObject({ handled: true });
    enterText(editor, 'foo');
    expect(editor.routeKey({ key: 'Tab' })).toMatchObject({ handled: true });
    enterText(editor, 'bar');
    expect(editor.searchState).toMatchObject({
      open: true,
      replace: true,
      activeField: 'replacement',
      query: 'foo',
      replacement: 'bar',
    });
    expect(editor.routeKey({ key: 'Backspace' })).toMatchObject({ handled: true });
    expect(editor.searchState.replacement).toBe('ba');
    expect(editor.routeKey({ key: 'Tab', shift: true })).toMatchObject({ handled: true });
    expect(editor.searchState.activeField).toBe('query');

    expect(() => editor.execute('search.replaceCurrent')).not.toThrow();
    expect(() => editor.execute('search.replaceAll')).not.toThrow();
    expect(() => editor.execute('search.dismiss')).not.toThrow();
    expect(() => editor.execute('search.replaceOpen')).not.toThrow();
  });

  it('keeps the published search snapshot immutable and retains query setter compatibility', () => {
    // Search state is an immutable public snapshot regardless of whether text came from the setter or keyboard.
    const { editor } = createSearchHarness('Alpha alpha');
    editor.execute('search.open');
    editor.setSearchQuery('alpha');
    editor.setReplacementText('omega');
    editor.setSearchCaseSensitive(true);

    const snapshot = editor.searchState;
    expect(snapshot).toMatchObject({
      open: true,
      query: 'alpha',
      replacement: 'omega',
      caseSensitive: true,
      total: 1,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    editor.setSearchCaseSensitive(false);
    expect(snapshot.caseSensitive).toBe(true);
    expect(editor.searchState.total).toBe(2);
  });
});

describe('bounded replacement', () => {
  it('replaces only the selected current match', () => {
    // Replacing the current result leaves every other literal occurrence unchanged.
    const { document, editor } = createSearchHarness('foo one foo two foo');
    editor.execute('search.replaceOpen');
    editor.setSearchQuery('foo');
    editor.setReplacementText('BAR');
    editor.execute('search.next');
    const selected = document.selection;

    editor.execute('search.replaceCurrent');

    expect(document.text.match(/BAR/g)).toHaveLength(1);
    expect(document.text.match(/foo/g)).toHaveLength(2);
    const selectedFrom = Math.min(Number(selected.anchor), Number(selected.head));
    expect(document.text.slice(selectedFrom, selectedFrom + 3)).toBe('BAR');
    expect(document.undoDepth).toBe(1);
  });

  it('replaces all non-overlapping matches through one search-origin transaction and one undo step', () => {
    // Replace-all is one atomic controller mutation and one reversible history unit.
    const { controller, document, editor } = createSearchHarness('aaaa');
    const applyMutation = vi.spyOn(controller, 'applyMutation');
    editor.execute('search.replaceOpen');
    editor.setSearchQuery('aa');
    editor.setReplacementText('b');
    const beforeRevision = Number(document.identity.revision);

    editor.execute('search.replaceAll');

    expect(document.text).toBe('bb');
    expect(Number(document.identity.revision)).toBe(beforeRevision + 1);
    expect(document.undoDepth).toBe(1);
    expect(applyMutation).toHaveBeenCalledTimes(1);
    expect(applyMutation).toHaveBeenCalledWith(expect.objectContaining({ origin: 'search' }));
    expect(document.undo()).toMatchObject({ accepted: true });
    expect(document.text).toBe('aaaa');
  });

  it.each([
    ['read-only documents', { readOnly: true }, 'foo foo', 'bar'],
    ['edit-count overflow', { limits: { editsPerTransaction: 1 } }, 'foo foo', 'bar'],
    ['replacement-byte overflow', { limits: { replacementBytes: 2 } }, 'foo', 'three'],
    ['result-size overflow', { limits: { documentBytes: 7 } }, 'foo foo', 'longer'],
  ] as const)('changes nothing for %s', (_label, options, text, replacement) => {
    // Read-only and bounded-limit rejection leave text, identity, selection, and history untouched.
    const { document, editor } = createSearchHarness(text, options);
    editor.execute('search.replaceOpen');
    editor.setSearchQuery('foo');
    editor.setReplacementText(replacement);
    const before = {
      text: document.text,
      identity: document.identity,
      selection: document.selection,
      undoDepth: document.undoDepth,
      redoDepth: document.redoDepth,
    };

    editor.execute('search.replaceAll');

    expect({
      text: document.text,
      identity: document.identity,
      selection: document.selection,
      undoDepth: document.undoDepth,
      redoDepth: document.redoDepth,
    }).toEqual(before);
    expect(editor.searchState.total).toBe(text === 'foo' ? 1 : 2);
  });
});
