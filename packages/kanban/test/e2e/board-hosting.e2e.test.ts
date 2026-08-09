import { createI18n } from '@jsvision/i18n';
import { Group, Window, createApplication, resolveCapabilities, signal } from '@jsvision/ui';
import type { Application, Rect } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../../src/index.js';
import type {
  CardKey,
  KanbanCardAdapter,
  KanbanColumnMeta,
  KanbanIdentityInput,
  KanbanQuery,
} from '../../src/index.js';
import { kanbanDe } from '../../src/i18n/locales.js';

interface WorkItem {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly status: string;
}

interface InspectedColumn {
  readonly columnId: string;
}

interface InspectedCard {
  readonly cardKey: CardKey;
}

const QUERY: KanbanQuery = { filters: [], sort: [] };
const CARD: KanbanCardAdapter<WorkItem> = {
  keyOf: (item) => item.id,
  titleOf: (item) => item.title,
  statusOf: (item) => item.status,
};
const COLOR_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;
const MONO_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'mono' },
}).profile;

const ownedApps: Application[] = [];

afterEach(() => {
  for (const app of ownedApps.splice(0)) app.loop.dispose();
});

/** Creates immutable source column metadata in its authoritative presentation order. */
function columns(...entries: readonly (string | readonly [string, string])[]): readonly KanbanColumnMeta[] {
  return entries.map((entry) => {
    const [columnId, label] = typeof entry === 'string' ? [entry, entry.toUpperCase()] : entry;
    return { columnId, label, revision: 1 };
  });
}

/** Creates the shared deterministic board fixture without adding host-specific behavior. */
function fixture(
  options: {
    readonly liveColumns?: ReturnType<typeof signal<readonly KanbanColumnMeta[]>>;
    readonly liveCards?: ReturnType<typeof signal<readonly WorkItem[]>>;
    readonly identity?: ReturnType<typeof signal<KanbanIdentityInput>>;
    readonly i18n?: ReturnType<typeof signal<ReturnType<typeof createI18n>>>;
  } = {},
) {
  const liveColumns = options.liveColumns ?? signal(columns('ready', 'doing', 'done'));
  const liveCards =
    options.liveCards ??
    signal<readonly WorkItem[]>([
      { id: 1, columnId: 'ready', title: 'Prepare fixture', status: 'Ready' },
      { id: 2, columnId: 'doing', title: 'Preserve semantic focus', status: 'Doing' },
      { id: 3, columnId: 'done', title: 'Verify result', status: 'Done' },
    ]);
  const source = createEagerKanbanDataSource(liveCards, {
    columns: liveColumns,
    keyOf: (item) => item.id,
    columnOf: (item) => item.columnId,
  });
  const board = new KanbanBoard<WorkItem>({
    source,
    query: () => QUERY,
    card: CARD,
    ...(options.identity === undefined ? {} : { identity: options.identity }),
    ...(options.i18n === undefined ? {} : { i18n: options.i18n }),
  });
  board.setLayout({ position: 'fill' });
  return { board, liveColumns, liveCards };
}

/** Mounts a board as the application's direct, frameless content surface. */
function mountSurface(board: KanbanBoard<WorkItem>, width: number, height: number): Application {
  const app = createApplication({ content: board, viewport: { width, height }, caps: COLOR_CAPS });
  ownedApps.push(app);
  app.loop.renderRoot.flush();
  return app;
}

/** Mounts a board in a real desktop window whose one-cell frame leaves the requested content rect. */
function mountWindow(board: KanbanBoard<WorkItem>, contentWidth: number, contentHeight: number) {
  const app = createApplication({
    viewport: { width: contentWidth + 12, height: contentHeight + 8 },
    caps: COLOR_CAPS,
  });
  const window = new Window('Kanban host');
  window.setLayout({ rect: { x: 4, y: 3, width: contentWidth + 2, height: contentHeight + 2 } });
  window.add(board);
  app.desktop.addWindow(window);
  ownedApps.push(app);
  app.loop.renderRoot.flush();
  return { app, window };
}

/** Returns only host-independent semantic and hit evidence from one mounted board. */
function contentEvidence(board: KanbanBoard<WorkItem>) {
  const inspection = board.inspection();
  return {
    state: inspection.state,
    columns: inspection.visibleColumns,
    cards: inspection.visibleCards,
    navigator: inspection.navigator,
    actionTargets: inspection.actionTargets,
    viewport: board.viewport.metrics(),
  };
}

/** Verifies every child solved by the board remains within its immediate parent clip. */
function expectChildrenClipped(parent: Group): void {
  for (const child of parent.children) {
    const rect = child.bounds;
    expect(rect.x, `${child.constructor.name} left`).toBeGreaterThanOrEqual(0);
    expect(rect.y, `${child.constructor.name} top`).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width, `${child.constructor.name} right`).toBeLessThanOrEqual(parent.bounds.width);
    expect(rect.y + rect.height, `${child.constructor.name} bottom`).toBeLessThanOrEqual(parent.bounds.height);
    if (child instanceof Group) expectChildrenClipped(child);
  }
}

/** Captures an application's complete in-memory frame as plain terminal cells. */
function frameText(app: Application): string {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Verifies that every double-width cell owns an in-bounds continuation cell. */
function expectCellSafeFrame(app: Application): void {
  const buffer = app.loop.renderRoot.buffer();
  for (const row of buffer.rows()) {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x]?.width === 2) expect(row[x + 1]?.width, `wide cell at ${x}`).toBe(0);
      if (row[x]?.width === 0) expect(row[x - 1]?.width, `continuation at ${x}`).toBe(2);
    }
  }
}

describe('Kanban real host equivalence', () => {
  it('should produce equal content, metrics, and bounded scene hits on a surface and in a window', () => {
    const direct = fixture();
    const framed = fixture();
    const surfaceApp = mountSurface(direct.board, 72, 16);
    const { app: windowApp } = mountWindow(framed.board, 72, 16);

    expect(direct.board.bounds).toEqual({ x: 0, y: 0, width: 72, height: 16 });
    // Window content is parent-relative after the frame's one-cell padding; usable size stays equal.
    expect(framed.board.bounds).toEqual({ x: 1, y: 1, width: 72, height: 16 });
    expect(contentEvidence(framed.board)).toEqual(contentEvidence(direct.board));

    const beforeDirect = direct.board.inspection().identity;
    const beforeFramed = framed.board.inspection().identity;
    surfaceApp.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 2, y: 2 });
    windowApp.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 6, y: 5 });
    expect(direct.board.inspection().identity).toEqual(beforeDirect);
    expect(framed.board.inspection().identity).toEqual(beforeFramed);
    const directTargets = direct.board.inspection().actionTargets;
    expect(framed.board.inspection().actionTargets).toEqual(directTargets);
    expect(directTargets.map(({ kind }) => kind)).toEqual(expect.arrayContaining(['card', 'workflow-header']));
    expect(directTargets.map(({ kind }) => kind)).not.toEqual(
      expect.arrayContaining(['insertion', 'drop', 'ghost', 'drag', 'drag-hover']),
    );
  });
});

describe('Kanban responsive identity anchoring', () => {
  it('should preserve focused card and containing-column visibility through multi-column to narrow and back', () => {
    const identity = signal<KanbanIdentityInput>({ selectedCardKeys: [2], focusedCardKey: 2 });
    const { board } = fixture({ identity });
    const app = mountSurface(board, 80, 24);

    expect(board.viewport.metrics().mode).toBe('multi-column');
    app.loop.resize({ width: 36, height: 14 });
    const narrow = board.inspection();
    expect(board.viewport.metrics().mode).toBe('focused-column');
    expect(board.viewport.metrics().visibleColumnIds).toEqual(['doing']);
    expect(narrow.identity.focusedCardKey).toBe(2);

    app.loop.resize({ width: 80, height: 24 });
    const restored = board.inspection();
    expect(board.viewport.metrics().mode).toBe('multi-column');
    expect(board.viewport.metrics().visibleColumnIds).toContain('doing');
    expect(restored.identity).toEqual({ selectedCardKeys: [2], focusedCardKey: 2 });
    expect(restored.visibleCards).toContainEqual(expect.objectContaining({ cardKey: 2, columnId: 'doing' }));
  });
});

describe('Kanban scrolled cell cropping', () => {
  it('crops horizontal headers at the content offset instead of pinning their first glyph', () => {
    const liveColumns = signal(columns(['ready', 'ABCDEFGHIJKLMN'], 'doing', 'done'));
    const { board } = fixture({ liveColumns });
    const app = mountSurface(board, 40, 10);
    const before = frameText(app).split('\n')[0] ?? '';
    expect(before.startsWith('ABCDEFGHI')).toBe(true);

    board.scrollTo({ x: 5 });
    app.loop.renderRoot.flush();
    const after = frameText(app).split('\n')[0] ?? '';
    expect(after.startsWith('FGHIJKLMN')).toBe(true);
    expect(after.startsWith('ABCDEFGHI')).toBe(false);
  });

  it('preserves cell coordinates when horizontal cropping bisects a wide header glyph', () => {
    const liveColumns = signal(columns(['ready', '界ABCDEFGHIJKLMN'], 'doing', 'done'));
    const { board } = fixture({ liveColumns });
    const app = mountSurface(board, 40, 10);

    board.scrollTo({ x: 1 });
    app.loop.renderRoot.flush();
    expect((frameText(app).split('\n')[0] ?? '').startsWith(' A')).toBe(true);
  });

  it('preserves the viewport-origin column when authoritative column order changes', () => {
    const liveColumns = signal(columns('ready', 'doing', 'done', 'blocked'));
    const { board } = fixture({ liveColumns });
    const app = mountSurface(board, 40, 10);
    board.scrollTo({ x: 19 });
    app.loop.renderRoot.flush();
    expect(board.viewport.metrics().visibleColumnIds[0]).toBe('doing');

    liveColumns.set(columns('doing', 'ready', 'done', 'blocked'));
    app.loop.renderRoot.flush();
    expect(board.viewport.metrics().offsets.x).toBe(0);
    expect(board.viewport.metrics().visibleColumnIds[0]).toBe('doing');
  });

  it('draws the surviving descriptor row when vertical scrolling clips a card top', () => {
    const liveColumns = signal(columns('ready'));
    const liveCards = signal<readonly WorkItem[]>([
      { id: 1, columnId: 'ready', title: 'TITLE ROW', status: 'STATUS ROW' },
      { id: 2, columnId: 'ready', title: 'SECOND CARD', status: 'READY' },
      { id: 3, columnId: 'ready', title: 'THIRD CARD', status: 'READY' },
    ]);
    const { board } = fixture({ liveColumns, liveCards });
    const app = mountSurface(board, 24, 8);
    expect(frameText(app).split('\n')[1]).toContain('TITLE ROW');

    board.scrollTo({ y: 1 });
    app.loop.renderRoot.flush();
    const clippedTop = frameText(app).split('\n')[1] ?? '';
    expect(clippedTop).toContain('STATUS ROW');
    expect(clippedTop).not.toContain('TITLE ROW');
  });
});

describe('Kanban focused-column reveal authority', () => {
  it('lets imperative reveal temporarily select the containing column until application focus changes', async () => {
    const identity = signal<KanbanIdentityInput>({ focusedColumnId: 'ready' });
    const liveCards = signal<readonly WorkItem[]>([
      { id: 1, columnId: 'ready', title: 'Ready card', status: 'Ready' },
      { id: 2, columnId: 'doing', title: 'Doing card', status: 'Doing' },
    ]);
    const { board } = fixture({ liveCards, identity });
    const app = mountSurface(board, 24, 8);
    expect(board.viewport.metrics().visibleColumnIds).toEqual(['ready']);

    await board.revealCard(2, 'start');
    app.loop.renderRoot.flush();
    expect(board.viewport.metrics().visibleColumnIds).toEqual(['doing']);
    expect(board.inspection().visibleCards).toContainEqual(expect.objectContaining({ cardKey: 2 }));
  });
});

describe('Kanban window resize lifecycle', () => {
  it('should maximize and restore exactly while every solved board child remains clipped', () => {
    const { board } = fixture();
    const { app, window } = mountWindow(board, 54, 14);
    const restoredWindowRect: Rect = { ...window.bounds };
    const restoredBoardRect: Rect = { ...board.bounds };

    expectChildrenClipped(board);
    window.zoom();
    app.loop.renderRoot.flush();
    expect(window.isZoomed()).toBe(true);
    expect(window.bounds).toEqual({ x: 0, y: 0, width: app.desktop.bounds.width, height: app.desktop.bounds.height });
    expect(board.bounds.width).toBeGreaterThan(restoredBoardRect.width);
    expect(board.bounds.height).toBeGreaterThan(restoredBoardRect.height);
    expectChildrenClipped(board);

    window.zoom();
    app.loop.renderRoot.flush();
    expect(window.isZoomed()).toBe(false);
    expect(window.bounds).toEqual(restoredWindowRect);
    expect(board.bounds).toEqual(restoredBoardRect);
    expectChildrenClipped(board);
  });
});

describe('Kanban reactive localization and terminal fallbacks', () => {
  it('should reflow for an authored locale, clip wide text by cells, retain semantic labels, and follow source removal', () => {
    const hostileWideLabel = 'Planificare \u001b[31m界界界界界界界界界界';
    const sanitizedWideLabel = 'Planificare [31m界界界界界界界界界界';
    const liveColumns = signal<readonly KanbanColumnMeta[]>(columns(['ready', hostileWideLabel], 'doing', 'done'));
    const liveCards = signal<readonly WorkItem[]>([
      { id: 1, columnId: 'ready', title: 'Titlu sigur', status: 'Ready' },
      { id: 2, columnId: 'doing', title: 'Focused', status: 'Doing' },
      { id: 3, columnId: 'done', title: 'Complete', status: 'Done' },
    ]);
    const identity = signal<KanbanIdentityInput>({ selectedCardKeys: [2], focusedCardKey: 2 });
    const i18n = signal(createI18n({ locale: 'en' }));
    const { board } = fixture({ liveColumns, liveCards, identity, i18n });
    const app = createApplication({ content: board, viewport: { width: 80, height: 18 }, caps: MONO_CAPS });
    ownedApps.push(app);
    app.loop.renderRoot.flush();
    const english = board.inspection();

    i18n.set(createI18n({ locale: 'de', catalogs: [kanbanDe] }));
    app.loop.renderRoot.flush();
    const german = board.inspection();
    expect(german.label).toBe('Kanban-Board');
    expect(german.layoutReflows).toBe(english.layoutReflows + 1);
    expect(german.visibleColumns[0]).toMatchObject({ columnId: 'ready', label: sanitizedWideLabel });
    expect(german.visibleCards.find((card: InspectedCard) => card.cardKey === 2)?.marker.cues).toContain('focused');
    expect(frameText(app)).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u);
    expectCellSafeFrame(app);
    expectChildrenClipped(board);

    liveColumns.set(columns('done', ['ready', hostileWideLabel]));
    liveCards.set(liveCards().filter((item) => item.id !== 2));
    app.loop.renderRoot.flush();
    const authoritative = board.inspection();
    expect(authoritative.visibleColumns.map((column: InspectedColumn) => column.columnId)).toEqual(['done', 'ready']);
    expect(authoritative.visibleCards.map((card: InspectedCard) => card.cardKey).sort()).toEqual([1, 3]);
    expect(authoritative.identity).toEqual({ selectedCardKeys: [], focusedCardKey: undefined });
    expect(authoritative.visibleColumns[1]?.label).toBe(sanitizedWideLabel);
    expectCellSafeFrame(app);
    expectChildrenClipped(board);
  });
});
