import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanFieldId } from '../contract/identity.js';
import type { KanbanFieldId } from '../contract/identity.js';
import type { KanbanCardFormattingContext } from './formatting.js';
import {
  snapshotPresentationArray,
  snapshotPresentationProperties,
  snapshotPresentationText,
} from './presentation-value.js';
import { KANBAN_THEME_ROLES } from './theme.js';
import type { KanbanThemeRole } from './theme.js';

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

/** Detached bounded aggregate value for one selected summary. */
export interface KanbanCardSummarySnapshot {
  /** Stable configured summary identity. */
  readonly summaryId: KanbanFieldId;
  /** Sanitized non-empty summary label. */
  readonly label: string;
  /** Non-negative degradation priority. */
  readonly priority: number;
  /** Optional allowlisted semantic role. */
  readonly role?: KanbanThemeRole;
  /** Optional sanitized aggregate text. */
  readonly text?: string;
  /** Optional non-negative safe-integer aggregate count. */
  readonly count?: number;
}

/** Validated internal summary descriptor retaining only safe metadata and callback wrappers. */
export interface KanbanCardSummaryDefinition<TCard> {
  /** Validated stable summary identity. */
  readonly summaryId: KanbanFieldId;
  /** Sanitized non-empty label. */
  readonly label: string;
  /** Non-negative degradation priority. */
  readonly priority: number;
  /** Optional allowlisted semantic role. */
  readonly role?: KanbanThemeRole;
  /** Safe callback wrapper for the application value getter. */
  readonly valueOf: (card: TCard) => unknown;
  /** Optional safe callback wrapper for the application formatter. */
  readonly format?: (value: unknown, context: KanbanCardFormattingContext) => unknown;
}

/** Structural keys accepted from one structured summary result. */
const SUMMARY_VALUE_KEYS = new Set(['text', 'count']);
/** Structural keys accepted from one configured summary descriptor. */
const SUMMARY_KEYS = new Set(['summaryId', 'label', 'priority', 'role', 'valueOf', 'format']);

/** Validates one optional allowlisted summary role. */
function summaryRole(value: unknown): KanbanThemeRole | undefined {
  if (value === undefined) return undefined;
  return KANBAN_THEME_ROLES.find((role) => role === value) ?? undefined;
}

/** Validates all summary identities and descriptors before any value callback can run. */
export function snapshotKanbanCardSummaryDefinitions<TCard>(
  value: unknown,
  maximum: number,
): readonly KanbanCardSummaryDefinition<TCard>[] {
  if (value === undefined) return Object.freeze([]);
  const entries = snapshotPresentationArray(value, maximum);
  const result: KanbanCardSummaryDefinition<TCard>[] = [];
  for (const entry of entries) {
    const source = snapshotPresentationProperties(entry, SUMMARY_KEYS);
    if (typeof source.summaryId !== 'string') throw new KanbanInvalidDescriptorError();
    const summaryId = createKanbanFieldId(source.summaryId);
    const label = snapshotPresentationText(source.label, true);
    const role = summaryRole(source.role);
    if (source.role !== undefined && role === undefined) throw new KanbanInvalidDescriptorError();
    if (
      typeof source.priority !== 'number' ||
      !Number.isSafeInteger(source.priority) ||
      source.priority < 0 ||
      typeof source.valueOf !== 'function' ||
      (source.format !== undefined && typeof source.format !== 'function')
    ) {
      throw new KanbanInvalidDescriptorError();
    }
    const valueOf = source.valueOf;
    const format = source.format;
    result.push(
      Object.freeze({
        summaryId,
        label: label ?? '',
        priority: source.priority,
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
  if (new Set(result.map(({ summaryId }) => summaryId)).size !== result.length) {
    throw new KanbanInvalidDescriptorError();
  }
  return Object.freeze(result);
}

/** Converts one raw or formatted summary into a detached bounded value. */
export function snapshotKanbanCardSummaryValue(
  value: unknown,
  formatting: KanbanCardFormattingContext,
): Readonly<KanbanCardSummaryValue> | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') {
    const text = snapshotPresentationText(value);
    return text === undefined ? undefined : Object.freeze({ text });
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new KanbanInvalidDescriptorError();
    const text = snapshotPresentationText(formatting.formatNumber(value), true);
    return Object.freeze({ text });
  }
  const source = snapshotPresentationProperties(value, SUMMARY_VALUE_KEYS);
  const text = source.text === undefined ? undefined : snapshotPresentationText(source.text, true);
  const count = source.count;
  if (count !== undefined && (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)) {
    throw new KanbanInvalidDescriptorError();
  }
  if (text === undefined && count === undefined) throw new KanbanInvalidDescriptorError();
  return Object.freeze({ ...(text === undefined ? {} : { text }), ...(count === undefined ? {} : { count }) });
}
