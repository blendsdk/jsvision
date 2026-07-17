/**
 * Validation surfacing helpers for the data grid: the reactive message band that shows the active
 * validation / veto message. The per-row cross-field gate (`validateRow`) and its row-leave trap layer
 * onto this module in a later slice.
 */
import { Text } from '@jsvision/ui';
import type { View } from '@jsvision/ui';

/**
 * Build the grid's one-line message band — a reactive `Text` bound to the active validation/veto
 * message. It shows the empty string (a blank line) when there is no active message, so the band's row
 * stays reserved and the body never jumps as messages come and go. The message is sanitized for free at
 * the draw boundary, so an echoed control byte cannot inject.
 *
 * @param active A reactive getter for the current active message, or `null` when there is none.
 * @param severity The band's severity styling (`'error'` for a validation/veto message); read once.
 * @returns A `Text` view to place in the grid's footer region.
 * @example
 * ```ts
 * import { createErrorRegistry } from '@jsvision/datagrid';
 * const errors = createErrorRegistry();
 * const band = buildMessageBand(() => errors.active(), () => 'error');
 * // place `band` in the footer region; it repaints as errors.set/clear change the active message
 * ```
 */
export function buildMessageBand(active: () => string | null, severity: () => 'error' | 'warning'): View {
  return new Text(() => active() ?? '', { severity: severity() });
}
