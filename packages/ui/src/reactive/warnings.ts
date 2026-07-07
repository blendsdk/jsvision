/**
 * Development-only warning helper.
 *
 * A shipped TUI must never write to the console, because it shares the terminal with the rendered
 * screen. The reactive core still needs to flag two footguns during development — a computation
 * created with no owner scope (a potential leak) and a duplicate `For` key — so this helper writes
 * `console.warn` only when `NODE_ENV !== 'production'`: visible while developing, silent in a
 * shipped build.
 */

/**
 * Emit a development-only warning, prefixed so its source is obvious. Silenced when
 * `process.env.NODE_ENV === 'production'`.
 *
 * @param message The warning text. Keep it free of secrets/PII — it may reach a shared terminal.
 */
export function devWarn(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[jsvision/ui reactive] ${message}`);
  }
}
