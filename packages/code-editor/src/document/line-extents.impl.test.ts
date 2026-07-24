import { describe, expect, it } from 'vitest';

import { createDocumentModel } from './model.js';
import { offsetToVisualColumn, visualColumnToOffset } from './positions.js';

/** Compares the persistent geometry index with the immutable reference conversion functions. */
function expectReferenceGeometry(model: ReturnType<typeof createDocumentModel>): void {
  const snapshot = model.snapshot;
  const line = snapshot.line(0);
  for (let offset = Number(line.from); offset <= Number(line.to); offset += 1) {
    expect(model.visualColumnAt(offset)).toBe(Number(offsetToVisualColumn(snapshot, offset, model.tabSize)));
  }
  for (let column = 0; column <= model.maximumVisualColumn; column += 1) {
    expect(model.offsetAtVisualColumn(0, column)).toBe(
      Number(visualColumnToOffset(snapshot, 0, column, model.tabSize)),
    );
  }
}

describe('incremental document line extents', () => {
  it('tracks tabs and wide graphemes through edits, undo, and redo', () => {
    const model = createDocumentModel({ text: 'short\n\t界', tabSize: 4 });
    expect(model.maximumVisualColumn).toBe(6);

    const line = model.snapshot.line(1);
    const result = model.apply(
      model.createTransaction({
        edits: [{ range: { from: line.from, to: line.to }, text: 'x' }],
        origin: 'typing',
      }),
    );
    expect(result.accepted).toBe(true);
    expect(model.maximumVisualColumn).toBe(5);

    expect(model.undo().accepted).toBe(true);
    expect(model.maximumVisualColumn).toBe(6);
    expect(model.redo().accepted).toBe(true);
    expect(model.maximumVisualColumn).toBe(5);
  });

  it('updates exact maxima when atomic edits add, join, and independently replace lines', () => {
    const model = createDocumentModel({ text: 'longest\nx\ny', tabSize: 4 });
    expect(model.maximumVisualColumn).toBe(7);

    const inserted = model.apply(
      model.createTransaction({
        edits: [{ range: { from: 0, to: 7 }, text: 'a\nwide-wide' }],
        origin: 'typing',
      }),
    );
    expect(inserted.accepted).toBe(true);
    expect(model.maximumVisualColumn).toBe(9);

    const snapshot = model.snapshot;
    const first = snapshot.line(0);
    const last = snapshot.line(snapshot.lineCount - 1);
    const replaced = model.apply(
      model.createTransaction({
        edits: [
          { range: { from: first.from, to: first.to }, text: 'prefix' },
          { range: { from: last.from, to: last.to }, text: 'longest-tail' },
        ],
        origin: 'typing',
      }),
    );
    expect(replaced.accepted).toBe(true);
    expect(model.maximumVisualColumn).toBe(12);

    const joined = model.apply(
      model.createTransaction({
        edits: [{ range: { from: 6, to: 7 }, text: '' }],
        origin: 'typing',
      }),
    );
    expect(joined.accepted).toBe(true);
    expect(model.maximumVisualColumn).toBe(15);
  });

  it('updates a very long simple line without rescanning its unchanged suffix', () => {
    const model = createDocumentModel({ text: 'x'.repeat(1_000_000), tabSize: 4 });
    const editAt = 500_000;
    const startedAt = performance.now();
    const result = model.apply(
      model.createTransaction({
        edits: [{ range: { from: editAt, to: editAt }, text: 'y' }],
        origin: 'typing',
      }),
    );

    expect(result.accepted).toBe(true);
    expect(model.maximumVisualColumn).toBe(1_000_001);
    expect(performance.now() - startedAt).toBeLessThan(50);
  });

  it('keeps persistent tab and wide-Unicode mappings exact after local edits', () => {
    const tabs = createDocumentModel({ text: '\t'.repeat(3_000), tabSize: 4 });
    expect(tabs.maximumVisualColumn).toBe(12_000);
    expect(tabs.offsetAtVisualColumn(0, 11_996)).toBe(2_999);
    tabs.setSelection({ anchor: 0, head: 0 });
    expect(
      tabs.apply(
        tabs.createTransaction({
          edits: [{ range: { from: 0, to: 0 }, text: 'x' }],
          origin: 'typing',
        }),
      ).accepted,
    ).toBe(true);
    expect(tabs.visualColumnAt(tabs.text.length)).toBe(12_000);

    const wide = createDocumentModel({ text: '界'.repeat(3_000), tabSize: 4 });
    wide.setSelection({ anchor: 1_500, head: 1_500 });
    expect(
      wide.apply(
        wide.createTransaction({
          edits: [{ range: { from: 1_500, to: 1_500 }, text: 'x' }],
          origin: 'typing',
        }),
      ).accepted,
    ).toBe(true);
    expect(wide.maximumVisualColumn).toBe(6_001);
    expect(wide.visualColumnAt(wide.text.length)).toBe(6_001);
    expect(wide.offsetAtVisualColumn(0, 3_001)).toBe(1_501);
  });

  it('matches immutable reference geometry through tab, Unicode, undo, and redo updates', () => {
    for (const text of ['\talpha\tomega', '界alpha界omega', `e\u0301 alpha 👩‍💻`]) {
      const model = createDocumentModel({ text, tabSize: 4 });
      expectReferenceGeometry(model);
      const middle = Math.floor(model.text.length / 2);
      expect(
        model.apply(
          model.createTransaction({
            edits: [{ range: { from: middle, to: middle }, text: 'xy' }],
            origin: 'typing',
          }),
        ).accepted,
      ).toBe(true);
      expectReferenceGeometry(model);
      expect(model.undo().accepted).toBe(true);
      expectReferenceGeometry(model);
      expect(model.redo().accepted).toBe(true);
      expectReferenceGeometry(model);
    }

    const joiningBoundary = createDocumentModel({ text: `a\u0301👩‍`, tabSize: 4 });
    const end = joiningBoundary.text.length;
    expect(
      joiningBoundary.apply(
        joiningBoundary.createTransaction({
          edits: [{ range: { from: end, to: end }, text: '💻' }],
          origin: 'typing',
        }),
      ).accepted,
    ).toBe(true);
    expectReferenceGeometry(joiningBoundary);

    const unboundedJoin = createDocumentModel({
      text: `👩${'\u0301'.repeat(130)}‍`,
      tabSize: 4,
    });
    const unboundedEnd = unboundedJoin.text.length;
    expect(
      unboundedJoin.apply(
        unboundedJoin.createTransaction({
          edits: [{ range: { from: unboundedEnd, to: unboundedEnd }, text: '💻' }],
          origin: 'typing',
        }),
      ).accepted,
    ).toBe(true);
    const fresh = createDocumentModel({ text: `👩${'\u0301'.repeat(130)}‍💻`, tabSize: 4 });
    expect(unboundedJoin.maximumVisualColumn).toBe(fresh.maximumVisualColumn);
    expectReferenceGeometry(unboundedJoin);
  });
});
