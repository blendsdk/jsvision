/**
 * The `createHost` orchestrator (RD-07, plan doc 03-01).
 *
 * Ties the bound streams, the resolved runtime adapter, RD-06's `decode()`, and
 * RD-04's `serialize()` into a running terminal application: `start()` takes over
 * the terminal (raw mode + enter-mode), the input pump turns stdin bytes into
 * `onInput` events (routing query replies away and owning the lone-ESC flush
 * timer, AR-14), `render()` diffs each frame to a single coalesced write (AR-3),
 * and signals/restore/EPIPE guarantee the terminal is restored on **every** exit
 * path (AR-6, AR-16, AR-17). `stop()` restores without exiting (AR-8).
 *
 * All exit paths funnel through one idempotent restore plus a shared
 * {@link handleFatal} crash path (PF-002/PF-008), and the adapter is resolved
 * after `bindStreams()` so the real one is bound to the output (PF-010).
 *
 * The `.js` extensions in the import specifiers are required by NodeNext ESM
 * resolution (they resolve to the `.ts` sources during development via tsx).
 */
import { bindStreams } from './streams.js';
import type { BoundStreams } from './streams.js';
import { createTerminalQuery } from './terminal-query.js';
import { warnIfAmbiguousWide, degradeCapsForWidth, degradeCapsFully, isAsciiSafe } from './width-probe.js';
import { enterMode, leaveMode } from './modes.js';
import { realRuntime } from './platform.js';
import { createRestore } from './restore.js';
import type { GuaranteedRestore } from './restore.js';
import { installSignals } from './signals.js';
import type { Host, HostOptions, RuntimeAdapter, TimerHandle } from './types.js';
import type { CapabilityProfile } from '../capability/profile.js';
import { createDecoderState, decode, flush } from '../input/decoder.js';
import { ESC_TIMEOUT_MS } from '../input/events.js';
import type { DecoderState, InputEvent } from '../input/events.js';
import { serialize } from '../render/serialize.js';
import type { ScreenBuffer } from '../render/buffer.js';

const ESC = 0x1b;

/** Normalize a stdin chunk (Buffer/Uint8Array or string) to the bytes `decode` expects. */
function toBytes(chunk: Uint8Array | string): Uint8Array {
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
  return chunk; // Buffer is a Uint8Array.
}

/** Render an unknown thrown value to a stderr-safe diagnostic line (never raw input, PF-002). */
function formatError(err: unknown): string {
  if (err instanceof Error) return `${err.stack ?? err.message}\n`;
  return `${String(err)}\n`;
}

/** Whether a thrown value is an EPIPE error (a pipe disconnect, AR-16). */
function isEpipe(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'EPIPE';
}

/** A warning sink that swallows the message — used when adaptation runs but warning is off. */
const noopWarn = (): void => {};

/**
 * Create a terminal host. Wires caps→modes, stdin→decode→dispatch, and
 * buffer→serialize→write, and guarantees terminal restore on every exit path. [AR-1]
 *
 * @param options - host configuration; only `caps` is required.
 * @returns a {@link Host}; call `start()` to take over the terminal.
 */
export function createHost(options: HostOptions): Host {
  const caps = options.caps;
  const modeOpts = { focus: options.focus };

  // The EFFECTIVE serialize caps: what render() and the resume repaint emit with.
  // `JSVISION_ASCII` (presence = on, NO_COLOR-style) forces full ASCII-safe chrome at
  // creation and skips the probe; otherwise start()'s probe may adapt it (AR-8/AR-15).
  const forceAscii = (options.env ?? process.env).JSVISION_ASCII !== undefined;
  let effectiveCaps: CapabilityProfile = forceAscii ? degradeCapsFully(caps) : caps;

  let running = false;
  let streams: BoundStreams | null = null;
  let adapter: RuntimeAdapter | null = null;
  let restore: GuaranteedRestore | null = null;
  let decoderState: DecoderState = createDecoderState();
  let prev: ScreenBuffer | null = null;
  let lastBuffer: ScreenBuffer | null = null;
  let escTimer: TimerHandle | null = null;
  let isTTY = false;
  let dataListener: ((chunk: Uint8Array | string) => void) | null = null;
  let errorListener: ((err: unknown) => void) | null = null;
  let signalsTeardown: (() => void) | null = null;
  let unsubUncaught: (() => void) | null = null;
  let unsubRejection: (() => void) | null = null;

  /** Deliver decoded events to the app (query replies never reach here). */
  function dispatch(events: readonly InputEvent[]): void {
    const onInput = options.onInput;
    if (!onInput) return;
    for (const event of events) onInput(event);
  }

  /** Disarm the lone-ESC flush timer if armed. */
  function clearEscTimer(): void {
    if (escTimer !== null && adapter) {
      adapter.clearTimer(escTimer);
      escTimer = null;
    }
  }

  /** The input pump: bytes → decode → dispatch, managing the lone-ESC timer (AR-14). */
  function onData(chunk: Uint8Array | string): void {
    if (!adapter) return;
    const result = decode(toBytes(chunk), decoderState, { caps });
    decoderState = result.state;
    dispatch(result.events);
    // result.queries are intentionally dropped — routed away from onInput (AR-2).
    clearEscTimer();
    const carry = decoderState.carry;
    // HR-24: arm the flush timer whenever the carry BEGINS with ESC (any length), not only for a
    // lone ESC. A carried `ESC [` (Alt+`[`) or `ESC O` otherwise waits forever and fuses with the
    // next keypress into a phantom CSI/SS3; the timer flushes it as an Alt-prefixed / bare escape.
    if (carry.length >= 1 && carry[0] === ESC) {
      // A trailing ESC-prefixed carry: arm the disambiguation timer; new bytes cancel it (AR-14).
      escTimer = adapter.setTimer(() => {
        escTimer = null;
        const flushed = flush(decoderState, { caps });
        decoderState = flushed.state;
        dispatch(flushed.events);
      }, ESC_TIMEOUT_MS);
    }
  }

  /** Shared crash path: restore → print error → onBeforeExit(1) → exit 1 (PF-002/PF-008). */
  function handleFatal(err: unknown): void {
    if (!adapter) return;
    restore?.run();
    adapter.writeError(formatError(err));
    options.onBeforeExit?.(1);
    adapter.exit(1);
  }

  /** The bound output's `'error'` handler: EPIPE is a clean end, everything else is fatal (AR-16). */
  function onOutputError(err: unknown): void {
    if (!adapter) return;
    if (isEpipe(err)) {
      restore?.run(); // best-effort; secondary failures swallowed inside run()
      options.onBeforeExit?.(0);
      adapter.exit(0); // a disconnect is an expected end
    } else {
      handleFatal(err); // no throw inside the listener (PF-008)
    }
  }

  /**
   * Probe the primary screen for double-width chrome glyphs, then adapt effective
   * caps and/or warn (best-effort). One probe run feeds both concerns: `adapted`
   * selects the warning variant, a disabled warning uses a no-op sink, and when
   * adaptation is enabled the effective caps are downgraded for the wide groups.
   *
   * Owns the query seam's lifecycle: it always closes the seam — detaching the
   * probe's input listener before the host's own input pump attaches — and never
   * throws, so a detection failure can neither block nor crash startup.
   */
  async function probeWidthAdaptAndWarn(input: NodeJS.ReadStream, output: NodeJS.WriteStream): Promise<void> {
    const query = createTerminalQuery({ input, output });
    const adapt = options.adaptAmbiguousWidth === true;
    try {
      const result = await warnIfAmbiguousWide(query, {
        // Warning off ⇒ no-op sink; on ⇒ default stderr sink unless an override is given.
        warn: options.warnAmbiguousWidth ? options.onWidthWarning : noopWarn,
        adapted: adapt,
      });
      if (adapt) {
        effectiveCaps = degradeCapsForWidth(effectiveCaps, result);
      }
    } catch {
      // Best-effort: a probe failure must never block or crash startup.
    } finally {
      query.close();
    }
  }

  async function start(): Promise<void> {
    if (running) return;
    running = true;
    // HR-15: reset the render diff baseline and decoder carry on every start, so a stop()→start()
    // restart paints a FULL first frame onto the fresh alt-screen (diffing against a stale `prev`
    // would paint garbage) and no pre-restart ESC carry fuses into the first post-restart key.
    // Done at start() (not stop()) so a crash between the two can never leave a half-reset state.
    prev = null;
    lastBuffer = null;
    decoderState = createDecoderState();
    streams = bindStreams(options);
    isTTY = streams.isTTY;
    // Resolve the adapter after binding so the real one is bound to the output (PF-010).
    adapter = options.runtime ?? realRuntime(streams.output);

    const enterStr = enterMode(caps, modeOpts);
    const leaveStr = leaveMode(caps, modeOpts);

    // Create restore + register the panic backstop FIRST, so a crash mid-setup still restores (AR-17).
    restore = createRestore({
      adapter,
      output: streams.output,
      input: streams.input,
      caps,
      focus: options.focus,
      isTTY,
    });
    unsubUncaught = adapter.onUncaughtException((err) => handleFatal(err));
    unsubRejection = adapter.onUnhandledRejection((reason) => handleFatal(reason));

    if (isTTY) {
      adapter.setRawMode(streams.input, true);
      // Width probe runs in this window — raw mode on, alt-screen not yet entered —
      // so the probe glyphs + their erase happen on the primary screen (PF: width).
      // Skipped when effective caps are already fully ASCII-safe (env-forced,
      // already-degraded, or utf8-off) — nothing to learn or swap (AR-13, PF-003).
      if ((options.warnAmbiguousWidth || options.adaptAmbiguousWidth) && !isAsciiSafe(effectiveCaps)) {
        await probeWidthAdaptAndWarn(streams.input, streams.output);
      }
      streams.output.write(enterStr); // a throw here is caught by the 'exit' backstop (AR-17)
    }

    signalsTeardown = installSignals({
      adapter,
      output: streams.output,
      input: streams.input,
      restore,
      enterStr,
      leaveStr,
      isTTY,
      onResize: options.onResize,
      onSuspend: options.onSuspend,
      onResume: options.onResume,
      exitOnSignal: options.exitOnSignal !== false,
      onBeforeExit: options.onBeforeExit,
      getLastBuffer: () => lastBuffer,
      // The resume repaint must use the same (possibly adapted) caps as render() (PF-001).
      getSerializeCaps: () => effectiveCaps,
    });

    dataListener = (chunk: Uint8Array | string): void => onData(chunk);
    streams.input.on('data', dataListener);
    errorListener = (err: unknown): void => onOutputError(err);
    streams.output.on('error', errorListener);
    return Promise.resolve();
  }

  function stop(): Promise<void> {
    if (!running) return Promise.resolve();
    running = false;
    clearEscTimer();
    if (streams && dataListener) {
      streams.input.removeListener('data', dataListener);
      dataListener = null;
    }
    if (streams && errorListener) {
      streams.output.removeListener('error', errorListener);
      errorListener = null;
    }
    signalsTeardown?.();
    signalsTeardown = null;
    unsubUncaught?.();
    unsubUncaught = null;
    unsubRejection?.();
    unsubRejection = null;
    restore?.run(); // idempotent leave-mode + raw off (gated on isTTY)
    restore?.teardown(); // remove the 'exit' backstop
    restore = null;
    streams?.dispose();
    streams = null;
    adapter = null;
    return Promise.resolve();
  }

  function render(next: ScreenBuffer): void {
    if (!streams) return;
    // Effective caps swap wide chrome to ASCII when the probe/env adapted them (AR-4).
    const out = serialize(next, prev, { caps: effectiveCaps });
    if (out) streams.output.write(out);
    // Snapshot the rendered frame: callers may pass a single LIVE buffer they keep mutating in place
    // (e.g. the UI loop's `renderRoot.buffer()`), so aliasing it as `prev` would diff the next frame
    // against itself — an empty diff that freezes the screen. `lastBuffer` may stay a live reference:
    // the resume path full-repaints it against `null`, so it should reflect the latest screen state.
    prev = next.clone();
    lastBuffer = next;
  }

  return {
    get isTTY(): boolean {
      return isTTY;
    },
    start,
    stop,
    render,
  };
}
