import { openKanbanConfigurationDialog } from './dialog.js';
import type {
  KanbanColumnConfigurationOperation,
  KanbanConfigurationConfirm,
  KanbanConfigurationDialogCompletion,
  KanbanConfigurationDialogHost,
  KanbanConfigurationDialogResult,
  KanbanConfigurationSource,
} from './types.js';

/** Options for invoking one package-owned column configuration workflow. */
export interface OpenKanbanColumnConfigurationDialogOptions {
  /** Authoritative board structure source. */
  readonly source: KanbanConfigurationSource;
  /** Add, update, reorder, or delete workflow. */
  readonly operation: KanbanColumnConfigurationOperation;
  /** Result-only or application-authority completion. */
  readonly completion: KanbanConfigurationDialogCompletion;
  /** Optional application confirmation policy. */
  readonly confirm?: KanbanConfigurationConfirm;
}

/**
 * Opens the localized responsive column configuration dialog on demand.
 *
 * @example
 * ```ts
 * const result = await openKanbanColumnConfigurationDialog(host, {
 *   source,
 *   operation: { kind: 'update', columnId: 'todo' },
 *   completion: { kind: 'result-only' },
 * });
 * ```
 */
export function openKanbanColumnConfigurationDialog(
  host: KanbanConfigurationDialogHost,
  options: OpenKanbanColumnConfigurationDialogOptions,
): Promise<KanbanConfigurationDialogResult> {
  return openKanbanConfigurationDialog(host, options);
}
