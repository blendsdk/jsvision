/** Implementation coverage for bounded semantic drop-map projection internals. */
import { describe, expect, it } from 'vitest';

import { KanbanInvalidGeometryError } from '../src/contract/error.js';
import { projectKanbanCardDropMap } from '../src/interaction/drop-map.js';

/** Current semantic start placement shared by deterministic fixtures. */
const START = Object.freeze({ kind: 'start' as const, cursorRevision: 'cursor-r1' });
/** Current semantic end placement shared by deterministic fixtures. */
const END = Object.freeze({ kind: 'end' as const, cursorRevision: 'cursor-r1' });

/** Creates one complete two-card cell with deliberately overlapping fallback regions. */
function cell(columnId = 'ready') {
  return Object.freeze({
    address: Object.freeze({ columnId }),
    content: Object.freeze({ x: 0, y: 2, width: 12, height: 10 }),
    header: Object.freeze({ x: 0, y: 0, width: 12, height: 1 }),
    postHeader: Object.freeze({ rect: { x: 0, y: 1, width: 12, height: 1 }, position: START }),
    leading: Object.freeze({ rect: { x: 0, y: 2, width: 12, height: 2 }, position: START }),
    trailing: Object.freeze({ rect: { x: 0, y: 10, width: 12, height: 2 }, position: END }),
    cards: Object.freeze([
      Object.freeze({
        cardKey: 1,
        rect: Object.freeze({ x: 1, y: 3, width: 10, height: 4 }),
        before: START,
        after: Object.freeze({
          kind: 'between' as const,
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        }),
      }),
      Object.freeze({
        cardKey: 2,
        rect: Object.freeze({ x: 1, y: 7, width: 10, height: 3 }),
        before: Object.freeze({
          kind: 'between' as const,
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        }),
        after: END,
      }),
    ]),
    gutters: Object.freeze([
      Object.freeze({
        rect: Object.freeze({ x: 0, y: 7, width: 12, height: 1 }),
        position: Object.freeze({
          kind: 'between' as const,
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        }),
      }),
    ]),
    complete: Object.freeze({ leading: true, trailing: true, empty: false }),
  });
}

describe('drop-map overlap ordering', () => {
  it('keeps active compact gaps first and omits every resting gutter', () => {
    const map = projectKanbanCardDropMap({
      density: 'compact',
      cells: [cell()],
      activeGap: {
        address: { columnId: 'ready' },
        rect: { x: 0, y: 7, width: 12, height: 1 },
        position: {
          kind: 'between',
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        },
      },
    });

    expect(map.targets[0]?.kind).toBe('active-gap');
    expect(map.targetAt({ x: 2, y: 7 })?.kind).toBe('active-gap');
    expect(map.targets.some(({ kind }) => kind === 'resting-gutter')).toBe(false);
  });

  it('orders comfortable gutters before card halves and card halves before wide edge zones', () => {
    const map = projectKanbanCardDropMap({ density: 'comfortable', cells: [cell()] });

    expect(map.targetAt({ x: 2, y: 7 })?.kind).toBe('resting-gutter');
    expect(map.targetAt({ x: 2, y: 3 })?.kind).toBe('card-before');
    expect(map.targetAt({ x: 11, y: 3 })?.kind).toBe('cell-leading');
  });

  it('keeps post-header geometry distinct from inert header and empty-cell fallback', () => {
    const empty = { ...cell(), cards: [], gutters: [], complete: { leading: true, trailing: true, empty: true } };
    const map = projectKanbanCardDropMap({ density: 'spacious', cells: [empty] });

    expect(map.targetAt({ x: 5, y: 0 })).toBeUndefined();
    expect(map.targetAt({ x: 5, y: 1 })?.kind).toBe('post-header');
    expect(map.targetAt({ x: 5, y: 6 })?.kind).toBe('empty-cell');
  });
});

describe('drop-map clipping and half-open boundaries', () => {
  it('clips targets before splitting visible card halves', () => {
    const shifted = {
      ...cell(),
      content: { x: -3, y: 2, width: 15, height: 10 },
      header: { x: -3, y: 0, width: 15, height: 1 },
      cards: [
        {
          cardKey: 1,
          rect: { x: -2, y: 3, width: 10, height: 5 },
          before: START,
          after: END,
        },
      ],
      gutters: [],
    };
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [shifted],
      bounds: { x: 0, y: 4, width: 6, height: 4 },
    });
    const before = map.targets.find(({ kind }) => kind === 'card-before');
    const after = map.targets.find(({ kind }) => kind === 'card-after');

    expect(before?.rect).toEqual({ x: 0, y: 4, width: 6, height: 2 });
    expect(after?.rect).toEqual({ x: 0, y: 6, width: 6, height: 2 });
  });

  it('uses half-open right and bottom bounds so adjacent cells never double-hit', () => {
    const left = {
      ...cell('left'),
      cards: [],
      gutters: [],
      complete: { leading: true, trailing: true, empty: true },
    };
    const right = {
      ...cell('right'),
      content: { x: 12, y: 2, width: 12, height: 10 },
      header: { x: 12, y: 0, width: 12, height: 1 },
      postHeader: { rect: { x: 12, y: 1, width: 12, height: 1 }, position: START },
      leading: { rect: { x: 12, y: 2, width: 12, height: 2 }, position: START },
      trailing: { rect: { x: 12, y: 10, width: 12, height: 2 }, position: END },
      cards: [],
      gutters: [],
      complete: { leading: true, trailing: true, empty: true },
    };
    const map = projectKanbanCardDropMap({ density: 'comfortable', cells: [left, right] });

    expect(map.targetAt({ x: 11, y: 6 })?.address.columnId).toBe('left');
    expect(map.targetAt({ x: 12, y: 6 })?.address.columnId).toBe('right');
    expect(map.targetAt({ x: 24, y: 6 })).toBeUndefined();
  });
});

describe('drop-map semantic identity and resource bounds', () => {
  it('rejects aggregate multi-cell work above the package target ceiling', () => {
    const cards = Object.freeze(
      Array.from({ length: 4_097 }, (_, index) =>
        Object.freeze({
          cardKey: index,
          rect: Object.freeze({ x: 0, y: index + 2, width: 1, height: 1 }),
          before: START,
          after: END,
        }),
      ),
    );
    const overloaded = Object.freeze([
      Object.freeze({ ...cell('left'), cards, gutters: Object.freeze([]) }),
      Object.freeze({ ...cell('right'), cards, gutters: Object.freeze([]) }),
    ]);

    expect(() => projectKanbanCardDropMap({ density: 'compact', cells: overloaded })).toThrow(
      KanbanInvalidGeometryError,
    );
  });

  it('keeps one slot identity stable across geometry generations and target representations', () => {
    const first = projectKanbanCardDropMap({ density: 'comfortable', cells: [cell()], geometryGeneration: 4 });
    const second = projectKanbanCardDropMap({ density: 'compact', cells: [cell()], geometryGeneration: 5 });
    const gutter = first.targets.find(({ kind }) => kind === 'resting-gutter');
    const cardBefore = second.targets.find(({ kind, cardKey }) => kind === 'card-before' && cardKey === 2);

    expect(gutter?.slotId).toBe(cardBefore?.slotId);
    expect(gutter?.geometryGeneration).toBe(4);
    expect(cardBefore?.geometryGeneration).toBe(5);
  });

  it('keeps numeric and textual card anchors collision-safe', () => {
    const numeric = {
      ...cell('numeric'),
      cards: [{ cardKey: 1, rect: { x: 1, y: 3, width: 10, height: 2 }, before: START, after: END }],
      gutters: [],
    };
    const textual = {
      ...cell('numeric'),
      cards: [{ cardKey: '1', rect: { x: 1, y: 3, width: 10, height: 2 }, before: START, after: END }],
      gutters: [],
    };
    const numericTarget = projectKanbanCardDropMap({ density: 'compact', cells: [numeric] }).targets.find(
      ({ kind }) => kind === 'card-before',
    );
    const textualTarget = projectKanbanCardDropMap({ density: 'compact', cells: [textual] }).targets.find(
      ({ kind }) => kind === 'card-before',
    );

    // The position is the same start slot, so representation-specific card identities do not alter it.
    expect(numericTarget?.slotId).toBe(textualTarget?.slotId);
    expect(numericTarget?.cardKey).toBe(1);
    expect(textualTarget?.cardKey).toBe('1');
  });

  it('truncates deterministically at the caller target budget', () => {
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [cell()],
      maximumTargets: 3,
    });

    expect(map.targets).toHaveLength(3);
    expect(map.targets.map(({ kind }) => kind)).toEqual(['resting-gutter', 'post-header', 'card-before']);
  });

  it('rejects invalid geometry and target budgets with one sanitized error', () => {
    expect(() => projectKanbanCardDropMap({ density: 'comfortable', cells: [cell()], maximumTargets: 0 })).toThrow(
      KanbanInvalidGeometryError,
    );
    expect(() =>
      projectKanbanCardDropMap({
        density: 'comfortable',
        cells: [{ ...cell(), content: { x: 1, y: 0, width: Number.MAX_SAFE_INTEGER, height: 2 } }],
      }),
    ).toThrow(KanbanInvalidGeometryError);
  });
});
