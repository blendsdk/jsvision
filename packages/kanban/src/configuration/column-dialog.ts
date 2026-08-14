import { openKanbanConfigurationDialog } from './dialog.js';
import type {
  KanbanColumnConfigurationOperation,
  KanbanConfigurationConfirm,
  KanbanConfigurationDialogCompletion,
  KanbanConfigurationDialogHost,
  KanbanConfigurationDialogResult,
  KanbanConfigurationSource,
} from './types.js';
import type { KanbanConfigurationFocusTarget } from '../board/board-configuration-binding.js';

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
  /** Optional caller lifetime for modal and application work. */
  readonly signal?: AbortSignal;
  /** Optional bridge that applies a committed deletion's stable board focus target. */
  readonly focus?: (target: KanbanConfigurationFocusTarget) => void;
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
