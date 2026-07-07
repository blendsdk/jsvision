/**
 * The production {@link RuntimeAdapter} and its per-OS signal wiring.
 *
 * `hostSignalSource()` is a **pure** map from an abstract {@link HostSignal} to
 * its concrete OS source (a `process` signal or a stream event), so both the
 * POSIX and Windows maps can be exercised on any host by passing a platform.
 * `realRuntime()` builds the real adapter over `node:process` / `node:fs` /
 * `node:tty`, bound to the host's output stream (so Windows `resize`/`hangup`
 * can attach to it). The `platform` / `vtAvailable` overrides exist only so the
 * Windows paths and the legacy-console warning are testable from a POSIX runner;
 * production passes neither.
 */
import { writeSync as fsWriteSync } from 'node:fs';
import type { HostSignal, RuntimeAdapter, TimerHandle } from './types.js';

/** Where an abstract {@link HostSignal} is sourced. `process` = a process signal; `output` = a stream event. */
export interface SignalSource {
  readonly emitter: 'process' | 'output';
  readonly name: string;
}

/**
 * Map an abstract {@link HostSignal} to its concrete OS source on `platform`.
 * Pure (no I/O); `null` means the signal is not wired on that platform (e.g.
 * suspend/continue on Windows, which has no SIGTSTP/SIGCONT).
 *
 * @param platform - the OS to map for (`process.platform` shape).
 * @param signal - the abstract host signal.
 * @returns the source descriptor, or `null` when unsupported on `platform`.
 */
export function hostSignalSource(platform: NodeJS.Platform, signal: HostSignal): SignalSource | null {
  const win32 = platform === 'win32';
  switch (signal) {
    case 'resize':
      return win32 ? { emitter: 'output', name: 'resize' } : { emitter: 'process', name: 'SIGWINCH' };
    case 'interrupt':
      return { emitter: 'process', name: 'SIGINT' };
    case 'terminate':
      return win32 ? { emitter: 'process', name: 'SIGBREAK' } : { emitter: 'process', name: 'SIGTERM' };
    case 'hangup':
      return win32 ? { emitter: 'output', name: 'close' } : { emitter: 'process', name: 'SIGHUP' };
    case 'suspend':
      return win32 ? null : { emitter: 'process', name: 'SIGTSTP' };
    case 'continue':
      return win32 ? null : { emitter: 'process', name: 'SIGCONT' };
  }
}

/** Optional injectable overrides for {@link realRuntime} (test-only; production omits them). */
export interface RealRuntimeOptions {
  /** Platform to assume; defaults to `process.platform`. Lets a POSIX runner exercise the Windows paths. */
  readonly platform?: NodeJS.Platform;
  /** VT-processing availability predicate (Windows only); defaults to "available". */
  readonly vtAvailable?: () => boolean;
  /** Warning sink; defaults to `process.stderr.write`. Injected so the legacy-console warning is assertable. */
  readonly warn?: (message: string) => void;
}

/** Narrow an arbitrary `process.platform` to the three the adapter models. */
function normalizePlatform(platform: NodeJS.Platform): 'linux' | 'darwin' | 'win32' {
  if (platform === 'win32') return 'win32';
  if (platform === 'darwin') return 'darwin';
  return 'linux';
}

/**
 * Build the production {@link RuntimeAdapter} bound to `output`.
 *
 * All OS effects route through here so the host stays platform-agnostic and the
 * whole subsystem is testable by injecting a fake adapter instead. On Windows, if
 * the `vtAvailable` predicate reports VT processing is unavailable (a legacy
 * console), it warns once at construction.
 *
 * @param output - the bound output stream; Windows `resize`/`hangup` attach to it.
 * @param options - test-only platform / VT overrides; omit in production.
 * @returns a real {@link RuntimeAdapter}.
 */
export function realRuntime(output: NodeJS.WriteStream, options: RealRuntimeOptions = {}): RuntimeAdapter {
  const rawPlatform = options.platform ?? process.platform;
  const platform = normalizePlatform(rawPlatform);
  const vtAvailable = options.vtAvailable ?? ((): boolean => true);
  const warnSink =
    options.warn ??
    ((message: string): void => {
      process.stderr.write(message);
    });

  /** Attach `handler` to the source's emitter; return an unsubscribe. */
  function subscribe(emitter: NodeJS.EventEmitter, name: string, handler: () => void): () => void {
    emitter.on(name, handler);
    return (): void => {
      emitter.off(name, handler);
    };
  }

  // Windows VT-processing check: warn once if a legacy console lacks VT support.
  if (platform === 'win32' && !vtAvailable()) {
    warnSink('tui: virtual-terminal processing unavailable (legacy console); rendering may be degraded.\n');
  }

  return {
    platform,
    setRawMode(stream: NodeJS.ReadStream, on: boolean): void {
      // Never attempt raw mode on a non-TTY — setRawMode does not exist there.
      if (stream.isTTY) stream.setRawMode(on);
    },
    on(event: HostSignal, handler: () => void): () => void {
      const source = hostSignalSource(rawPlatform, event);
      // Unsupported on this platform (e.g. suspend/continue on Windows) → inert.
      if (source === null) return (): void => {};
      const emitter: NodeJS.EventEmitter = source.emitter === 'output' ? output : process;
      return subscribe(emitter, source.name, handler);
    },
    onUncaughtException(handler: (err: unknown) => void): () => void {
      const listener = (err: unknown): void => handler(err);
      process.on('uncaughtException', listener);
      return (): void => {
        process.off('uncaughtException', listener);
      };
    },
    onUnhandledRejection(handler: (reason: unknown) => void): () => void {
      const listener = (reason: unknown): void => handler(reason);
      process.on('unhandledRejection', listener);
      return (): void => {
        process.off('unhandledRejection', listener);
      };
    },
    suspendSelf(): void {
      // SIGSTOP is uncatchable, so this actually suspends without re-entering the SIGTSTP handler.
      process.kill(process.pid, 'SIGSTOP');
    },
    scheduleImmediate(fn: () => void): void {
      setImmediate(fn);
    },
    setTimer(fn: () => void, ms: number): TimerHandle {
      return setTimeout(fn, ms);
    },
    clearTimer(handle: TimerHandle): void {
      // The handle round-trips as the opaque TimerHandle; it is the NodeJS.Timeout setTimer returned.
      clearTimeout(handle as NodeJS.Timeout);
    },
    onProcessExit(handler: () => void): () => void {
      process.on('exit', handler);
      return (): void => {
        process.off('exit', handler);
      };
    },
    writeSync(fd: number, data: string): void {
      // Synchronous so the draining on-exit restore backstop actually flushes.
      fsWriteSync(fd, data);
    },
    exit(code: number): never {
      return process.exit(code);
    },
    writeError(message: string): void {
      process.stderr.write(message);
    },
    warn(message: string): void {
      warnSink(message);
    },
  };
}
