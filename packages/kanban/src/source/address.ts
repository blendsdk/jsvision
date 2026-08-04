import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanCellAddress } from './types.js';

/** Exact accepted members of a semantic cell address. */
const ADDRESS_KEYS = new Set(['columnId', 'swimlaneId']);

/** Raises the bounded public error used for invalid source-owned values. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Validates, detaches, and freezes one column/swimlane cell address. */
export function snapshotKanbanCellAddress(value: unknown): KanbanCellAddress {
  try {
    const properties = snapshotKanbanDataProperties(value, ADDRESS_KEYS.size);
    validateKanbanDataKeys(properties, ADDRESS_KEYS);
    if (typeof properties.columnId !== 'string') return invalidPublication();
    const columnId = createKanbanColumnId(properties.columnId);
    if (properties.swimlaneId === undefined) {
      if (Object.keys(properties).length !== 1) return invalidPublication();
      return Object.freeze({ columnId });
    }
    if (typeof properties.swimlaneId !== 'string' || Object.keys(properties).length !== 2) {
      return invalidPublication();
    }
    return Object.freeze({ columnId, swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/**
 * Creates a collision-safe key for one validated semantic cell address.
 *
 * JSON string framing preserves the distinction between a missing swimlane and every string value,
 * including identities that themselves contain separators.
 */
export function canonicalizeKanbanCellAddress(value: KanbanCellAddress): string {
  const address = snapshotKanbanCellAddress(value);
  return JSON.stringify(['kanban-cell', address.columnId, address.swimlaneId ?? null]);
}
