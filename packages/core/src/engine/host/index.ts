/**
 * Public entry point of the host & lifecycle subsystem — everything needed to
 * take over a real terminal and give it safely back.
 *
 * Re-exports: the {@link createHost} factory (raw mode, alternate screen,
 * signals, and guaranteed restore on every exit path), the {@link detectTty}
 * pre-start TTY check, the {@link createTerminalQuery} response seam, the
 * ambiguous-width startup probe helpers, and the public type surface
 * ({@link Host}, {@link HostOptions}, {@link ResizeEvent}, {@link RuntimeAdapter},
 * and friends). All of these are re-exported again from `@jsvision/core`, so
 * import them from there. The mode/signal/restore internals are not exported.
 */
export { createHost } from './host.js';
export { detectTty } from './streams.js';
export { createTerminalQuery } from './terminal-query.js';
export {
  probeAmbiguousWidth,
  warnIfAmbiguousWide,
  parseCursorPosition,
  degradeCapsForWidth,
  degradeCapsFully,
  isAsciiSafe,
  AMBIGUOUS_PROBE_GLYPHS,
  BOX_PROBE_GLYPHS,
  WIDTH_WARNING_MESSAGE,
  WIDTH_ADAPTED_MESSAGE,
  DEFAULT_WIDTH_PROBE_TIMEOUT_MS,
} from './width-probe.js';
export type { StreamOptions } from './streams.js';
export type { TerminalQueryOptions, ManagedTerminalQuery } from './terminal-query.js';
export type {
  WidthProbeResult,
  WidthProbeGroupResult,
  WidthProbeOptions,
  WidthWarnOptions,
  CursorPosition,
} from './width-probe.js';
export type { Host, HostOptions, ResizeEvent, RuntimeAdapter, HostSignal, TimerHandle } from './types.js';
