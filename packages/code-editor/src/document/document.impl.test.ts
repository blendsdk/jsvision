import { describe, expect, it } from 'vitest';

import { createDocumentModel } from './model.js';
import { utf8ByteLength } from './limits.js';
import { offsetToPosition, positionToOffset } from './positions.js';

function edit(from: number, to: number, text: string) {
  return { range: { from, to }, text };
}

describe('document model implementation', () => {
  it('evicts complete history entries at the configured bound', () => {
    const model = createDocumentModel({ text: '', limits: { maxHistoryEntries: 2 } });
    for (const text of ['a', 'b', 'c']) {
      expect(
        model.apply(
          model.createTransaction({
            edits: [edit(model.text.length, model.text.length, text)],
            selection: { anchor: model.text.length + 1, head: model.text.length + 1 },
            origin: 'typing',
          }),
        ),
      ).toMatchObject({ accepted: true });
    }

    expect(model.undoDepth).toBe(2);
    expect(model.undo()).toMatchObject({ accepted: true });
    expect(model.undo()).toMatchObject({ accepted: true });
    expect(model.text).toBe('a');
    expect(model.undo()).toMatchObject({ accepted: false, reason: 'history-empty' });
  });

  it('clears redo after a new edit and keeps revisions monotonic', () => {
    const model = createDocumentModel({ text: 'a' });
    model.apply(model.createTransaction({ edits: [edit(1, 1, 'b')], origin: 'typing' }));
    model.undo();
    const revisionAfterUndo = model.snapshot.revision;

    model.apply(model.createTransaction({ edits: [edit(1, 1, 'c')], origin: 'typing' }));

    expect(model.text).toBe('ac');
    expect(model.snapshot.revision).toBe(revisionAfterUndo + 1);
    expect(model.redoDepth).toBe(0);
    expect(model.redo()).toMatchObject({ accepted: false, reason: 'history-empty' });
  });

  it('tracks save checkpoints by exact text across undo and redo', () => {
    const model = createDocumentModel({ text: 'before' });
    model.apply(
      model.createTransaction({
        edits: [edit(0, model.text.length, 'saved')],
        origin: 'format',
      }),
    );
    model.markSaved();
    expect(model.modified).toBe(false);

    model.apply(model.createTransaction({ edits: [edit(5, 5, '!')], origin: 'typing' }));
    expect(model.modified).toBe(true);
    model.undo();
    expect(model.text).toBe('saved');
    expect(model.modified).toBe(false);
    model.redo();
    expect(model.modified).toBe(true);
  });

  it('maps an existing selection through edits when no explicit selection is supplied', () => {
    const selected = createDocumentModel({ text: 'abcdef' });
    selected.setSelection({ anchor: 4, head: 6 });
    selected.apply(selected.createTransaction({ edits: [edit(0, 2, '')], origin: 'typing' }));
    expect(selected.selection).toEqual({ anchor: 2, head: 4 });
  });

  it('reports URI, language, line endings, and replacement metadata independently', () => {
    const model = createDocumentModel({
      text: 'a\r\nb\r\n',
      uri: 'file:///first.ts',
      languageId: 'typescript',
    });
    expect(model).toMatchObject({
      uri: 'file:///first.ts',
      languageId: 'typescript',
      lineEnding: 'crlf',
    });

    model.replaceDocument({
      text: 'select 1;\nselect 2;\r\n',
      uri: 'file:///second.sql',
      languageId: 'postgresql',
      readOnly: true,
    });
    expect(model).toMatchObject({
      uri: 'file:///second.sql',
      languageId: 'postgresql',
      lineEnding: 'mixed',
      readOnly: true,
      tabSize: 4,
    });
  });

  it('adopts replacement limits and tab size as one coherent document policy', () => {
    const model = createDocumentModel({ text: 'old', tabSize: 2 });
    model.replaceDocument({
      text: 'new',
      tabSize: 8,
      limits: { maxDocumentBytes: 3 },
    });
    expect(model.tabSize).toBe(8);
    expect(
      model.apply(
        model.createTransaction({
          edits: [edit(3, 3, '!')],
          origin: 'typing',
        }),
      ),
    ).toMatchObject({ accepted: false, reason: 'document-limit' });
  });

  it('searches literally with stable UTF-16 ranges and a result bound', () => {
    const model = createDocumentModel({ text: 'Value value VALUE' });
    expect(model.search('value')).toEqual([{ from: 6, to: 11 }]);
    expect(model.search('value', { caseSensitive: false, maxResults: 2 })).toEqual([
      { from: 0, to: 5 },
      { from: 6, to: 11 },
    ]);
    expect(model.search('')).toEqual([]);
    expect(createDocumentModel({ text: 'İX' }).search('x', { caseSensitive: false })).toEqual([{ from: 1, to: 2 }]);
    expect(createDocumentModel({ text: 'AİX' }).search('i\u0307x', { caseSensitive: false })).toEqual([
      { from: 1, to: 3 },
    ]);
  });

  it('permits line-neutral replacements at the configured line ceiling', () => {
    const lf = createDocumentModel({ text: 'a\nb', limits: { maxDocumentLines: 2 } });
    expect(lf.apply(lf.createTransaction({ edits: [edit(0, 3, 'c\nd')], origin: 'typing' }))).toMatchObject({
      accepted: true,
    });

    const crlf = createDocumentModel({ text: 'a\r\nb', limits: { maxDocumentLines: 2 } });
    expect(crlf.apply(crlf.createTransaction({ edits: [edit(2, 3, '')], origin: 'typing' }))).toMatchObject({
      accepted: true,
    });
    expect(crlf.snapshot.lineCount).toBe(2);
  });

  it('indexes CR and mixed separators without changing exact source text', () => {
    const cr = createDocumentModel({ text: 'a\rb\r' });
    expect(cr.lineEnding).toBe('cr');
    expect(cr.snapshot.lineCount).toBe(3);
    expect(cr.snapshot.line(1)).toMatchObject({ from: 2, to: 3, text: 'b' });
    expect(cr.text).toBe('a\rb\r');

    const mixed = createDocumentModel({ text: 'a\r\nb\nc\rd' });
    expect(mixed.lineEnding).toBe('mixed');
    expect(mixed.snapshot.lineCount).toBe(4);
    expect(mixed.snapshot.line(3)).toMatchObject({ text: 'd' });
  });

  it('maps a collapsed caret after text inserted at its boundary', () => {
    const model = createDocumentModel({ text: 'ab' });
    model.setSelection({ anchor: 1, head: 1 });
    model.apply(model.createTransaction({ edits: [edit(1, 1, 'X')], origin: 'typing' }));
    expect(model.selection).toEqual({ anchor: 2, head: 2 });
  });

  it('retains changed content rather than complete document snapshots in history', () => {
    const model = createDocumentModel({
      text: 'x'.repeat(1_048_576),
      limits: { maxHistoryBytes: 4_096 },
    });
    for (let index = 0; index < 1_000; index += 1) {
      model.apply(
        model.createTransaction({
          edits: [edit(index, index + 1, index % 2 === 0 ? 'y' : 'z')],
          origin: 'typing',
        }),
      );
    }
    expect(model.historyRetainedBytes).toBeLessThanOrEqual(4_096);
    expect(model.undoDepth).toBeLessThanOrEqual(1_000);
  });

  it('counts UTF-8 without allocating an encoded copy', () => {
    expect(utf8ByteLength('ascii')).toBe(5);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('😀')).toBe(4);
    expect(utf8ByteLength('\uD800')).toBe(3);
  });

  it('keeps snapshot reads immutable after later model edits', () => {
    const model = createDocumentModel({ text: 'first\nsecond' });
    const snapshot = model.snapshot;
    model.apply(model.createTransaction({ edits: [edit(0, 5, 'changed')], origin: 'typing' }));

    expect(snapshot.slice(0)).toBe('first\nsecond');
    expect(snapshot.line(1)).toMatchObject({ number: 1, text: 'second', from: 6, to: 12 });
    expect(model.snapshot.slice(0)).toBe('changed\nsecond');
  });

  it('round-trips every valid position in a multiline UTF-16 snapshot', () => {
    const model = createDocumentModel({ text: 'zero\n😀\nthree' });
    for (let offset = 0; offset <= model.text.length; offset += 1) {
      const position = offsetToPosition(model.snapshot, offset);
      expect(positionToOffset(model.snapshot, position)).toBe(offset);
    }
  });
});
