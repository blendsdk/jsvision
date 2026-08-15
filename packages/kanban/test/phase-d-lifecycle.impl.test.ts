import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import {
  KanbanBoard,
  createEagerKanbanDataSource,
  createKanbanEventHub,
  createKanbanViewController,
} from '../src/index.js';
import type { KanbanBoardEditorOpenContext, KanbanCardAdapter, KanbanQuery } from '../src/index.js';

interface LifecycleCard {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<LifecycleCard> = Object.freeze({
  keyOf: (card: LifecycleCard) => card.id,
  titleOf: (card: LifecycleCard) => card.title,
  statusOf: (card: LifecycleCard) => card.columnId,
});
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Builds the smallest mounted board that still owns every Phase D binder. */
function mountedBoard() {
  const controller = createKanbanViewController({ initial: { density: 'comfortable' } });
  const events = createKanbanEventHub({ boardId: 'lifecycle-board', retained: 8 });
  let editorContext: KanbanBoardEditorOpenContext | undefined;
  const source = createEagerKanbanDataSource<LifecycleCard>(
    () => [{ id: 1, columnId: 'ready', title: 'Lifecycle card' }],
    {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    },
  );
  const board = new KanbanBoard({
    source,
    query: () => QUERY,
    card: CARD,
    view: { controller, chrome: 'standard' },
    events,
    actions: {
      boardId: 'lifecycle-board',
      host: { kind: 'terminal', platform: 'linux' },
      executePackageAction: () => ({ kind: 'handled' }),
    },
    editor: {
      open: (_cardKey, _authority, context) => {
        editorContext = context;
      },
    },
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 64, height: 20 }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return { application, board, controller, events, editorContext: () => editorContext };
}

describe('Phase D board binding lifecycle', () => {
  it('should reflow controller replacements and stop observing them after board disposal', () => {
    const fixture = mountedBoard();
    const before = fixture.board.inspection().layoutReflows;

    expect(fixture.controller.apply({ kind: 'set-density', density: 'compact' })).toMatchObject({ kind: 'changed' });
    fixture.application.loop.renderRoot.flush();
    expect(fixture.board.inspection().layoutReflows).toBeGreaterThan(before);
    const disposedAt = fixture.board.inspection().layoutReflows;

    fixture.board.dispose();
    expect(fixture.controller.apply({ kind: 'set-density', density: 'spacious' })).toMatchObject({ kind: 'changed' });
    fixture.application.loop.renderRoot.flush();

    expect(fixture.board.inspection().layoutReflows).toBe(disposedAt);
    expect(fixture.board.actions()?.invoke('kanban.help.open', 'programmatic', { kind: 'board' })).toEqual({
      kind: 'unavailable',
      code: 'router-disposed',
    });
    fixture.controller.dispose();
    fixture.events.dispose();
  });

  it('should abort an editor acquisition when its owning board is disposed', async () => {
    const fixture = mountedBoard();
    const outcome = fixture.board.actions()?.invoke('kanban.card.activate', 'programmatic', {
      kind: 'card',
      cardKey: 1,
    });
    expect(outcome).toEqual({ kind: 'handled' });
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    expect(fixture.editorContext()?.signal.aborted).toBe(false);

    fixture.board.dispose();

    expect(fixture.editorContext()?.signal.aborted).toBe(true);
    fixture.controller.dispose();
    fixture.events.dispose();
  });
});
