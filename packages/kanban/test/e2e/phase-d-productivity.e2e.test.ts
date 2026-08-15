/** End-to-end oracle for mounted Phase D productivity chrome and action reachability. */
import { createApplication, Input, resolveCapabilities } from '@jsvision/ui';
import type { Application, View } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import {
  KanbanBoard,
  createEagerKanbanDataSource,
  createEnglishKanbanI18n,
  createKanbanViewController,
} from '../../src/index.js';
import type { KanbanCardAdapter, KanbanQuery } from '../../src/index.js';

interface WorkItem {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly revision: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [], viewRevision: 'phase-d-e2e-r1' });
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

/** Creates enough deterministic data to exercise both chrome and viewport at compact geometry. */
function source() {
  const cards = Array.from({ length: 16 }, (_, index) => ({
    id: index + 1,
    columnId: index % 2 === 0 ? 'ready' : 'doing',
    title: `Work item ${index + 1}`,
    revision: `card-${index + 1}-r1`,
  }));
  return createEagerKanbanDataSource<WorkItem>(() => cards, {
    columns: () => [
      { columnId: 'ready', label: 'Ready', revision: 'ready-r1' },
      { columnId: 'doing', label: 'In progress', revision: 'doing-r1' },
    ],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
}

/** Constructs the board through its JavaScript boundary while the new options remain intentionally red. */
function createBoard(controller: ReturnType<typeof createKanbanViewController>): KanbanBoard<WorkItem> {
  return Reflect.construct(KanbanBoard, [
    {
      source: source(),
      query: () => QUERY,
      card: CARD,
      view: { controller, chrome: 'standard' },
      actions: { boardId: 'phase-d-e2e', host: { kind: 'terminal', platform: 'linux' } },
    },
  ]);
}

/** Mounts one complete board at an exact terminal viewport. */
function mount(board: KanbanBoard<WorkItem>, width = 80, height = 24): Application {
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width, height }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return application;
}

/** Traverses public child ownership without relying on private layout nodes. */
function descendants(view: View): readonly View[] {
  if (!('children' in view) || !Array.isArray(view.children)) return [];
  return view.children.flatMap((child) => [child, ...descendants(child)]);
}

/** Reads the configured action surface and one of its public facets. */
function actions(board: KanbanBoard<WorkItem>): object {
  const getter: unknown = Reflect.get(board, 'actions');
  if (typeof getter !== 'function') throw new Error('Missing board-owned actions.');
  const value: unknown = Reflect.apply(getter, board, []);
  if (typeof value !== 'object' || value === null) throw new Error('Missing configured board actions.');
  return value;
}

/** Returns a rectangular plain-text frame for clipping and visible-label assertions. */
function frame(application: Application): readonly string[] {
  application.loop.renderRoot.flush();
  return application.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''));
}

describe('Phase D mounted productivity integration', () => {
  it('keeps standard view chrome, cards, and action help reachable at 80x24', () => {
    const controller = createKanbanViewController();
    const board = createBoard(controller);
    const application = mount(board);
    const lines = frame(application);
    const actionSurface = actions(board);
    const keyboard: unknown = Reflect.get(actionSurface, 'keyboard');

    expect(lines).toHaveLength(24);
    expect(lines.every((line) => line.length === 80)).toBe(true);
    expect(lines.join('\n')).toMatch(/Search|Ready|In progress/u);
    expect(descendants(board).some((view) => view instanceof Input)).toBe(true);
    expect(keyboard).toBeTypeOf('function');
    if (typeof keyboard !== 'function') throw new Error('Missing keyboard action route.');
    expect(
      Reflect.apply(keyboard, actionSurface, [
        { type: 'key', key: 'f1', ctrl: false, alt: false, shift: false },
        { kind: 'board' },
      ]),
    ).toEqual({ kind: 'handled' });
    controller.dispose();
  });

  it('preserves search state, focus identity, and unclipped reachability through narrow and restored layouts', () => {
    const controller = createKanbanViewController();
    const board = createBoard(controller);
    const application = mount(board);
    const search = descendants(board).find((view): view is Input => view instanceof Input);
    expect(search).toBeDefined();
    if (search === undefined) throw new Error('Missing standard search input.');
    application.loop.focusView(search);
    application.loop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
    const focused = application.loop.getFocused();

    application.loop.renderRoot.resize({ width: 44, height: 14 });
    const narrow = frame(application);
    expect(narrow).toHaveLength(14);
    expect(narrow.every((line) => line.length === 44)).toBe(true);
    expect(application.loop.getFocused()).toBe(focused);
    expect(search.getValueSignal()()).toBe('x');

    application.loop.renderRoot.resize({ width: 80, height: 24 });
    expect(frame(application).every((line) => line.length === 80)).toBe(true);
    expect(application.loop.getFocused()).toBe(focused);
    expect(search.getValueSignal()()).toBe('x');
    expect(actions(board)).toBeDefined();
    controller.dispose();
  });

  it('resolves every mounted action label and help message through the canonical English catalog', () => {
    const controller = createKanbanViewController();
    const board = createBoard(controller);
    mount(board);
    const actionSurface = actions(board);
    const registry: unknown = Reflect.get(actionSurface, 'registry');
    if (typeof registry !== 'object' || registry === null) throw new Error('Missing action registry.');
    const list: unknown = Reflect.get(registry, 'actions');
    if (typeof list !== 'function') throw new Error('Missing action inventory.');
    const inventory: unknown = Reflect.apply(list, registry, []);
    if (!Array.isArray(inventory)) throw new Error('Invalid action inventory.');
    const i18n = createEnglishKanbanI18n();

    for (const action of inventory) {
      if (typeof action !== 'object' || action === null) throw new Error('Invalid action metadata.');
      const labelId: unknown = Reflect.get(action, 'labelMessageId');
      const helpId: unknown = Reflect.get(action, 'helpMessageId');
      if (typeof labelId !== 'string' || typeof helpId !== 'string') throw new Error('Invalid action message IDs.');
      const translate: unknown = Reflect.get(i18n, 't');
      if (typeof translate !== 'function') throw new Error('Missing translation function.');
      expect(Reflect.apply(translate, i18n, [labelId])).not.toBe(labelId);
      expect(Reflect.apply(translate, i18n, [helpId])).not.toBe(helpId);
    }
    controller.dispose();
  });
});
