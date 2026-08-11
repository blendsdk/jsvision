/** Implementation coverage for the private board-to-viewport operation bridge. */
import { resolveCapabilities } from '@jsvision/core';
import { Group, createRenderRoot } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanViewport, createEagerKanbanDataSource, createKanbanOperationId } from '../src/index.js';
import type { KanbanCardAdapter, KanbanOperationSnapshot } from '../src/index.js';
import {
  prepareKanbanViewportOperations,
  readKanbanViewportOperations,
} from '../src/board/viewport-operation-bridge.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
}

const CARD: KanbanCardAdapter<Card> = Object.freeze({
  keyOf: (card: Card) => card.id,
  titleOf: (card: Card) => `Card ${card.id}`,
  statusOf: (card: Card) => card.columnId,
});

/** Creates an unmounted viewport suitable for private bridge reads. */
function viewport(observe?: (value: { readonly code: string }) => void): KanbanViewport<Card> {
  const source = createEagerKanbanDataSource(() => Object.freeze([]), {
    columns: () => [Object.freeze({ columnId: 'ready', label: 'Ready', revision: 1 })],
    keyOf: (card: Card) => card.id,
    columnOf: (card: Card) => card.columnId,
  });
  return new KanbanViewport({
    source,
    query: () => ({ filters: [], sort: [] }),
    card: CARD,
    ...(observe === undefined ? {} : { observe }),
  });
}

/** Creates one valid pending move snapshot with a requested aggregate subject count. */
function pending(cardCount: number): KanbanOperationSnapshot {
  const cardKeys = Object.freeze(Array.from({ length: cardCount }, (_, cardKey) => cardKey));
  return Object.freeze({
    operationId: createKanbanOperationId('aggregate-operation'),
    kind: 'card-move',
    state: 'pending',
    affected: Object.freeze([Object.freeze({ kind: 'column' as const, columnId: 'doing' })]),
    projection: Object.freeze({
      kind: 'card-move' as const,
      state: 'pending' as const,
      cardKeys,
      sources: Object.freeze(cardKeys.map(() => Object.freeze({ columnId: 'ready' }))),
      target: Object.freeze({ columnId: 'doing' }),
      position: Object.freeze({ kind: 'end' as const, cursorRevision: 1 }),
    }),
  });
}

describe('private viewport operation bridge', () => {
  it('rejects aggregate operation work above the visible projection budget before composition', () => {
    const instance = viewport();
    prepareKanbanViewportOperations(instance, {
      snapshot: () => [pending(8_193)],
      subscribe: () => () => undefined,
      cancel: () => true,
    });

    expect(readKanbanViewportOperations(instance, 32, 8_192)).toEqual({ kind: 'failed' });
    instance.dispose();
  });

  it('rejects accessor-bearing snapshots without invoking application object behavior', () => {
    const instance = viewport();
    const getter = vi.fn(() => 'pending');
    const hostile = Object.defineProperty({}, 'state', { enumerable: true, get: getter });
    prepareKanbanViewportOperations(instance, {
      snapshot: () => [hostile as never],
      subscribe: () => () => undefined,
      cancel: () => true,
    });

    expect(readKanbanViewportOperations(instance, 32, 8_192)).toEqual({ kind: 'failed' });
    expect(getter).not.toHaveBeenCalled();
    instance.dispose();
  });

  it('cancels aggregate overflow once at the mounted boundary and does not retry settled work', () => {
    const observations: string[] = [];
    const instance = viewport((value) => observations.push(value.code));
    let active: readonly KanbanOperationSnapshot[] = [pending(8_193)];
    const cancel = vi.fn(() => {
      active = Object.freeze([]);
      return true;
    });
    prepareKanbanViewportOperations(instance, {
      snapshot: () => active,
      subscribe: () => () => undefined,
      cancel,
    });
    instance.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 8 } });
    const host = new Group();
    host.add(instance);
    const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
    const render = createRenderRoot({ width: 24, height: 8 }, { caps });
    render.mount(host);
    render.flush();
    render.flush();

    expect(cancel).toHaveBeenCalledOnce();
    expect(observations).toEqual(['overlay-composition-failed']);
    render.unmount();
  });
});
