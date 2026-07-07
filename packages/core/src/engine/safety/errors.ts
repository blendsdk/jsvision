/**
 * The SDK's typed error model.
 *
 * A single {@link TuiError} base lets you catch every error the SDK raises with
 * one `instanceof` check, while the concrete subclasses carry the specifics:
 * {@link EssentialsNotMetError} reports the unmet runtime essentials, and
 * {@link LoggerConfigError} signals a logger configured to write to the screen.
 */

/**
 * Base class for every error the SDK throws. Catch it to handle any SDK error
 * broadly, then narrow to a subclass for the specifics.
 *
 * Messages are always human-readable and never carry raw keystrokes, pasted
 * text, or other secrets. `error.name` is set to the concrete subclass name so
 * it reads correctly in stack traces and logs.
 *
 * @example
 * import { TuiError, createHost } from '@jsvision/core';
 *
 * try {
 *   // ... start the host, run the app ...
 * } catch (e) {
 *   if (e instanceof TuiError) {
 *     console.error(`SDK error (${e.name}): ${e.message}`);
 *   } else {
 *     throw e; // not ours — rethrow
 *   }
 * }
 */
export class TuiError extends Error {
  /**
   * @param message Human-readable description (never carries raw input/secrets).
   */
  public constructor(message: string) {
    super(message);
    this.name = new.target.name; // report the concrete subclass name in stack traces
  }
}

/**
 * Thrown when the terminal does not meet the SDK's runtime essentials, so the
 * app must not start. The unmet essentials are listed in {@link missing} and in
 * the message.
 *
 * @example
 * import { assertEssentials, EssentialsNotMetError, resolveCapabilities, detectTty } from '@jsvision/core';
 *
 * try {
 *   assertEssentials(resolveCapabilities().profile, { isTTY: detectTty() });
 * } catch (e) {
 *   if (e instanceof EssentialsNotMetError) {
 *     console.error(`Cannot start: ${e.missing.join(', ')}`);
 *     process.exit(1);
 *   }
 *   throw e;
 * }
 */
export class EssentialsNotMetError extends TuiError {
  /** The unmet essential(s), e.g. `['interactive TTY (raw-mode keyboard input)']`. */
  public readonly missing: readonly string[];

  /**
   * @param missing The unmet essential(s); included in the message verbatim.
   */
  public constructor(missing: readonly string[]) {
    super(`Terminal does not meet the SDK essentials: ${missing.join(', ')}.`);
    this.missing = missing;
  }
}

/**
 * Thrown by {@link createLogger} when the configured log sink would resolve to
 * the terminal's own output stream. The logger fails fast rather than let a
 * stray log line scribble over your rendered screen.
 *
 * Fix by pointing the logger at a file (`path` / the `JSVISION_LOG` env var) or
 * the in-memory ring sink, or by ensuring stderr is redirected away from the
 * terminal device.
 *
 * @example
 * import { createLogger, LoggerConfigError } from '@jsvision/core';
 *
 * try {
 *   const log = createLogger({ enabled: true, sink: 'file', path: '/var/log/app.log' });
 * } catch (e) {
 *   if (e instanceof LoggerConfigError) {
 *     // The chosen sink pointed at the screen — pick a safe destination instead.
 *   }
 * }
 */
export class LoggerConfigError extends TuiError {}
