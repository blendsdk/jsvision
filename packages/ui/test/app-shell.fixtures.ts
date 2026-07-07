/**
 * Shared test doubles for the RD-05 app-shell lifecycle suites (PA-14).
 *
 * Not a `*.test.ts` file, so the unit glob never runs it directly. Mirrors core's host test fake
 * (`packages/core/test/host-doubles.ts`) — a ui-local copy because that file is not exported across
 * the package boundary. The doubles implement the injectable OS boundary `createHost` designs for:
 * a {@link FakeRuntimeAdapter} that records exits / raw-mode / suspend / writes and drives signals +
 * uncaught-exception/rejection backstops, a TTY {@link CaptureStream} that collects exact ANSI, and
 * a TTY {@link FakeInput} that emits decoded `data`. Nothing internal is mocked — `createHost`,
 * `decode`, `serialize`, `enterMode`/`leaveMode`, and `installSignals` all run for real.
 *
 * The `.js` extensions in the import specifiers are required by NodeNext ESM resolution.
 */
import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';
import type { HostSignal, RuntimeAdapter, TimerHandle } from '@jsvision/core';

/** Thrown by {@link FakeRuntimeAdapter.exit} so the `never`-typed exit unwinds the handler. */
export class ProcessExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
    this.name = 'ProcessExitError';
  }
}

/** Run `fn`, swallowing the expected {@link ProcessExitError}; rethrow anything else. */
export function expectExit(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (!(err instanceof ProcessExitError)) throw err;
  }
}

/** A pending manual timer in the fake clock. */
interface FakeTimer {
  readonly fn: () => void;
  readonly at: number;
}

/**
 * The injectable OS boundary as an in-process recorder + driver. Records effects for assertions and
 * exposes `emit*`/`flushImmediates` drivers so a test deterministically advances the host. Immediates
 * and timers are deferred (never synchronous) so they mirror real `setImmediate`/`setTimeout`.
 */
export class FakeRuntimeAdapter implements RuntimeAdapter {
  public readonly platform: 'linux' | 'darwin' | 'win32';

  /** Exit codes passed to {@link exit}, in order. */
  public readonly exits: number[] = [];
  /** Raw-mode toggles recorded by {@link setRawMode}. */
  public readonly rawModeCalls: boolean[] = [];
  /** Count of {@link suspendSelf} calls. */
  public suspendCount = 0;
  /** Synchronous writes recorded by {@link writeSync}. */
  public readonly writeSyncCalls: { readonly fd: number; readonly data: string }[] = [];
  /** Concatenated {@link writeError} output (stderr channel). */
  public errorOutput = '';
  /** Concatenated {@link warn} output. */
  public warnOutput = '';

  private readonly signalHandlers = new Map<HostSignal, Set<() => void>>();
  private readonly uncaughtHandlers = new Set<(err: unknown) => void>();
  private readonly rejectionHandlers = new Set<(reason: unknown) => void>();
  private readonly exitHandlers: (() => void)[] = [];
  private immediates: (() => void)[] = [];
  private readonly timers = new Map<number, FakeTimer>();
  private clock = 0;
  private nextTimerId = 1;

  constructor(platform: 'linux' | 'darwin' | 'win32' = 'linux') {
    this.platform = platform;
  }

  /** True once the host has restored cooked mode (a `setRawMode(_, false)` after a raw toggle). */
  public get restored(): boolean {
    return this.rawModeCalls.length > 0 && this.rawModeCalls[this.rawModeCalls.length - 1] === false;
  }

  public setRawMode(_stream: NodeJS.ReadStream, on: boolean): void {
    this.rawModeCalls.push(on);
  }

  public on(event: HostSignal, handler: () => void): () => void {
    let set = this.signalHandlers.get(event);
    if (!set) {
      set = new Set();
      this.signalHandlers.set(event, set);
    }
    set.add(handler);
    return (): void => {
      set?.delete(handler);
    };
  }

  public onUncaughtException(handler: (err: unknown) => void): () => void {
    this.uncaughtHandlers.add(handler);
    return (): void => {
      this.uncaughtHandlers.delete(handler);
    };
  }

  public onUnhandledRejection(handler: (reason: unknown) => void): () => void {
    this.rejectionHandlers.add(handler);
    return (): void => {
      this.rejectionHandlers.delete(handler);
    };
  }

  public suspendSelf(): void {
    this.suspendCount += 1;
  }

  public scheduleImmediate(fn: () => void): void {
    this.immediates.push(fn);
  }

  public setTimer(fn: () => void, ms: number): TimerHandle {
    const id = this.nextTimerId;
    this.nextTimerId += 1;
    this.timers.set(id, { fn, at: this.clock + ms });
    return id;
  }

  public clearTimer(handle: TimerHandle): void {
    this.timers.delete(handle as number);
  }

  public onProcessExit(handler: () => void): () => void {
    this.exitHandlers.push(handler);
    return (): void => {
      const at = this.exitHandlers.indexOf(handler);
      if (at >= 0) this.exitHandlers.splice(at, 1);
    };
  }

  public writeSync(fd: number, data: string): void {
    this.writeSyncCalls.push({ fd, data });
  }

  public exit(code: number): never {
    this.exits.push(code);
    throw new ProcessExitError(code);
  }

  public writeError(message: string): void {
    this.errorOutput += message;
  }

  public warn(message: string): void {
    this.warnOutput += message;
  }

  // --- test drivers -------------------------------------------------------

  /** Fire every handler registered for `signal`. */
  public emit(signal: HostSignal): void {
    for (const handler of this.signalHandlers.get(signal) ?? []) handler();
  }

  /** Fire the uncaught-exception handlers with `err` (the host's escaping-throw backstop). */
  public emitUncaught(err: unknown): void {
    for (const handler of [...this.uncaughtHandlers]) handler(err);
  }

  /** Fire the unhandled-rejection handlers with `reason`. */
  public emitUnhandledRejection(reason: unknown): void {
    for (const handler of [...this.rejectionHandlers]) handler(reason);
  }

  /** Drain the pending immediate queue once (resize coalescing fires here). */
  public flushImmediates(): void {
    const queue = this.immediates;
    this.immediates = [];
    for (const fn of queue) fn();
  }
}

/**
 * A capturing TTY output stream collecting exact ANSI into {@link data}. Built on EventEmitter (not
 * Writable) so `write()` captures synchronously. The host only uses `write`/`on`/`columns`/`rows`/
 * `fd`/`isTTY`.
 */
export class CaptureStream extends EventEmitter {
  /** Everything written, concatenated. */
  public data = '';
  /** Each write() call's chunk, in order — for atomic-write assertions. */
  public chunks: string[] = [];
  public columns = 80;
  public rows = 24;
  public isTTY = true;
  public fd = 1;

  /** Capture a chunk synchronously. */
  public write(chunk: Uint8Array | string): boolean {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    this.data += text;
    this.chunks.push(text);
    return true;
  }

  /** Count of non-overlapping occurrences of `needle` in the captured output. */
  public countOf(needle: string): number {
    if (needle.length === 0) return 0;
    let count = 0;
    let index = this.data.indexOf(needle);
    while (index !== -1) {
      count += 1;
      index = this.data.indexOf(needle, index + needle.length);
    }
    return count;
  }

  /** View this double as a `NodeJS.WriteStream` (the host uses only a small structural subset). */
  public asOutput(): NodeJS.WriteStream {
    return this as unknown as NodeJS.WriteStream;
  }
}

/** A readable TTY input double that emits `data` on demand. */
export class FakeInput extends EventEmitter {
  public isTTY = true;

  /** Push raw bytes to the host's `data` listener (the host decodes them into input events). */
  public feed(bytes: Uint8Array): void {
    this.emit('data', bytes);
  }

  /** No-op flow control — the width probe's `createTerminalQuery` calls `resume()` before reading. */
  public resume(): this {
    return this;
  }

  /** No-op flow control counterpart to {@link resume}. */
  public pause(): this {
    return this;
  }

  /** View this double as a `NodeJS.ReadStream`. */
  public asInput(): NodeJS.ReadStream {
    return this as unknown as NodeJS.ReadStream;
  }
}
