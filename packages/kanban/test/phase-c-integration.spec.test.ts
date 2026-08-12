/** Specification coverage for Phase C cross-input operations and cancellation-first integration. */
import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application, DispatchEvent } from '@jsvision/ui';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KanbanBoard, KanbanViewport, createEagerKanbanDataSource } from '../src/index.js';
import type {
  KanbanCardAdapter,
  KanbanInteractionFacade,
  KanbanQuery,
  KanbanRequest,
  KanbanRequestDispatcher,
} from '../src/index.js';
import * as kanbanTesting from '../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly swimlaneId: string;
  readonly title: string;
  readonly revision: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [], viewRevision: 'phase-c-view-r1' });
const CARDS: readonly Card[] = Object.freeze([
  Object.freeze({ id: 1, columnId: 'ready', swimlaneId: 'alpha', title: 'First', revision: 'card-1-r1' }),
  Object.freeze({ id: 2, columnId: 'ready', swimlaneId: 'alpha', title: 'Second', revision: 'card-2-r1' }),
  Object.freeze({ id: 3, columnId: 'doing', swimlaneId: 'alpha', title: 'Anchor', revision: 'card-3-r1' }),
]);
const CARD: KanbanCardAdapter<Card> = Object.freeze({
  keyOf: (card: Card) => card.id,
  titleOf: (card: Card) => card.title,
  statusOf: (card: Card) => card.columnId,
  presentationRevisionOf: (card: Card) => card.revision,
});
const applications: Application[] = [];
const repoRoot = join(import.meta.dirname, '..', '..', '..');

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Creates the same explicit structure and card fixture for each input origin. */
function source() {
  return createEagerKanbanDataSource<Card>(() => CARDS, {
    columns: () => [
      { columnId: 'ready', label: 'Ready', revision: 'ready-r1' },
      { columnId: 'doing', label: 'Doing', revision: 'doing-r1' },
      { columnId: 'done', label: 'Done', revision: 'done-r1' },
    ],
    swimlanes: () => [
      { swimlaneId: 'alpha', label: 'Alpha', revision: 'alpha-r1' },
      { swimlaneId: 'beta', label: 'Beta', revision: 'beta-r1' },
    ],
    groupingFields: [{ id: 'team', swimlaneOf: (card) => card.swimlaneId }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
}

/** Mounts one real board with its normalized input enabled only after setup completes. */
function mountedBoard(dispatcher: KanbanRequestDispatcher) {
  const board = new KanbanBoard({
    source: source(),
    query: () => ({ ...QUERY, groupBy: 'team' }),
    card: CARD,
    dispatcher,
    operationEligibility: () => ({ kind: 'allowed' }),
    structure: () => ({ revision: 'structure-r1', columns: [] }),
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 60, height: 18 }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return Object.freeze({ application, board });
}

/** Reads one required Phase C facade method without bypassing runtime validation. */
function requiredFacadeMethod(facade: KanbanInteractionFacade, name: string) {
  const method: unknown = Reflect.get(facade, name);
  expect(method, `${name} must be available on the stable interaction facade`).toBeTypeOf('function');
  if (typeof method !== 'function') throw new Error(`Missing Phase C facade method: ${name}`);
  return (options?: unknown): Promise<unknown> => Promise.resolve(Reflect.apply(method, facade, [options]));
}

/** Removes coordinator-owned lifecycle fields before comparing semantic producer parity. */
function semanticRequest(request: KanbanRequest): unknown {
  switch (request.kind) {
    case 'card-move':
      return {
        kind: request.kind,
        moved: request.moved,
        target: request.target,
        position: request.position,
        viewRevision: request.viewRevision,
      };
    case 'column-reorder':
      return { kind: request.kind, columnId: request.columnId, position: request.position };
    case 'swimlane-reorder':
      return { kind: request.kind, swimlaneId: request.swimlaneId, position: request.position };
    default:
      return { kind: request.kind };
  }
}

/** Delivers one normalized mounted key without depending on host byte decoding. */
function key(board: KanbanBoard<Card>, value: string, modifiers: { ctrl?: boolean; shift?: boolean } = {}) {
  const event: DispatchEvent = {
    event: {
      type: 'key',
      key: value,
      ctrl: modifiers.ctrl ?? false,
      shift: modifiers.shift ?? false,
      alt: false,
    },
    handled: false,
  };
  board.viewport.onEvent(event);
  return event;
}

/** Drains serialized facade and coordinator work. */
async function settle(): Promise<void> {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}

describe('Phase C semantic operation parity', () => {
  it('produces the same eligible card move from pointer, mounted keyboard, and programmatic origins', async () => {
    // Input origin may differ, but semantic placement, dispatcher, pending, and terminal outcomes stay identical.
    const requests: KanbanRequest[] = [];
    const dispatcher: KanbanRequestDispatcher = (request) => {
      requests.push(request);
      return { kind: 'rejected', operationId: request.operationId, code: 'fixture-complete' };
    };

    const programmatic = mountedBoard(dispatcher);
    const moveCard = requiredFacadeMethod(programmatic.board.interaction(), 'moveCard');
    await moveCard({
      cardKey: 1,
      target: { columnId: 'doing', swimlaneId: 'alpha' },
      direction: 'end',
      origin: 'programmatic',
    });
    await settle();
    const programmaticRequest = requests.shift();

    const keyboard = mountedBoard(dispatcher);
    const keyboardEvent = key(keyboard.board, 'right', { ctrl: true, shift: true });
    await settle();
    expect(keyboardEvent.handled).toBe(true);
    const keyboardRequest = requests.shift();

    const pointer = mountedBoard(dispatcher);
    const sourceTarget = pointer.board
      .inspection()
      .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 1);
    const target = pointer.board
      .inspection()
      .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 3);
    if (sourceTarget === undefined || target === undefined)
      throw new Error('Expected complete pointer parity geometry.');
    const origin = pointer.application.loop.renderRoot.originOf(pointer.board.viewport);
    if (origin === null) throw new Error('Expected mounted viewport origin.');
    const absolute = (x: number, y: number) => ({ x: origin.x + x + 1, y: origin.y + y + 1 });
    pointer.application.loop.dispatch({
      type: 'mouse',
      kind: 'down',
      button: 0,
      ...absolute(sourceTarget.x + 1, sourceTarget.y + 1),
    });
    pointer.application.loop.dispatch({
      type: 'mouse',
      kind: 'move',
      button: 0,
      ...absolute(sourceTarget.x + 2, sourceTarget.y + 1),
    });
    pointer.application.loop.dispatch({
      type: 'mouse',
      kind: 'drag',
      button: 0,
      ...absolute(target.x + 1, target.y + Math.max(1, target.height - 1)),
    });
    pointer.application.loop.dispatch({
      type: 'mouse',
      kind: 'up',
      button: 0,
      ...absolute(target.x + 1, target.y + Math.max(1, target.height - 1)),
    });
    await settle();
    const pointerRequest = requests.shift();

    expect(programmaticRequest).toBeDefined();
    expect(keyboardRequest).toBeDefined();
    expect(pointerRequest).toBeDefined();
    if (programmaticRequest === undefined || keyboardRequest === undefined || pointerRequest === undefined) return;
    expect(semanticRequest(keyboardRequest)).toEqual(semanticRequest(programmaticRequest));
    expect(semanticRequest(pointerRequest)).toEqual(semanticRequest(programmaticRequest));
    expect(requests).toEqual([]);
  });

  it('routes card, selected-block, column, and swimlane methods through one typed operation result boundary', async () => {
    // Every stable facade mutation returns a correlated result and uses the board's sole dispatcher.
    const requests: KanbanRequest[] = [];
    const { board } = mountedBoard((request) => {
      requests.push(request);
      return { kind: 'rejected', operationId: request.operationId, code: 'fixture-complete' };
    });
    const facade = board.interaction();
    await facade.transition({ kind: 'selection', operation: 'toggle' });
    await facade.transition({ kind: 'navigate', direction: 'down' });
    await facade.transition({ kind: 'selection', operation: 'toggle' });

    const results = await Promise.all([
      requiredFacadeMethod(
        facade,
        'moveCard',
      )({
        cardKey: 1,
        target: { columnId: 'doing', swimlaneId: 'alpha' },
        position: { kind: 'end' },
      }),
      requiredFacadeMethod(
        facade,
        'moveSelectedBlock',
      )({
        target: { columnId: 'doing', swimlaneId: 'alpha' },
        position: { kind: 'end' },
      }),
      requiredFacadeMethod(facade, 'reorderColumn')({ columnId: 'doing', position: { kind: 'start' } }),
      requiredFacadeMethod(facade, 'reorderSwimlane')({ swimlaneId: 'beta', position: { kind: 'start' } }),
    ]);

    expect(results).toHaveLength(4);
    expect(results.every((result) => typeof result === 'object' && result !== null && 'kind' in result)).toBe(true);
    expect(requests.map(({ kind }) => kind)).toEqual(['card-move', 'card-move', 'column-reorder', 'swimlane-reorder']);
  });

  it.each(['start', 'end'] as const)(
    'resolves a same-cell %s move through current cursor evidence',
    async (direction) => {
      // Start/end are semantic edges in the card's current cell, not horizontal navigation aliases.
      const requests: KanbanRequest[] = [];
      const { board } = mountedBoard((request) => {
        requests.push(request);
        return { kind: 'rejected', operationId: request.operationId, code: 'fixture-complete' };
      });

      const result = await board.interaction().moveCard({ cardKey: 2, direction });

      expect(result.kind).toBe('rejected');
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        kind: 'card-move',
        target: { columnId: 'ready', swimlaneId: 'alpha' },
        position: { kind: direction },
      });
    },
  );

  it('contains hostile runtime facade arguments behind typed rejected results', async () => {
    // Public TypeScript types do not make JavaScript callers trustworthy at runtime.
    const dispatcher = vi.fn<KanbanRequestDispatcher>((request) => ({
      kind: 'rejected',
      operationId: request.operationId,
      code: 'fixture-complete',
    }));
    const { board } = mountedBoard(dispatcher);
    const facade = board.interaction();
    const getter = vi.fn(() => 1);
    const hostile = Object.defineProperty({}, 'cardKey', { enumerable: true, get: getter });
    const moveCard: unknown = Reflect.get(facade, 'moveCard');
    const reorderColumn: unknown = Reflect.get(facade, 'reorderColumn');
    if (typeof moveCard !== 'function' || typeof reorderColumn !== 'function')
      throw new Error('Missing facade methods.');

    const results = await Promise.all([
      Reflect.apply(moveCard, facade, [null]),
      Reflect.apply(moveCard, facade, [hostile]),
      Reflect.apply(moveCard, facade, [{ cardKey: 1, direction: 'right', extra: true }]),
      Reflect.apply(reorderColumn, facade, [null]),
      Reflect.apply(reorderColumn, facade, [{ columnId: '', position: { kind: 'start' } }]),
    ]);

    expect(results.every((result) => result.kind === 'rejected')).toBe(true);
    expect(getter).not.toHaveBeenCalled();
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('applies Escape to active drag, then cancellable operation, then selection without creating a ghost for keys', async () => {
    // Escape always cancels the most transient owned layer before it changes durable semantic selection.
    let settleDispatch: ((value: { kind: 'cancelled'; operationId: string }) => void) | undefined;
    const dispatcher: KanbanRequestDispatcher = (request) =>
      new Promise((resolve) => {
        settleDispatch = () => resolve({ kind: 'cancelled', operationId: request.operationId });
      });
    const { board } = mountedBoard(dispatcher);
    const facade = board.interaction();
    await facade.transition({ kind: 'selection', operation: 'toggle' });
    await facade.transition({ kind: 'navigate', direction: 'down' });
    await facade.transition({ kind: 'selection', operation: 'toggle' });
    const selected = facade.snapshot().selectedCardKeys;

    const move = requiredFacadeMethod(
      facade,
      'moveSelectedBlock',
    )({
      target: { columnId: 'doing', swimlaneId: 'alpha' },
      position: { kind: 'end' },
      origin: 'keyboard',
    });
    await settle();
    expect(board.operationSnapshot()).toHaveLength(1);
    expect(Reflect.get(board.inspection(), 'overlay')).not.toMatchObject({ ghost: expect.anything() });

    const firstEscape = key(board, 'escape');
    await settle();
    expect(firstEscape.handled).toBe(true);
    expect(facade.snapshot().selectedCardKeys).toEqual(selected);
    expect(board.operationSnapshot()).toEqual([]);

    settleDispatch?.({ kind: 'cancelled', operationId: 'ignored' });
    await move;
    const secondEscape = key(board, 'escape');
    await settle();
    expect(secondEscape.handled).toBe(true);
    expect(facade.snapshot().selectedCardKeys).toEqual([]);
  });
});

describe('Phase C board setup and standalone lifecycle', () => {
  it('keeps a standalone viewport readable and clickable while mutation remains unavailable', async () => {
    // A viewport without the board coordinator never gains application mutation authority.
    const viewport = new KanbanViewport({ source: source(), query: () => QUERY, card: CARD });
    viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 50, height: 14 } });
    const application = createApplication({ content: viewport, viewport: { width: 50, height: 14 }, caps: CAPS });
    applications.push(application);
    application.loop.renderRoot.flush();
    await settle();
    application.loop.renderRoot.flush();
    const inspection = viewport.inspection();
    const card = inspection.actionTargets.find(({ kind }) => kind === 'card');
    expect(inspection.visibleCards.length).toBeGreaterThan(0);
    expect(card).toBeDefined();
    if (card === undefined) return;

    const down: DispatchEvent = {
      event: { type: 'mouse', kind: 'down', button: 0, x: card.x + 1, y: card.y + 1 },
      local: { x: card.x + 1, y: card.y + 1 },
      handled: false,
    };
    viewport.onEvent(down);
    expect(down.handled).toBe(true);
    expect(Reflect.get(viewport.inspection(), 'overlay')).not.toMatchObject({ ghost: expect.anything() });
    expect(Reflect.get(viewport.inspection(), 'operation')).toEqual({
      kind: 'unavailable',
      code: 'dispatcher-unavailable',
    });
  });

  it.each(['coordinator', 'viewport', 'controller', 'input'] as const)(
    'rolls back every earlier owner when setup fails at the %s stage',
    (stage) => {
      // Input is enabled last, while failed setup unwinds resources in cancellation-first reverse order.
      const createHarness: unknown = Reflect.get(kanbanTesting, 'createKanbanBoardSetupHarness');
      expect(createHarness).toBeTypeOf('function');
      if (typeof createHarness !== 'function') throw new Error('Missing deterministic board setup harness.');
      const harness: unknown = Reflect.apply(createHarness, kanbanTesting, [{ failAt: stage }]);
      if (typeof harness !== 'object' || harness === null) throw new Error('Invalid board setup harness.');
      const mount: unknown = Reflect.get(harness, 'mount');
      const snapshot: unknown = Reflect.get(harness, 'snapshot');
      if (typeof mount !== 'function' || typeof snapshot !== 'function')
        throw new Error('Incomplete board setup harness.');

      expect(() => Reflect.apply(mount, harness, [])).toThrow();
      expect(Reflect.apply(snapshot, harness, [])).toMatchObject({
        inputEnabled: false,
        liveResources: [],
        captureLeases: 0,
        timers: 0,
        subscriptions: 0,
      });
    },
  );

  it('makes double disposal, late work, and remount attempts inert after cancellation-first teardown', async () => {
    // Teardown invalidates input and async generations before releasing the source and render graph.
    let settleDispatch: ((value: { kind: 'accepted'; operationId: string }) => void) | undefined;
    const calls: KanbanRequest[] = [];
    const { application, board } = mountedBoard((request) => {
      calls.push(request);
      return new Promise((resolve) => {
        settleDispatch = () => resolve({ kind: 'accepted', operationId: request.operationId });
      });
    });
    const move = requiredFacadeMethod(
      board.interaction(),
      'moveCard',
    )({
      cardKey: 1,
      target: { columnId: 'doing', swimlaneId: 'alpha' },
      direction: 'end',
    });
    await settle();
    const before = board.inspection();

    application.loop.renderRoot.unmount();
    board.dispose();
    board.dispose();
    settleDispatch?.({ kind: 'accepted', operationId: 'ignored' });
    await move;
    await settle();

    expect(calls).toHaveLength(1);
    expect(board.inspection().pendingOperations).toEqual([]);
    expect(board.inspection().layoutReflows).toBe(before.layoutReflows);
    expect(() => application.loop.renderRoot.mount(board)).toThrow();
    const late = key(board, 'right', { ctrl: true, shift: true });
    expect(late.handled).toBe(false);
  });
});

describe('Phase C production, testing, documentation, and plugin delivery boundary', () => {
  it('keeps host tooling and deterministic harnesses out of the production entry graph', () => {
    const productionEntry = readFileSync(join(repoRoot, 'packages/kanban/src/index.ts'), 'utf8');
    const testingEntry = readFileSync(join(repoRoot, 'packages/kanban/src/testing.ts'), 'utf8');
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'packages/kanban/package.json'), 'utf8')) as {
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly devDependencies?: Readonly<Record<string, string>>;
      readonly exports?: Readonly<Record<string, unknown>>;
    };

    expect(manifest.exports).toHaveProperty('.');
    expect(manifest.exports).toHaveProperty('./testing');
    expect(manifest.dependencies).not.toHaveProperty('node-pty');
    expect(manifest.dependencies).not.toHaveProperty('@xterm/headless');
    expect(manifest.dependencies).not.toHaveProperty('@jsvision/web');
    expect(manifest.devDependencies).toMatchObject({
      'node-pty': expect.stringMatching(/^\^1\.1\.0$/u),
      '@xterm/headless': expect.stringMatching(/^\^6\.0\.0$/u),
      '@jsvision/web': '1.5.2',
    });
    expect(productionEntry).not.toMatch(/testing\/|node-pty|@xterm\/headless|@jsvision\/web/u);
    for (const helper of [
      'createKanbanFakeClock',
      'createKanbanDragHarness',
      'createKanbanDispatcherHarness',
      'createKanbanOperationLifecycleHarness',
      'createKanbanStandardPointerTrace',
      'replayKanbanSemanticPointerTrace',
    ]) {
      expect(testingEntry, `${helper} must be exported only from @jsvision/kanban/testing`).toContain(helper);
      expect(productionEntry).not.toContain(helper);
    }
  });

  it('publishes separate generated testing API evidence while keeping the production plugin surface clean', () => {
    const testingApiRoot = join(repoRoot, 'packages/docs-site/api/kanban-testing');
    const i18nIndex = readFileSync(join(repoRoot, 'packages/docs-site/reference/i18n-entry-points.md'), 'utf8');
    const pluginApi = readFileSync(join(repoRoot, 'tools/jsvision-skill/references/api/kanban.md'), 'utf8');
    const pluginTesting = join(repoRoot, 'tools/jsvision-skill/references/api/kanban-testing.md');

    expect(existsSync(testingApiRoot)).toBe(true);
    expect(existsSync(pluginTesting)).toBe(true);
    expect(i18nIndex).toContain('kanbanPhaseCEn');
    expect(i18nIndex).toContain('kanbanPhaseCSv');
    expect(pluginApi).toContain('KANBAN_PHASE_C_ENGLISH_CATALOG');
    expect(pluginApi).not.toContain('createKanbanStandardPointerTrace');
    if (existsSync(pluginTesting)) {
      const testingReference = readFileSync(pluginTesting, 'utf8');
      expect(testingReference).toContain('createKanbanStandardPointerTrace');
      expect(testingReference).toContain('replayKanbanSemanticPointerTrace');
    }
  });
});
