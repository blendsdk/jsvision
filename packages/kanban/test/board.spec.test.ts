import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Group, View, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type {
  KanbanBoardInspection,
  KanbanCardAdapter,
  CardKey,
  KanbanColumnMeta,
  KanbanExtensionRequest,
  KanbanPublicationNotice,
  KanbanQuery,
  KanbanSessionPublication,
} from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

interface DomainRecord {
  readonly ticketNumber: number;
  readonly workflowStage: string;
  readonly caption: string;
  readonly stateLabel: string;
}

interface InspectedColumn {
  readonly columnId: string;
}

interface InspectedCard {
  readonly cardKey: CardKey;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = { filters: [], sort: [] };
const CARD: KanbanCardAdapter<DomainRecord> = {
  keyOf: (record) => record.ticketNumber,
  titleOf: (record) => record.caption,
  statusOf: (record) => record.stateLabel,
};

/** Creates deterministic source column metadata in requested semantic order. */
function columns(...ids: readonly string[]): readonly KanbanColumnMeta[] {
  return ids.map((columnId) => ({ columnId, label: columnId.toUpperCase(), revision: 1 }));
}

/** Mounts one board as ordinary fill content without giving it desktop authority. */
function mountBoard(board: KanbanBoard<DomainRecord>, width = 80, height = 24) {
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const render = createRenderRoot({ width, height }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

/** Counts the actual mounted View topology without reading Kanban internals. */
function countViews(view: View): number {
  if (!(view instanceof Group)) return 1;
  return 1 + view.children.reduce((count: number, child: View) => count + countViews(child), 0);
}

describe('Kanban isolated consumer contract', () => {
  it('should typecheck generic Board, pure-layout, and testing imports under isolated NodeNext resolution', () => {
    // The fixture imports supported package entries only and contains no StandardCard conversion or unsafe cast.
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const authoredFixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'consumer-board-types');
    const compiler = join(repositoryRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
    const consumer = mkdtempSync(join(tmpdir(), 'jsvision-kanban-board-types-'));
    try {
      for (const name of ['package.json', 'tsconfig.json', 'index.ts']) {
        cpSync(join(authoredFixture, name), join(consumer, name));
      }
      const scope = join(consumer, 'node_modules', '@jsvision');
      mkdirSync(scope, { recursive: true });
      symlinkSync(packageRoot, join(scope, 'kanban'), process.platform === 'win32' ? 'junction' : 'dir');

      expect(() =>
        execFileSync(compiler, ['-p', 'tsconfig.json'], {
          cwd: consumer,
          encoding: 'utf8',
          maxBuffer: 1_048_576,
          timeout: 60_000,
        }),
      ).not.toThrow();
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  });
});

describe('Kanban Board public composition', () => {
  it('should construct a generic application record board without StandardCard inheritance or conversion', () => {
    // The board retains the typed adapter boundary and exposes exactly one owned viewport.
    const records = signal<readonly DomainRecord[]>([
      { ticketNumber: 1, workflowStage: 'ready', caption: 'Generic ticket', stateLabel: 'Ready' },
    ]);
    const source = createEagerKanbanDataSource(records, {
      columns: () => columns('ready'),
      keyOf: (record) => record.ticketNumber,
      columnOf: (record) => record.workflowStage,
    });
    const board = new KanbanBoard<DomainRecord>({ source, query: () => QUERY, card: CARD });

    expect(board).toBeInstanceOf(Group);
    expect(board.viewport).toBeDefined();
    expect(records()[0]).not.toHaveProperty('key');
    expect(records()[0]).not.toHaveProperty('title');
    expect(records()[0]).not.toHaveProperty('status');
  });

  it('should keep mounted View topology bounded for 100,000 logical cards', () => {
    // Logical cards remain source records, never one mounted View per item.
    const fixture = createWindowedKanbanFixture<DomainRecord>({
      logicalCardCount: 100_000,
      columns: columns('ready', 'doing', 'done'),
      materialize: () => [],
      keyOf: (record) => record.ticketNumber,
    });
    const board = new KanbanBoard<DomainRecord>({ source: fixture.source, query: () => QUERY, card: CARD });
    const render = mountBoard(board);

    expect(countViews(board)).toBeLessThanOrEqual(10);
    expect(board.children.filter((child: View) => child === board.viewport)).toHaveLength(1);
    expect(fixture.metrics().createdCursors).toBeLessThan(100_000);

    render.unmount();
    fixture.dispose();
  });

  it('should clear contradictory pending metadata and continue rendering authoritative application data', async () => {
    // Accepted intent is metadata only; a contradictory notice clears it while source content wins.
    const records = signal<readonly DomainRecord[]>([
      { ticketNumber: 7, workflowStage: 'ready', caption: 'Application value', stateLabel: 'Ready' },
    ]);
    const source = createEagerKanbanDataSource(records, {
      columns: () => columns('ready'),
      keyOf: (record) => record.ticketNumber,
      columnOf: (record) => record.workflowStage,
    });
    const publication = {
      operationId: 'edit-7',
      subjects: [{ kind: 'card' as const, cardKey: 7, baselineRevision: 'card-1', expectedRevision: 'card-2' }],
    };
    const dispatcher = vi.fn(() => ({ kind: 'accepted' as const, operationId: 'edit-7', publication }));
    const board = new KanbanBoard<DomainRecord>({ source, query: () => QUERY, card: CARD, dispatcher });
    const render = mountBoard(board, 24, 10);
    const request: KanbanExtensionRequest<'example.edit', { readonly cardKey: number; readonly title: string }> = {
      kind: 'extension',
      extensionId: 'example.edit',
      operationId: 'edit-7',
      expected: {},
      payload: { cardKey: 7, title: 'Uncommitted proposal' },
      signal: new AbortController().signal,
    };

    await board.request(request);
    expect(board.inspection().pendingOperations).toHaveLength(1);
    const notice: KanbanPublicationNotice = { kind: 'contradictory', ...publication };
    board.reconcilePublication(notice);
    render.flush();
    const inspection: KanbanBoardInspection = board.inspection();

    expect(inspection.pendingOperations).toEqual([]);
    expect(inspection.clearedPublication).toEqual(notice);
    expect(inspection.visibleCards).toEqual([
      expect.objectContaining({ cardKey: 7, title: expect.stringContaining('Application value') }),
    ]);
    expect(JSON.stringify(inspection)).not.toContain('Uncommitted proposal');
    expect(records()[0]?.caption).toBe('Application value');

    render.unmount();
  });

  it('should retain selected identity through unload and prune it only after authoritative deletion', async () => {
    // Virtualization is not deletion; only the source identity batch may remove selected identity.
    const identity = signal({ selectedCardKeys: [7] as readonly number[], focusedCardKey: 7 });
    const fixture = createWindowedKanbanFixture<DomainRecord>({
      logicalCardCount: 100,
      columns: columns('ready'),
      initialRevision: 1,
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          ticketNumber: start + offset,
          workflowStage: 'ready',
          caption: `Ticket ${start + offset}`,
          stateLabel: 'Ready',
        })),
      keyOf: (record) => record.ticketNumber,
    });
    const board = new KanbanBoard<DomainRecord>({
      source: fixture.source,
      query: () => QUERY,
      card: CARD,
      identity,
    });
    const render = mountBoard(board, 24, 10);
    for (const request of fixture.controller.pendingRanges()) fixture.controller.resolveRange(request.requestId);
    await Promise.resolve();
    render.flush();

    board.viewport.scrollTo({ y: 90 });
    render.flush();
    expect(board.inspection().identity.selectedCardKeys).toEqual([7]);
    board.viewport.scrollTo({ y: 0 });
    render.flush();
    expect(board.inspection().identity.selectedCardKeys).toEqual([7]);

    const publication: KanbanSessionPublication = {
      revision: 2,
      state: { kind: 'partial' },
      columns: columns('ready'),
      swimlanes: [],
      counts: {
        total: { quality: 'unknown' },
        matching: { quality: 'unknown' },
        loaded: { quality: 'exact', value: 0 },
        visible: { quality: 'unknown' },
        selected: { quality: 'unknown' },
        wip: { quality: 'unknown' },
      },
      headers: { revision: 2, columns: [{ columnId: 'ready', label: 'READY' }], swimlanes: [] },
      identityChanges: { revision: 2, changes: [{ kind: 'deleted-card', cardKey: 7 }] },
    };
    fixture.controller.publishSession(publication);
    render.flush();

    expect(board.inspection().identity.selectedCardKeys).toEqual([]);
    expect(board.inspection().identity.focusedCardKey).toBeUndefined();

    render.unmount();
    fixture.dispose();
  });

  it('should render a focusable no-columns state with zero header, card, or action targets', () => {
    // Empty workflow structure is a valid localized board state, not a partial mount failure.
    const source = createEagerKanbanDataSource<DomainRecord>(() => [], {
      columns: () => [],
      keyOf: (record) => record.ticketNumber,
      columnOf: (record) => record.workflowStage,
    });
    const board = new KanbanBoard<DomainRecord>({ source, query: () => QUERY, card: CARD });
    const render = mountBoard(board, 24, 8);
    const inspection = board.inspection();

    expect(board.focusable).toBe(true);
    expect(inspection.state).toEqual({ kind: 'no-columns', label: 'No columns' });
    expect(inspection.visibleColumns).toEqual([]);
    expect(inspection.visibleCards).toEqual([]);
    expect(inspection.actionTargets).toEqual([]);

    render.unmount();
  });

  it('should follow authoritative column reorder without replacing card identity or topology', () => {
    // Source order changes presentation only; application records and bounded View ownership remain stable.
    const first: DomainRecord = Object.freeze({
      ticketNumber: 1,
      workflowStage: 'ready',
      caption: 'First',
      stateLabel: 'Ready',
    });
    const second: DomainRecord = Object.freeze({
      ticketNumber: 2,
      workflowStage: 'done',
      caption: 'Second',
      stateLabel: 'Done',
    });
    const liveColumns = signal<readonly KanbanColumnMeta[]>(columns('ready', 'doing', 'done'));
    const source = createEagerKanbanDataSource(() => [first, second], {
      columns: liveColumns,
      keyOf: (record) => record.ticketNumber,
      columnOf: (record) => record.workflowStage,
    });
    const board = new KanbanBoard<DomainRecord>({ source, query: () => QUERY, card: CARD });
    const render = mountBoard(board);
    const topologyBefore = countViews(board);

    liveColumns.set(columns('done', 'doing', 'ready'));
    render.flush();
    const inspection = board.inspection();

    expect(inspection.visibleColumns.map((column: InspectedColumn) => column.columnId)).toEqual([
      'done',
      'doing',
      'ready',
    ]);
    expect(inspection.visibleCards.map((card: InspectedCard) => card.cardKey).sort()).toEqual([1, 2]);
    expect(countViews(board)).toBe(topologyBefore);
    expect(first).toEqual({ ticketNumber: 1, workflowStage: 'ready', caption: 'First', stateLabel: 'Ready' });
    expect(second).toEqual({ ticketNumber: 2, workflowStage: 'done', caption: 'Second', stateLabel: 'Done' });

    render.unmount();
  });

  it('should remove the focused-column navigator with one reflow and return its row to the viewport', () => {
    // The navigator is conditional DSL content rather than a permanent side rail or overlapping overlay.
    const source = createEagerKanbanDataSource<DomainRecord>(() => [], {
      columns: () => columns('ready', 'doing', 'done'),
      keyOf: (record) => record.ticketNumber,
      columnOf: (record) => record.workflowStage,
    });
    const board = new KanbanBoard<DomainRecord>({ source, query: () => QUERY, card: CARD });
    const render = mountBoard(board, 36, 10);
    const narrow = board.inspection();

    expect(narrow.navigator.visible).toBe(true);
    expect(narrow.viewportRect.height).toBe(9);
    render.resize({ width: 80, height: 10 });
    render.flush();
    const wide = board.inspection();

    expect(wide.navigator.visible).toBe(false);
    expect(wide.viewportRect.height).toBe(10);
    expect(wide.layoutReflows).toBe(narrow.layoutReflows + 1);
    expect(wide.viewportRect.y).toBe(0);

    render.unmount();
  });

  it('should compose one viewport session and dispose it exactly once with the board', () => {
    // Board composition delegates read ownership to its single viewport and never opens a second coordinator.
    const fixture = createWindowedKanbanFixture<DomainRecord>({
      logicalCardCount: 10,
      columns: columns('ready'),
      materialize: () => [],
      keyOf: (record) => record.ticketNumber,
    });
    const board = new KanbanBoard<DomainRecord>({ source: fixture.source, query: () => QUERY, card: CARD });
    const render = mountBoard(board, 24, 8);

    expect(fixture.metrics().openedSessions).toBe(1);
    expect(board.children.filter((child: View) => child === board.viewport)).toHaveLength(1);
    render.unmount();
    render.unmount();
    board.dispose();
    board.dispose();

    expect(fixture.metrics().disposedSessions).toBe(1);
    expect(fixture.metrics().disposedCursors).toBe(fixture.metrics().createdCursors);
    fixture.dispose();
  });
});
