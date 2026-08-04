import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanFieldId } from '../contract/identity.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { readKanbanCardAdapter } from './adapter.js';
import type {
  KanbanCardFieldKind,
  KanbanCardPresentationAdapter,
  KanbanCardStyleSelection,
  KanbanCardVisualState,
} from './adapter.js';
import { snapshotKanbanChecklistGroups } from './checklist.js';
import type { KanbanChecklistGroup } from './checklist.js';
import { formatKanbanCardDate, formatKanbanCardNumber, validateKanbanCardFormattingContext } from './formatting.js';
import type { KanbanCardFormattingContext } from './formatting.js';
import { resolveKanbanCardPresentationSelection } from './presentation-policy.js';
import type { KanbanCardPresentationMaximum, ResolvedKanbanCardPresentationSelection } from './presentation-policy.js';
import {
  snapshotPresentationArray,
  snapshotPresentationProperties,
  snapshotPresentationText,
} from './presentation-value.js';
import { snapshotKanbanCardSummaryDefinitions, snapshotKanbanCardSummaryValue } from './summary.js';
import type { KanbanCardSummaryDefinition, KanbanCardSummarySnapshot } from './summary.js';
import { KANBAN_THEME_ROLES } from './theme.js';
import type { KanbanThemeRole } from './theme.js';

export type { KanbanCardSummarySnapshot } from './summary.js';

/** Inputs required to detach one application card into safe presentation values. */
export interface KanbanCardPresentationSnapshotContext {
  /** Resolved view maxima and configured optional-section identities. */
  readonly maximum: KanbanCardPresentationMaximum;
  /** Current card-local interaction state. */
  readonly visualState: KanbanCardVisualState;
  /** Application-owned locale formatting callbacks. */
  readonly formatting: KanbanCardFormattingContext;
  /** Optional payload-free observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
  /** Optional already-acquired checklist values used by convenience renderers to avoid a second getter call. */
  readonly checklistValues?: unknown;
}

/** Detached safe display values for one selected metadata field. */
export interface KanbanCardFieldSnapshot {
  /** Stable configured field identity. */
  readonly fieldId: KanbanFieldId;
  /** Value and formatter contract used for the field. */
  readonly kind: KanbanCardFieldKind;
  /** Sanitized non-empty field label. */
  readonly label: string;
  /** Non-negative degradation priority. */
  readonly priority: number;
  /** Optional allowlisted semantic role. */
  readonly role?: KanbanThemeRole;
  /** Detached sanitized display strings. */
  readonly values: readonly string[];
}

/** Complete detached, deeply frozen standard-card presentation snapshot. */
export interface KanbanCardPresentationSnapshot {
  /** Validated application-owned card identity. */
  readonly cardKey: CardKey;
  /** Optional equality-only card presentation revision. */
  readonly presentationRevision?: KanbanRevision;
  /** Sanitized mandatory title. */
  readonly title: string;
  /** Sanitized mandatory status. */
  readonly status: string;
  /** Selected safe metadata fields. */
  readonly fields: readonly KanbanCardFieldSnapshot[];
  /** Selected safe aggregate summaries. */
  readonly summaries: readonly KanbanCardSummarySnapshot[];
  /** Selected safe read-only checklist groups. */
  readonly checklists: readonly KanbanChecklistGroup[];
  /** Resolved optional-section selection and unchanged numeric maxima. */
  readonly selection: ResolvedKanbanCardPresentationSelection;
  /** Detached visual state used for style resolution. */
  readonly visualState: KanbanCardVisualState;
  /** Safe semantic style selection. */
  readonly style: KanbanCardStyleSelection;
}

/** Internal validated field definition retaining only safe metadata and callback wrappers. */
interface FieldDefinition<TCard> {
  readonly fieldId: KanbanFieldId;
  readonly kind: KanbanCardFieldKind;
  readonly label: string;
  readonly priority: number;
  readonly role?: KanbanThemeRole;
  readonly valueOf: (card: TCard) => unknown;
  readonly format?: (value: unknown, context: KanbanCardFormattingContext) => unknown;
}

/** Structural keys accepted from a card visual-state publication. */
const VISUAL_STATE_KEYS = new Set(['focused', 'selected', 'rangeAnchor', 'readOnly', 'invalid', 'operation']);
/** Structural keys accepted from style resolver output. */
const STYLE_KEYS = new Set([
  'revision',
  'surfaceRole',
  'borderRole',
  'markerRole',
  'titleRole',
  'statusRole',
  'textRole',
  'glyphFamily',
]);
/** Structural keys accepted from one field descriptor. */
const FIELD_KEYS = new Set(['fieldId', 'label', 'priority', 'role', 'kind', 'valueOf', 'format']);
/** Frozen neutral style used after absence, rejection, or resolver failure. */
const NEUTRAL_STYLE: KanbanCardStyleSelection = Object.freeze({});

/** Validates one optional allowlisted theme role. */
function themeRole(value: unknown): KanbanThemeRole | undefined {
  if (value === undefined) return undefined;
  return KANBAN_THEME_ROLES.find((role) => role === value) ?? undefined;
}

/** Validates one non-negative safe priority. */
function priority(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new KanbanInvalidDescriptorError();
  }
  return value;
}

/** Reads an optional adapter member without invoking an accessor. */
function optionalAdapterMember<TCard>(adapter: KanbanCardPresentationAdapter<TCard>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(adapter, key);
    if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new KanbanInvalidDescriptorError();
    return descriptor?.value;
  } catch {
    throw new KanbanInvalidDescriptorError();
  }
}

/** Emits one redacted observation while containing observer failures. */
function observe(sink: ((observation: KanbanObservation) => void) | undefined, code: string, cardKey: CardKey): void {
  if (sink === undefined) return;
  const observation = createKanbanObservation({ code, scope: 'card', cardKey });
  try {
    sink(observation);
  } catch {
    // Observation is best-effort and must never replace the card-local fallback.
  }
}

/** Validates and detaches the visual state before any style callback receives it. */
function visualState(value: unknown): KanbanCardVisualState {
  const source = snapshotPresentationProperties(value, VISUAL_STATE_KEYS);
  if (Object.keys(source).length !== VISUAL_STATE_KEYS.size) throw new KanbanInvalidDescriptorError();
  for (const key of ['focused', 'selected', 'rangeAnchor', 'readOnly', 'invalid'] as const) {
    if (typeof source[key] !== 'boolean') throw new KanbanInvalidDescriptorError();
  }
  const operation = source.operation;
  if (operation !== 'idle' && operation !== 'grabbed' && operation !== 'pending' && operation !== 'rejected') {
    throw new KanbanInvalidDescriptorError();
  }
  return Object.freeze({
    focused: source.focused === true,
    selected: source.selected === true,
    rangeAnchor: source.rangeAnchor === true,
    readOnly: source.readOnly === true,
    invalid: source.invalid === true,
    operation,
  });
}

/** Validates all field descriptors before any field value callback can run. */
function fieldDefinitions<TCard>(value: unknown, maximum: number): readonly FieldDefinition<TCard>[] {
  if (value === undefined) return Object.freeze([]);
  const entries = snapshotPresentationArray(value, maximum);
  const result: FieldDefinition<TCard>[] = [];
  for (const entry of entries) {
    const source = snapshotPresentationProperties(entry, FIELD_KEYS);
    if (typeof source.fieldId !== 'string') throw new KanbanInvalidDescriptorError();
    const fieldId = createKanbanFieldId(source.fieldId);
    const label = snapshotPresentationText(source.label, true);
    const role = themeRole(source.role);
    if (source.role !== undefined && role === undefined) throw new KanbanInvalidDescriptorError();
    if (source.kind !== 'text' && source.kind !== 'number' && source.kind !== 'date' && source.kind !== 'labels') {
      throw new KanbanInvalidDescriptorError();
    }
    if (typeof source.valueOf !== 'function' || (source.format !== undefined && typeof source.format !== 'function')) {
      throw new KanbanInvalidDescriptorError();
    }
    const valueOf = source.valueOf;
    const format = source.format;
    result.push(
      Object.freeze({
        fieldId,
        kind: source.kind,
        label: label ?? '',
        priority: priority(source.priority),
        ...(role === undefined ? {} : { role }),
        valueOf: (card: TCard) => Reflect.apply(valueOf, undefined, [card]),
        ...(format === undefined
          ? {}
          : {
              format: (input: unknown, context: KanbanCardFormattingContext) =>
                Reflect.apply(format, undefined, [input, context]),
            }),
      }),
    );
  }
  if (new Set(result.map(({ fieldId }) => fieldId)).size !== result.length) throw new KanbanInvalidDescriptorError();
  return Object.freeze(result);
}

/** Converts one field callback result into detached safe strings. */
function fieldValues<TCard>(
  definition: FieldDefinition<TCard>,
  card: TCard,
  formatting: KanbanCardFormattingContext,
  maximumValues: number,
): readonly string[] | undefined {
  const input = definition.valueOf(card);
  if (input === undefined) return undefined;
  let output: unknown;
  if (definition.kind === 'text') {
    if (typeof input !== 'string') throw new KanbanInvalidDescriptorError();
    output = definition.format === undefined ? input : definition.format(input, formatting);
  } else if (definition.kind === 'number') {
    output = formatKanbanCardNumber(input, formatting, definition.format);
  } else if (definition.kind === 'date') {
    output = formatKanbanCardDate(input, formatting, definition.format);
  } else {
    const labels = snapshotPresentationArray(input, maximumValues);
    if (labels.some((label) => typeof label !== 'string')) throw new KanbanInvalidDescriptorError();
    output = definition.format === undefined ? labels : definition.format(Object.freeze([...labels]), formatting);
  }
  if (definition.kind === 'labels') {
    if (output === undefined) return undefined;
    const labels = snapshotPresentationArray(output, maximumValues);
    const cleaned = labels.map((label) => snapshotPresentationText(label, true) ?? '');
    return Object.freeze(cleaned);
  }
  const text = snapshotPresentationText(output);
  return text === undefined ? undefined : Object.freeze([text]);
}

/** Validates and freezes one semantic style result. */
function styleSelection(value: unknown): KanbanCardStyleSelection {
  const source = snapshotPresentationProperties(value, STYLE_KEYS);
  const result: Record<string, unknown> = {};
  if (source.revision !== undefined) result.revision = snapshotKanbanRevision(source.revision);
  for (const key of ['surfaceRole', 'borderRole', 'markerRole', 'titleRole', 'statusRole', 'textRole'] as const) {
    const role = themeRole(source[key]);
    if (source[key] !== undefined && role === undefined) throw new KanbanInvalidDescriptorError();
    if (role !== undefined) result[key] = role;
  }
  if (
    source.glyphFamily !== undefined &&
    source.glyphFamily !== 'automatic' &&
    source.glyphFamily !== 'unicode' &&
    source.glyphFamily !== 'ascii'
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  if (source.glyphFamily !== undefined) result.glyphFamily = source.glyphFamily;
  return Object.freeze(result);
}

/** Reads and snapshots one optional callback, returning a local fallback on failure. */
function callbackOrFallback<T>(callback: (() => T) | undefined, fallback: T, onFailure: () => void): T {
  if (callback === undefined) return fallback;
  try {
    return callback();
  } catch {
    onFailure();
    return fallback;
  }
}

/**
 * Detaches one application card into bounded, display-safe, deeply frozen presentation values.
 *
 * Mandatory identity/title/status failures propagate to the board's existing safe-render fallback.
 * Optional family and callback failures emit payload-free observations and remain local.
 *
 * @example
 * ```ts
 * const snapshot = snapshotKanbanCardPresentation(card, adapter, context);
 * ```
 */
export function snapshotKanbanCardPresentation<TCard>(
  card: TCard,
  adapter: KanbanCardPresentationAdapter<TCard>,
  context: KanbanCardPresentationSnapshotContext,
): KanbanCardPresentationSnapshot {
  const mandatory = readKanbanCardAdapter(card, adapter);
  const title = snapshotPresentationText(mandatory.title, true) ?? '';
  const status = snapshotPresentationText(mandatory.status, true) ?? '';
  const state = visualState(context.visualState);
  validateKanbanCardFormattingContext(context.formatting);
  const formatting = context.formatting;
  const observeFailure = (code: string) => observe(context.observe, code, mandatory.cardKey);
  const defaultSelection = resolveKanbanCardPresentationSelection(undefined, context.maximum);
  const limits = defaultSelection.limits;

  const definitions = callbackOrFallback(
    () => fieldDefinitions<TCard>(optionalAdapterMember(adapter, 'fields'), limits.cardFields),
    Object.freeze<FieldDefinition<TCard>[]>([]),
    () => observeFailure('card-fields-invalid'),
  );
  const summaries = callbackOrFallback(
    () =>
      snapshotKanbanCardSummaryDefinitions<TCard>(optionalAdapterMember(adapter, 'summaries'), limits.summarySections),
    Object.freeze<KanbanCardSummaryDefinition<TCard>[]>([]),
    () => observeFailure('card-summaries-invalid'),
  );
  const selection = callbackOrFallback(
    () => {
      const callback = optionalAdapterMember(adapter, 'selectionOf');
      if (callback === undefined) return defaultSelection;
      if (typeof callback !== 'function') throw new KanbanInvalidDescriptorError();
      const requested: unknown = Reflect.apply(callback, undefined, [card]);
      return requested === undefined
        ? defaultSelection
        : resolveKanbanCardPresentationSelection(requested, context.maximum);
    },
    defaultSelection,
    () => observeFailure('card-selection-failed'),
  );

  const selectedFields: KanbanCardFieldSnapshot[] = [];
  for (const fieldId of selection.fieldIds) {
    const definition = definitions.find((candidate) => candidate.fieldId === fieldId);
    if (definition === undefined) continue;
    try {
      const values = fieldValues(definition, card, formatting, limits.cardFields);
      if (values === undefined || values.length === 0) continue;
      selectedFields.push(
        Object.freeze({
          fieldId: definition.fieldId,
          kind: definition.kind,
          label: definition.label,
          priority: definition.priority,
          ...(definition.role === undefined ? {} : { role: definition.role }),
          values,
        }),
      );
    } catch {
      observeFailure('card-field-failed');
    }
  }

  const selectedSummaries: KanbanCardSummarySnapshot[] = [];
  for (const summaryId of selection.summaryIds) {
    const definition = summaries.find((candidate) => candidate.summaryId === summaryId);
    if (definition === undefined) continue;
    try {
      const input = definition.valueOf(card);
      if (input === undefined) continue;
      const output = definition.format === undefined ? input : definition.format(input, formatting);
      const value = snapshotKanbanCardSummaryValue(output, formatting);
      if (value === undefined) continue;
      selectedSummaries.push(
        Object.freeze({
          summaryId: definition.summaryId,
          label: definition.label,
          priority: definition.priority,
          ...(definition.role === undefined ? {} : { role: definition.role }),
          ...value,
        }),
      );
    } catch {
      observeFailure('card-summary-failed');
    }
  }

  const groups = callbackOrFallback(
    () => {
      if (context.checklistValues !== undefined) {
        return snapshotKanbanChecklistGroups(
          context.checklistValues,
          limits.checklistGroups,
          limits.checklistItemsPerGroup,
        );
      }
      const callback = optionalAdapterMember(adapter, 'checklistOf');
      if (callback === undefined) return Object.freeze<KanbanChecklistGroup[]>([]);
      if (typeof callback !== 'function') throw new KanbanInvalidDescriptorError();
      return snapshotKanbanChecklistGroups(
        Reflect.apply(callback, undefined, [card]),
        limits.checklistGroups,
        limits.checklistItemsPerGroup,
      );
    },
    Object.freeze<KanbanChecklistGroup[]>([]),
    () => observeFailure('card-checklists-invalid'),
  );
  const style = callbackOrFallback(
    () => {
      const callback = optionalAdapterMember(adapter, 'styleOf');
      if (callback === undefined) return NEUTRAL_STYLE;
      if (typeof callback !== 'function') throw new KanbanInvalidDescriptorError();
      return styleSelection(Reflect.apply(callback, undefined, [card, state]));
    },
    NEUTRAL_STYLE,
    () => observeFailure('card-style-failed'),
  );

  return Object.freeze({
    cardKey: mandatory.cardKey,
    ...(mandatory.presentationRevision === undefined ? {} : { presentationRevision: mandatory.presentationRevision }),
    title,
    status,
    fields: Object.freeze(selectedFields),
    summaries: Object.freeze(selectedSummaries),
    checklists: groups,
    selection,
    visualState: state,
    style,
  });
}
