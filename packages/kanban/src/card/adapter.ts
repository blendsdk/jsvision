import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey, KanbanChecklistId, KanbanFieldId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanCardPresentationSelection } from './presentation-policy.js';
import type { KanbanCardFormattingContext } from './formatting.js';
import type { KanbanCardOperationState } from './descriptor.js';
import type { StandardCard } from './standard-card.js';
import type { KanbanThemeRole } from './theme.js';

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

/** Supported value and formatter contracts for one optional metadata field. */
export type KanbanCardFieldKind = 'text' | 'number' | 'date' | 'labels';

/** Shared identity, label, priority, and semantic-role metadata for one field. */
export interface KanbanCardFieldBase {
  /** Stable application field identity. */
  readonly fieldId: KanbanFieldId;
  /** Display label sanitized at the snapshot boundary. */
  readonly label: string;
  /** Non-negative priority used only when optional content must degrade. */
  readonly priority: number;
  /** Optional semantic text role. */
  readonly role?: KanbanThemeRole;
}

/** Generic application-owned field projection understood by the standard snapshot boundary. */
export type KanbanCardField<TCard> =
  | (KanbanCardFieldBase & {
      readonly kind: 'text';
      readonly valueOf: (card: TCard) => string | undefined;
      readonly format?: (value: string, context: KanbanCardFormattingContext) => string | undefined;
    })
  | (KanbanCardFieldBase & {
      readonly kind: 'number';
      readonly valueOf: (card: TCard) => number | bigint | undefined;
      readonly format?: (value: number | bigint, context: KanbanCardFormattingContext) => string | undefined;
    })
  | (KanbanCardFieldBase & {
      readonly kind: 'date';
      readonly valueOf: (card: TCard) => unknown;
      readonly format?: (value: unknown, context: KanbanCardFormattingContext) => string | undefined;
    })
  | (KanbanCardFieldBase & {
      readonly kind: 'labels';
      readonly valueOf: (card: TCard) => readonly string[] | undefined;
      readonly format?: (
        value: readonly string[],
        context: KanbanCardFormattingContext,
      ) => readonly string[] | undefined;
    });

/** Detached bounded summary result containing text, count, or both. */
export interface KanbanCardSummaryValue {
  /** Optional application-formatted summary text. */
  readonly text?: string;
  /** Optional non-negative safe-integer aggregate count. */
  readonly count?: number;
}

/** Raw summary value accepted before optional formatting and validation. */
export type KanbanCardSummaryInput = string | number | bigint | KanbanCardSummaryValue;

/** Generic application-owned aggregate projection for one standard card summary. */
export interface KanbanCardSummary<TCard> {
  /** Stable summary identity in the application field namespace. */
  readonly summaryId: KanbanFieldId;
  /** Display label sanitized at the snapshot boundary. */
  readonly label: string;
  /** Non-negative priority used only when optional content must degrade. */
  readonly priority: number;
  /** Optional semantic summary role. */
  readonly role?: KanbanThemeRole;
  /** Reads one bounded aggregate value without transferring card ownership. */
  readonly valueOf: (card: TCard) => KanbanCardSummaryInput | undefined;
  /** Optionally formats the unchanged aggregate input once. */
  readonly format?: (
    value: KanbanCardSummaryInput,
    context: KanbanCardFormattingContext,
  ) => KanbanCardSummaryValue | undefined;
}

/** Stable item identity whose uniqueness is scoped to one checklist group. */
export type KanbanChecklistItemId = string;

/** One application-owned checklist item snapshotted for read-only card display. */
export interface KanbanChecklistItem {
  /** Stable group-scoped item identity. */
  readonly itemId: KanbanChecklistItemId;
  /** Display text sanitized at the snapshot boundary. */
  readonly text: string;
  /** Application-owned completion state. */
  readonly completed: boolean;
}

/** One ordered application-owned checklist group. */
export interface KanbanChecklistGroup {
  /** Stable card-scoped checklist identity. */
  readonly checklistId: KanbanChecklistId;
  /** Optional group title sanitized at the snapshot boundary. */
  readonly title?: string;
  /** Ordered read-only item publication. */
  readonly items: readonly KanbanChecklistItem[];
}

/** Complete card-local interaction state available to semantic style selection. */
export interface KanbanCardVisualState {
  /** Whether the card owns keyboard focus. */
  readonly focused: boolean;
  /** Whether the card belongs to the current selection. */
  readonly selected: boolean;
  /** Whether the card is the range-selection anchor. */
  readonly rangeAnchor: boolean;
  /** Whether mutation actions are disabled. */
  readonly readOnly: boolean;
  /** Whether current application validation rejects the card. */
  readonly invalid: boolean;
  /** Current drag or persistence operation state. */
  readonly operation: KanbanCardOperationState;
}

/** Optional semantic roles and glyph policy selected from card/application state. */
export interface KanbanCardStyleSelection {
  /** Optional equality-only style revision for descriptor caching. */
  readonly revision?: KanbanRevision;
  /** Optional card interior role. */
  readonly surfaceRole?: KanbanThemeRole;
  /** Optional card boundary role. */
  readonly borderRole?: KanbanThemeRole;
  /** Optional non-color marker role. */
  readonly markerRole?: KanbanThemeRole;
  /** Optional title role. */
  readonly titleRole?: KanbanThemeRole;
  /** Optional status role. */
  readonly statusRole?: KanbanThemeRole;
  /** Optional general metadata role. */
  readonly textRole?: KanbanThemeRole;
  /** Preferred safe glyph family. */
  readonly glyphFamily?: 'automatic' | 'unicode' | 'ascii';
}

/** Final-shaped generic adapter for rich standard-card presentation. */
export interface KanbanCardPresentationAdapter<TCard> extends KanbanCardAdapter<TCard> {
  /** Ordered configured metadata fields. */
  readonly fields?: readonly KanbanCardField<TCard>[];
  /** Ordered configured aggregate summaries. */
  readonly summaries?: readonly KanbanCardSummary<TCard>[];
  /** Reads ordered checklist groups once for one card snapshot. */
  readonly checklistOf?: (card: TCard) => readonly KanbanChecklistGroup[];
  /** Selects an optional reordered subset without changing numeric maxima. */
  readonly selectionOf?: (card: TCard) => KanbanCardPresentationSelection | undefined;
  /** Resolves semantic style roles from card and detached visual state. */
  readonly styleOf?: (card: TCard, state: KanbanCardVisualState) => KanbanCardStyleSelection;
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
