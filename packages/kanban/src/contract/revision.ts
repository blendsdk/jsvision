/** Equality-only revision value published by an application or data source. */
export type KanbanRevision = string | number;

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
