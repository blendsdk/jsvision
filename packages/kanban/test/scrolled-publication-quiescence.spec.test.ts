/**
 * Specification oracle for bounded repaint settlement after scrolled source publication.
 *
 * A source move may relocate the focused vertical anchor to a position where its previous screen
 * row is impossible to preserve. The viewport must accept the nearest clamped position and become
 * idle; it must never keep scheduling frames in pursuit of an unreachable negative scroll offset.
 */
import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { expect, test, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type {
  CardKey,
  KanbanCardLocation,
  KanbanCardPresentationAdapter,
  KanbanCellAddress,
  KanbanDataSource,
  KanbanQuery,
  KanbanQuerySession,
} from '../src/index.js';

interface Card {
  readonly key: number;
  readonly columnId: string;
  readonly title: string;
  readonly detail?: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: KanbanCardPresentationAdapter<Card> = Object.freeze({
  keyOf: (card: Card) => card.key,
  titleOf: (card: Card) => card.title,
  statusOf: () => 'Ready',
  fields: Object.freeze([
    Object.freeze({
      fieldId: 'detail',
      label: 'Detail',
      priority: 1,
      kind: 'text' as const,
      valueOf: (card: Card) => card.detail,
    }),
  ]),
});

const PRESENTATION = Object.freeze({
  revision: 'anchor-quiescence-v1',
  cardRows: 4,
  cardGap: 1,
  metadataFields: 1,
  labelRows: 0,
  summarySections: 0,
  checklistMode: 'hidden' as const,
  checklistPreviewItems: 0,
});

/** Drains source promises and captured render callbacks without allowing an unbounded busy loop. */
async function settle(callbacks: Array<() => void>, limit: number): Promise<number> {
  let frames = 0;
  let idleRounds = 0;
  for (let round = 0; round < limit; round += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    let worked = false;
    while (callbacks.length > 0 && frames < limit) {
      callbacks.shift()?.();
      frames += 1;
      worked = true;
    }
    idleRounds = worked ? 0 : idleRounds + 1;
    if (idleRounds >= 8) return frames;
  }
  return frames;
}

/** Returns one visible card's viewport row from semantic hit-test geometry. */
function cardRow(board: KanbanBoard<Card>, cardKey: number): number | undefined {
  return board.inspection().regions.find((region) => region.kind === 'card' && region.cardKey === cardKey)?.y;
}

test('a focused card moved above a scrolled viewport settles at the clamped top offset', async () => {
  const cards = signal<readonly Card[]>(
    Array.from({ length: 40 }, (_, key) => ({
      key,
      columnId: 'ready',
      title: `Card ${key}`,
      ...(key % 2 === 0 ? { detail: `Variable detail ${key}` } : {}),
    })),
  );
  const source = createEagerKanbanDataSource(cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => ({ filters: [], sort: [] }),
    card: CARD,
    presentation: () => PRESENTATION,
    identity: () => ({ selectedCardKeys: [2], focusedCardKey: 2 }),
  });
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const callbacks: Array<() => void> = [];
  const render = createRenderRoot(
    { width: 24, height: 18 },
    { caps: CAPS, schedule: (callback) => callbacks.push(callback) },
  );
  render.mount(host);
  await settle(callbacks, 32);
  board.scrollTo({ y: 7 });
  render.flush();
  await settle(callbacks, 32);
  expect(board.viewport.metrics().offsets.y).toBeGreaterThan(0);

  const reordered = [...cards()];
  const [focused] = reordered.splice(2, 1);
  if (focused === undefined) throw new Error('Focused fixture card is missing.');
  reordered.unshift(focused);
  cards.set(Object.freeze(reordered));
  await vi.waitFor(() => {
    render.flush();
    expect(board.viewport.metrics().offsets.y).toBe(0);
    expect(cardRow(board, 2)).toBe(3);
  });
  const frameCount = await settle(callbacks, 32);

  expect(callbacks).toHaveLength(0);
  expect(frameCount).toBeLessThan(32);
  expect(board.viewport.metrics().offsets.y).toBe(0);
  expect(cardRow(board, 2)).toBe(3);
  render.unmount();
});

test('a reachable variable-height relocation preserves its prior row and becomes idle', async () => {
  const cards = signal<readonly Card[]>(
    Array.from({ length: 40 }, (_, key) => ({
      key,
      columnId: 'ready',
      title: `Card ${key}`,
      ...(key % 2 === 0 ? { detail: `Variable detail ${key}` } : {}),
    })),
  );
  const source = createEagerKanbanDataSource(cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => ({ filters: [], sort: [] }),
    card: CARD,
    presentation: () => PRESENTATION,
    identity: () => ({ selectedCardKeys: [2], focusedCardKey: 2 }),
  });
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const callbacks: Array<() => void> = [];
  const render = createRenderRoot(
    { width: 24, height: 18 },
    { caps: CAPS, schedule: (callback) => callbacks.push(callback) },
  );
  render.mount(host);
  await settle(callbacks, 32);
  board.scrollTo({ y: 7 });
  render.flush();
  await settle(callbacks, 32);
  const before = cardRow(board, 2);
  expect(before).toBeDefined();

  const reordered = [...cards()];
  const [focused] = reordered.splice(2, 1);
  if (focused === undefined) throw new Error('Focused fixture card is missing.');
  reordered.splice(10, 0, focused);
  cards.set(Object.freeze(reordered));
  await vi.waitFor(
    () => {
      render.flush();
      expect(board.viewport.metrics().offsets.y).toBeGreaterThan(20);
    },
    { timeout: 3_000 },
  );
  const frames = await settle(callbacks, 64);

  expect(callbacks).toHaveLength(0);
  expect(frames).toBeLessThan(64);
  expect(board.viewport.metrics().offsets.y).toBeGreaterThan(20);
  expect(cardRow(board, 2)).toBe(before);
  const heights = new Set(board.inspection().visibleCards.map(({ descriptor }) => descriptor.measuredHeight));
  expect(heights.size).toBeGreaterThan(1);
  render.unmount();
});

test('ordinary scrolling does not start source-relocation locators for an offscreen anchor', async () => {
  const cards = signal<readonly Card[]>(
    Array.from({ length: 80 }, (_, key) => ({ key, columnId: 'ready', title: `Card ${key}` })),
  );
  const eager = createEagerKanbanDataSource(cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  let locatorCalls = 0;
  const source: KanbanDataSource<Card> = Object.freeze({
    openQuery(query: KanbanQuery): KanbanQuerySession<Card> {
      const session = eager.openQuery(query);
      const locateCard = session.locateCard;
      if (locateCard === undefined) throw new Error('Eager fixture must provide bounded location.');
      return Object.freeze({
        state: () => session.state(),
        revision: () => session.revision(),
        columns: () => session.columns(),
        swimlanes: () => session.swimlanes(),
        counts: () => session.counts(),
        headers: () => session.headers(),
        identityChanges: () => session.identityChanges(),
        cell: (address: KanbanCellAddress) => session.cell(address),
        locateCard: (cardKey: CardKey, options?: { readonly signal?: AbortSignal }) => {
          locatorCalls += 1;
          return locateCard(cardKey, options);
        },
        dispose: () => session.dispose(),
      });
    },
  });
  const board = new KanbanBoard({
    source,
    query: () => ({ filters: [], sort: [] }),
    card: CARD,
    identity: () => ({ selectedCardKeys: [2], focusedCardKey: 2 }),
  });
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const callbacks: Array<() => void> = [];
  const render = createRenderRoot(
    { width: 24, height: 18 },
    { caps: CAPS, schedule: (callback) => callbacks.push(callback) },
  );
  render.mount(host);
  await settle(callbacks, 32);
  expect(cardRow(board, 2)).toBeDefined();

  board.scrollTo({ y: 100 });
  render.flush();
  await settle(callbacks, 32);

  expect(locatorCalls).toBe(0);
  expect(callbacks).toHaveLength(0);
  expect(board.viewport.metrics().offsets.y).toBeGreaterThan(80);
  render.unmount();
});

test('deleting an anchor during relocation clears pending work and scheduler ownership', async () => {
  const cards = signal<readonly Card[]>(
    Array.from({ length: 40 }, (_, key) => ({ key, columnId: 'ready', title: `Card ${key}` })),
  );
  const source = createEagerKanbanDataSource(cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => ({ filters: [], sort: [] }),
    card: CARD,
    identity: () => ({ selectedCardKeys: [2], focusedCardKey: 2 }),
  });
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const callbacks: Array<() => void> = [];
  const render = createRenderRoot(
    { width: 24, height: 18 },
    { caps: CAPS, schedule: (callback) => callbacks.push(callback) },
  );
  render.mount(host);
  await settle(callbacks, 32);
  board.scrollTo({ y: 7 });
  render.flush();
  await settle(callbacks, 32);

  const reordered = [...cards()];
  const [focused] = reordered.splice(2, 1);
  if (focused === undefined) throw new Error('Focused fixture card is missing.');
  reordered.splice(30, 0, focused);
  cards.set(Object.freeze(reordered));
  render.flush();
  await Promise.resolve();
  cards.set(Object.freeze(cards().filter(({ key }) => key !== 2)));
  render.flush();
  const frames = await settle(callbacks, 32);

  expect(callbacks).toHaveLength(0);
  expect(frames).toBeLessThan(32);
  expect(board.inspection().visibleCards.some(({ descriptor }) => descriptor.cardKey === 2)).toBe(false);
  render.unmount();
});

test('a newer source move supersedes an unresolved relocation expectation', async () => {
  const cards = signal<readonly Card[]>(
    Array.from({ length: 40 }, (_, key) => ({ key, columnId: 'ready', title: `Card ${key}` })),
  );
  const eager = createEagerKanbanDataSource(cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  let locatorCalls = 0;
  let firstLocatorAborted = false;
  const source: KanbanDataSource<Card> = Object.freeze({
    openQuery(query: KanbanQuery): KanbanQuerySession<Card> {
      const session = eager.openQuery(query);
      const locateCard = session.locateCard;
      if (locateCard === undefined) throw new Error('Eager fixture must provide bounded location.');
      return Object.freeze({
        state: () => session.state(),
        revision: () => session.revision(),
        columns: () => session.columns(),
        swimlanes: () => session.swimlanes(),
        counts: () => session.counts(),
        headers: () => session.headers(),
        identityChanges: () => session.identityChanges(),
        cell: (address: KanbanCellAddress) => session.cell(address),
        locateCard: (cardKey: CardKey, options?: { readonly signal?: AbortSignal }) => {
          locatorCalls += 1;
          if (locatorCalls !== 1) {
            return Object.freeze({
              kind: 'found' as const,
              address: Object.freeze({ columnId: 'ready' }),
              index: cards().findIndex(({ key }) => key === cardKey),
              sessionRevision: session.revision(),
            });
          }
          return new Promise<KanbanCardLocation>((_, reject) => {
            options?.signal?.addEventListener(
              'abort',
              () => {
                firstLocatorAborted = true;
                reject(new Error('Superseded fixture locator.'));
              },
              { once: true },
            );
          });
        },
        dispose: () => session.dispose(),
      });
    },
  });
  const board = new KanbanBoard({
    source,
    query: () => ({ filters: [], sort: [] }),
    card: CARD,
    identity: () => ({ selectedCardKeys: [2], focusedCardKey: 2 }),
  });
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const callbacks: Array<() => void> = [];
  const render = createRenderRoot(
    { width: 24, height: 18 },
    { caps: CAPS, schedule: (callback) => callbacks.push(callback) },
  );
  render.mount(host);
  await settle(callbacks, 32);
  board.scrollTo({ y: 7 });
  render.flush();
  await settle(callbacks, 32);

  const first = [...cards()];
  const [focused] = first.splice(2, 1);
  if (focused === undefined) throw new Error('Focused fixture card is missing.');
  first.splice(30, 0, focused);
  cards.set(Object.freeze(first));
  render.flush();
  expect(locatorCalls).toBe(1);
  const second = cards().filter(({ key }) => key !== 2);
  cards.set(Object.freeze([focused, ...second]));
  await vi.waitFor(
    () => {
      render.flush();
      // One replacement relocation lookup plus the interaction controller's independent reveal lookup.
      expect(locatorCalls).toBe(3);
      expect(board.viewport.metrics().offsets.y).toBe(0);
      expect(cardRow(board, 2)).toBe(3);
    },
    { timeout: 3_000 },
  );
  const frames = await settle(callbacks, 32);

  expect(callbacks).toHaveLength(0);
  expect(frames).toBeLessThan(32);
  expect(firstLocatorAborted).toBe(true);
  expect(locatorCalls).toBe(3);
  render.unmount();
});
