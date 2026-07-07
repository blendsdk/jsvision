/**
 * A screen-safe logger for TUI apps.
 *
 * A terminal app owns the whole screen, so an ordinary `console.log` would
 * scribble over your UI. {@link createLogger} gives you a {@link Logger} that
 * writes only to safe destinations — a file, stderr (when it is a different
 * device from the screen), or an in-memory ring buffer — never to the terminal.
 *
 * It is disabled by default, so a normal run writes zero bytes; enable it with
 * `{ enabled: true }`, the `JSVISION_DEBUG=1` env var, or by choosing the `ring`
 * sink. Construction throws {@link LoggerConfigError} if the configured sink
 * would resolve to the terminal's own output stream.
 */
import * as nodeFs from 'node:fs';

import { LoggerConfigError } from './errors.js';

/** Severity levels, coarsest to finest. */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** A single structured log record. */
export interface LogRecord {
  readonly level: LogLevel;
  /** Subsystem tag, e.g. 'input' | 'gate' | 'host'. */
  readonly component: string;
  readonly msg: string;
  /** Extra non-secret fields (e.g. a redacted event). Never raw input. */
  readonly fields?: Readonly<Record<string, unknown>>;
}

/**
 * Where log records go:
 * - `auto` — a file if a path is set, else stderr when it is a distinct device, else the ring.
 * - `file` — append to `path` (or the `JSVISION_LOG` env var).
 * - `stderr` — write to fd 2 (rejected if it is the same device as the screen).
 * - `ring` — an in-memory buffer readable via {@link Logger.entries} (also self-enables).
 */
export type LogSink = 'auto' | 'file' | 'stderr' | 'ring';

/**
 * The minimal filesystem interface the logger uses. Injectable so the
 * screen-safety guard can be tested without touching real devices; defaults to
 * `node:fs`, so you normally never set this.
 */
export interface LoggerFs {
  openSync(path: string, flags: string): number;
  fstatSync(fd: number): { readonly dev: number; readonly ino: number };
  writeSync(fd: number, data: string): number;
  closeSync(fd: number): void;
}

/** Options for {@link createLogger}; every field is optional (env supplies the defaults). */
export interface LoggerOptions {
  /** Force enable/disable. Default: enabled iff `sink==='ring'` or `env.JSVISION_DEBUG==='1'`. */
  readonly enabled?: boolean;
  /** Minimum level emitted. Default: 'debug' when enabled. */
  readonly level?: LogLevel;
  /** Sink override. Default 'auto' (file if a path is set, else stderr-if-safe). */
  readonly sink?: LogSink;
  /** File path for the 'file' sink. Default: `env.JSVISION_LOG`. */
  readonly path?: string;
  /** Ring capacity in entries (sink==='ring'). Default 1024. */
  readonly size?: number;
  /** Environment to read flags from. Default: `process.env`. (Injectable for tests.) */
  readonly env?: NodeJS.ProcessEnv;
  /** UI output stream fd to refuse (screen-safety guard). Default: stdout fd (1). */
  readonly uiFd?: number;
  /** Filesystem seam (injectable for tests). Default: `node:fs`. */
  readonly fs?: LoggerFs;
}

/** A screen-safe logger, returned by {@link createLogger}. */
export interface Logger {
  readonly enabled: boolean;
  debug(component: string, msg: string, fields?: Record<string, unknown>): void;
  info(component: string, msg: string, fields?: Record<string, unknown>): void;
  warn(component: string, msg: string, fields?: Record<string, unknown>): void;
  error(component: string, msg: string, fields?: Record<string, unknown>): void;
  /** Ring sink only: the buffered records (oldest→newest). Empty otherwise. For tests. */
  entries(): readonly LogRecord[];
  /** Flush/close the sink (closes the file handle). Idempotent. */
  close(): void;
}

/** Numeric severity for level filtering (lower = coarser/more severe). */
const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

/** Default ring capacity. */
const DEFAULT_RING_SIZE = 1024;

/** Internal sink contract shared by the ring/file/stderr/none implementations. */
interface Sink {
  write(record: LogRecord): void;
  entries(): readonly LogRecord[];
  close(): void;
}

/** Format one record as a single log line (file/stderr sinks). */
function formatLine(record: LogRecord): string {
  const base = `${record.level} ${record.component} ${record.msg}`;
  const extra = record.fields ? ` ${JSON.stringify(record.fields)}` : '';
  return `${base}${extra}\n`;
}

/** A bounded in-memory ring sink (oldest dropped past `size`). */
function createRingSink(size: number): Sink {
  const capacity = size > 0 ? size : DEFAULT_RING_SIZE;
  const records: LogRecord[] = [];
  return {
    write: (record) => {
      records.push(record);
      if (records.length > capacity) records.shift();
    },
    entries: () => records.slice(),
    close: () => undefined,
  };
}

/** An fd-backed line sink (file or stderr). `ownsFd` closes the fd on `close()`. */
function createFdSink(fs: LoggerFs, fd: number, ownsFd: boolean): Sink {
  let closed = false;
  return {
    write: (record) => {
      if (!closed) fs.writeSync(fd, formatLine(record));
    },
    entries: () => [],
    close: () => {
      if (ownsFd && !closed) fs.closeSync(fd);
      closed = true;
    },
  };
}

/**
 * Throw {@link LoggerConfigError} when the opened file `fd` resolves to the same
 * device+inode as the UI stream (`ino !== 0` guard; best-effort where the UI
 * stat is unavailable). Closes `fd` before throwing so no handle leaks.
 */
function assertFileNotUiStream(fs: LoggerFs, fileFd: number, uiFd: number): void {
  const file = fs.fstatSync(fileFd);
  let ui: { readonly dev: number; readonly ino: number };
  try {
    ui = fs.fstatSync(uiFd);
  } catch {
    return; // UI stat unavailable → cannot compare; allow (best-effort).
  }
  if (file.ino !== 0 && file.dev === ui.dev && file.ino === ui.ino) {
    fs.closeSync(fileFd);
    throw new LoggerConfigError('Refusing a log file that resolves to the UI output stream.');
  }
}

/**
 * Open `path` for append (creating it if missing) and return an fd-backed sink,
 * after asserting it does not resolve to the UI stream. Opening with `'a'`
 * follows symlinks to the real file, so the fd-based `{dev,ino}` guard catches a
 * symlinked UI stream without a separate `realpath` step.
 */
function openFileSink(fs: LoggerFs, path: string, uiFd: number): Sink {
  const fd = fs.openSync(path, 'a');
  assertFileNotUiStream(fs, fd, uiFd);
  return createFdSink(fs, fd, true);
}

/**
 * Whether stderr (fd 2) resolves to the same terminal **device** as the screen's
 * output stream. Interactively, stdout (fd 1) and stderr (fd 2) usually share one
 * tty device, so comparing fd *numbers* (`2 === uiFd`) would miss the collision and
 * a log line would scribble over the raw-mode alternate screen. This compares
 * `{dev, ino}` device identity instead — the same mechanism {@link assertFileNotUiStream}
 * uses. If either stat is unavailable (an exotic runtime), it conservatively reports
 * "same device" so the screen is never risked.
 *
 * @param fs   The filesystem interface (injectable).
 * @param uiFd The screen's output stream fd.
 * @returns `true` when stderr shares the screen's device (or the comparison is impossible).
 */
function stderrSharesUiStream(fs: LoggerFs, uiFd: number): boolean {
  try {
    const err = fs.fstatSync(2);
    const ui = fs.fstatSync(uiFd);
    return err.dev === ui.dev && err.ino === ui.ino;
  } catch {
    return true; // cannot compare → assume shared (never write to the UI device)
  }
}

/** Resolve the concrete sink for an enabled logger, applying the UI-stream guard. */
function resolveSink(options: LoggerOptions, env: NodeJS.ProcessEnv): Sink {
  const fs = options.fs ?? nodeFs;
  const uiFd = options.uiFd ?? 1;
  const sink = options.sink ?? 'auto';
  const path = options.path ?? env.JSVISION_LOG;

  if (sink === 'ring') return createRingSink(options.size ?? DEFAULT_RING_SIZE);

  if (sink === 'stderr') {
    // An explicit stderr sink that shares the screen's device is a hard error
    // (mirrors the file sink's contract) — never risk painting over the UI.
    if (stderrSharesUiStream(fs, uiFd)) {
      throw new LoggerConfigError('Refusing a stderr sink that is the UI output stream.');
    }
    return createFdSink(fs, 2, false);
  }

  if (sink === 'file') {
    if (!path) throw new LoggerConfigError('The file sink requires a path (options.path or JSVISION_LOG).');
    return openFileSink(fs, path, uiFd);
  }

  // 'auto': prefer a file when a path is set; else stderr when it is a distinct device; else the ring
  // sink — logs stay captured and readable via entries() while the screen is never touched.
  if (path) return openFileSink(fs, path, uiFd);
  if (!stderrSharesUiStream(fs, uiFd)) return createFdSink(fs, 2, false);
  return createRingSink(options.size ?? DEFAULT_RING_SIZE);
}

/**
 * Create a screen-safe logger.
 *
 * **Enablement.** Off unless you pass `enabled: true`, set `JSVISION_DEBUG=1`, or
 * choose `sink: 'ring'`. A disabled logger is a pure no-op (every method returns
 * without writing and `entries()` is empty), so a normal run writes nothing.
 *
 * **Sink selection** (`sink: 'auto'`, the default): a file if a path is set
 * (`options.path` or the `JSVISION_LOG` env var); else stderr when it is a
 * different device from the screen; else the in-memory ring buffer.
 *
 * **Screen safety.** Construction throws {@link LoggerConfigError} if the chosen
 * sink would resolve to the terminal's own output stream, so a misconfigured
 * logger can never corrupt your rendered UI.
 *
 * @param options Optional configuration; env vars supply the defaults.
 * @returns A `Logger`. It is a no-op when not enabled.
 * @throws LoggerConfigError when the resolved sink targets the terminal's output stream.
 * @example
 * import { createLogger } from '@jsvision/core';
 *
 * // Enable via env (JSVISION_DEBUG=1) and log to a file (JSVISION_LOG=/tmp/app.log):
 * const log = createLogger();
 * log.info('host', 'started', { cols: 120, rows: 40 });
 *
 * // Or capture in memory for a diagnostics dump (always enabled):
 * const ring = createLogger({ sink: 'ring' });
 * ring.debug('input', 'key pressed');
 * console.error(ring.entries());
 * ring.close();
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const env = options.env ?? process.env;
  const sink = options.sink ?? 'auto';
  const enabled = options.enabled ?? (sink === 'ring' || env.JSVISION_DEBUG === '1');

  if (!enabled) {
    // Disabled: a pure no-op so a normal run of the screen-owning app writes nothing.
    return {
      enabled: false,
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      entries: () => [],
      close: () => undefined,
    };
  }

  const threshold = LEVELS[options.level ?? 'debug'];
  const target = resolveSink(options, env);

  const emit = (level: LogLevel, component: string, msg: string, fields?: Record<string, unknown>): void => {
    if (LEVELS[level] > threshold) return; // below the configured level → drop.
    const record: LogRecord = fields ? { level, component, msg, fields } : { level, component, msg };
    target.write(record);
  };

  return {
    enabled: true,
    debug: (component, msg, fields) => emit('debug', component, msg, fields),
    info: (component, msg, fields) => emit('info', component, msg, fields),
    warn: (component, msg, fields) => emit('warn', component, msg, fields),
    error: (component, msg, fields) => emit('error', component, msg, fields),
    entries: () => target.entries(),
    close: () => target.close(),
  };
}
