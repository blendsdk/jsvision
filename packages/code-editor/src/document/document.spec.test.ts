import { describe, expect, it } from 'vitest';

import { createDocumentModel } from './model.js';
import { offsetToPosition, offsetToVisualColumn, positionToOffset } from './positions.js';

function stateOf(model: ReturnType<typeof createDocumentModel>) {
  return {
    text: model.text,
    selection: model.selection,
    revision: model.snapshot.revision,
    undoDepth: model.undoDepth,
    redoDepth: model.redoDepth,
    modified: model.modified,
  };
}

function edit(from: number, to: number, text: string) {
  return { range: { from, to }, text };
}

describe('document transactions', () => {
  it('applies single and multiple edits as one revision and one undo step', () => {
    // All edits in one valid transaction become visible together and create one history entry.
    const single = createDocumentModel({ text: 'one two' });
    const first = single.createTransaction({
      edits: [edit(4, 7, 'three')],
      origin: 'typing',
      base: single.identity,
    });
    expect(single.apply(first)).toMatchObject({ accepted: true });
    expect(single.text).toBe('one three');
    expect(single.snapshot.revision).toBe(1);
    expect(single.undoDepth).toBe(1);

    const multiple = createDocumentModel({ text: 'alpha beta gamma' });
    const combined = multiple.createTransaction({
      edits: [edit(0, 5, 'A'), edit(11, 16, 'G')],
      origin: 'format',
      base: multiple.identity,
    });
    expect(multiple.apply(combined)).toMatchObject({ accepted: true });
    expect(multiple.text).toBe('A beta G');
    expect(multiple.snapshot.revision).toBe(1);
    expect(multiple.undoDepth).toBe(1);
  });

  it.each([
    ['completion', 'const value', 'const valueOf()', { anchor: 15, head: 15 }],
    ['snippet', '', 'for (const item of items) {\n\t\n}', { anchor: 29, head: 29 }],
    ['format', 'let x=1', 'let x = 1;\n', { anchor: 11, head: 11 }],
  ] as const)('undoes and redoes an atomic %s transaction exactly', (origin, before, after, selection) => {
    // Completion, snippet, and formatting edits restore exact text and selection in both directions.
    const model = createDocumentModel({ text: before });
    const priorSelection = model.selection;
    const transaction = model.createTransaction({
      edits: [edit(0, before.length, after)],
      selection,
      origin,
      base: model.identity,
    });

    expect(model.apply(transaction)).toMatchObject({ accepted: true });
    expect({ text: model.text, selection: model.selection }).toEqual({ text: after, selection });
    expect(model.undo()).toMatchObject({ accepted: true });
    expect({ text: model.text, selection: model.selection }).toEqual({
      text: before,
      selection: priorSelection,
    });
    expect(model.redo()).toMatchObject({ accepted: true });
    expect({ text: model.text, selection: model.selection }).toEqual({ text: after, selection });
  });

  it.each([
    ['negative offset', edit(-1, 0, 'x')],
    ['non-finite offset', edit(0, Number.POSITIVE_INFINITY, 'x')],
    ['non-integral offset', edit(0.5, 1, 'x')],
    ['reversed range', edit(2, 1, 'x')],
    ['out-of-document range', edit(0, 7, 'x')],
  ])('rejects a %s without changing document state', (_label, invalidEdit) => {
    // Invalid primitive ranges are rejected before any text, revision, or history mutation.
    const model = createDocumentModel({ text: 'abc' });
    const before = stateOf(model);
    const transaction = model.createTransaction({
      edits: [invalidEdit],
      origin: 'external',
      base: model.identity,
    });

    expect(model.apply(transaction)).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(before);
  });

  it('rejects overlapping edits atomically', () => {
    // A transaction with intersecting edits cannot expose a partial result.
    const model = createDocumentModel({ text: 'abcdef' });
    const before = stateOf(model);
    const transaction = model.createTransaction({
      edits: [edit(1, 4, 'x'), edit(3, 5, 'y')],
      origin: 'external',
      base: model.identity,
    });
    expect(model.apply(transaction)).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(before);
  });

  it('rejects stale revisions and identities from another document', () => {
    // Transactions belong to one exact document lineage and base revision.
    const model = createDocumentModel({ text: 'abc' });
    const stale = model.createTransaction({
      edits: [edit(0, 1, 'A')],
      origin: 'typing',
      base: model.identity,
    });
    const current = model.createTransaction({
      edits: [edit(1, 2, 'B')],
      origin: 'typing',
      base: model.identity,
    });
    expect(model.apply(current)).toMatchObject({ accepted: true });
    const afterCurrent = stateOf(model);
    expect(model.apply(stale)).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(afterCurrent);

    const other = createDocumentModel({ text: 'abc' });
    const foreign = model.createTransaction({
      edits: [edit(0, 1, 'A')],
      origin: 'external',
      base: other.identity,
    });
    expect(model.apply(foreign)).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(afterCurrent);
  });

  it('rejects edit-count and result-size limit violations atomically', () => {
    // Configured safety limits reject the whole transaction without consuming history.
    const model = createDocumentModel({
      text: 'abc',
      limits: { maxEditsPerTransaction: 2, maxDocumentBytes: 5 },
    });
    const before = stateOf(model);
    const tooMany = model.createTransaction({
      edits: [edit(0, 0, 'a'), edit(1, 1, 'b'), edit(2, 2, 'c')],
      origin: 'external',
      base: model.identity,
    });
    expect(model.apply(tooMany)).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(before);

    const oversized = model.createTransaction({
      edits: [edit(0, 3, '123456')],
      origin: 'external',
      base: model.identity,
    });
    expect(model.apply(oversized)).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(before);
  });

  it('replaces a document with a fresh lineage and no document-scoped residue', () => {
    // Replacement resets identity, revision, history, selection, and saved-state tracking.
    const model = createDocumentModel({ text: 'old', uri: 'file:///old.ts' });
    const oldIdentity = model.identity;
    const oldTransaction = model.createTransaction({
      edits: [edit(0, 3, 'stale')],
      origin: 'external',
      base: oldIdentity,
    });
    model.apply(
      model.createTransaction({
        edits: [edit(0, 3, 'changed')],
        origin: 'typing',
        base: model.identity,
      }),
    );

    model.replaceDocument({ text: 'new', uri: 'file:///new.ts', languageId: 'typescript' });
    expect(model.identity.lineage).not.toBe(oldIdentity.lineage);
    expect(stateOf(model)).toEqual({
      text: 'new',
      selection: { anchor: 0, head: 0 },
      revision: 0,
      undoDepth: 0,
      redoDepth: 0,
      modified: false,
    });
    const afterReplacement = stateOf(model);
    expect(model.apply(oldTransaction)).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(afterReplacement);
  });

  it('keeps read-only documents queryable but rejects all mutation paths', () => {
    // Read-only mode blocks edits and history changes while preserving navigation and search.
    const model = createDocumentModel({ text: 'alpha\nbeta', readOnly: true });
    const before = stateOf(model);
    const transaction = model.createTransaction({
      edits: [edit(0, 5, 'ALPHA')],
      selection: { anchor: 5, head: 5 },
      origin: 'typing',
      base: model.identity,
    });
    expect(model.apply(transaction)).toMatchObject({ accepted: false });
    expect(model.undo()).toMatchObject({ accepted: false });
    expect(model.redo()).toMatchObject({ accepted: false });
    expect(stateOf(model)).toEqual(before);
    expect(model.search('beta')).toHaveLength(1);
    expect(model.snapshot.lineAt(7)).toMatchObject({ text: 'beta' });
    expect(offsetToPosition(model.snapshot, 7)).toEqual({ line: 1, character: 1 });

    model.setReadOnly(false);
    expect(stateOf(model)).toEqual(before);
    model.setReadOnly(true);
    expect(stateOf(model)).toEqual(before);
  });
});

describe('document positions', () => {
  it('round-trips UTF-16 offsets across line endings, graphemes, and lone surrogates', () => {
    // Logical positions count UTF-16 code units exactly, independent of rendered graphemes.
    const text = 'a😀e\u0301\r\n\t界\n\uD800x';
    const model = createDocumentModel({ text });
    for (let offset = 0; offset <= text.length; offset += 1) {
      if (text.slice(offset, offset + 2) === '\r\n' || text.slice(offset - 1, offset + 1) === '\r\n') {
        continue;
      }
      const position = offsetToPosition(model.snapshot, offset);
      expect(positionToOffset(model.snapshot, position)).toBe(offset);
    }
    expect(offsetToPosition(model.snapshot, 3)).toEqual({ line: 0, character: 3 });
    expect(offsetToPosition(model.snapshot, 7)).toEqual({ line: 1, character: 0 });
    expect(offsetToPosition(model.snapshot, 11)).toEqual({ line: 2, character: 1 });
  });

  it('computes visual columns for tabs, combining marks, wide text, and surrogate pairs', () => {
    // Visual columns expand tabs and rendered graphemes while offsets remain UTF-16 based.
    const model = createDocumentModel({ text: '\tA\u0301界😀', tabSize: 4 });
    expect([0, 1, 2, 3, 4, 5, 6].map((offset) => offsetToVisualColumn(model.snapshot, offset))).toEqual([
      0, 4, 5, 5, 7, 7, 9,
    ]);
    expect(offsetToVisualColumn(model.snapshot, 1, 8)).toBe(8);
  });

  it('rejects out-of-range offsets and positions', () => {
    // Position helpers never clamp invalid input into a different document location.
    const snapshot = createDocumentModel({ text: 'a\r\nb' }).snapshot;
    expect(() => offsetToPosition(snapshot, -1)).toThrow();
    expect(() => offsetToPosition(snapshot, 5)).toThrow();
    expect(() => positionToOffset(snapshot, { line: -1, character: 0 })).toThrow();
    expect(() => positionToOffset(snapshot, { line: 0, character: 2 })).toThrow();
    expect(() => positionToOffset(snapshot, { line: 9, character: 0 })).toThrow();
  });
});

describe('document size modes', () => {
  it.each([
    ['one MiB', 'x'.repeat(1_048_576)],
    ['fifty thousand lines', `${'x\n'.repeat(49_999)}x`],
  ])('uses full mode at the %s inclusive boundary', (_label, text) => {
    // Documents remain fully featured when both inclusive full-mode limits are satisfied.
    const model = createDocumentModel({ text });
    expect(model.sizeMode).toBe('full');
    expect(model.text).toBe(text);
  });

  it.each([
    ['one byte above one MiB', 'x'.repeat(1_048_577)],
    ['fifty thousand and one lines', `${'x\n'.repeat(50_000)}x`],
    ['exactly ten MiB', 'x'.repeat(10_485_760)],
  ])('uses bounded mode when %s exceeds a full-mode dimension', (_label, text) => {
    // Exceeding either full-mode threshold degrades features without altering accepted text.
    const model = createDocumentModel({ text });
    expect(model.sizeMode).toBe('bounded');
    expect(model.text).toBe(text);
  });

  it('requires confirmation above ten MiB and opens confirmed text in reduced plain mode', () => {
    // Oversized text is never changed, but explicit approval is required before reduced plain mode.
    const text = 'x'.repeat(10_485_761);
    expect(() => createDocumentModel({ text })).toThrow();
    const model = createDocumentModel({
      text,
      languageId: 'typescript',
      confirmLargeDocument: () => true,
    });
    expect(model.sizeMode).toBe('reduced');
    expect(model.languageId).toBe('plain');
    expect(model.text).toBe(text);
  });
});
