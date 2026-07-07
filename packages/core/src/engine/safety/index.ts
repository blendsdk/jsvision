/**
 * Public entry point of the safety subsystem — the SDK's guardrails against
 * corrupting the terminal or leaking secrets into logs.
 *
 * Re-exports: the {@link sanitize} terminal-injection boundary, the typed
 * {@link TuiError} model, the screen-safe {@link createLogger}, the pure
 * {@link redactEvent}/{@link dumpCaps} redaction helpers, and the essentials gate
 * ({@link evaluateEssentials}/{@link essentialsMet}/{@link assertEssentials}).
 * These are all re-exported again from `@jsvision/core`, so import them from there.
 */

// Canonical output sanitizer — the primary injection boundary.
export { sanitize } from './sanitize.js';

// Essentials gate.
export { evaluateEssentials, essentialsMet, assertEssentials } from './essentials.js';
export type { EssentialsReport, Degradation, HostFacts } from './essentials.js';

// Typed error model.
export { TuiError, EssentialsNotMetError, LoggerConfigError } from './errors.js';

// Screen-safe logger.
export { createLogger } from './logger.js';
export type { Logger, LoggerOptions, LogLevel, LogRecord, LogSink, LoggerFs } from './logger.js';

// Pure redaction helpers.
export { redactEvent, dumpCaps } from './redact.js';
export type { RedactedEvent } from './redact.js';
