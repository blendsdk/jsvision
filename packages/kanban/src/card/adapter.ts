import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanCardPresentationSelection } from './presentation-policy.js';
import type { KanbanCardFormattingContext } from './formatting.js';
import type { KanbanCardOperationState } from './descriptor.js';
import type { KanbanChecklistGroup } from './checklist.js';
import type { StandardCard, StandardCardSummary } from './standard-card.js';
import type { KanbanCardSummary, KanbanCardSummaryInput, KanbanCardSummaryValue } from './summary.js';
import type { KanbanThemeRole } from './theme.js';

export type { KanbanChecklistGroup, KanbanChecklistItem, KanbanChecklistItemId } from './checklist.js';
export type { KanbanCardSummary, KanbanCardSummaryInput, KanbanCardSummaryValue } from './summary.js';

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

/** Common optional property names understood by the {@link StandardCard} convenience adapter. */
export type StandardKanbanCardFieldName =
  'description' | 'type' | 'priority' | 'assignees' | 'labels' | 'startDate' | 'dueDate' | 'estimate' | 'value';

/** Stable field identities used by the standard-card presentation adapter. */
export const KANBAN_STANDARD_CARD_FIELD_IDS: Readonly<Record<StandardKanbanCardFieldName, KanbanFieldId>> =
  Object.freeze({
    description: 'description',
    type: 'type',
    priority: 'priority',
    assignees: 'assignees',
    labels: 'labels',
    startDate: 'startDate',
    dueDate: 'dueDate',
    estimate: 'estimate',
    value: 'value',
  });

/** Shared localized display configuration for one optional standard-card field. */
export interface StandardKanbanCardFieldConfiguration {
  /** Application-localized field label. */
  readonly label: string;
  /** Non-negative priority used only when optional content must degrade. */
  readonly priority: number;
  /** Optional semantic text role. */
  readonly role?: KanbanThemeRole;
}

/** Localized configuration for one standard-card text field. */
export interface StandardKanbanCardTextFieldConfiguration extends StandardKanbanCardFieldConfiguration {
  /** Optionally formats the unchanged string value once. */
  readonly format?: (value: string, context: KanbanCardFormattingContext) => string | undefined;
}

/** Localized configuration for one standard-card list field. */
export interface StandardKanbanCardListFieldConfiguration extends StandardKanbanCardFieldConfiguration {
  /** Optionally formats the detached ordered labels once. */
  readonly format?: (value: readonly string[], context: KanbanCardFormattingContext) => readonly string[] | undefined;
}

/** Localized configuration for one opaque standard-card date field. */
export interface StandardKanbanCardDateFieldConfiguration extends StandardKanbanCardFieldConfiguration {
  /** Optionally formats the exact unchanged application date value once. */
  readonly format?: (value: unknown, context: KanbanCardFormattingContext) => string | undefined;
}

/** Optional common fields exposed by the standard-card presentation adapter. */
export interface StandardKanbanCardFieldsConfiguration {
  /** Long description metadata. */
  readonly description?: StandardKanbanCardTextFieldConfiguration;
  /** Work-item type metadata. */
  readonly type?: StandardKanbanCardTextFieldConfiguration;
  /** Priority metadata. */
  readonly priority?: StandardKanbanCardTextFieldConfiguration;
  /** Ordered assignee labels. */
  readonly assignees?: StandardKanbanCardListFieldConfiguration;
  /** Ordered card labels. */
  readonly labels?: StandardKanbanCardListFieldConfiguration;
  /** Opaque start date. */
  readonly startDate?: StandardKanbanCardDateFieldConfiguration;
  /** Opaque due date. */
  readonly dueDate?: StandardKanbanCardDateFieldConfiguration;
  /** Application-formatted estimate text. */
  readonly estimate?: StandardKanbanCardTextFieldConfiguration;
  /** Application-formatted business-value text. */
  readonly value?: StandardKanbanCardTextFieldConfiguration;
}

/** One configured standard-card summary section whose value is read by stable identity. */
export interface StandardKanbanCardSummaryConfiguration extends KanbanCardFieldBase {
  /** Stable summary identity matching `StandardCard.summaries[].fieldId`. */
  readonly fieldId: KanbanFieldId;
  /** Optionally formats the unchanged summary string once. */
  readonly format?: (value: string, context: KanbanCardFormattingContext) => KanbanCardSummaryValue | undefined;
}

/** Optional rich-presentation configuration for the standard-card adapter factory. */
export interface StandardKanbanCardAdapterOptions<TDate = unknown, TCustom = unknown> {
  /** Common fields to expose, in the package's stable canonical order. */
  readonly fields?: StandardKanbanCardFieldsConfiguration;
  /** Ordered configured summaries read from each card by stable field identity. */
  readonly summaries?: readonly StandardKanbanCardSummaryConfiguration[];
  /** Optionally selects a reordered subset for each card without enlarging policy maxima. */
  readonly selectionOf?: (card: StandardCard<TDate, TCustom>) => KanbanCardPresentationSelection | undefined;
  /** Optionally selects semantic roles from the detached visual state. */
  readonly styleOf?: (card: StandardCard<TDate, TCustom>, state: KanbanCardVisualState) => KanbanCardStyleSelection;
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

/** Frozen empty checklist publication shared by standard cards without checklist data. */
const EMPTY_STANDARD_CHECKLISTS: readonly [] = Object.freeze([]);

/** Builds one configured text field without retaining its mutable configuration object. */
function standardTextField<TDate, TCustom>(
  fieldId: KanbanFieldId,
  configuration: StandardKanbanCardTextFieldConfiguration,
  valueOf: (card: StandardCard<TDate, TCustom>) => string | undefined,
): KanbanCardField<StandardCard<TDate, TCustom>> {
  return Object.freeze({
    kind: 'text',
    fieldId,
    label: configuration.label,
    priority: configuration.priority,
    valueOf,
    ...(configuration.role === undefined ? {} : { role: configuration.role }),
    ...(configuration.format === undefined ? {} : { format: configuration.format }),
  });
}

/** Builds one configured label-list field without retaining its mutable configuration object. */
function standardListField<TDate, TCustom>(
  fieldId: KanbanFieldId,
  configuration: StandardKanbanCardListFieldConfiguration,
  valueOf: (card: StandardCard<TDate, TCustom>) => readonly string[] | undefined,
): KanbanCardField<StandardCard<TDate, TCustom>> {
  return Object.freeze({
    kind: 'labels',
    fieldId,
    label: configuration.label,
    priority: configuration.priority,
    valueOf,
    ...(configuration.role === undefined ? {} : { role: configuration.role }),
    ...(configuration.format === undefined ? {} : { format: configuration.format }),
  });
}

/** Builds one configured opaque-date field without retaining its mutable configuration object. */
function standardDateField<TDate, TCustom>(
  fieldId: KanbanFieldId,
  configuration: StandardKanbanCardDateFieldConfiguration,
  valueOf: (card: StandardCard<TDate, TCustom>) => TDate | undefined,
): KanbanCardField<StandardCard<TDate, TCustom>> {
  return Object.freeze({
    kind: 'date',
    fieldId,
    label: configuration.label,
    priority: configuration.priority,
    valueOf,
    ...(configuration.role === undefined ? {} : { role: configuration.role }),
    ...(configuration.format === undefined ? {} : { format: configuration.format }),
  });
}

/** Creates configured standard fields in a stable order independent of object key enumeration. */
function createStandardFields<TDate, TCustom>(
  configuration: StandardKanbanCardFieldsConfiguration | undefined,
): readonly KanbanCardField<StandardCard<TDate, TCustom>>[] {
  if (configuration === undefined) return Object.freeze([]);

  const fields: KanbanCardField<StandardCard<TDate, TCustom>>[] = [];
  if (configuration.description !== undefined) {
    fields.push(
      standardTextField(
        KANBAN_STANDARD_CARD_FIELD_IDS.description,
        configuration.description,
        (card) => card.description,
      ),
    );
  }
  if (configuration.type !== undefined) {
    fields.push(standardTextField(KANBAN_STANDARD_CARD_FIELD_IDS.type, configuration.type, (card) => card.type));
  }
  if (configuration.priority !== undefined) {
    fields.push(
      standardTextField(KANBAN_STANDARD_CARD_FIELD_IDS.priority, configuration.priority, (card) => card.priority),
    );
  }
  if (configuration.assignees !== undefined) {
    fields.push(
      standardListField(KANBAN_STANDARD_CARD_FIELD_IDS.assignees, configuration.assignees, (card) =>
        card.assignees?.map((assignee) => assignee.label),
      ),
    );
  }
  if (configuration.labels !== undefined) {
    fields.push(
      standardListField(KANBAN_STANDARD_CARD_FIELD_IDS.labels, configuration.labels, (card) =>
        card.labels?.map((label) => label.label),
      ),
    );
  }
  if (configuration.startDate !== undefined) {
    fields.push(
      standardDateField(KANBAN_STANDARD_CARD_FIELD_IDS.startDate, configuration.startDate, (card) => card.startDate),
    );
  }
  if (configuration.dueDate !== undefined) {
    fields.push(
      standardDateField(KANBAN_STANDARD_CARD_FIELD_IDS.dueDate, configuration.dueDate, (card) => card.dueDate),
    );
  }
  if (configuration.estimate !== undefined) {
    fields.push(
      standardTextField(KANBAN_STANDARD_CARD_FIELD_IDS.estimate, configuration.estimate, (card) => card.estimate),
    );
  }
  if (configuration.value !== undefined) {
    fields.push(standardTextField(KANBAN_STANDARD_CARD_FIELD_IDS.value, configuration.value, (card) => card.value));
  }
  return Object.freeze(fields);
}

/** Finds one card-local summary value without publishing the containing collection. */
function standardSummaryValue(
  summaries: readonly StandardCardSummary[] | undefined,
  fieldId: KanbanFieldId,
): string | undefined {
  return summaries?.find((summary) => summary.fieldId === fieldId)?.value;
}

/** Creates detached configured summary descriptors in caller order. */
function createStandardSummaries<TDate, TCustom>(
  configurations: readonly StandardKanbanCardSummaryConfiguration[] | undefined,
): readonly KanbanCardSummary<StandardCard<TDate, TCustom>>[] {
  if (configurations === undefined) return Object.freeze([]);
  return Object.freeze(
    configurations.map((configuration) => {
      const fieldId = configuration.fieldId;
      const format = configuration.format;
      return Object.freeze({
        summaryId: fieldId,
        label: configuration.label,
        priority: configuration.priority,
        valueOf: (card: StandardCard<TDate, TCustom>) => standardSummaryValue(card.summaries, fieldId),
        ...(configuration.role === undefined ? {} : { role: configuration.role }),
        ...(format === undefined
          ? {}
          : {
              format: (value: KanbanCardSummaryInput, context: KanbanCardFormattingContext) =>
                typeof value === 'string' ? format(value, context) : undefined,
            }),
      });
    }),
  );
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
 * The adapter never mutates the card. Optional presentation configuration is copied into immutable
 * descriptors, while runtime values remain application-owned until the snapshot boundary validates
 * and detaches them. Labels are supplied by the application so they can follow its locale and domain
 * vocabulary.
 *
 * @example
 * ```ts
 * const adapter = createStandardKanbanCardAdapter({
 *   fields: { priority: { label: 'Priority', priority: 1 } },
 * });
 * const key = adapter.keyOf({ key: 42, columnId: 'ready', title: 'Review', status: 'Ready' });
 * ```
 */
export function createStandardKanbanCardAdapter<TDate = unknown, TCustom = unknown>(
  options: StandardKanbanCardAdapterOptions<TDate, TCustom> = {},
): KanbanCardPresentationAdapter<StandardCard<TDate, TCustom>> {
  const fields = createStandardFields<TDate, TCustom>(options.fields);
  const summaries = createStandardSummaries<TDate, TCustom>(options.summaries);
  return Object.freeze({
    keyOf: (card: StandardCard<TDate, TCustom>) => card.key,
    titleOf: (card: StandardCard<TDate, TCustom>) => card.title,
    statusOf: (card: StandardCard<TDate, TCustom>) => card.status,
    presentationRevisionOf: (card: StandardCard<TDate, TCustom>) => card.presentationRevision,
    checklistOf: (card: StandardCard<TDate, TCustom>) => card.checklists ?? EMPTY_STANDARD_CHECKLISTS,
    ...(fields.length === 0 ? {} : { fields }),
    ...(summaries.length === 0 ? {} : { summaries }),
    ...(options.selectionOf === undefined ? {} : { selectionOf: options.selectionOf }),
    ...(options.styleOf === undefined ? {} : { styleOf: options.styleOf }),
  });
}
