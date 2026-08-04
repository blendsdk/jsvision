import type { CardKey } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { StandardCard } from './standard-card.js';

/**
 * Pure presentation getters that adapt an application-owned record to mandatory card semantics.
 *
 * Adapter calls never transfer ownership of the record. Implementations should read only the fields
 * needed for the requested value and leave domain data unchanged.
 *
 * @example
 * ```ts
 * const adapter: KanbanCardAdapter<Ticket> = {
 *   keyOf: (ticket) => ticket.number,
 *   titleOf: (ticket) => ticket.summary,
 *   statusOf: (ticket) => ticket.state,
 * };
 * ```
 */
export interface KanbanCardAdapter<TCard> {
  /** Returns the stable application-owned identity without string coercion. */
  keyOf(card: TCard): CardKey;
  /** Returns the mandatory card title. */
  titleOf(card: TCard): string;
  /** Returns the mandatory application-formatted status. */
  statusOf(card: TCard): string;
  /** Optionally returns an equality-only revision for presentation-affecting values. */
  presentationRevisionOf?(card: TCard): KanbanRevision | undefined;
}

/**
 * Creates the direct adapter for the optional {@link StandardCard} convenience model.
 *
 * The adapter returns existing values and never clones, normalizes, or mutates the card. Runtime
 * validation is applied by the rendering boundary so these getters remain small and composable.
 *
 * @example
 * ```ts
 * const adapter = createStandardKanbanCardAdapter();
 * const key = adapter.keyOf({ key: 42, columnId: 'ready', title: 'Review', status: 'Ready' });
 * ```
 */
export function createStandardKanbanCardAdapter<TDate = unknown, TCustom = unknown>(): KanbanCardAdapter<
  StandardCard<TDate, TCustom>
> {
  return Object.freeze({
    keyOf: (card: StandardCard<TDate, TCustom>) => card.key,
    titleOf: (card: StandardCard<TDate, TCustom>) => card.title,
    statusOf: (card: StandardCard<TDate, TCustom>) => card.status,
    presentationRevisionOf: (card: StandardCard<TDate, TCustom>) => card.presentationRevision,
  });
}
