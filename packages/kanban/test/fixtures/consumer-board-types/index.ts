import { KanbanBoard, createKanbanColumnId, solveKanbanColumnWidths } from '@jsvision/kanban';
import type { KanbanCardAdapter, KanbanQuery } from '@jsvision/kanban';
import { createWindowedKanbanFixture } from '@jsvision/kanban/testing';

interface DomainRecord {
  readonly ticketNumber: number;
  readonly workflowStage: string;
  readonly caption: string;
  readonly stateLabel: string;
}

const columns = [{ columnId: createKanbanColumnId('ready'), label: 'Ready', revision: 1 }] as const;
const fixture = createWindowedKanbanFixture<DomainRecord>({
  logicalCardCount: 100_000,
  columns,
  materialize: ({ start, end }) =>
    Array.from({ length: end - start }, (_, offset) => ({
      ticketNumber: start + offset,
      workflowStage: 'ready',
      caption: `Ticket ${start + offset}`,
      stateLabel: 'Ready',
    })),
  keyOf: (record) => record.ticketNumber,
});
const query: KanbanQuery = { filters: [], sort: [] };
const card: KanbanCardAdapter<DomainRecord> = {
  keyOf: (record) => record.ticketNumber,
  titleOf: (record) => record.caption,
  statusOf: (record) => record.stateLabel,
};

const board = new KanbanBoard<DomainRecord>({ source: fixture.source, query: () => query, card });
const widths = solveKanbanColumnWidths({ availableWidth: 24, columns, focusedColumnId: 'ready' });

if (board.viewport === undefined || widths.columns[0]?.columnId !== 'ready') {
  throw new Error('the public Kanban board contract is unavailable');
}

fixture.dispose();
