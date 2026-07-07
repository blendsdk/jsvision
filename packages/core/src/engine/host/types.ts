/**
 * The host's public type surface — the contract for {@link createHost} and the
 * objects it works with.
 *
 * Declares the {@link ResizeEvent} the host delivers, the {@link HostOptions}
 * that configure it, the running {@link Host}, the injectable
 * {@link RuntimeAdapter} OS boundary (for headless testing), and the abstract
 * {@link HostSignal} set the adapter maps onto real POSIX/Windows specifics.
 */
import type { CapabilityProfile } from '../capability/profile.js';
import type { InputEvent } from '../input/events.js';
import type { ScreenBuffer } from '../render/buffer.js';

/** A terminal resize, delivered via SIGWINCH (POSIX) or a stdout 'resize' event (Windows). */
export interface ResizeEvent {
  readonly type: 'resize';
  /** New terminal width in columns. */
  readonly columns: number;
  /** New terminal height in rows. */
  readonly rows: number;
}

/**
 * Options for {@link createHost}. Only `caps` is required; every OS-touching
 * input is injectable, so the same host can be driven against real streams or
 * fakes in tests.
 */
export interface HostOptions {
  /** The detected capability profile; gates every terminal mode the host enables. */
  readonly caps: CapabilityProfile;
  /** Input stream to read from. Default: `process.stdin` (or `/dev/tty` when stdout is piped). */
  readonly input?: NodeJS.ReadStream;
  /** Output stream to render to. Default: `process.stdout` (or `/dev/tty` when piped). */
  readonly output?: NodeJS.WriteStream;
  /** When true (default) and stdout is piped but a controlling terminal exists, bind to `/dev/tty`. */
  readonly preferDevTty?: boolean;
  /** Called with each decoded input event. Terminal query replies are handled internally and never delivered here. */
  readonly onInput?: (event: InputEvent) => void;
  /** Called with a terminal resize, coalesced so a burst of SIGWINCH yields a single event. */
  readonly onResize?: (event: ResizeEvent) => void;
  /** POSIX Ctrl+Z (SIGTSTP): fired just before the terminal is restored and the process suspends. */
  readonly onSuspend?: () => void;
  /** POSIX resume (SIGCONT): fired after modes are re-asserted and the last frame is repainted. */
  readonly onResume?: () => void;
  /** Runs just before the host calls `process.exit` on a signal or crash path (receives the exit code). */
  readonly onBeforeExit?: (code: number) => void;
  /** When false, terminating signals restore the terminal but do not call `process.exit`. Default true. */
  readonly exitOnSignal?: boolean;
  /**
   * Enable focus reporting (the terminal reports when it gains/loses focus). No
   * capability models this, so it is a host policy rather than caps-gated.
   * Default `true`.
   */
  readonly focus?: boolean;
  /**
   * Probe the terminal at startup for double-width chrome glyphs — East-Asian
   * *Ambiguous* code points (e.g. `▲◄■▒`) that a font fallback or CJK locale
   * renders two cells wide, shifting box/scroll chrome — and warn via
   * {@link onWidthWarning} when found. Real TTY only; runs after raw mode and
   * before the alternate screen, so the probe and its erase stay off your UI.
   * Default `false` (the higher-level app runner turns this on). Detection is
   * best-effort — a silent or non-TTY terminal never warns.
   */
  readonly warnAmbiguousWidth?: boolean;
  /**
   * Automatically switch to ASCII-safe chrome when the startup width probe finds
   * that box/scroll glyphs render two cells wide: wide arrows turn on the
   * `ambiguousWide` glyph flag, wide box/shade glyphs turn `boxDrawing`/`halfBlocks`
   * off — so every frame stays aligned instead of shearing. Downgrade-only; the
   * original caps are still used for input decoding, mode setup, and restore.
   * Real TTY only, and it shares the single probe run with {@link warnAmbiguousWidth}.
   * Default `false` (the higher-level app runner turns this on).
   */
  readonly adaptAmbiguousWidth?: boolean;
  /**
   * Environment to read the `JSVISION_ASCII` force switch from (NO_COLOR-style:
   * its mere presence, with any value, turns it on). When set, the host renders
   * fully ASCII-safe chrome and skips the width probe entirely. Default
   * `process.env`. Presence-checked only — the value is never parsed or logged.
   */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * Where the startup width warning goes (see {@link warnAmbiguousWidth}).
   * Default: one line to `process.stderr` (never the terminal's output stream).
   * Provide your own to route it into a logger or custom reporting.
   */
  readonly onWidthWarning?: (message: string) => void;
  /** The OS boundary the host runs against. Defaults to the real Node runtime; inject a fake to test headlessly. */
  readonly runtime?: RuntimeAdapter;
}

/** A running terminal host, returned by {@link createHost}. */
export interface Host {
  /** True when both the bound output and input are a real TTY. */
  readonly isTTY: boolean;
  /** Take over the terminal: bind streams, enter raw mode + the configured screen modes, install handlers. Idempotent. */
  start(): Promise<void>;
  /** Give the terminal back: leave modes, restore cooked mode / main screen / cursor, remove handlers. Idempotent; does not exit. */
  stop(): Promise<void>;
  /**
   * Paint a frame. Diffs `buffer` against the previously rendered frame and
   * writes only the changed cells as one coalesced write.
   *
   * `trailer` (optional) is appended to that same write — typically the
   * show-and-move-cursor sequence — so the terminal never repaints between the
   * damage and the cursor move (a separate write would flash the cursor at the
   * last damaged cell for one frame). A trailer is written even when the diff is
   * empty.
   *
   * @param buffer The frame to render.
   * @param trailer Extra bytes to append to the same write (e.g. a cursor move).
   */
  render(buffer: ScreenBuffer, trailer?: string): void;
}

/**
 * The injectable OS boundary the host runs against. The real implementation
 * wraps `node:tty` / `node:process` / `node:fs`; tests inject a fake that records
 * exit codes, captures writes, and drives signals and timers on demand. You only
 * touch this when driving the host headlessly — normal apps let it default.
 */
export interface RuntimeAdapter {
  /** The OS the adapter targets; selects the per-OS signal source map. */
  readonly platform: 'linux' | 'darwin' | 'win32';
  /** Put the input stream in or out of raw mode. Guarded so it is a no-op on a non-TTY. */
  setRawMode(stream: NodeJS.ReadStream, on: boolean): void;
  /** Subscribe to a payload-free signal/resize source; returns an unsubscribe function. */
  on(event: HostSignal, handler: () => void): () => void;
  /** Subscribe to an uncaught exception; the handler receives the thrown value. */
  onUncaughtException(handler: (err: unknown) => void): () => void;
  /** Subscribe to an unhandled promise rejection; the handler receives the reason. */
  onUnhandledRejection(handler: (reason: unknown) => void): () => void;
  /** Suspend the current process (real: `process.kill(pid, 'SIGSTOP')`), used for Ctrl+Z. */
  suspendSelf(): void;
  /** Schedule a callback to run after the current turn (real: `setImmediate`), used to coalesce resizes. */
  scheduleImmediate(fn: () => void): void;
  /** Arm a timer (real: `setTimeout`), used for the lone-ESC disambiguation window; returns a clearable handle. */
  setTimer(fn: () => void, ms: number): TimerHandle;
  /** Clear a timer previously armed by {@link setTimer} (real: `clearTimeout`). */
  clearTimer(handle: TimerHandle): void;
  /** Register a last-resort restore to run on process exit (real: `process.on('exit')`); returns an unsubscribe. */
  onProcessExit(handler: () => void): () => void;
  /**
   * Synchronously write to a file descriptor (real: `fs.writeSync`). Used only by
   * the on-exit restore backstop, where the event loop is draining and an async
   * write would never flush. Synchronous on every platform.
   */
  writeSync(fd: number, data: string): void;
  /** Terminate the process (real: `process.exit`). */
  exit(code: number): never;
  /** Write a diagnostic line to stderr (real: `process.stderr.write`). Never receives raw input. */
  writeError(message: string): void;
  /** Best-effort warning channel (e.g. a legacy Windows console without VT processing). Never logs input. */
  warn(message: string): void;
}

/**
 * The abstract, payload-free signal set the host reacts to. The adapter maps
 * these onto the concrete POSIX/Windows sources internally, keeping the host
 * platform-agnostic. Uncaught exceptions and unhandled rejections carry a payload
 * and so are NOT in this set — they have their own subscriptions
 * ({@link RuntimeAdapter.onUncaughtException} / {@link RuntimeAdapter.onUnhandledRejection}).
 */
export type HostSignal = 'resize' | 'interrupt' | 'terminate' | 'hangup' | 'suspend' | 'continue';

/** Opaque timer handle returned by {@link RuntimeAdapter.setTimer}. */
export type TimerHandle = unknown;
