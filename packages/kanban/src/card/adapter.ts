import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
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

/** Detached mandatory presentation values read from one application card. */
export interface KanbanCardAdapterSnapshot {
  /** Validated card identity with number/string distinction preserved. */
  readonly cardKey: CardKey;
  /** Bounded non-empty title awaiting output sanitization. */
  readonly title: string;
  /** Bounded non-empty status awaiting output sanitization. */
  readonly status: string;
  /** Optional validated equality-only presentation revision. */
  readonly presentationRevision?: KanbanRevision;
}

/** Shared encoder used to bound mandatory strings by the package's safe semantic-string limit. */
const CARD_TEXT_ENCODER = new TextEncoder();

/** Validates one mandatory adapter string without coercing or retaining an invalid value. */
function mandatoryText(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > KANBAN_LIMITS.semanticStringBytes.safe ||
    CARD_TEXT_ENCODER.encode(value).byteLength > KANBAN_LIMITS.semanticStringBytes.safe
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  return value;
}

/**
 * Reads and validates one card through its adapter as one atomic presentation snapshot.
 *
 * Callback failures propagate to the single safe-render wrapper, which owns observation and fallback.
 * The snapshot contains no application record reference and is frozen before publication.
 */
export function readKanbanCardAdapter<TCard>(
  card: TCard,
  adapter: KanbanCardAdapter<TCard>,
): KanbanCardAdapterSnapshot {
  const cardKey = createKanbanCardKey(adapter.keyOf(card));
  const title = mandatoryText(adapter.titleOf(card));
  const status = mandatoryText(adapter.statusOf(card));
  const revision = adapter.presentationRevisionOf?.(card);
  const presentationRevision = revision === undefined ? undefined : snapshotKanbanRevision(revision);
  return Object.freeze({
    cardKey,
    title,
    status,
    ...(presentationRevision === undefined ? {} : { presentationRevision }),
  });
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
