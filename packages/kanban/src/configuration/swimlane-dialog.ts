import { openKanbanConfigurationDialog } from './dialog.js';
import type {
  KanbanConfigurationConfirm,
  KanbanConfigurationDialogCompletion,
  KanbanConfigurationDialogHost,
  KanbanConfigurationDialogResult,
  KanbanConfigurationSource,
  KanbanSwimlaneConfigurationOperation,
} from './types.js';
import type { KanbanConfigurationFocusTarget } from '../board/board-configuration-binding.js';

/** Options for invoking one package-owned explicit-swimlane configuration workflow. */
export interface OpenKanbanSwimlaneConfigurationDialogOptions {
  /** Authoritative board structure source. */
  readonly source: KanbanConfigurationSource;
  /** Add, update, reorder, or delete workflow. */
  readonly operation: KanbanSwimlaneConfigurationOperation;
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
 * Opens the localized responsive explicit-swimlane configuration dialog on demand.
 *
 * @example
 * ```ts
 * const result = await openKanbanSwimlaneConfigurationDialog(host, {
 *   source,
 *   operation: { kind: 'reorder', swimlaneId: 'team-a' },
 *   completion: { kind: 'result-only' },
 * });
 * ```
 */
export function openKanbanSwimlaneConfigurationDialog(
  host: KanbanConfigurationDialogHost,
  options: OpenKanbanSwimlaneConfigurationDialogOptions,
): Promise<KanbanConfigurationDialogResult> {
  return openKanbanConfigurationDialog(host, options);
}
