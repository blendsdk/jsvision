import { describe, expect, it } from 'vitest';

import { createDocumentModel } from '../../src/document/model.js';
import { offsetToPosition, positionToOffset } from '../../src/document/positions.js';

function stateOf(model: ReturnType<typeof createDocumentModel>) {
  return {
    text: model.text,
    revision: model.snapshot.revision,
    undoDepth: model.undoDepth,
    redoDepth: model.redoDepth,
  };
}

describe('document input validation security', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0.5])(
    'rejects hostile coordinate %s without mutation',
    (coordinate) => {
      const model = createDocumentModel({ text: 'safe' });
      const before = stateOf(model);
      const transaction = model.createTransaction({
        edits: [{ range: { from: coordinate, to: 1 }, text: 'unsafe' }],
        origin: 'external',
      });

      expect(model.apply(transaction)).toMatchObject({ accepted: false });
      expect(stateOf(model)).toEqual(before);
    },
  );

  it('rejects invalid configured limits before constructing document state', () => {
    expect(() => createDocumentModel({ text: '', limits: { maxDocumentBytes: 0 } })).toThrow(RangeError);
    expect(() => createDocumentModel({ text: '', limits: { maxEditsPerTransaction: 10_001 } })).toThrow(RangeError);
    expect(() => createDocumentModel({ text: '', limits: { maxHistoryEntries: 10_001 } })).toThrow(RangeError);
  });

  it('rejects malformed and forged transactions without throwing or mutation', () => {
    const model = createDocumentModel({ text: 'safe' });
    const before = stateOf(model);
    const malformed = { edits: [null], origin: 'external' };
    const transaction = Reflect.apply(model.createTransaction, model, [malformed]);
    expect(() => model.apply(transaction)).not.toThrow();
    expect(model.apply(transaction)).toMatchObject({ accepted: false, reason: 'invalid-edit' });

    const forged = Object.freeze({ kind: 'document-transaction' });
    expect(Reflect.apply(model.apply, model, [forged])).toMatchObject({
      accepted: false,
      reason: 'invalid-edit',
    });
    expect(stateOf(model)).toEqual(before);
  });

  it('reads hostile transaction accessors once and converts failures to rejection', () => {
    const model = createDocumentModel({ text: 'safe' });
    let reads = 0;
    const hostile = Object.defineProperty({}, 'edits', {
      get() {
        reads += 1;
        throw new Error('hostile getter');
      },
    });
    const transaction = Reflect.apply(model.createTransaction, model, [hostile]);
    expect(model.apply(transaction)).toMatchObject({ accepted: false, reason: 'invalid-edit' });
    expect(reads).toBe(1);
  });

  it('rejects edit floods before reading their entries', () => {
    const model = createDocumentModel({
      text: 'safe',
      limits: { maxEditsPerTransaction: 2 },
    });
    let entryReads = 0;
    const edits = new Proxy([{}, {}, {}], {
      get(target, property, receiver) {
        if (property !== 'length') {
          entryReads += 1;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const transaction = Reflect.apply(model.createTransaction, model, [{ edits, origin: 'external' }]);
    expect(model.apply(transaction)).toMatchObject({ accepted: false, reason: 'edit-limit' });
    expect(entryReads).toBe(0);
  });

  it('rejects content beyond a lowered byte ceiling without changing source text', () => {
    expect(() =>
      createDocumentModel({
        text: 'éé',
        limits: { maxDocumentBytes: 3 },
      }),
    ).toThrow(RangeError);

    const model = createDocumentModel({ text: 'ok', limits: { maxDocumentBytes: 4 } });
    const before = stateOf(model);
    expect(
      model.apply(
        model.createTransaction({
          edits: [{ range: { from: 2, to: 2 }, text: '😀' }],
          origin: 'external',
        }),
      ),
    ).toMatchObject({ accepted: false, reason: 'document-limit' });
    expect(stateOf(model)).toEqual(before);
  });

  it('rejects invalid position and tab inputs instead of clamping them', () => {
    const snapshot = createDocumentModel({ text: 'safe\ntext' }).snapshot;
    expect(() => offsetToPosition(snapshot, Number.NaN)).toThrow(RangeError);
    expect(() => positionToOffset(snapshot, { line: 0, character: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => createDocumentModel({ text: '', tabSize: 0 })).toThrow(RangeError);
    expect(() => createDocumentModel({ text: '', tabSize: 33 })).toThrow(RangeError);
  });

  it('rejects newline floods before constructing document storage', () => {
    expect(() =>
      createDocumentModel({
        text: 'x\nx\nx',
        limits: { maxDocumentLines: 2 },
      }),
    ).toThrow(RangeError);
  });
});
