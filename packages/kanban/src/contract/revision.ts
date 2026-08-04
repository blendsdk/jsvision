import { KanbanInvalidSourcePublicationError } from './error.js';

/** Equality-only revision value published by an application or data source. */
export type KanbanRevision = string | number;

/** Control characters forbidden in opaque string revisions crossing the public boundary. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Maximum UTF-8 size of one opaque string revision. */
const MAX_REVISION_BYTES = 2_048;

/**
 * Validates one equality-only revision without coercion or disclosure of rejected content.
 *
 * @example
 * ```ts
 * const revision = snapshotKanbanRevision('source-42');
 * ```
 */
export function snapshotKanbanRevision(value: unknown): KanbanRevision {
  if (typeof value === 'number' && Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
  if (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_REVISION_BYTES &&
    !CONTROL_CHARACTERS.test(value) &&
    new TextEncoder().encode(value).byteLength <= MAX_REVISION_BYTES
  ) {
    return value;
  }
  throw new KanbanInvalidSourcePublicationError();
}

/**
 * Compares revisions without ordering, coercion, or stringification.
 *
 * @example
 * ```ts
 * kanbanRevisionsEqual(1, '1'); // false
 * ```
 */
export function kanbanRevisionsEqual(left: KanbanRevision, right: KanbanRevision): boolean {
  return left === right;
}
