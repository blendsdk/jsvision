import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidPresentationError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type { KanbanDefinitionOfDone } from '../source/types.js';

/** Exact accepted members of one definition-of-done input. */
const DEFINITION_KEYS = new Set(['summary', 'details', 'indicator']);
/** ANSI control sequences removed as a unit so parameter bytes never become visible text. */
const ANSI_CONTROL_SEQUENCE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)?|.)/gu;
/** Bidirectional controls removed before user text reaches terminal layout. */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Complete safe definition-of-done evidence exposed by focused interaction surfaces. */
export interface KanbanDefinitionOfDoneSnapshot extends KanbanDefinitionOfDone {
  /** Compact non-color evidence rendered by a configured column header. */
  readonly indicator: 'configured';
}

/** Converts malformed definition text into one payload-free public error. */
function invalidDefinition(): never {
  throw new KanbanInvalidPresentationError();
}

/** Sanitizes one non-empty bounded line without retaining terminal controls or direction overrides. */
function definitionText(value: unknown): string {
  if (typeof value !== 'string') return invalidDefinition();
  const result = sanitizeContractText(
    value.replace(ANSI_CONTROL_SEQUENCE, '').replace(BIDI_CONTROLS, ''),
    KANBAN_LIMITS.semanticStringBytes.safe,
  )
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (result.length === 0 || new TextEncoder().encode(result).byteLength > KANBAN_LIMITS.semanticStringBytes.safe) {
    return invalidDefinition();
  }
  return result;
}

/**
 * Detaches compact and complete definition-of-done text for safe header/help presentation.
 *
 * @example
 * ```ts
 * const definition = snapshotKanbanDefinitionOfDone({
 *   summary: 'Reviewed',
 *   details: 'Reviewed by the release owner',
 * });
 * ```
 */
export function snapshotKanbanDefinitionOfDone(value: unknown): KanbanDefinitionOfDoneSnapshot {
  try {
    const properties = snapshotKanbanDataProperties(value, DEFINITION_KEYS.size);
    validateKanbanDataKeys(properties, DEFINITION_KEYS);
    if (properties.indicator !== undefined && properties.indicator !== 'configured') return invalidDefinition();
    const summary = definitionText(properties.summary);
    const details = properties.details === undefined ? undefined : definitionText(properties.details);
    return Object.freeze({ summary, ...(details === undefined ? {} : { details }), indicator: 'configured' });
  } catch (error) {
    if (error instanceof KanbanInvalidPresentationError) throw error;
    return invalidDefinition();
  }
}
