import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { createEagerKanbanDataSource } from '../source/eager-source.js';
import type { EagerKanbanSourceOptions } from '../source/eager-index.js';
import type { KanbanColumnMeta, KanbanDataSource } from '../source/types.js';

/** Controllable reactive eager fixture returned from the testing entry. */
export interface KanbanEagerFixture<TCard> {
  /** Public eager source under test. */
  readonly source: KanbanDataSource<TCard>;
  /** Reactive application-owned card publication. */
  readonly cards: Signal<readonly TCard[]>;
  /** Reactive application-owned ordered columns. */
  readonly columns: Signal<readonly KanbanColumnMeta[]>;
}

/**
 * Creates a controllable reactive eager fixture while preserving application card references.
 *
 * @example
 * ```ts
 * const fixture = createEagerKanbanFixture(cards, columns, {
 *   keyOf: (card) => card.id,
 *   columnOf: (card) => card.columnId,
 * });
 * ```
 */
export function createEagerKanbanFixture<TCard>(
  initialCards: readonly TCard[],
  initialColumns: readonly KanbanColumnMeta[],
  options: Omit<EagerKanbanSourceOptions<TCard>, 'columns'>,
): KanbanEagerFixture<TCard> {
  const cards = signal<readonly TCard[]>(initialCards);
  const columns = signal<readonly KanbanColumnMeta[]>(initialColumns);
  return Object.freeze({
    source: createEagerKanbanDataSource(cards, { ...options, columns }),
    cards,
    columns,
  });
}
