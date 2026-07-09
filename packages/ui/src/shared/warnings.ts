/**
 * Development-only warning helper shared across `@jsvision/ui` subsystems.
 *
 * A shipped TUI must never write to the console — it shares the terminal with the rendered screen, so
 * a stray `console.log` corrupts the display. When a subsystem needs to flag a developer footgun (a
 * duplicate accelerator, say), it routes it through here: the message reaches the console only while
 * `NODE_ENV !== 'production'`, so it is visible during development and completely silent (and
 * tree-shakeably cheap) in a shipped build. This is the single sanctioned `console.*` sink for the
 * non-reactive subsystems; the reactive core keeps its own equivalent under the `reactive` scope tag.
 */

/**
 * Emit a development-only warning tagged with its originating subsystem. The message is prefixed
 * `[jsvision/ui <scope>]` so its source is obvious in a log, and is suppressed entirely when
 * `process.env.NODE_ENV === 'production'`.
 *
 * Internal to `@jsvision/ui` (not part of the public API); scope subsystems call it directly.
 *
 * @param scope   A short subsystem tag for the prefix, e.g. `'menu'`, `'dialog'`, `'tabs'`.
 * @param message The warning text. Keep it free of secrets/PII — it may reach a shared terminal.
 * @example
 * // Warn a developer about a duplicate accelerator (silent in production builds):
 * devWarn('menu', "duplicate accelerator 'x' — \"Exit\", \"Export\" share it; only the first is reachable");
 */
export function devWarn(scope: string, message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[jsvision/ui ${scope}] ${message}`);
  }
}
