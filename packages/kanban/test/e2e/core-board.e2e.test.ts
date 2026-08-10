import { createI18n } from '@jsvision/i18n';
import { Window, createApplication, resolveCapabilities, signal } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../../src/index.js';
import type {
  KanbanCardAdapter,
  KanbanCardDensity,
  KanbanInteractionIntent,
  KanbanQuery,
  KanbanStructurePolicy,
  KanbanSwimlanePresentationInput,
} from '../../src/index.js';
import { kanbanDe } from '../../src/i18n/locales.js';
import { createWindowedKanbanFixture } from '../../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly team?: string;
  readonly title: string;
}

const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const COLOR = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const ASCII_MONO = resolveCapabilities({
  env: { NO_COLOR: '1' },
  platform: 'linux',
  override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
}).profile;
const apps: Application[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.loop.dispose();
});

/** Builds a populated board with optional grouped swimlane presentation. */
function board(
  options: {
    readonly density?: KanbanCardDensity;
    readonly presentation?: KanbanSwimlanePresentationInput;
    readonly intents?: KanbanInteractionIntent[];
    readonly i18n?: () => ReturnType<typeof createI18n>;
    readonly cards?: () => readonly Card[];
  } = {},
): KanbanBoard<Card> {
  const cards =
    options.cards ??
    (() => [
      { id: 1, columnId: 'ready', team: 'alpha', title: 'Plan implementation' },
      { id: 2, columnId: 'doing', team: 'alpha', title: 'Build terminal interaction' },
      { id: 3, columnId: 'done', team: 'beta', title: 'Verify complete behavior' },
    ]);
  const grouped = options.presentation !== undefined;
  const source = createEagerKanbanDataSource(cards, {
    columns: () => [
      { columnId: 'ready', label: 'Ready', revision: 1 },
      { columnId: 'doing', label: 'Doing', revision: 1 },
      { columnId: 'done', label: 'Done', revision: 1 },
    ],
    ...(grouped
      ? {
          swimlanes: () => [
            { swimlaneId: 'alpha', label: 'Team Alpha', revision: 1 },
            { swimlaneId: 'beta', label: 'Team Beta', revision: 1 },
            { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
          ],
          groupingFields: [{ id: 'team', swimlaneOf: (card: Card) => card.team }],
        }
      : {}),
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
    search: (card, term) => card.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
  });
  const structure: KanbanStructurePolicy<Card> = {
    revision: 1,
    columns: [],
    ...(grouped
      ? {
          grouping: {
            fieldId: 'team',
            unassigned: { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
            presentation: options.presentation,
            railWidth: 12,
          },
        }
      : {}),
  };
  const instance = new KanbanBoard({
    source,
    query: () => (grouped ? { ...QUERY, groupBy: 'team' } : QUERY),
    card: CARD,
    structure: () => structure,
    ...(options.density === undefined ? {} : { density: () => options.density! }),
    ...(options.i18n === undefined ? {} : { i18n: options.i18n }),
    ...(options.intents === undefined ? {} : { onInteraction: (intent) => options.intents?.push(intent) }),
  });
  instance.setLayout({ position: 'fill' });
  return instance;
}

/** Mounts a real direct surface or application-owned window. */
function mount(instance: KanbanBoard<Card>, width: number, height: number, host: 'surface' | 'window', mono = false) {
  const caps = mono ? ASCII_MONO : COLOR;
  if (host === 'surface') {
    const app = createApplication({ content: instance, viewport: { width, height }, caps });
    apps.push(app);
    app.loop.renderRoot.flush();
    return { app };
  }
  const app = createApplication({ viewport: { width: width + 8, height: height + 6 }, caps });
  const window = new Window('Kanban matrix');
  window.setLayout({ rect: { x: 3, y: 2, width: width + 2, height: height + 2 } });
  window.add(instance);
  app.desktop.addWindow(window);
  apps.push(app);
  app.loop.renderRoot.flush();
  return { app, window };
}

/** Waits for facade serialization and intent delivery behind real loop dispatch. */
async function settle(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

/** Converts a viewport-local action point to absolute host coordinates. */
function absolute(app: Application, instance: KanbanBoard<Card>, point: { readonly x: number; readonly y: number }) {
  const origin = app.loop.renderRoot.originOf(instance.viewport);
  if (origin === null) throw new Error('Expected a mounted viewport origin.');
  return { x: origin.x + point.x + 1, y: origin.y + point.y + 1 };
}

describe('Kanban Phase B 12-row real-loop matrix', () => {
  it.each([
    [1, 'surface', 80, 24, 'comfortable', 'hybrid', 'swimlane-header'],
    [2, 'window', 80, 24, 'compact', 'separator', 'swimlane-separator'],
    [3, 'surface', 36, 14, 'compact', 'band', 'swimlane-band'],
    [5, 'surface', 100, 24, 'comfortable', 'rail', 'swimlane-rail'],
  ] as const)(
    'row %i renders %s %ix%i %s/%s geometry',
    (row, host, width, height, density, presentation, regionKind) => {
      const instance = board({ density, presentation });
      mount(instance, width, height, host);
      const inspection = instance.inspection();
      expect(
        inspection.regions.some(({ kind }) => kind === regionKind),
        `matrix row ${row}`,
      ).toBe(true);
      expect(instance.viewport.metrics().mode).toBe(row === 3 ? 'focused-column' : 'multi-column');
      expect(inspection.visibleCards.length).toBeGreaterThan(0);
    },
  );

  it('row 4 recovers from minimum window geometry with safe custom chrome fallback', () => {
    const custom: KanbanSwimlanePresentationInput = { kind: 'custom', revision: 1, render: () => ({}) };
    const instance = board({ presentation: custom });
    const { app, window } = mount(instance, 12, 3, 'window');
    if (window === undefined) throw new Error('Expected matrix window.');
    expect(instance.viewport.metrics().mode).toBe('minimum-size');
    app.loop.resize({ width: 56, height: 18 });
    window.setLayout({ rect: { x: 3, y: 2, width: 50, height: 14 } });
    app.loop.renderRoot.flush();
    expect(instance.viewport.metrics().mode).not.toBe('minimum-size');
    expect(instance.inspection().regions.some(({ kind }) => kind === 'swimlane-header')).toBe(true);
  });

  it('row 6 preserves responsive content through maximize and restore with variable heights', () => {
    const live = signal<readonly Card[]>([
      { id: 1, columnId: 'ready', title: 'Short' },
      { id: 2, columnId: 'doing', title: 'A long title that wraps through several terminal rows' },
      { id: 3, columnId: 'done', title: 'Complete' },
    ]);
    const instance = board({ cards: live });
    const { app, window } = mount(instance, 48, 12, 'window');
    if (window === undefined) throw new Error('Expected matrix window.');
    const before = { ...window.bounds };
    window.zoom();
    app.loop.renderRoot.flush();
    expect(window.isZoomed()).toBe(true);
    window.zoom();
    app.loop.renderRoot.flush();
    expect(window.bounds).toEqual(before);
    expect(instance.inspection().visibleCards.map(({ cardKey }) => cardKey)).toContain(2);
  });

  it('row 7 measures an authored locale and Unicode content without unsafe terminal cells', () => {
    const i18n = signal(createI18n({ locale: 'de', catalogs: [kanbanDe] }));
    const instance = board({
      i18n,
      cards: () => [{ id: 1, columnId: 'ready', title: 'Überprüfung 界界界 mit sehr langem Titel' }],
    });
    const { app } = mount(instance, 40, 12, 'surface');
    expect(instance.inspection().label).toBe('Kanban-Board');
    expect(instance.inspection().visibleCards[0]?.title).toContain('Überprüfung');
    const cells = app.loop.renderRoot.buffer().rows().flat();
    expect(cells.some((cell) => cell.width === 2)).toBe(true);
  });

  it('row 8 retains non-color focus and selection cues in ASCII monochrome mode', async () => {
    const instance = board();
    const { app } = mount(instance, 40, 12, 'surface', true);
    app.loop.focusView(instance.viewport);
    app.loop.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
    await settle();
    app.loop.renderRoot.flush();
    const focused = instance.inspection().visibleCards.find(({ cardKey }) => cardKey === 1);
    expect(focused?.marker.cues).toEqual(expect.arrayContaining(['focused', 'selected']));
    expect(focused?.descriptor.marker.glyph).toBe('>');
  });

  it('row 9 routes keyboard selection and activation through the real event loop', async () => {
    const intents: KanbanInteractionIntent[] = [];
    const instance = board({ intents });
    const { app } = mount(instance, 48, 14, 'surface');
    app.loop.focusView(instance.viewport);
    app.loop.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
    app.loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
    await settle();
    expect(instance.interaction().snapshot().selectedCardKeys).toEqual([1]);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ kind: 'open-card', origin: 'keyboard', cardKey: 1 });
  });

  it('row 10 routes pointer down/up, double-click, and context targeting', async () => {
    const intents: KanbanInteractionIntent[] = [];
    const instance = board({ intents });
    const { app } = mount(instance, 48, 14, 'surface');
    const target = instance.inspection().actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 2);
    if (target === undefined) throw new Error('Expected matrix pointer target.');
    const point = absolute(app, instance, target);
    for (const kind of ['down', 'up'] as const) {
      app.loop.dispatch({ type: 'mouse', kind, button: 0, ...point });
    }
    await settle();
    for (const kind of ['down', 'up'] as const) {
      app.loop.dispatch({ type: 'mouse', kind, button: 0, ...point });
    }
    await settle();
    app.loop.dispatch({ type: 'mouse', kind: 'down', button: 2, ...point });
    await settle();
    expect(instance.interaction().snapshot().focused).toMatchObject({ kind: 'card', cardKey: 2 });
    expect(intents.map(({ kind }) => kind)).toEqual(expect.arrayContaining(['open-card', 'open-context']));
  });

  it('row 11 exposes filtered and source-state actions without mutating application query', async () => {
    const query = signal<KanbanQuery>({ search: 'missing', filters: [], sort: [] });
    const intents: KanbanInteractionIntent[] = [];
    const source = createEagerKanbanDataSource(() => [{ id: 1, columnId: 'ready', title: 'Card' }], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      search: (card, term) => card.title.includes(term),
    });
    const instance = new KanbanBoard({ source, query, card: CARD, onInteraction: (intent) => intents.push(intent) });
    instance.setLayout({ position: 'fill' });
    const { app } = mount(instance, 40, 12, 'surface');
    const action = instance.inspection().actionTargets.find(({ kind }) => kind === 'state-action');
    if (action === undefined) throw new Error('Expected filtered state action.');
    const point = absolute(app, instance, action);
    app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...point });
    app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...point });
    await settle();
    expect(intents[0]).toMatchObject({ kind: 'scoped-action', actionId: 'clear-filters' });
    expect(query().search).toBe('missing');
  });

  it('row 12 cancels active windowed work before releasing the real host', () => {
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 10_000,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const instance = new KanbanBoard({ source: fixture.source, query: () => QUERY, card: CARD });
    instance.setLayout({ position: 'fill' });
    mount(instance, 40, 12, 'surface');
    expect(fixture.controller.pendingRanges().length).toBeGreaterThan(0);
    instance.dispose();
    expect(fixture.metrics()).toMatchObject({ disposedSessions: 1 });
    expect(fixture.metrics().disposedCursors).toBe(fixture.metrics().createdCursors);
    expect(fixture.metrics().abortedRequests).toBeGreaterThan(0);
    fixture.dispose();
  });
});
