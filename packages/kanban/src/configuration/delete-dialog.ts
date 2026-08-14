import { resolveKanbanEditorMessage } from '../editor/presentation-text.js';
import { confirmKanbanConfigurationAction } from './confirmation.js';
import type {
  KanbanConfigurationConfirm,
  KanbanConfigurationDialogHost,
  KanbanConfigurationOccupancy,
} from './types.js';

/** Input used to decide whether a package-owned structural deletion may proceed. */
export interface KanbanConfigurationDeleteConfirmationOptions {
  /** Authoritative affected-card count; unknown counts fail closed without opening UI. */
  readonly occupancy: KanbanConfigurationOccupancy;
  /** Whether one complete application policy resolves a non-empty structure atomically. */
  readonly hasPolicy: boolean;
  /** Optional application replacement for the localized package confirmation. */
  readonly confirm?: KanbanConfigurationConfirm;
  /** Owning dialog lifetime used to cancel confirmation work. */
  readonly signal: AbortSignal;
}

/**
 * Confirms an eligible structural deletion and fails closed for unknown or unresolved non-empty occupancy.
 *
 * @example
 * ```ts
 * const confirmed = await confirmKanbanConfigurationDeletion(host, {
 *   occupancy: { quality: 'exact', count: 0 },
 *   hasPolicy: false,
 * });
 * ```
 */
export async function confirmKanbanConfigurationDeletion(
  host: KanbanConfigurationDialogHost,
  options: KanbanConfigurationDeleteConfirmationOptions,
): Promise<boolean> {
  if (options.occupancy.quality === 'unknown') return false;
  if (options.occupancy.count > 0 && !options.hasPolicy) return false;
  const message = resolveKanbanEditorMessage(
    host.i18n,
    'kanban.configuration.confirm.delete',
    options.occupancy.count === 0
      ? 'Delete this empty structure?'
      : `Delete this structure and atomically move ${options.occupancy.count} affected cards?`,
  );
  return confirmKanbanConfigurationAction(host, 'delete-structure', message, options.signal, options.confirm);
}
