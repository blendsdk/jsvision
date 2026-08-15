/** Specification oracle for Phase D board composition, action parity, and compatibility. */
import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  KanbanBoard,
  createEagerKanbanDataSource,
  createKanbanEventHub,
  createKanbanReadOnlyCapabilityProvider,
  createKanbanViewController,
} from '../src/index.js';
import type { KanbanCardAdapter, KanbanQuery } from '../src/index.js';

interface WorkItem {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly revision: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [], viewRevision: 'legacy-view-r1' });
const CARD: KanbanCardAdapter<WorkItem> = Object.freeze({
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: (card) => card.columnId,
  presentationRevisionOf: (card) => card.revision,
});
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Creates a deterministic two-card source with one explicit workflow column. */
function source() {
  return createEagerKanbanDataSource<WorkItem>(
    () => [
      { id: 1, columnId: 'ready', title: 'First', revision: 'card-1-r1' },
      { id: 2, columnId: 'ready', title: 'Second', revision: 'card-2-r1' },
    ],
    {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'column-r1' }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    },
  );
}

/** Constructs a board through the JavaScript boundary so the red oracle can precede public typing. */
function boardWith(options: Readonly<Record<string, unknown>>): KanbanBoard<WorkItem> {
  return Reflect.construct(KanbanBoard, [{ source: source(), query: () => QUERY, card: CARD, ...options }]);
}

/** Mounts one real board and completes its source/controller setup transaction. */
function mount(board: KanbanBoard<WorkItem>, width = 60, height = 18): Application {
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width, height }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return application;
}

/** Reads the required board-owned action surface without inventing a private implementation path. */
function actionSurface(board: KanbanBoard<WorkItem>): object {
  const getter: unknown = Reflect.get(board, 'actions');
  expect(getter).toBeTypeOf('function');
  if (typeof getter !== 'function') throw new Error('Missing board-owned Phase D action surface.');
  const value: unknown = Reflect.apply(getter, board, []);
  expect(value).toBeTypeOf('object');
  if (typeof value !== 'object' || value === null) throw new Error('Missing configured Phase D actions.');
  return value;
}

/** Invokes one named method on the public action surface. */
function invokeAction(surface: object, name: string, parameters: readonly unknown[]) {
  const method: unknown = Reflect.get(surface, name);
  expect(method).toBeTypeOf('function');
  if (typeof method !== 'function') throw new Error(`Missing action method: ${name}`);
  return Reflect.apply(method, surface, parameters);
}

describe('Phase D board composition', () => {
  it('preserves legacy construction while a controller owns only its declared view facets', () => {
    const legacyPresentation = vi.fn(() => ({
      selection: { fieldIds: ['owner'], checklistIds: ['tasks'] },
      visualState: {
        focused: false,
        selected: false,
        rangeAnchor: false,
        readOnly: true,
        invalid: false,
        operation: 'idle' as const,
      },
    }));
    const legacy = boardWith({ cardPresentation: legacyPresentation });
    mount(legacy);

    expect(Reflect.get(legacy, 'viewBar')).toBeUndefined();
    expect(Reflect.get(legacy, 'actions')).toBeTypeOf('function');
    const legacyActions = Reflect.apply(Reflect.get(legacy, 'actions'), legacy, []);
    expect(legacyActions).toBeUndefined();
    expect(legacyPresentation).toHaveBeenCalled();
    expect(legacy.inspection().visibleCards[0]?.descriptor.marker.cues).toContain('read-only');

    const controller = createKanbanViewController({ initial: { density: 'compact' } });
    const composed = boardWith({
      view: { controller },
      density: () => 'spacious',
      cardPresentation: legacyPresentation,
    });
    mount(composed);
    expect(composed.inspection().visibleCards[0]?.descriptor.density).toBe('compact');
    expect(composed.inspection().visibleCards[0]?.descriptor.marker.cues).toContain('read-only');
    controller.dispose();
  });

  it('routes every producer through one board-owned context and removes read-only pointer targets', () => {
    const events = createKanbanEventHub({ boardId: 'board-main' });
    const routed: unknown[] = [];
    const board = boardWith({
      events,
      actions: {
        boardId: 'board-main',
        host: { kind: 'terminal', platform: 'linux' },
        capability: createKanbanReadOnlyCapabilityProvider(),
        extensions: [
          {
            id: 'acme.inspect',
            category: 'application',
            labelMessageId: 'acme.inspect.label',
            helpMessageId: 'acme.inspect.help',
            target: 'card',
            capability: 'acme.inspect',
            bindings: ['alt+x'],
            handler: (invocation: unknown) => {
              routed.push(invocation);
              return { kind: 'handled' };
            },
          },
        ],
      },
    });
    mount(board);
    const actions = actionSurface(board);
    const target = { kind: 'card', cardKey: 1, revision: 'card-1-r1' };

    expect(invokeAction(actions, 'pointerAffordance', ['kanban.card.edit', target])).toEqual({
      visible: false,
      enabled: false,
    });
    expect(invokeAction(actions, 'pointerAffordance', ['kanban.card.open', target])).toEqual({
      visible: true,
      enabled: true,
    });
    for (const origin of ['menu', 'context-menu', 'status', 'programmatic'] as const) {
      expect(invokeAction(actions, 'invoke', ['acme.inspect', origin, target])).toEqual({ kind: 'handled' });
    }
    expect(invokeAction(actions, 'pointer', ['acme.inspect', target])).toEqual({ kind: 'handled' });
    expect(
      invokeAction(actions, 'keyboard', [{ type: 'key', key: 'x', ctrl: false, alt: true, shift: false }, target]),
    ).toEqual({ kind: 'handled' });
    expect(routed).toHaveLength(6);
    expect(routed).toMatchObject(
      ['menu', 'context-menu', 'status', 'programmatic', 'pointer', 'keyboard'].map((origin) => ({
        boardId: 'board-main',
        origin,
        source: { state: 'ready', queryRevision: expect.anything() },
        view: { revision: expect.anything() },
      })),
    );
  });

  it('maps package activation and configuration actions onto existing semantic board seams', async () => {
    const interactions: unknown[] = [];
    const board = boardWith({
      onInteraction: (interaction: unknown) => interactions.push(interaction),
      actions: { boardId: 'board-main', host: { kind: 'terminal', platform: 'linux' } },
    });
    mount(board);
    const actions = actionSurface(board);

    expect(
      invokeAction(actions, 'invoke', [
        'kanban.card.activate',
        'programmatic',
        { kind: 'card', cardKey: 1, revision: 'card-1-r1' },
      ]),
    ).toEqual({ kind: 'handled' });
    expect(
      invokeAction(actions, 'invoke', [
        'kanban.column.configure',
        'context-menu',
        { kind: 'column', columnId: 'ready', revision: 'column-r1' },
      ]),
    ).toEqual({ kind: 'handled' });
    for (let index = 0; index < 8; index += 1) await Promise.resolve();

    expect(interactions).toMatchObject([
      { kind: 'open-card', origin: 'programmatic', scope: { kind: 'card', cardKey: 1 } },
      {
        kind: 'scoped-action',
        origin: 'context-menu',
        actionId: 'configure',
        scope: { kind: 'column', columnId: 'ready' },
      },
    ]);
  });

  it('rejects event/action board identity mismatch and releases the owned router with the board', () => {
    const events = createKanbanEventHub({ boardId: 'board-other' });
    expect(() =>
      boardWith({
        events,
        actions: { boardId: 'board-main', host: { kind: 'terminal', platform: 'linux' } },
      }),
    ).toThrow();

    const board = boardWith({
      actions: { boardId: 'board-main', host: { kind: 'terminal', platform: 'linux' } },
    });
    mount(board);
    const actions = actionSurface(board);
    board.dispose();
    expect(invokeAction(actions, 'invoke', ['kanban.help.open', 'programmatic', { kind: 'board' }])).toEqual({
      kind: 'unavailable',
      code: 'router-disposed',
    });
  });
});
