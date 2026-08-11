/** Mounted integration coverage for the complete Phase C card-drag input and authority path. */
import { createApplication, resolveCapabilities, signal } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type {
  KanbanCardAdapter,
  KanbanEligibility,
  KanbanQuery,
  KanbanRequestDispatcher,
  KanbanRequestProposal,
  KanbanRequestResult,
  KanbanStructurePolicy,
} from '../src/index.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly revision: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [], viewRevision: 'view-r7' });
const CARD: KanbanCardAdapter<Card> = Object.freeze({
  keyOf: (card: Card) => card.id,
  titleOf: (card: Card) => card.title,
  statusOf: (card: Card) => card.columnId,
  presentationRevisionOf: (card: Card) => card.revision,
});
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
  vi.useRealTimers();
});

/** Creates and mounts a real board with current policy and mutation seams. */
function mountedBoard(
  dispatcher: KanbanRequestDispatcher,
  eligibility: (proposal: KanbanRequestProposal) => KanbanEligibility,
  options: {
    readonly records?: () => readonly Card[];
    readonly structure?: () => KanbanStructurePolicy<Card>;
  } = {},
) {
  const records =
    options.records ??
    (() =>
      Object.freeze([
        Object.freeze({ id: 1, columnId: 'ready', title: 'Move me', revision: 'card-1-r1' }),
        Object.freeze({ id: 2, columnId: 'doing', title: 'Destination anchor', revision: 'card-2-r1' }),
      ]));
  const source = createEagerKanbanDataSource(records, {
    columns: () => [
      { columnId: 'ready', label: 'Ready', revision: 'ready-r1' },
      { columnId: 'doing', label: 'Doing', revision: 'doing-r1' },
      { columnId: 'done', label: 'Done', revision: 'done-r1' },
      { columnId: 'blocked', label: 'Blocked', revision: 'blocked-r1' },
    ],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => QUERY,
    card: CARD,
    dispatcher,
    operationEligibility: eligibility,
    ...(options.structure === undefined ? {} : { structure: options.structure }),
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 60, height: 16 }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return Object.freeze({ application, board });
}

/** Creates a grouped board with one visible card and one temporarily revealable collapsed swimlane. */
function mountedCollapsedBoard() {
  const records: readonly (Card & { readonly team: string })[] = Object.freeze([
    Object.freeze({ id: 1, columnId: 'ready', team: 'beta', title: 'Drag source', revision: 'card-1-r1' }),
    Object.freeze({ id: 2, columnId: 'ready', team: 'alpha', title: 'Collapsed target', revision: 'card-2-r1' }),
  ]);
  const source = createEagerKanbanDataSource(() => records, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'ready-r1' }],
    swimlanes: () => [
      { swimlaneId: 'alpha', label: 'Team Alpha', revision: 'alpha-r1' },
      { swimlaneId: 'beta', label: 'Team Beta', revision: 'beta-r1' },
    ],
    groupingFields: [{ id: 'team', swimlaneOf: (card) => card.team }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
  const structure: KanbanStructurePolicy<Card & { readonly team: string }> = Object.freeze({
    revision: 'policy-r1',
    columns: Object.freeze([]),
    grouping: Object.freeze({
      fieldId: 'team',
      collapsedSwimlaneIds: Object.freeze(['alpha']),
      unassigned: Object.freeze({ swimlaneId: 'unassigned', label: 'Unassigned', revision: 'unassigned-r1' }),
      presentation: 'separator',
    }),
  });
  const board = new KanbanBoard({
    source,
    query: () => ({ ...QUERY, groupBy: 'team' }),
    card: CARD,
    structure: () => structure,
    dispatcher: (request) => ({ kind: 'accepted', operationId: request.operationId }),
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 60, height: 18 }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return Object.freeze({ application, board });
}

/** Converts viewport-local inspection geometry to absolute event-loop coordinates. */
function absolute<TCard>(application: Application, board: KanbanBoard<TCard>, x: number, y: number) {
  const origin = application.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected mounted Kanban viewport geometry.');
  return Object.freeze({ x: origin.x + x + 1, y: origin.y + y + 1 });
}

/** Drives one real capture-backed drag from card 1 into the visible Doing cell. */
function dragToDoing(application: Application, board: KanbanBoard<Card>, release = true) {
  const inspection = board.inspection();
  const source = inspection.actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 1);
  const destination = inspection.actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 2);
  if (source === undefined || destination === undefined) throw new Error('Expected mounted drag geometry.');
  const down = absolute(application, board, source.x + 1, source.y + 1);
  const threshold = absolute(application, board, source.x + 2, source.y + 1);
  const target = absolute(application, board, destination.x + 1, destination.y + 1);
  application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
  application.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, ...threshold });
  application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...target });
  if (release) application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...target });
  return target;
}

/** Drains coordinator microtasks without depending on host time. */
async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

/** Returns the current terminal frame as plain text for projection-only assertions. */
function frameText(application: Application): string {
  return application.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

describe('mounted card-drag authority integration', () => {
  it('keeps a hovered collapsed swimlane expanded through reprojection and restores it on release', () => {
    vi.useFakeTimers();
    const { application, board } = mountedCollapsedBoard();
    expect(board.inspection().visibleCards.some(({ cardKey }) => cardKey === 2)).toBe(false);
    const source = board.inspection().actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 1);
    const header = board
      .inspection()
      .actionTargets.find(({ kind, swimlaneId }) => kind === 'swimlane-header' && swimlaneId === 'alpha');
    if (source === undefined || header === undefined) throw new Error('Expected collapsed-swimlane drag geometry.');
    const down = absolute(application, board, source.x + 1, source.y + 1);
    const threshold = absolute(application, board, source.x + 2, source.y + 1);
    const hover = absolute(application, board, header.x + 1, header.y);
    application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
    application.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, ...threshold });
    application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...hover });

    vi.advanceTimersByTime(500);
    application.loop.renderRoot.flush();
    application.loop.renderRoot.flush();
    expect(frameText(application)).toContain('Collapsed target');

    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...hover });
    application.loop.renderRoot.flush();
    expect(frameText(application)).not.toContain('Collapsed target');
  });

  it('captures, evaluates, and dispatches one view-revision-bound move through the real event loop', async () => {
    const dispatcher = vi.fn((request): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: request.operationId,
    }));
    const { application, board } = mountedBoard(dispatcher, () => ({ kind: 'allowed' }));

    dragToDoing(application, board);
    await settle();

    expect(dispatcher).toHaveBeenCalledOnce();
    expect(dispatcher.mock.calls[0]?.[0]).toMatchObject({
      kind: 'card-move',
      viewRevision: 'view-r7',
      moved: [{ cardKey: 1 }],
      target: { columnId: 'doing' },
    });
  });

  it('shows current blocked policy to drag admission and never invokes the dispatcher', async () => {
    const dispatcher = vi.fn((_request): KanbanRequestResult => {
      throw new Error('blocked drag must not dispatch');
    });
    const { application, board } = mountedBoard(dispatcher, () => ({
      kind: 'blocked',
      code: 'transition-blocked',
    }));

    dragToDoing(application, board);
    await settle();

    expect(dispatcher).not.toHaveBeenCalled();
    expect(board.inspection().pendingOperations).toEqual([]);
  });

  it('cancels an active mounted drag on host focus loss without dispatching', async () => {
    const dispatcher = vi.fn();
    const { application, board } = mountedBoard(dispatcher, () => ({ kind: 'allowed' }));
    dragToDoing(application, board, false);

    application.loop.dispatch({ type: 'focus', focused: false });
    await settle();

    expect(dispatcher).not.toHaveBeenCalled();
    expect(board.inspection().pendingOperations).toEqual([]);
  });

  it('cancels a mounted drag when application structure policy changes', async () => {
    const dispatcher = vi.fn();
    const structure = signal<KanbanStructurePolicy<Card>>({ revision: 'policy-r1', columns: [] });
    const { application, board } = mountedBoard(dispatcher, () => ({ kind: 'allowed' }), { structure });
    const target = dragToDoing(application, board, false);

    structure.set({ revision: 'policy-r2', columns: [] });
    await settle();
    application.loop.renderRoot.flush();
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...target });
    await settle();

    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('preserves an active drag across an unrelated publication and releases with fresh placement', async () => {
    const records = signal<readonly Card[]>([
      { id: 1, columnId: 'ready', title: 'Move me', revision: 'card-1-r1' },
      { id: 2, columnId: 'doing', title: 'Destination anchor', revision: 'card-2-r1' },
      { id: 3, columnId: 'done', title: 'Unrelated', revision: 'card-3-r1' },
    ]);
    const dispatcher = vi.fn((request): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: request.operationId,
    }));
    const { application, board } = mountedBoard(dispatcher, () => ({ kind: 'allowed' }), { records });
    const target = dragToDoing(application, board, false);

    records.set([
      records()[0]!,
      records()[1]!,
      { id: 3, columnId: 'blocked', title: 'Unrelated changed', revision: 'card-3-r2' },
    ]);
    await settle();
    application.loop.renderRoot.flush();
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...target });
    await settle();

    expect(dispatcher).toHaveBeenCalledOnce();
    expect(dispatcher.mock.calls[0]?.[0]).toMatchObject({
      moved: [{ sourceRevision: 2, sourcePlacement: { cursorRevision: 2 } }],
    });
  });

  it('cancels an active drag when its source card entity revision changes', async () => {
    const records = signal<readonly Card[]>([
      { id: 1, columnId: 'ready', title: 'Move me', revision: 'card-1-r1' },
      { id: 2, columnId: 'doing', title: 'Destination anchor', revision: 'card-2-r1' },
    ]);
    const dispatcher = vi.fn();
    const { application, board } = mountedBoard(dispatcher, () => ({ kind: 'allowed' }), { records });
    const target = dragToDoing(application, board, false);

    records.set([{ id: 1, columnId: 'ready', title: 'Move me changed', revision: 'card-1-r2' }, records()[1]!]);
    await settle();
    application.loop.renderRoot.flush();
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...target });
    await settle();

    expect(dispatcher).not.toHaveBeenCalled();
  });
});
