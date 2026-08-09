import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  KanbanBoard,
  KanbanInvalidSourcePublicationError,
  KanbanViewport,
  createEagerKanbanDataSource,
} from '../src/index.js';
import type { KanbanBoardOptions, KanbanCardAdapter, KanbanInteractionSnapshot, KanbanQuery } from '../src/index.js';
import type { KanbanViewportInteractionAdapter } from '../src/board/viewport-interaction.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};

/** Creates one deterministic eager source for standalone interaction projection. */
function source() {
  return createEagerKanbanDataSource(
    () => [
      { id: 1, columnId: 'ready', title: 'One' },
      { id: 2, columnId: 'ready', title: 'Two' },
    ],
    {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    },
  );
}

/** Mounts one standalone viewport and flushes its first complete scene. */
function mount(viewport: KanbanViewport<Card>, height = 12) {
  viewport.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(viewport);
  const render = createRenderRoot({ width: 40, height }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

describe('standalone viewport interaction adapter', () => {
  it('keeps the adapter out of board-owned construction options', () => {
    expectTypeOf<KanbanBoardOptions<Card>>().not.toHaveProperty('interaction');

    const interaction = {
      snapshot: () =>
        Object.freeze({
          revision: 0,
          focused: Object.freeze({ kind: 'board-state' as const }),
          selectedCardKeys: Object.freeze([]),
        }),
      transition: () => ({
        kind: 'unchanged' as const,
        snapshot: Object.freeze({
          revision: 0,
          focused: Object.freeze({ kind: 'board-state' as const }),
          selectedCardKeys: Object.freeze([]),
        }),
      }),
      subscribe: () => () => undefined,
    };
    const widenedOptions = { source: source(), query: () => QUERY, card: CARD, interaction };
    expect(() => new KanbanBoard(widenedOptions)).toThrow(KanbanInvalidSourcePublicationError);
  });

  it('projects validated publications and releases only its non-owning subscription', () => {
    let current: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'card', cardKey: 1, address: Object.freeze({ columnId: 'ready' }) }),
      selectedCardKeys: Object.freeze([2]),
    });
    let notify: (() => void) | undefined;
    let failSnapshot = false;
    const unsubscribe = vi.fn();
    const transition = vi.fn(() => ({ kind: 'unchanged' as const, snapshot: current }));
    const ownerDispose = vi.fn();
    const adapter: KanbanViewportInteractionAdapter & { readonly dispose: () => void } = {
      snapshot: () => {
        if (failSnapshot) throw new Error('adapter-secret');
        return current;
      },
      transition,
      subscribe: (invalidate) => {
        notify = invalidate;
        return unsubscribe;
      },
      dispose: ownerDispose,
    };
    const viewport = new KanbanViewport({ source: source(), query: () => QUERY, card: CARD, interaction: adapter });
    const render = mount(viewport);
    const initial = viewport.inspection();

    expect(initial.interaction).toMatchObject({ revision: 1, focused: { cardKey: 1 }, selectedCardKeys: [2] });
    expect(initial.visibleCards.find(({ cardKey }) => cardKey === 1)?.marker.cues).toContain('focused');
    expect(initial.visibleCards.find(({ cardKey }) => cardKey === 2)?.marker.cues).toContain('selected');

    current = Object.freeze({
      revision: 2,
      focused: Object.freeze({ kind: 'card', cardKey: 2, address: Object.freeze({ columnId: 'ready' }) }),
      selectedCardKeys: Object.freeze([1, 2]),
      rangeAnchor: Object.freeze({ cardKey: 1, address: Object.freeze({ columnId: 'ready' }) }),
    });
    notify?.();
    render.flush();
    const updated = viewport.inspection();
    expect(updated.interaction).toMatchObject({ revision: 2, focused: { cardKey: 2 }, selectedCardKeys: [1, 2] });
    expect(updated.visibleCards.find(({ cardKey }) => cardKey === 1)?.marker.cues).toContain('selected');
    expect(updated.visibleCards.find(({ cardKey }) => cardKey === 2)?.marker.cues).toEqual(
      expect.arrayContaining(['focused', 'selected']),
    );

    failSnapshot = true;
    notify?.();
    render.flush();
    expect(viewport.inspection().interaction.revision).toBe(2);
    render.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(ownerDispose).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it('keeps a standalone viewport neutral when no interaction owner is supplied', () => {
    const viewport = new KanbanViewport({ source: source(), query: () => QUERY, card: CARD });
    const render = mount(viewport);
    const inspection = viewport.inspection();

    expect(inspection.interaction).toMatchObject({ revision: 0, focused: { kind: 'board-state' } });
    expect(inspection.visibleCards.every((card) => card.marker.cues.length === 0)).toBe(true);
    render.unmount();
  });

  it('derives interaction targets only from final clipped visible projection', () => {
    const viewport = new KanbanViewport({ source: source(), query: () => QUERY, card: CARD });
    const render = mount(viewport, 8);
    const inspection = viewport.inspection();
    const navigation = viewport.interactionScene();
    const navigationCards = navigation.targets.flatMap((entry) =>
      entry.target.kind === 'card' ? [entry.target.cardKey] : [],
    );
    const navigationColumns = navigation.targets.flatMap((entry) =>
      entry.enabled && entry.target.kind === 'column-header' ? [entry.target.columnId] : [],
    );

    expect(navigationCards).toEqual(inspection.visibleCards.map((card) => card.cardKey));
    expect(navigationColumns).toEqual(inspection.visibleColumns.map((column) => column.columnId));
    render.unmount();
  });

  it('captures adapter methods and isolates a throwing external unsubscribe', () => {
    const initial: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'card', cardKey: 1, address: Object.freeze({ columnId: 'ready' }) }),
      selectedCardKeys: Object.freeze([]),
    });
    const replacement: KanbanInteractionSnapshot = Object.freeze({
      revision: 2,
      focused: Object.freeze({ kind: 'card', cardKey: 2, address: Object.freeze({ columnId: 'ready' }) }),
      selectedCardKeys: Object.freeze([]),
    });
    const adapter = {
      snapshot: () => initial,
      transition: () => ({ kind: 'unchanged' as const, snapshot: initial }),
      subscribe: () => () => {
        throw new Error('external-cleanup-secret');
      },
    };
    const viewport = new KanbanViewport({ source: source(), query: () => QUERY, card: CARD, interaction: adapter });
    adapter.snapshot = () => replacement;
    const render = mount(viewport);

    expect(viewport.inspection().interaction).toMatchObject({ revision: 1, focused: { cardKey: 1 } });
    expect(() => render.unmount()).not.toThrow();
  });

  it('rejects mount atomically when the adapter cannot publish or subscribe', () => {
    const throwingSnapshot: KanbanViewportInteractionAdapter = {
      snapshot: () => {
        throw new Error('initial-publication-secret');
      },
      transition: () => {
        throw new Error('unused');
      },
      subscribe: () => () => undefined,
    };
    const snapshotFailure = new KanbanViewport({
      source: source(),
      query: () => QUERY,
      card: CARD,
      interaction: throwingSnapshot,
    });
    expect(() => mount(snapshotFailure)).toThrow(KanbanInvalidSourcePublicationError);

    const valid: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'board-state' }),
      selectedCardKeys: Object.freeze([]),
    });
    const throwingSubscribe: KanbanViewportInteractionAdapter = {
      snapshot: () => valid,
      transition: () => ({ kind: 'unchanged', snapshot: valid }),
      subscribe: () => {
        throw new Error('subscription-secret');
      },
    };
    const subscriptionFailure = new KanbanViewport({
      source: source(),
      query: () => QUERY,
      card: CARD,
      interaction: throwingSubscribe,
    });
    expect(() => mount(subscriptionFailure)).toThrow(KanbanInvalidSourcePublicationError);
  });
});
