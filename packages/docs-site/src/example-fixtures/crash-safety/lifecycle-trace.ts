/**
 * Deterministic native-host lifecycle evidence for the Crash safety course.
 *
 * This is an authentic substitute for a browser laboratory: it drives the public host through its
 * injected operating-system boundary and records bounded, payload-free effects.
 */
import { PassThrough } from 'node:stream';
import { createHost, resolveCapabilities } from '@jsvision/core';
import type { HostSignal, RuntimeAdapter, TimerHandle } from '@jsvision/core';

/** Lifecycle paths covered by the course's runnable evidence artifact. */
export type LifecycleScenario =
  | 'normal'
  | 'exception'
  | 'rejection'
  | 'interrupt'
  | 'terminate'
  | 'hangup'
  | 'partial-start'
  | 'double-stop'
  | 'restore-failure'
  | 'exception-restore-failure';

const CSI = '\u001b[';
const EXPECTED_ENTER = `${CSI}?1049h${CSI}?25l${CSI}?7l${CSI}?1006h${CSI}?1000h${CSI}?1002h${CSI}?2004h${CSI}?1004h`;
const EXPECTED_LEAVE = `${CSI}?1004l${CSI}?2004l${CSI}?1002l${CSI}?1000l${CSI}?1006l${CSI}?7h${CSI}?25h${CSI}?1049l`;

/** Bounded, payload-free result of one real public-host lifecycle run. */
export interface LifecycleTraceResult {
  /** Scenario that produced this result. */
  readonly scenario: LifecycleScenario;
  /** Ordered stable lifecycle steps, capped by the fixture's trace capacity. */
  readonly trace: readonly string[];
  /** Exit codes requested by fatal or terminating paths. */
  readonly exitCodes: readonly number[];
  /** Codes observed by the public `onBeforeExit` seam. */
  readonly beforeExitCodes: readonly number[];
  /** Number of times a pre-existing signal observer ran. */
  readonly existingHandlerRuns: number;
  /** Number of handlers remaining after the scenario. */
  readonly remainingHandlers: number;
  /** Whether startup threw before terminal entry completed. */
  readonly startupFailed: boolean;
}

/** Error used to model a requested process exit without terminating the test runner. */
class ExitRequest extends Error {
  public constructor(public readonly code: number) {
    super(`exit ${code}`);
    this.name = 'ExitRequest';
  }
}

/** Return whether an object exposes the stream operations the public host consumes. */
function hasMethods(value: object, names: readonly string[]): boolean {
  return names.every((name) => name in value && typeof Reflect.get(value, name) === 'function');
}

/** Narrow a structural input recorder to the public Node input-stream contract. */
function isInputStream(value: object): value is NodeJS.ReadStream {
  return hasMethods(value, ['on', 'removeListener', 'resume', 'pause']);
}

/** Narrow a structural output recorder to the public Node output-stream contract. */
function isOutputStream(value: object): value is NodeJS.WriteStream {
  return hasMethods(value, ['on', 'removeListener', 'write']);
}

/**
 * Public runtime-boundary recorder.
 *
 * Stable category tokens enter the trace; thrown values and diagnostic text never do.
 */
export class LifecycleTraceRuntime implements RuntimeAdapter {
  /** Linux supplies every abstract signal used by this deterministic fixture. */
  public readonly platform = 'linux';

  /** Exit codes requested by the host. */
  public readonly exitCodes: number[] = [];

  protected readonly steps: string[] = [];
  protected readonly signals = new Map<HostSignal, Set<() => void>>();
  protected readonly uncaught = new Set<(error: unknown) => void>();
  protected readonly rejections = new Set<(reason: unknown) => void>();
  protected readonly processExit = new Set<() => void>();
  protected readonly traceCapacity = 32;

  /** Build a recorder, optionally injecting one raw-off teardown failure. */
  public constructor(protected readonly failRawOff = false) {}

  /** Record one stable step while keeping the trace bounded. */
  public record(step: string): void {
    this.steps.push(step);
    if (this.steps.length > this.traceCapacity) this.steps.splice(0, this.steps.length - this.traceCapacity);
  }

  /** Defensive snapshot of the ordered lifecycle trace. */
  public snapshot(): readonly string[] {
    return [...this.steps];
  }

  /** Total number of currently registered runtime handlers. */
  public get handlerCount(): number {
    return (
      [...this.signals.values()].reduce((total, handlers) => total + handlers.size, 0) +
      this.uncaught.size +
      this.rejections.size +
      this.processExit.size
    );
  }

  /** Record raw/cooked transitions made by the real host. */
  public setRawMode(_stream: NodeJS.ReadStream, on: boolean): void {
    if (!on && this.failRawOff) {
      this.record('raw:off-failed');
      throw new Error('bounded restore failure');
    }
    this.record(on ? 'raw:on' : 'raw:off');
  }

  /** Register a signal observer without replacing observers already at the boundary. */
  public on(signal: HostSignal, handler: () => void): () => void {
    const handlers = this.signals.get(signal) ?? new Set<() => void>();
    handlers.add(handler);
    this.signals.set(signal, handlers);
    return () => handlers.delete(handler);
  }

  /** Register an uncaught-exception observer. */
  public onUncaughtException(handler: (error: unknown) => void): () => void {
    this.uncaught.add(handler);
    return () => this.uncaught.delete(handler);
  }

  /** Register an unhandled-rejection observer. */
  public onUnhandledRejection(handler: (reason: unknown) => void): () => void {
    this.rejections.add(handler);
    return () => this.rejections.delete(handler);
  }

  /** Record deterministic suspension. */
  public suspendSelf(): void {
    this.record('process:suspend');
  }

  /** Run resize work immediately; resize timing is outside this artifact's lesson. */
  public scheduleImmediate(fn: () => void): void {
    fn();
  }

  /** Return the callback as an opaque timer handle without scheduling wall-clock work. */
  public setTimer(fn: () => void, _ms: number): TimerHandle {
    return fn;
  }

  /** The fixture schedules no wall-clock timers, so clearing is inert. */
  public clearTimer(_handle: TimerHandle): void {}

  /** Register the synchronous last-resort process-exit backstop. */
  public onProcessExit(handler: () => void): () => void {
    this.processExit.add(handler);
    this.record('backstop:armed');
    return () => {
      this.processExit.delete(handler);
      this.record('backstop:removed');
    };
  }

  /** Record the synchronous restore channel without retaining terminal bytes. */
  public writeSync(_fd: number, data: string): void {
    this.record(
      data === EXPECTED_LEAVE ? `screen:restore-sync:${data.length}` : `screen:unexpected-sync:${data.length}`,
    );
  }

  /** Record an exit request and unwind to the fixture boundary. */
  public exit(code: number): never {
    this.exitCodes.push(code);
    this.record(`exit:${code}`);
    throw new ExitRequest(code);
  }

  /** Record only diagnostic length, never the error payload. */
  public writeError(message: string): void {
    this.record(`diagnostic:safe:length-${Math.min(message.length, 999)}`);
  }

  /** Record a payload-free warning category. */
  public warn(_message: string): void {
    this.record('warning:safe');
  }

  /** Emit one abstract signal through every registered observer. */
  public emitSignal(signal: HostSignal): void {
    this.record(`signal:${signal}`);
    for (const handler of [...(this.signals.get(signal) ?? [])]) handler();
  }

  /** Emit an uncaught failure while discarding its value at the trace boundary. */
  public emitUncaught(error: unknown): void {
    this.record('failure:exception');
    for (const handler of [...this.uncaught]) handler(error);
  }

  /** Emit an unhandled rejection while discarding its value at the trace boundary. */
  public emitRejection(reason: unknown): void {
    this.record('failure:rejection');
    for (const handler of [...this.rejections]) handler(reason);
  }

  /** Fire the synchronous exit backstop. */
  public emitProcessExit(): void {
    this.record('process:exit-backstop');
    for (const handler of [...this.processExit]) handler();
  }
}

/** Build TTY-shaped streams without touching visitor input, output, or devices. */
function terminalStreams(
  runtime: LifecycleTraceRuntime,
  options: { readonly failFirstWrite: boolean },
): { readonly input: NodeJS.ReadStream; readonly output: NodeJS.WriteStream } {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode: (_on: boolean): void => {},
  });
  if (!isInputStream(input)) throw new Error('fixture input does not satisfy the host stream boundary');

  const base = Object.assign(new PassThrough(), {
    isTTY: true,
    columns: 80,
    rows: 24,
    fd: 1,
  });
  let writes = 0;
  const output = new Proxy(base, {
    get(target, property, receiver) {
      if (property !== 'write') return Reflect.get(target, property, receiver);
      return (chunk: Uint8Array | string): boolean => {
        writes += 1;
        const data = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        if (options.failFirstWrite && writes === 1) {
          runtime.record(data === EXPECTED_ENTER ? 'screen:enter-failed' : 'screen:unexpected-enter-failed');
          throw new Error('bounded setup failure');
        }
        if (data === EXPECTED_ENTER) runtime.record(`screen:enter:${data.length}`);
        else if (data === EXPECTED_LEAVE) runtime.record(`screen:restore:${data.length}`);
        else runtime.record(`screen:unexpected:${data.length}`);
        return true;
      };
    },
  });
  if (!isOutputStream(output)) throw new Error('fixture output does not satisfy the host stream boundary');
  return { input, output };
}

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    mouse: { sgr: true, drag: true, wheel: true },
    altScreen: true,
    bracketedPaste: true,
  },
}).profile;

/**
 * Run one authentic lifecycle scenario through the public terminal host.
 *
 * The resulting sequence contains stable categories and bounded lengths only. It never retains the
 * supplied secret fixture payload.
 */
export async function runLifecycleTrace(scenario: LifecycleScenario): Promise<LifecycleTraceResult> {
  const runtime = new LifecycleTraceRuntime(scenario === 'restore-failure' || scenario === 'exception-restore-failure');
  const streams = terminalStreams(runtime, { failFirstWrite: scenario === 'partial-start' });
  const beforeExitCodes: number[] = [];
  let existingHandlerRuns = 0;
  runtime.on('interrupt', () => {
    existingHandlerRuns += 1;
    runtime.record('observer:existing');
  });
  const host = createHost({
    caps,
    runtime,
    input: streams.input,
    output: streams.output,
    warnAmbiguousWidth: false,
    onBeforeExit: (code) => {
      beforeExitCodes.push(code);
      runtime.record(`before-exit:${code}`);
    },
  });

  let startupFailed = false;
  try {
    await host.start();
  } catch {
    startupFailed = true;
    runtime.record('start:failed');
  }

  try {
    if (scenario === 'partial-start') {
      runtime.emitProcessExit();
      await host.stop();
      runtime.emitSignal('interrupt');
    } else if (scenario === 'normal' || scenario === 'restore-failure') {
      await host.stop();
      runtime.emitSignal('interrupt');
    } else if (scenario === 'double-stop') {
      await host.stop();
      await host.stop();
      runtime.emitSignal('interrupt');
    } else if (scenario === 'exception' || scenario === 'exception-restore-failure') {
      runtime.emitUncaught(new Error('fixture-secret-payload'));
    } else if (scenario === 'rejection') {
      runtime.emitRejection(new Error('fixture-secret-payload'));
    } else {
      runtime.emitSignal(scenario);
    }
  } catch (error) {
    if (!(error instanceof ExitRequest)) throw error;
  }

  return {
    scenario,
    trace: runtime.snapshot(),
    exitCodes: [...runtime.exitCodes],
    beforeExitCodes,
    existingHandlerRuns,
    remainingHandlers: runtime.handlerCount,
    startupFailed,
  };
}
