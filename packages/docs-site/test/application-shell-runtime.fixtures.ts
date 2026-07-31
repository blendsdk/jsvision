/**
 * Headless host fixtures for the application-shell Guide lifecycle checks.
 *
 * The fixtures live in the docs-site package so its isolated TypeScript project never imports test
 * helpers from another workspace. The stream proxies retain Node's real stream types while
 * suppressing terminal output and reporting TTY capability to the injected runtime adapter.
 */
import type { HostSignal, RuntimeAdapter, TimerHandle } from '@jsvision/core';

/** Error used to model the process-exit boundary without terminating the test runner. */
export class TestProcessExitError extends Error {
  /**
   * Create an observable process-exit result.
   *
   * @param code Exit code requested by the host.
   */
  public constructor(public readonly code: number) {
    super(`process.exit(${code})`);
    this.name = 'TestProcessExitError';
  }
}

/** Run a callback and require it to terminate through the injected process-exit boundary. */
export function expectTestExit(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    if (error instanceof TestProcessExitError) return;
    throw error;
  }
  throw new Error('expected the runtime adapter to request process exit');
}

/** Minimal deterministic runtime adapter needed to prove restoration and fatal-exit behavior. */
export class GuideRuntimeAdapter implements RuntimeAdapter {
  /** Platform used by the host signal policy. */
  public readonly platform = 'linux';

  /** Raw-mode transitions observed during the run. */
  public readonly rawModeCalls: boolean[] = [];

  /** Registered uncaught-exception callbacks. */
  private readonly uncaughtHandlers = new Set<(error: unknown) => void>();

  /** Registered unhandled-rejection callbacks. */
  private readonly rejectionHandlers = new Set<(reason: unknown) => void>();

  /** Registered process-exit callbacks. */
  private readonly exitHandlers = new Set<() => void>();

  /** Registered signal callbacks. */
  private readonly signalHandlers = new Map<HostSignal, Set<() => void>>();

  /** Whether the most recent raw-mode transition restored cooked mode. */
  public get restored(): boolean {
    return this.rawModeCalls.at(-1) === false;
  }

  /** Record a raw-mode transition. */
  public setRawMode(_stream: NodeJS.ReadStream, enabled: boolean): void {
    this.rawModeCalls.push(enabled);
  }

  /** Register a host signal callback. */
  public on(signal: HostSignal, handler: () => void): () => void {
    const handlers = this.signalHandlers.get(signal) ?? new Set<() => void>();
    handlers.add(handler);
    this.signalHandlers.set(signal, handlers);
    return (): void => {
      handlers.delete(handler);
    };
  }

  /** Register an uncaught-exception callback. */
  public onUncaughtException(handler: (error: unknown) => void): () => void {
    this.uncaughtHandlers.add(handler);
    return (): void => {
      this.uncaughtHandlers.delete(handler);
    };
  }

  /** Register an unhandled-rejection callback. */
  public onUnhandledRejection(handler: (reason: unknown) => void): () => void {
    this.rejectionHandlers.add(handler);
    return (): void => {
      this.rejectionHandlers.delete(handler);
    };
  }

  /** No-op suspension seam; lifecycle checks do not exercise job control. */
  public suspendSelf(): void {}

  /** Execute an immediate deterministically. */
  public scheduleImmediate(handler: () => void): void {
    handler();
  }

  /** Schedule an inert timer because lifecycle checks never advance input time. */
  public setTimer(_handler: () => void, _milliseconds: number): TimerHandle {
    return Symbol('guide-runtime-timer');
  }

  /** No-op timer cancellation for inert test timers. */
  public clearTimer(_handle: TimerHandle): void {}

  /** Register a last-resort process-exit restoration callback. */
  public onProcessExit(handler: () => void): () => void {
    this.exitHandlers.add(handler);
    return (): void => {
      this.exitHandlers.delete(handler);
    };
  }

  /** No-op synchronous terminal write used only by the process-exit backstop. */
  public writeSync(_fileDescriptor: number, _data: string): void {}

  /** Model process termination as an observable exception. */
  public exit(code: number): never {
    throw new TestProcessExitError(code);
  }

  /** No-op diagnostic sink; tests assert restoration rather than diagnostic rendering. */
  public writeError(_message: string): void {}

  /** No-op warning sink; the fixtures disable ambiguous-width warnings. */
  public warn(_message: string): void {}

  /** Deliver an uncaught exception to every currently registered host callback. */
  public emitUncaught(error: unknown): void {
    for (const handler of [...this.uncaughtHandlers]) handler(error);
  }
}

/**
 * Return a TTY-like stdin proxy without changing or consuming the real process stream.
 *
 * Host method reads are bound to the underlying stream so Node's private stream state remains valid.
 */
export function quietTestInput(): NodeJS.ReadStream {
  return new Proxy(process.stdin, {
    get(target, property) {
      if (property === 'isTTY') return true;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Return a TTY-like stdout proxy that discards frame bytes while preserving the real stream type.
 */
export function quietTestOutput(): NodeJS.WriteStream {
  return new Proxy(process.stdout, {
    get(target, property) {
      if (property === 'isTTY') return true;
      if (property === 'write') return (): boolean => true;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
