import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanChecklistId } from '../contract/identity.js';
import type { KanbanChecklistId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import {
  snapshotPresentationArray,
  snapshotPresentationProperties,
  snapshotPresentationText,
} from './presentation-value.js';

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

/** Structural keys accepted from one checklist group and item. */
const CHECKLIST_GROUP_KEYS = new Set(['checklistId', 'title', 'items']);
const CHECKLIST_ITEM_KEYS = new Set(['itemId', 'text', 'completed']);
/** Terminal controls forbidden in group-scoped checklist item identities. */
const ID_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Shared encoder for the same identity byte ceiling used by package structural IDs. */
const CHECKLIST_ID_ENCODER = new TextEncoder();

/**
 * Creates one bounded control-free checklist-item identity.
 *
 * Item identities are unique only within their containing checklist group. Rejected input is never
 * retained in the resulting sanitized error.
 *
 * @example
 * ```ts
 * const itemId = createKanbanChecklistItemId('verify-release');
 * ```
 */
export function createKanbanChecklistItemId(value: string): KanbanChecklistItemId {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > KANBAN_LIMITS.idBytes.absolute ||
    ID_CONTROLS.test(value) ||
    CHECKLIST_ID_ENCODER.encode(value).byteLength > KANBAN_LIMITS.idBytes.absolute
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  return value;
}

/** Snapshots one bounded checklist family after complete identity and shape validation. */
export function snapshotKanbanChecklistGroups(
  value: unknown,
  maximumGroups: number,
  maximumItems: number,
): readonly KanbanChecklistGroup[] {
  const groups = snapshotPresentationArray(value, maximumGroups);
  const result: KanbanChecklistGroup[] = [];
  for (const group of groups) {
    const source = snapshotPresentationProperties(group, CHECKLIST_GROUP_KEYS);
    if (typeof source.checklistId !== 'string') throw new KanbanInvalidDescriptorError();
    const checklistId = createKanbanChecklistId(source.checklistId);
    const title = source.title === undefined ? undefined : snapshotPresentationText(source.title, true);
    const items = snapshotPresentationArray(source.items, maximumItems);
    const itemSnapshots = items.map((item) => {
      const itemSource = snapshotPresentationProperties(item, CHECKLIST_ITEM_KEYS);
      if (typeof itemSource.itemId !== 'string') throw new KanbanInvalidDescriptorError();
      const itemId = createKanbanChecklistItemId(itemSource.itemId);
      const text = snapshotPresentationText(itemSource.text, true);
      if (typeof itemSource.completed !== 'boolean') throw new KanbanInvalidDescriptorError();
      return Object.freeze({ itemId, text: text ?? '', completed: itemSource.completed });
    });
    if (new Set(itemSnapshots.map(({ itemId }) => itemId)).size !== itemSnapshots.length) {
      throw new KanbanInvalidDescriptorError();
    }
    result.push(
      Object.freeze({
        checklistId,
        ...(title === undefined ? {} : { title }),
        items: Object.freeze(itemSnapshots),
      }),
    );
  }
  if (new Set(result.map(({ checklistId }) => checklistId)).size !== result.length) {
    throw new KanbanInvalidDescriptorError();
  }
  return Object.freeze(result);
}
