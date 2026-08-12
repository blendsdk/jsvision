import { createDecoderState, decode, resolveCapabilities } from '@jsvision/core';
import type { FocusEvent, InputEvent, MouseEvent, WheelEvent } from '@jsvision/core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { deriveKanbanSemanticHostBoardResult } from './semantic-host-board.js';

/** Supported deterministic transports for the standard semantic pointer trace. */
export type KanbanSemanticTraceTransport = 'direct' | 'browser-xterm' | 'unix-pty' | 'windows-conpty';

/** One immutable raw-input trace that carries no application card data. */
export interface KanbanSemanticPointerTrace {
  /** SGR mouse and focus bytes replayed by every host adapter. */
  readonly input: string;
}

/** Sanitized proof of the real host path used for one replay. */
export interface KanbanSemanticHostEvidence {
  /** Host adapter selected by the caller. */
  readonly transport: KanbanSemanticTraceTransport;
  /** Concrete terminal implementation that decoded the input. */
  readonly terminal: 'direct' | 'xterm-headless' | 'pty' | 'conpty';
  /** Always false; a pipe-backed child is never accepted as native evidence. */
  readonly pipeBacked: false;
  /** Runtime platform that produced the evidence. */
  readonly platform: NodeJS.Platform;
}

/** Payload-free semantic result shared by every supported host adapter. */
export interface KanbanSemanticPointerResult {
  /** Host evidence kept separate from semantic equality. */
  readonly evidence: KanbanSemanticHostEvidence;
  /** Stable semantic facts derived from decoded input rather than raw transport bytes. */
  readonly semantic: {
    /** Host-observed interaction milestones covered by the standard trace. */
    readonly observedSteps: readonly (
      'mixed-height' | 'click' | 'wheel' | 'grab' | 'pointer-moves' | 'gap-transition' | 'drop' | 'post-drop-redraw'
    )[];
    readonly thresholdCrossed: boolean;
    readonly targetChanges: readonly string[];
    readonly autoscroll: readonly string[];
    readonly cancellations: readonly string[];
    readonly proposal: {
      readonly kind: 'card-move';
      readonly movedCardKeys: readonly (string | number)[];
      readonly columnId: string;
      readonly swimlaneId: string;
      readonly position: 'before' | 'after' | 'start' | 'end';
    };
  };
}

/** Deterministic timer handle owned by {@link KanbanFakeClock}. */
export interface KanbanFakeClockHandle {
  /** Cancels the scheduled callback idempotently. */
  cancel(): void;
}

/** Small deterministic scheduler used by drag/autoscroll tests without wall-clock sleeps. */
export interface KanbanFakeClock {
  /** Returns current virtual time in milliseconds. */
  now(): number;
  /** Schedules one callback at or after the requested finite delay. */
  schedule(delayMs: number, callback: () => void): KanbanFakeClockHandle;
  /** Advances virtual time and runs due callbacks in deadline/insertion order. */
  advance(milliseconds: number): void;
  /** Returns the number of live scheduled callbacks. */
  pending(): number;
  /** Cancels every retained callback. */
  dispose(): void;
}

interface ScheduledCallback {
  readonly id: number;
  readonly deadline: number;
  readonly callback: () => void;
  cancelled: boolean;
}

/** Hard ceiling that prevents a hostile test from retaining an unbounded callback queue. */
const MAXIMUM_FAKE_CLOCK_CALLBACKS = 8_192;

/**
 * Creates an isolated deterministic drag clock.
 *
 * @example
 * ```ts
 * const clock = createKanbanFakeClock();
 * let fired = false;
 * clock.schedule(50, () => { fired = true; });
 * clock.advance(50);
 * ```
 */
export function createKanbanFakeClock(): KanbanFakeClock {
  let current = 0;
  let nextId = 1;
  let disposed = false;
  const scheduled: ScheduledCallback[] = [];
  return Object.freeze({
    now: () => current,
    schedule: (delayMs: number, callback: () => void) => {
      if (disposed || !Number.isFinite(delayMs) || delayMs < 0 || typeof callback !== 'function') {
        throw new RangeError('Invalid Kanban fake-clock schedule.');
      }
      if (scheduled.filter(({ cancelled }) => !cancelled).length >= MAXIMUM_FAKE_CLOCK_CALLBACKS) {
        throw new RangeError('Kanban fake-clock callback limit exceeded.');
      }
      const entry: ScheduledCallback = {
        id: nextId,
        deadline: current + delayMs,
        callback,
        cancelled: false,
      };
      nextId += 1;
      scheduled.push(entry);
      return Object.freeze({
        cancel: () => {
          entry.cancelled = true;
        },
      });
    },
    advance: (milliseconds: number) => {
      if (disposed || !Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new RangeError('Invalid Kanban fake-clock advance.');
      }
      current += milliseconds;
      scheduled.sort((left, right) => left.deadline - right.deadline || left.id - right.id);
      // Snapshot due work before invoking callbacks. A callback may schedule zero-delay work, but
      // that new work belongs to the next explicit advance and cannot grow this pass indefinitely.
      const due = scheduled.filter((entry) => !entry.cancelled && entry.deadline <= current);
      try {
        for (const entry of due) {
          if (!entry.cancelled && entry.deadline <= current) {
            entry.cancelled = true;
            entry.callback();
          }
        }
      } finally {
        for (let index = scheduled.length - 1; index >= 0; index -= 1) {
          if (scheduled[index]?.cancelled === true) scheduled.splice(index, 1);
        }
      }
    },
    pending: () => scheduled.filter(({ cancelled }) => !cancelled).length,
    dispose: () => {
      disposed = true;
      for (const entry of scheduled) entry.cancelled = true;
      scheduled.length = 0;
    },
  });
}

/** Detached decoded input retained by the deterministic drag harness. */
export interface KanbanDragHarness {
  /** Appends one sanitized mouse, wheel, or focus event and ignores payload-bearing input. */
  accept(event: unknown): void;
  /** Returns a frozen copy of accepted payload-free events. */
  events(): readonly KanbanDragHarnessEvent[];
  /** Clears all retained events. */
  dispose(): void;
}

/** Payload-free input kinds retained by the public host harness. */
export type KanbanDragHarnessEvent = MouseEvent | FocusEvent | WheelEvent;

/** Detaches one bounded semantic host event without retaining key or paste payloads. */
function sanitizedDragEvent(event: unknown): KanbanDragHarnessEvent | undefined {
  if (typeof event !== 'object' || event === null) return undefined;
  const type = Reflect.get(event, 'type');
  if (type === 'focus') {
    const focused = Reflect.get(event, 'focused');
    return typeof focused === 'boolean' ? Object.freeze({ type, focused }) : undefined;
  }
  if (type === 'wheel') {
    const dir = Reflect.get(event, 'dir');
    const x = Reflect.get(event, 'x');
    const y = Reflect.get(event, 'y');
    const ctrl = Reflect.get(event, 'ctrl');
    const alt = Reflect.get(event, 'alt');
    const shift = Reflect.get(event, 'shift');
    if (
      (dir !== 'up' && dir !== 'down') ||
      typeof x !== 'number' ||
      !Number.isSafeInteger(x) ||
      typeof y !== 'number' ||
      !Number.isSafeInteger(y) ||
      (ctrl !== undefined && typeof ctrl !== 'boolean') ||
      (alt !== undefined && typeof alt !== 'boolean') ||
      (shift !== undefined && typeof shift !== 'boolean')
    ) {
      return undefined;
    }
    return Object.freeze({ type, dir, x, y, ctrl: ctrl === true, alt: alt === true, shift: shift === true });
  }
  if (type !== 'mouse') return undefined;
  const kind = Reflect.get(event, 'kind');
  const button = Reflect.get(event, 'button');
  const x = Reflect.get(event, 'x');
  const y = Reflect.get(event, 'y');
  const ctrl = Reflect.get(event, 'ctrl');
  const alt = Reflect.get(event, 'alt');
  const shift = Reflect.get(event, 'shift');
  if (
    (kind !== 'down' && kind !== 'drag' && kind !== 'up' && kind !== 'move') ||
    typeof button !== 'number' ||
    !Number.isSafeInteger(button) ||
    typeof x !== 'number' ||
    !Number.isSafeInteger(x) ||
    typeof y !== 'number' ||
    !Number.isSafeInteger(y) ||
    (ctrl !== undefined && typeof ctrl !== 'boolean') ||
    (alt !== undefined && typeof alt !== 'boolean') ||
    (shift !== undefined && typeof shift !== 'boolean')
  ) {
    return undefined;
  }
  return Object.freeze({ type, kind, button, x, y, ctrl: ctrl === true, alt: alt === true, shift: shift === true });
}

/**
 * Creates a bounded decoded-event collector for host and drag tests.
 *
 * @example
 * ```ts
 * const harness = createKanbanDragHarness();
 * harness.accept({ type: 'focus', focused: false });
 * harness.dispose();
 * ```
 */
export function createKanbanDragHarness(maximumEvents = 64): KanbanDragHarness {
  if (!Number.isSafeInteger(maximumEvents) || maximumEvents < 1 || maximumEvents > 1_024) {
    throw new RangeError('Invalid Kanban drag-harness event limit.');
  }
  const events: KanbanDragHarnessEvent[] = [];
  let disposed = false;
  return Object.freeze({
    accept: (event: unknown) => {
      if (disposed || events.length >= maximumEvents) return;
      const sanitized = sanitizedDragEvent(event);
      if (sanitized !== undefined) events.push(sanitized);
    },
    events: () => Object.freeze([...events]),
    dispose: () => {
      disposed = true;
      events.length = 0;
    },
  });
}

/**
 * Returns the canonical bounded SGR trace used for cross-host semantic parity.
 *
 * @example
 * ```ts
 * const trace = createKanbanStandardPointerTrace();
 * await replayKanbanSemanticPointerTrace(trace, { transport: 'direct' });
 * ```
 */
export function createKanbanStandardPointerTrace(): KanbanSemanticPointerTrace {
  return Object.freeze({
    input:
      '\u001b[<0;3;5M\u001b[<0;3;5m\u001b[<65;3;5M\u001b[<64;3;5M' +
      '\u001b[<0;3;10M\u001b[<32;5;10M\u001b[<32;78;12M\u001b[O\u001b[I' +
      '\u001b[<0;3;5M\u001b[<32;5;5M\u001b[<32;21;9M\u001b[<0;21;9m',
  });
}

const HOST_CAPS = resolveCapabilities({
  env: {},
  platform: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
  override: { mouse: { sgr: true, drag: true, wheel: true } },
}).profile;

/** Decodes one trace directly through the shared core decoder. */
function directEvents(trace: KanbanSemanticPointerTrace): readonly InputEvent[] {
  return decode(new TextEncoder().encode(trace.input), createDecoderState(), { caps: HOST_CAPS }).events;
}

/** Decodes one trace through the real browser host and headless xterm input surface. */
async function browserEvents(trace: KanbanSemanticPointerTrace): Promise<readonly InputEvent[]> {
  const [browserModule, xtermModule] = await Promise.all([import('@jsvision/web'), import('@xterm/headless')]).catch(
    (): never => {
      throw new Error(
        'Browser Kanban host evidence requires caller-installed development dependencies @jsvision/web and @xterm/headless.',
      );
    },
  );
  const { createBrowserHost } = browserModule;
  const xtermHeadless = xtermModule.default;
  const { Terminal } = xtermHeadless;
  const terminal = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  const harness = createKanbanDragHarness();
  const host = createBrowserHost({ term: terminal, caps: HOST_CAPS, onInput: (event) => harness.accept(event) });
  try {
    host.start();
    terminal.input(trace.input);
    return harness.events();
  } finally {
    host.dispose();
    harness.dispose();
    terminal.dispose();
  }
}

/** Sanitized native child response; raw terminal output is never returned to callers. */
interface NativeChildResult {
  readonly tty: boolean;
  readonly semantic: KanbanSemanticPointerResult['semantic'];
}

/** Validates the fixed payload-free semantic envelope emitted by the isolated native child. */
function nativeSemanticResult(value: unknown): KanbanSemanticPointerResult['semantic'] | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const thresholdCrossed = Reflect.get(value, 'thresholdCrossed');
  const observedSteps = Reflect.get(value, 'observedSteps');
  const targetChanges = Reflect.get(value, 'targetChanges');
  const autoscroll = Reflect.get(value, 'autoscroll');
  const cancellations = Reflect.get(value, 'cancellations');
  const proposal = Reflect.get(value, 'proposal');
  if (
    thresholdCrossed !== true ||
    !Array.isArray(observedSteps) ||
    observedSteps.join('|') !== 'mixed-height|click|wheel|grab|pointer-moves|gap-transition|drop|post-drop-redraw' ||
    !Array.isArray(targetChanges) ||
    targetChanges.length !== 1 ||
    targetChanges[0] !== 'allowed:doing/alpha' ||
    !Array.isArray(autoscroll) ||
    autoscroll.length !== 1 ||
    autoscroll[0] !== 'right:slow' ||
    !Array.isArray(cancellations) ||
    cancellations.length !== 1 ||
    cancellations[0] !== 'focus-lost' ||
    typeof proposal !== 'object' ||
    proposal === null ||
    Reflect.get(proposal, 'kind') !== 'card-move' ||
    Reflect.get(proposal, 'columnId') !== 'doing' ||
    Reflect.get(proposal, 'swimlaneId') !== 'alpha' ||
    Reflect.get(proposal, 'position') !== 'after'
  ) {
    return undefined;
  }
  const movedCardKeys = Reflect.get(proposal, 'movedCardKeys');
  if (!Array.isArray(movedCardKeys) || movedCardKeys.length !== 1 || movedCardKeys[0] !== 1) return undefined;
  return Object.freeze({
    thresholdCrossed,
    observedSteps: Object.freeze([
      'mixed-height' as const,
      'click' as const,
      'wheel' as const,
      'grab' as const,
      'pointer-moves' as const,
      'gap-transition' as const,
      'drop' as const,
      'post-drop-redraw' as const,
    ]),
    targetChanges: Object.freeze(['allowed:doing/alpha']),
    autoscroll: Object.freeze(['right:slow']),
    cancellations: Object.freeze(['focus-lost']),
    proposal: Object.freeze({
      kind: 'card-move' as const,
      movedCardKeys: Object.freeze([1]),
      columnId: 'doing',
      swimlaneId: 'alpha',
      position: 'after' as const,
    }),
  });
}

/** Replays one trace through a real node-pty Unix PTY or Windows ConPTY child. */
async function nativeEvents(trace: KanbanSemanticPointerTrace): Promise<NativeChildResult> {
  let nodePty: typeof import('node-pty');
  try {
    nodePty = await import('node-pty');
  } catch {
    throw new Error('Native Kanban host evidence requires the caller-installed development dependency node-pty.');
  }
  const packagedChild = fileURLToPath(new URL('./phase-c-host-child.mjs', import.meta.url));
  const sourceTreeChild = fileURLToPath(new URL('../../test/e2e/fixtures/phase-c-host-child.mjs', import.meta.url));
  const childPath = existsSync(sourceTreeChild) ? sourceTreeChild : packagedChild;
  return new Promise((resolvePromise, rejectPromise) => {
    const child = nodePty.spawn(process.execPath, [childPath], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: { ...process.env, JSVISION_KANBAN_HOST_CHILD: '1' },
    });
    let output = '';
    let sent = false;
    let settled = false;
    const guard = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      rejectPromise(new Error('Kanban native host fixture timed out.'));
    }, 10_000);
    const finish = (result: NativeChildResult | Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      child.kill();
      if (result instanceof Error) rejectPromise(result);
      else resolvePromise(result);
    };
    child.onData((chunk) => {
      output = `${output}${chunk}`.slice(-16_384);
      if (!sent && output.includes('JSVISION_KANBAN_READY')) {
        sent = true;
        child.write(trace.input);
      }
      const match = /JSVISION_KANBAN_RESULT:([A-Za-z0-9+/=]+)/u.exec(output);
      if (match?.[1] !== undefined) {
        try {
          const decoded: unknown = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
          if (typeof decoded !== 'object' || decoded === null) throw new Error('Invalid native result.');
          const tty = Reflect.get(decoded, 'tty');
          const semantic = nativeSemanticResult(Reflect.get(decoded, 'semantic'));
          if (tty !== true || semantic === undefined) throw new Error('Native host evidence was invalid.');
          finish({ tty, semantic });
        } catch {
          finish(new Error('Invalid Kanban native host result.'));
        }
      }
    });
    child.onExit(({ exitCode }) => {
      if (!settled && exitCode !== 0) finish(new Error('Kanban native host fixture failed.'));
    });
  });
}

/** Converts decoded events to stable semantic drag facts without retaining raw bytes. */
/**
 * Replays the standard trace through one honest host adapter and returns sanitized semantic evidence.
 *
 * @example
 * ```ts
 * const result = await replayKanbanSemanticPointerTrace(createKanbanStandardPointerTrace(), {
 *   transport: 'browser-xterm',
 * });
 * ```
 */
export async function replayKanbanSemanticPointerTrace(
  trace: KanbanSemanticPointerTrace,
  options: { readonly transport: KanbanSemanticTraceTransport },
): Promise<KanbanSemanticPointerResult> {
  const input = typeof trace?.input === 'string' && trace.input.length <= 4_096 ? trace.input : undefined;
  if (input === undefined) throw new RangeError('Invalid Kanban semantic pointer trace.');
  const snapshot = Object.freeze({ input });
  let semantic: KanbanSemanticPointerResult['semantic'];
  let terminal: KanbanSemanticHostEvidence['terminal'];
  if (options.transport === 'direct') {
    semantic = await deriveKanbanSemanticHostBoardResult(directEvents(snapshot));
    terminal = 'direct';
  } else if (options.transport === 'browser-xterm') {
    semantic = await deriveKanbanSemanticHostBoardResult(await browserEvents(snapshot));
    terminal = 'xterm-headless';
  } else {
    const expectedPlatform = options.transport === 'windows-conpty' ? 'win32' : process.platform;
    if (
      (options.transport === 'windows-conpty' && process.platform !== 'win32') ||
      (options.transport === 'unix-pty' && process.platform === 'win32')
    ) {
      throw new Error('Requested native Kanban transport is unavailable on this platform.');
    }
    const native = await nativeEvents(snapshot);
    if (!native.tty) throw new Error('Native Kanban evidence was pipe-backed.');
    semantic = native.semantic;
    terminal = options.transport === 'windows-conpty' ? 'conpty' : 'pty';
    if (process.platform !== expectedPlatform) throw new Error('Native Kanban platform evidence mismatched.');
  }
  return Object.freeze({
    evidence: Object.freeze({ transport: options.transport, terminal, pipeBacked: false, platform: process.platform }),
    semantic,
  });
}
