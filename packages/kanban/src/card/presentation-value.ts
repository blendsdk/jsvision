import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import type { KanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { sanitizeContractText } from '../contract/text-safety.js';

/** Bidirectional controls removed before application text reaches geometry or output. */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Copies a closed plain object and normalizes every rejection to a card descriptor error. */
export function snapshotPresentationProperties(value: unknown, keys: ReadonlySet<string>): KanbanDataProperties {
  try {
    const result = snapshotKanbanDataProperties(value, keys.size);
    validateKanbanDataKeys(result, keys);
    return result;
  } catch {
    throw new KanbanInvalidDescriptorError();
  }
}

/** Copies a bounded dense ordinary array without executing element accessors. */
export function snapshotPresentationArray(value: unknown, maximum: number): readonly unknown[] {
  try {
    return snapshotKanbanDataArray(value, maximum);
  } catch {
    throw new KanbanInvalidDescriptorError();
  }
}

/** Sanitizes one application display value to a bounded terminal-safe single line. */
export function snapshotPresentationText(value: unknown, required = false): string | undefined {
  if (typeof value !== 'string') {
    if (required) throw new KanbanInvalidDescriptorError();
    return undefined;
  }
  const result = sanitizeContractText(value, KANBAN_LIMITS.semanticStringBytes.safe)
    .replace(BIDI_CONTROLS, '')
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (result.length === 0) {
    if (required) throw new KanbanInvalidDescriptorError();
    return undefined;
  }
  return result;
}
