import { describe, expect, it } from 'vitest';

import { KanbanInvalidSourcePublicationError } from '../src/index.js';
import type { CardKey, KanbanCellAddress } from '../src/index.js';
import { KanbanSelectionModel, type KanbanEligibleSelectionCandidate } from '../src/interaction/selection.js';

/** Creates one detached selection candidate with deterministic revision evidence. */
function candidate(
  cardKey: CardKey,
  index: number,
  address: KanbanCellAddress = { columnId: 'ready' },
): KanbanEligibleSelectionCandidate {
  return Object.freeze({
    cardKey,
    address: Object.freeze(address),
    entityRevision: `entity-${typeof cardKey}-${String(cardKey)}-${index}`,
  });
}

/** Mirrors the model's required type-preserving identity equality without sharing its implementation. */
function identity(cardKey: CardKey): string {
  return `${typeof cardKey}:${String(cardKey)}`;
}

describe('ordered selection model', () => {
  it('preserves insertion order and type-preserving membership through toggle sequences', () => {
    const keys: readonly CardKey[] = Object.freeze([1, '1', 'number:1', '["number",1]', '__proto__', 0, '0']);
    const operations: readonly CardKey[] = Object.freeze([...keys, '1', 1, '1', '__proto__']);
    const model = new KanbanSelectionModel(keys.length);
    const expected: CardKey[] = [];

    for (const [index, cardKey] of operations.entries()) {
      const existingIndex = expected.findIndex((selected) => identity(selected) === identity(cardKey));
      if (existingIndex < 0) expected.push(cardKey);
      else expected.splice(existingIndex, 1);

      const result = model.toggle(candidate(cardKey, index));
      expect(result.kind).toBe('changed');
      expect(result.selectedCardKeys).toEqual(expected);
      expect(model.selectedCardKeys()).toEqual(expected);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.selectedCardKeys)).toBe(true);
    }
  });

  it('selects forward and reverse ranges atomically within one semantic cell', () => {
    const visible = Object.freeze([1, 2, 3, 4].map((cardKey, index) => candidate(cardKey, index)));
    const model = new KanbanSelectionModel(4);
    const anchor = Object.freeze({ cardKey: 2, address: Object.freeze({ columnId: 'ready' }) });

    expect(model.range(visible, anchor, 4)).toMatchObject({
      kind: 'changed',
      selectedCardKeys: [2, 3, 4],
      rangeAnchor: { cardKey: 2 },
    });
    expect(model.range(visible, anchor, 1)).toMatchObject({
      kind: 'changed',
      selectedCardKeys: [1, 2],
      rangeAnchor: { cardKey: 2 },
    });

    const limited = new KanbanSelectionModel(2);
    limited.replace(visible[0]!);
    const before = limited.selectedCardKeys();
    const rejected = limited.range(visible, { cardKey: 1, address: { columnId: 'ready' } }, 4);
    expect(rejected).toMatchObject({ kind: 'limit-exceeded', selectedCardKeys: before });
    expect(limited.selectedCardKeys()).toEqual(before);

    const crossCell = Object.freeze([candidate(1, 0), candidate(2, 1, { columnId: 'doing' })]);
    const retained = model.selectedCardKeys();
    expect(model.range(crossCell, anchor, 2)).toEqual({ kind: 'unchanged', selectedCardKeys: retained });
    expect(model.selectedCardKeys()).toEqual(retained);
    expect(model.rangeAnchor()).toBeUndefined();
  });

  it('prunes only view-hidden identities with exact counts and stable retained order', () => {
    const model = new KanbanSelectionModel(5);
    const selected = Object.freeze(
      [1, '1', '__proto__', 'number:1', 2].map((cardKey, index) => candidate(cardKey, index)),
    );
    model.selectLoadedVisibleMatching(selected);

    expect(model.prune([], 'cursor-unload')).toMatchObject({
      kind: 'unchanged',
      selectedCardKeys: [1, '1', '__proto__', 'number:1', 2],
      removedCount: 0,
    });
    expect(model.prune(['1', 'number:1', 1], 'visibility')).toMatchObject({
      kind: 'changed',
      selectedCardKeys: [1, '1', 'number:1'],
      removedCount: 2,
    });
    expect(model.prune(['1'], 'visibility')).toMatchObject({
      kind: 'changed',
      selectedCardKeys: ['1'],
      removedCount: 2,
    });
    expect(model.rangeAnchor()).toBeUndefined();
  });

  it('captures current eligible evidence in selection order and isolates it from later mutations', () => {
    const model = new KanbanSelectionModel(3);
    model.selectLoadedVisibleMatching([candidate(1, 0), candidate('1', 1), candidate('keep', 2)]);
    const captured = model.snapshotEligibleSelection(
      [
        candidate('1', 11, { columnId: 'doing', swimlaneId: 'team-b' }),
        candidate(1, 10, { columnId: 'doing', swimlaneId: 'team-a' }),
      ],
      { sessionRevision: 'session-2', queryGeneration: 7, viewRevision: 3 },
    );

    expect(captured).toEqual({
      entries: [
        candidate(1, 10, { columnId: 'doing', swimlaneId: 'team-a' }),
        candidate('1', 11, { columnId: 'doing', swimlaneId: 'team-b' }),
      ],
      sessionRevision: 'session-2',
      queryGeneration: 7,
      viewRevision: 3,
    });
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.entries)).toBe(true);
    for (const entry of captured.entries) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.address)).toBe(true);
    }

    model.clearMultiple();
    expect(model.selectedCardKeys()).toEqual([]);
    expect(captured.entries.map((entry) => entry.cardKey)).toEqual([1, '1']);
  });

  it('rejects duplicate and hostile candidates without partially replacing prior selection', () => {
    const model = new KanbanSelectionModel(4);
    model.selectLoadedVisibleMatching([candidate('safe', 0)]);
    const before = model.selectedCardKeys();

    expect(() => model.selectLoadedVisibleMatching([candidate(1, 1), candidate('1', 2), candidate(1, 3)])).toThrow(
      KanbanInvalidSourcePublicationError,
    );
    expect(model.selectedCardKeys()).toEqual(before);

    const hostile: KanbanEligibleSelectionCandidate = {
      get cardKey(): CardKey {
        throw new Error('secret-card-key');
      },
      address: { columnId: 'ready' },
      entityRevision: 1,
    };
    expect(() => model.toggle(hostile)).toThrow(KanbanInvalidSourcePublicationError);
    expect(model.selectedCardKeys()).toEqual(before);
  });
});
