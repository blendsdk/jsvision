/**
 * The datagrid's single sanctioned development-time diagnostics sink.
 *
 * A shipped TUI shares the terminal with the rendered screen, so stray `console.*` output would corrupt
 * the display. This module is the one place the package is allowed to warn, and it stays silent in
 * production builds — every other module routes misconfiguration notices through {@link devWarn} rather
 * than calling `console.*` directly.
 */

/**
 * Emit a development-only warning tagged for the datagrid. No-ops when `NODE_ENV === 'production'`, so a
 * shipped build never writes to the terminal the UI is drawing on. Use it to flag caller misconfiguration
 * that is recoverable (an ignored option, a dropped invalid entry) rather than throwing.
 *
 * @param scope A short tag for the emitting area (e.g. `'duplicateRow'`, `'footer'`), shown in brackets.
 * @param message The human-readable warning text.
 */
export function devWarn(scope: string, message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[jsvision/datagrid ${scope}] ${message}`);
  }
}
