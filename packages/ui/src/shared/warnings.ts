/**
 * Development-only warning helper shared across `@jsvision/ui` subsystems.
 *
 * A shipped TUI must never write to the console — it shares the terminal with the rendered screen, so
 * a stray `console.log` corrupts the display. When a subsystem needs to flag a developer footgun (a
 * duplicate accelerator, a view that laid out to nothing), it routes it through here: the message
 * reaches the developer only while `NODE_ENV !== 'production'`, so it is visible during development
 * and completely silent in a shipped build. This is the single sanctioned `console.*` sink for the
 * non-reactive subsystems; the reactive core keeps its own equivalent under the `reactive` scope tag.
 *
 * **Delivery depends on who owns the terminal.** Some footguns can only be detected while an app is
 * live — during layout, focus, or dispatch — and at that moment the renderer owns the screen, so
 * writing anywhere would scribble over the UI. So warnings raised inside a *screen session* (marked
 * by {@link beginScreenSession}/{@link endScreenSession} around the terminal host's lifetime) are
 * withheld and flushed to stderr once the terminal has been restored. Outside a session — at
 * construction time, in a headless test, or in the browser runtime, where nothing owns a terminal —
 * they go straight to `console.warn`, which is where they have always gone.
 *
 * **Every warning fires at most once.** A layout footgun is re-detected on every frame; without
 * de-duplication it would emit sixty times a second and drown out everything else. Identical
 * `(scope, message)` pairs after the first are dropped for the lifetime of the process.
 */

/**
 * How many distinct withheld warnings a screen session keeps before it stops collecting.
 *
 * De-duplication already bounds the buffer by the number of distinct footgun sites, which is small;
 * this is a second floor under a pathological case (a message that embeds an ever-changing value)
 * so a long-running app cannot grow the buffer without limit.
 */
const MAX_BUFFERED = 100;

/**
 * Nesting depth of active screen sessions. A counter rather than a boolean so that nested or
 * overlapping runs (a test harness that starts an app inside another) cannot have the inner one's
 * teardown flush while the outer still owns the screen.
 */
let sessionDepth = 0;

/** Every `(scope, message)` line already emitted, so a repeating condition warns exactly once. */
const emitted = new Set<string>();

/** Lines raised during the current screen session, awaiting the flush that follows terminal restore. */
let withheld: string[] = [];

/** Whether warnings are suppressed entirely (a shipped build). Read per call so tests can flip it. */
function suppressed(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Emit a development-only warning tagged with its originating subsystem. The message is prefixed
 * `[jsvision/ui <scope>]` so its source is obvious in a log, is suppressed entirely when
 * `process.env.NODE_ENV === 'production'`, and is emitted at most once per distinct
 * `(scope, message)` pair.
 *
 * While a screen session is active the warning is withheld and flushed to stderr on
 * {@link endScreenSession}; otherwise it goes to `console.warn` immediately.
 *
 * Internal to `@jsvision/ui` (not part of the public API); scope subsystems call it directly.
 *
 * @param scope   A short subsystem tag for the prefix, e.g. `'menu'`, `'layout'`, `'focus'`.
 * @param message The warning text. Keep it free of secrets/PII — it may reach a shared terminal.
 *   Say what went wrong **and how to fix it**; a diagnostic that only names the symptom leaves the
 *   reader exactly as stuck as the silence did.
 * @example
 * import { devWarn } from './warnings.js';
 *
 * // Warn a developer about a duplicate accelerator (silent in production builds):
 * devWarn('menu', "duplicate accelerator 'x' — \"Exit\", \"Export\" share it; only the first is reachable");
 */
export function devWarn(scope: string, message: string): void {
  if (suppressed()) return;

  const line = `[jsvision/ui ${scope}] ${message}`;
  if (emitted.has(line)) return;
  emitted.add(line);

  if (sessionDepth === 0) {
    console.warn(line);
    return;
  }
  if (withheld.length < MAX_BUFFERED) withheld.push(line);
}

/**
 * Mark the start of a screen session: from here until the matching {@link endScreenSession}, the
 * renderer owns the terminal and no warning may be written anywhere. Call it immediately before the
 * terminal host enters raw mode and the alternate screen.
 *
 * Nests: only the outermost session's end flushes.
 *
 * @internal Lifecycle plumbing, called by the app runner — not part of the public API.
 * @example
 * import { beginScreenSession, endScreenSession } from './warnings.js';
 *
 * beginScreenSession();
 * try {
 *   // The host has the terminal: every devWarn() raised in here is withheld.
 * } finally {
 *   // Restore the terminal first, then flush — that ordering is the whole point.
 *   endScreenSession();
 * }
 */
export function beginScreenSession(): void {
  sessionDepth += 1;
}

/**
 * Mark the end of a screen session and flush every warning withheld during it to stderr. Call it
 * **after** the terminal host has restored the terminal — the whole point of withholding is that the
 * alternate screen is gone by the time anything is written.
 *
 * A no-op when no session is active, and a no-op for an inner session while an outer one is still
 * open.
 *
 * @internal Lifecycle plumbing, called by the app runner — not part of the public API.
 */
export function endScreenSession(): void {
  if (sessionDepth === 0) return;
  sessionDepth -= 1;
  if (sessionDepth > 0) return;

  const lines = withheld;
  withheld = [];
  if (lines.length === 0 || suppressed()) return;
  process.stderr.write(`${lines.join('\n')}\n`);
}

/**
 * Forget every warning already emitted and discard any withheld lines and open sessions.
 *
 * Exists for tests: de-duplication is process-wide by design, so without a reset the second test to
 * exercise a given condition would see nothing.
 *
 * @internal Test seam — not part of the public API.
 */
export function resetDevWarnings(): void {
  emitted.clear();
  withheld = [];
  sessionDepth = 0;
}
