import { describe, expect, it } from 'vitest';

import { createDocumentModel } from './model.js';
import { offsetToPosition, positionToOffset } from './positions.js';

interface RandomSource {
  next(maximum: number): number;
}

function createRandomSource(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next(maximum: number): number {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state % maximum;
    },
  };
}

describe('document model properties', () => {
  it('matches a reference string across deterministic random atomic edits', () => {
    const random = createRandomSource(0xc0de);
    const model = createDocumentModel({ text: 'seed\ntext' });
    let reference = model.text;

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const from = random.next(reference.length + 1);
      const to = from + random.next(reference.length - from + 1);
      const insertion = ['x', '\n', '😀', ''][random.next(4)] ?? '';
      const result = model.apply(
        model.createTransaction({
          edits: [{ range: { from, to }, text: insertion }],
          origin: 'typing',
        }),
      );
      expect(result).toMatchObject({ accepted: true });
      reference = reference.slice(0, from) + insertion + reference.slice(to);
      expect(model.text).toBe(reference);
      expect(model.snapshot.length).toBe(reference.length);
      expect(model.snapshot.lineCount).toBe(reference.split('\n').length);
    }
  });

  it('round-trips every valid LF position in generated documents', () => {
    const random = createRandomSource(0x51a7e);
    for (let documentIndex = 0; documentIndex < 50; documentIndex += 1) {
      let text = '';
      const length = 20 + random.next(80);
      for (let index = 0; index < length; index += 1) {
        text += ['a', '\n', '界', '😀', '\u0301'][random.next(5)] ?? '';
      }
      const snapshot = createDocumentModel({ text }).snapshot;
      for (let offset = 0; offset <= text.length; offset += 1) {
        const position = offsetToPosition(snapshot, offset);
        expect(positionToOffset(snapshot, position)).toBe(offset);
      }
    }
  });

  it('keeps rapid edits correct on a one-MiB document', () => {
    const model = createDocumentModel({ text: 'x'.repeat(1_048_576) });
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const at = (iteration * 25_007) % model.snapshot.length;
      const result = model.apply(
        model.createTransaction({
          edits: [{ range: { from: at, to: at + 1 }, text: 'y' }],
          origin: 'typing',
        }),
      );
      expect(result).toMatchObject({ accepted: true });
    }
    expect(model.undoDepth).toBe(40);
  });
});
