/**
 * Test doubles for driving the RD-05 app shell against a **real host**, headlessly.
 *
 * The app-shell suites to date dispatch synthetic event objects straight into the loop, so the real
 * decode → host → serialize → output seam was never exercised (the live freeze + mouse bugs hid
 * there). These doubles implement the injectable boundary `createApplication`/`run()` already expose
 * (`runtime`/`input`/`output`): a {@link FakeRuntime} OS adapter, a {@link CaptureStream} that
 * collects exact ANSI, and a {@link FakeInput} that feeds raw bytes. `decode()`/`serialize()`/
 * `createHost()` all run for real — only the OS edge is faked.
 *
 * Not a `*.test.ts` file, so the unit glob never collects it directly. The two `as unknown as`
 * bridges (to `NodeJS.ReadStream`/`WriteStream`) are the same test-only structural casts core's host
 * doubles use — fully implementing a tty stream is impractical for a double and never ships.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';
import type { RuntimeAdapter, HostSignal, TimerHandle } from '@jsvision/core';

/** Thrown by {@link FakeRuntime.exit}; the happy path (quit command) never calls it. */
export class ProcessExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
    this.name = 'ProcessExitError';
  }
}

/**
 * The injectable OS boundary as an in-process recorder. Records raw-mode/exit/write effects and lets
 * a test fire signal/timer handlers; immediates resolve on a microtask so `await`-ing the event loop
 * drains them. Just enough for `run()` — not a general host driver.
 */
export class FakeRuntime implements RuntimeAdapter {
  readonly platform: 'linux' | 'darwin' | 'win32';
  /** Raw-mode toggles, in order. */
  readonly rawModeCalls: boolean[] = [];
  /** Exit codes passed to {@link exit} (should stay empty on the quit-command path). */
  readonly exits: number[] = [];

  private readonly signalHandlers = new Map<HostSignal, Set<() => void>>();
  private readonly timers = new Map<number, () => void>();
  private nextTimerId = 1;

  constructor(platform: 'linux' | 'darwin' | 'win32' = 'linux') {
    this.platform = platform;
  }

  setRawMode(_stream: NodeJS.ReadStream, on: boolean): void {
    this.rawModeCalls.push(on);
  }

  on(event: HostSignal, handler: () => void): () => void {
    let set = this.signalHandlers.get(event);
    if (set === undefined) {
      set = new Set();
      this.signalHandlers.set(event, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  onUncaughtException(_handler: (err: unknown) => void): () => void {
    return () => undefined;
  }

  onUnhandledRejection(_handler: (reason: unknown) => void): () => void {
    return () => undefined;
  }

  suspendSelf(): void {
    // no-op — suspend/resume is not exercised here
  }

  scheduleImmediate(fn: () => void): void {
    queueMicrotask(fn);
  }

  setTimer(fn: () => void, _ms: number): TimerHandle {
    const id = this.nextTimerId;
    this.nextTimerId += 1;
    this.timers.set(id, fn);
    return id;
  }

  clearTimer(handle: TimerHandle): void {
    this.timers.delete(handle as number);
  }

  onProcessExit(_handler: () => void): () => void {
    return () => undefined;
  }

  writeSync(_fd: number, _data: string): void {
    // no-op — only the process-'exit' restore backstop uses this
  }

  exit(code: number): never {
    this.exits.push(code);
    throw new ProcessExitError(code);
  }

  writeError(_message: string): void {
    // no-op
  }

  warn(_message: string): void {
    // no-op
  }

  /** Fire every handler registered for `signal` (test driver). */
  emit(signal: HostSignal): void {
    for (const handler of this.signalHandlers.get(signal) ?? []) handler();
  }

  /** Fire all armed timers (the lone-ESC flush; test driver). */
  fireTimers(): void {
    const pending = [...this.timers.values()];
    this.timers.clear();
    for (const fn of pending) fn();
  }
}

/**
 * A capturing output stream collecting exact ANSI into {@link data}. Built on EventEmitter (not
 * Writable) so `write()` captures synchronously. The host only uses `write`/`on`/`columns`/`rows`/
 * `fd`/`isTTY`.
 */
export class CaptureStream extends EventEmitter {
  /** Everything written, concatenated. */
  data = '';
  columns = 80;
  rows = 24;
  isTTY = true;
  fd = 1;

  /** Capture a chunk synchronously. */
  write(chunk: Uint8Array | string): boolean {
    this.data += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    return true;
  }

  /** View this double as a {@link NodeJS.WriteStream} (test-only structural bridge). */
  asOutput(): NodeJS.WriteStream {
    return this as unknown as NodeJS.WriteStream;
  }
}

/** A readable input double that feeds raw bytes to the host's `data` listener on demand. */
export class FakeInput extends EventEmitter {
  isTTY: boolean;

  constructor(isTTY = true) {
    super();
    this.isTTY = isTTY;
  }

  /** Push a chunk to the host's `data` listener (decoded synchronously by the host). */
  feed(bytes: Uint8Array): void {
    this.emit('data', bytes);
  }

  /** View this double as a {@link NodeJS.ReadStream} (test-only structural bridge). */
  asInput(): NodeJS.ReadStream {
    return this as unknown as NodeJS.ReadStream;
  }
}
