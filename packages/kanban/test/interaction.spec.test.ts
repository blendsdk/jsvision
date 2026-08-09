import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type {
  CardKey,
  KanbanCardAdapter,
  KanbanColumnMeta,
  KanbanInteractionFacade,
  KanbanQuery,
} from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

interface Card {
  readonly id: CardKey;
  readonly columnId: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
  presentationRevisionOf: (card) => `entity-${typeof card.id}-${String(card.id)}`,
};

/** Creates stable workflow metadata in the requested source order. */
function columns(...columnIds: readonly string[]): readonly KanbanColumnMeta[] {
  return columnIds.map((columnId) => ({ columnId, label: columnId.toUpperCase(), revision: 1 }));
}

/** Mounts one board and flushes its first complete scene publication. */
function mount(board: KanbanBoard<Card>, width = 80, height = 24) {
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const render = createRenderRoot({ width, height }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

/** Creates an eager board whose records remain application-owned reactive values. */
function eagerBoard(
  cards: () => readonly Card[],
  columnIds: readonly string[],
  options: {
    readonly query?: () => KanbanQuery;
    readonly limits?: ConstructorParameters<typeof KanbanBoard<Card>>[0]['limits'];
  } = {},
): KanbanBoard<Card> {
  const source = createEagerKanbanDataSource(cards, {
    columns: () => columns(...columnIds),
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
    search: (card, term) => card.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
  });
  return new KanbanBoard({
    source,
    query: options.query ?? (() => QUERY),
    card: CARD,
    structure: () => ({ revision: 'interaction-structure-v1', columns: [] }),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
}

/** Applies one programmatic transition and flushes the resulting semantic publication. */
async function transition(
  facade: KanbanInteractionFacade,
  command: Parameters<KanbanInteractionFacade['transition']>[0],
): Promise<void> {
  await facade.transition(command);
  await Promise.resolve();
}

describe('Kanban programmatic focus and navigation', () => {
  it('should choose the first card, first header, then board state as initial focus', () => {
    // Initial focus follows visible scene order and never manufactures a hidden card target.
    const populated = eagerBoard(() => [{ id: 1, columnId: 'ready', title: 'First card' }], ['ready']);
    const empty = eagerBoard(() => [], ['ready']);
    const withoutColumns = eagerBoard(() => [], []);
    const renders = [mount(populated), mount(empty), mount(withoutColumns)];

    expect(populated.interaction().snapshot().focused).toEqual({
      kind: 'card',
      cardKey: 1,
      address: { columnId: 'ready' },
    });
    expect(empty.interaction().snapshot().focused).toEqual({ kind: 'column-header', columnId: 'ready' });
    expect(withoutColumns.interaction().snapshot().focused).toEqual({ kind: 'board-state' });
    renders.forEach((render) => render.unmount());
  });

  it('should preserve the preferred visual row across unequal horizontal stacks', async () => {
    // Horizontal movement selects the closest visual center instead of reusing an unrelated array index.
    const cards = [
      { id: 'r1', columnId: 'ready', title: 'Short' },
      { id: 'r2', columnId: 'ready', title: 'A title that wraps over several terminal rows in the narrow card' },
      { id: 'd1', columnId: 'doing', title: 'One' },
      { id: 'd2', columnId: 'doing', title: 'Two with a longer wrapped title' },
      { id: 'd3', columnId: 'doing', title: 'Three' },
    ] satisfies readonly Card[];
    const board = eagerBoard(() => cards, ['ready', 'doing']);
    const render = mount(board, 48, 18);
    const interaction = board.interaction();
    await transition(interaction, {
      kind: 'focus',
      target: { kind: 'card', cardKey: 'r2', address: { columnId: 'ready' } },
    });
    const preferredCenterRow = interaction.snapshot().preferredCenterRow;
    await transition(interaction, { kind: 'navigate', direction: 'right' });

    expect(interaction.snapshot()).toMatchObject({
      focused: { kind: 'card', cardKey: 'd2', address: { columnId: 'doing' } },
      preferredCenterRow,
    });
    render.unmount();
  });

  it('should reconcile removed focus once and not restore it when a filter clears', async () => {
    // A filter fallback becomes the current focus; clearing the filter must not steal focus back.
    const query = signal<KanbanQuery>(QUERY);
    const board = eagerBoard(
      () => [
        { id: 1, columnId: 'ready', title: 'Hidden by query' },
        { id: 2, columnId: 'ready', title: 'Survivor' },
      ],
      ['ready'],
      { query },
    );
    const render = mount(board);
    const interaction = board.interaction();
    await transition(interaction, {
      kind: 'focus',
      target: { kind: 'card', cardKey: 1, address: { columnId: 'ready' } },
    });
    query.set({ search: 'Survivor', filters: [], sort: [] });
    render.flush();
    await transition(interaction, { kind: 'reconcile', reason: 'query' });
    expect(interaction.snapshot().focused).toMatchObject({ kind: 'card', cardKey: 2 });

    query.set(QUERY);
    render.flush();
    await transition(interaction, { kind: 'reconcile', reason: 'query' });
    expect(interaction.snapshot().focused).toMatchObject({ kind: 'card', cardKey: 2 });
    render.unmount();
  });

  it('should fall back after deletion while retaining unloaded identity for bounded acquisition', async () => {
    // Authoritative deletion removes focus, whereas cursor unload keeps the stable identity pending acquisition.
    const cards = signal<readonly Card[]>([
      { id: 1, columnId: 'ready', title: 'Delete me' },
      { id: 2, columnId: 'ready', title: 'Fallback' },
    ]);
    const eager = eagerBoard(cards, ['ready']);
    const eagerRender = mount(eager);
    await transition(eager.interaction(), {
      kind: 'focus',
      target: { kind: 'card', cardKey: 1, address: { columnId: 'ready' } },
    });
    cards.set(cards().slice(1));
    eagerRender.flush();
    await transition(eager.interaction(), { kind: 'reconcile', reason: 'source-publication' });
    expect(eager.interaction().snapshot().focused).toMatchObject({ kind: 'card', cardKey: 2 });
    eagerRender.unmount();

    const windowed = createWindowedKanbanFixture<Card>({
      logicalCardCount: 50,
      columns: columns('ready'),
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const lazy = new KanbanBoard({ source: windowed.source, query: () => QUERY, card: CARD });
    const lazyRender = mount(lazy, 24, 10);
    await transition(lazy.interaction(), {
      kind: 'focus',
      target: { kind: 'card', cardKey: 25, address: { columnId: 'ready' } },
    });
    expect(lazy.interaction().snapshot()).toMatchObject({
      focused: { kind: 'card', cardKey: 25 },
      pendingNavigation: { kind: 'acquire' },
    });
    expect(windowed.controller.pendingRanges().length).toBeGreaterThan(0);
    lazyRender.unmount();
    windowed.dispose();
  });

  it('should keep failed and superseded navigation from moving focus late', async () => {
    // Failed acquisition retains focus, and completion from an older cancelled generation is inert.
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 100,
      columns: columns('ready'),
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const board = new KanbanBoard({ source: fixture.source, query: () => QUERY, card: CARD });
    const render = mount(board, 24, 10);
    const interaction = board.interaction();
    const first = interaction.transition({ kind: 'navigate', direction: 'board-end' });
    const earlier = fixture.controller.pendingRanges()[0];
    if (earlier === undefined) throw new Error('Expected one bounded navigation range request.');
    await transition(interaction, { kind: 'navigate', direction: 'board-start' });
    fixture.controller.rejectRange(earlier.requestId, { code: 'unavailable' });
    await first;

    expect(interaction.snapshot().focused).not.toMatchObject({ kind: 'card', cardKey: 99 });
    expect(interaction.snapshot().pendingNavigation).toBeUndefined();
    render.unmount();
    fixture.dispose();
  });

  it('should reveal previous and next focused columns without publishing a hidden focus target', async () => {
    // Focused-column navigation keeps the preferred row while the destination column is made visible.
    const board = eagerBoard(
      () => [
        { id: 1, columnId: 'ready', title: 'Ready' },
        { id: 2, columnId: 'doing', title: 'Doing' },
        { id: 3, columnId: 'done', title: 'Done' },
      ],
      ['ready', 'doing', 'done'],
    );
    const render = mount(board, 24, 10);
    const interaction = board.interaction();
    expect(board.viewport.metrics().mode).toBe('focused-column');

    await transition(interaction, { kind: 'navigate', direction: 'next-column' });
    expect(interaction.snapshot().focused).toMatchObject({ kind: 'card', cardKey: 2 });
    expect(board.inspection().visibleCards.map((card) => card.cardKey)).toContain(2);
    await transition(interaction, { kind: 'navigate', direction: 'previous-column' });
    expect(interaction.snapshot().focused).toMatchObject({ kind: 'card', cardKey: 1 });
    expect(board.inspection().visibleCards.map((card) => card.cardKey)).toContain(1);
    render.unmount();
  });
});

describe('Kanban programmatic ordered selection', () => {
  it('should keep range extension cell-local and end it when navigation crosses a cell', async () => {
    // Range selection contains only contiguous loaded cards in one cell; crossing a column ends extension.
    const board = eagerBoard(
      () => [
        { id: 1, columnId: 'ready', title: 'One' },
        { id: 2, columnId: 'ready', title: 'Two' },
        { id: 3, columnId: 'ready', title: 'Three' },
        { id: 4, columnId: 'doing', title: 'Four' },
      ],
      ['ready', 'doing'],
    );
    const render = mount(board);
    const interaction = board.interaction();
    await transition(interaction, { kind: 'selection', operation: 'toggle' });
    await transition(interaction, { kind: 'navigate', direction: 'down', extendSelection: true });
    await transition(interaction, { kind: 'navigate', direction: 'down', extendSelection: true });
    expect(interaction.snapshot()).toMatchObject({ selectedCardKeys: [1, 2, 3] });
    expect(interaction.snapshot().rangeAnchor).toMatchObject({ cardKey: 1 });

    await transition(interaction, { kind: 'navigate', direction: 'right', extendSelection: true });
    expect(interaction.snapshot().focused).toMatchObject({ kind: 'card', cardKey: 4 });
    expect(interaction.snapshot().rangeAnchor).toBeUndefined();
    render.unmount();
  });

  it('should select only loaded visible matching cards and reject overflow atomically', async () => {
    // Loaded select-all is deterministic and never truncates or claims a larger logical collection.
    const records = [
      { id: 1, columnId: 'ready', title: 'One' },
      { id: 2, columnId: 'ready', title: 'Two' },
      { id: 3, columnId: 'doing', title: 'Three' },
    ] satisfies readonly Card[];
    const acceptedBoard = eagerBoard(() => records, ['ready', 'doing'], {
      limits: { values: { selectedKeys: 3 } },
    });
    const acceptedRender = mount(acceptedBoard);
    const accepted = await acceptedBoard
      .interaction()
      .transition({ kind: 'selection', operation: 'select-loaded-visible-matching' });
    expect(accepted).toMatchObject({ kind: 'changed' });
    expect(acceptedBoard.interaction().snapshot().selectedCardKeys).toEqual([1, 2, 3]);
    acceptedRender.unmount();

    const board = eagerBoard(() => [...records, { id: 4, columnId: 'doing', title: 'Four' }], ['ready', 'doing'], {
      limits: { values: { selectedKeys: 2 } },
    });
    const render = mount(board);
    const interaction = board.interaction();
    await transition(interaction, { kind: 'selection', operation: 'toggle' });
    const before = interaction.snapshot().selectedCardKeys;
    const result = await interaction.transition({ kind: 'selection', operation: 'select-loaded-visible-matching' });

    expect(result).toMatchObject({ kind: 'unavailable', code: 'selection-limit-exceeded' });
    expect(interaction.snapshot().selectedCardKeys).toEqual(before);
    expect(interaction.snapshot().feedback).toMatchObject({ code: 'selection-limit-exceeded' });
    render.unmount();
  });

  it('should prune hidden selection with an exact count while cursor unload removes none', async () => {
    // View exclusion prunes invisible members with honest feedback, but virtualization alone is never deletion.
    const query = signal<KanbanQuery>(QUERY);
    const board = eagerBoard(
      () => [
        { id: 1, columnId: 'ready', title: 'Keep' },
        { id: 2, columnId: 'ready', title: 'Hide two' },
        { id: 3, columnId: 'ready', title: 'Hide three' },
        { id: 4, columnId: 'ready', title: 'Hide four' },
      ],
      ['ready'],
      { query },
    );
    const render = mount(board);
    const interaction = board.interaction();
    await transition(interaction, { kind: 'selection', operation: 'select-loaded-visible-matching' });
    query.set({ search: 'Keep', filters: [], sort: [] });
    render.flush();
    await transition(interaction, { kind: 'reconcile', reason: 'query' });

    expect(interaction.snapshot().selectedCardKeys).toEqual([1]);
    expect(interaction.snapshot().feedback).toMatchObject({ code: 'selection-pruned', count: 3 });
    render.unmount();

    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 100,
      columns: columns('ready'),
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const lazy = new KanbanBoard({ source: fixture.source, query: () => QUERY, card: CARD });
    const lazyRender = mount(lazy, 24, 10);
    for (const pending of fixture.controller.pendingRanges()) fixture.controller.resolveRange(pending.requestId);
    await Promise.resolve();
    lazyRender.flush();
    await transition(lazy.interaction(), { kind: 'selection', operation: 'toggle' });
    const retained = lazy.interaction().snapshot().selectedCardKeys;
    lazy.scrollTo({ y: 180 });
    lazyRender.flush();
    await transition(lazy.interaction(), { kind: 'reconcile', reason: 'cursor-unload' });
    expect(lazy.interaction().snapshot().selectedCardKeys).toEqual(retained);
    expect(lazy.interaction().snapshot().feedback).not.toMatchObject({ code: 'selection-pruned' });
    lazyRender.unmount();
    fixture.dispose();
  });

  it('should preserve numeric and string identities through selection, pruning, and frozen capture', async () => {
    // Numeric 1 and string "1" remain distinct, ordered identities in every public snapshot.
    const cards = signal<readonly Card[]>([
      { id: 1, columnId: 'ready', title: 'Numeric' },
      { id: '1', columnId: 'ready', title: 'String' },
    ]);
    const board = eagerBoard(cards, ['ready']);
    const render = mount(board);
    const interaction = board.interaction();
    await transition(interaction, { kind: 'selection', operation: 'toggle' });
    await transition(interaction, { kind: 'navigate', direction: 'down' });
    await transition(interaction, { kind: 'selection', operation: 'toggle' });
    const captured = interaction.snapshotEligibleSelection();

    expect(interaction.snapshot().selectedCardKeys).toEqual([1, '1']);
    expect(captured.entries.map((entry) => entry.cardKey)).toEqual([1, '1']);
    expect(captured.entries.map((entry) => entry.entityRevision)).toEqual(['entity-number-1', 'entity-string-1']);
    expect(captured).toMatchObject({ sessionRevision: expect.anything(), queryGeneration: expect.any(Number) });
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.entries)).toBe(true);

    await transition(interaction, { kind: 'selection', operation: 'clear-multiple' });
    expect(captured.entries.map((entry) => entry.cardKey)).toEqual([1, '1']);
    expect(interaction.snapshot().focused).toMatchObject({ kind: 'card', cardKey: '1' });
    render.unmount();
  });

  it('should cancel one transient before clearing multiple selection on a second escape', async () => {
    // Escape gives one registered transient first refusal, then clears only multiple selection while retaining focus.
    const cancel = vi.fn();
    const board = eagerBoard(
      () => [
        { id: 1, columnId: 'ready', title: 'One' },
        { id: 2, columnId: 'ready', title: 'Two' },
      ],
      ['ready'],
    );
    const render = mount(board);
    const interaction = board.interaction();
    await transition(interaction, { kind: 'selection', operation: 'toggle' });
    await transition(interaction, { kind: 'navigate', direction: 'down' });
    await transition(interaction, { kind: 'selection', operation: 'toggle' });
    await transition(interaction, { kind: 'escape', transient: { kind: 'synthetic', cancel } });
    expect(cancel).toHaveBeenCalledOnce();
    expect(interaction.snapshot().selectedCardKeys).toEqual([1, 2]);

    await transition(interaction, { kind: 'escape' });
    expect(interaction.snapshot().selectedCardKeys).toEqual([]);
    expect(interaction.snapshot().focused).toMatchObject({ kind: 'card', cardKey: 2 });
    render.unmount();
  });
});
