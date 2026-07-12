/**
 * The terminal host — the object that takes over a real terminal and runs your
 * app's render/input loop, then guarantees the terminal is handed back.
 *
 * {@link createHost} ties together stream binding, input decoding, and frame
 * serialization: `start()` enters raw mode and full-screen mode, the input pump
 * turns stdin bytes into decoded `onInput` events (handling terminal query
 * replies and the lone-ESC disambiguation timer for you), `render()` diffs each
 * frame down to a single coalesced write, and the signal/crash/EPIPE handlers
 * restore the terminal on **every** exit path — normal, thrown, or signalled.
 * `stop()` restores the terminal without exiting the process.
 */
import { bindStreams } from './streams.js';
import type { BoundStreams } from './streams.js';
import { createTerminalQuery } from './terminal-query.js';
import { warnIfAmbiguousWide, degradeCapsForWidth, degradeCapsFully, isAsciiSafe } from './width-probe.js';
import { enterMode, leaveMode } from './modes.js';
import { realRuntime } from './platform.js';
import { createRestore } from './restore.js';
import type { GuaranteedRestore } from './restore.js';
import { createInputDiagnostics } from './diagnostics.js';
import type { InputDiagnostics } from './diagnostics.js';
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

/** Render an unknown thrown value to a stderr-safe diagnostic line (never raw input). */
function formatError(err: unknown): string {
  if (err instanceof Error) return `${err.stack ?? err.message}\n`;
  return `${String(err)}\n`;
}

/** Whether a thrown value is an EPIPE error (the output pipe was disconnected). */
function isEpipe(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'EPIPE';
}

/** A warning sink that swallows the message — used when adaptation runs but warning is off. */
const noopWarn = (): void => {};

/**
 * Create a terminal host. It wires the capability profile to the terminal modes
 * it enables, stdin to the input decoder, and each frame to a diffed write, and
 * it guarantees the terminal is restored on every exit path.
 *
 * The returned host is idle until you `await host.start()`. Only `caps` is
 * required; pass `onInput`/`onResize` to receive events, and drive the screen by
 * building a {@link ScreenBuffer} and calling `host.render(buffer)`.
 *
 * @param options Host configuration; see {@link HostOptions}. Only `caps` is required.
 * @returns A {@link Host}; call `start()` to take over the terminal and `stop()` to give it back.
 * @example
 * import { createHost, resolveCapabilities, ScreenBuffer } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const host = createHost({
 *   caps,
 *   onInput: (event) => {
 *     if (event.type === 'key' && event.key === 'q') void host.stop();
 *   },
 *   onResize: (size) => console.error(`resized to ${size.columns}x${size.rows}`),
 * });
 *
 * await host.start(); // raw mode + alternate screen; terminal restored on any exit
 * const frame = new ScreenBuffer(20, 1, { fg: 'default', bg: 'default' });
 * frame.set(0, 0, 'Hello — press q', { fg: 'white', bg: 'default' });
 * host.render(frame);
 */
export function createHost(options: HostOptions): Host {
  const caps = options.caps;
  const modeOpts = { focus: options.focus };

  // The EFFECTIVE serialize caps: what render() and the resume repaint emit with.
  // `JSVISION_ASCII` (presence = on, NO_COLOR-style) forces full ASCII-safe chrome at
  // creation and skips the probe; otherwise start()'s probe may adapt it.
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
  let inputDiag: InputDiagnostics | null = null;
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

  /** The input pump: bytes → decode → dispatch, managing the lone-ESC disambiguation timer. */
  function onData(chunk: Uint8Array | string): void {
    if (!adapter) return;
    inputDiag?.noteInput(chunk);
    const result = decode(toBytes(chunk), decoderState, { caps });
    decoderState = result.state;
    dispatch(result.events);
    // Terminal query replies are intentionally dropped here — they never reach onInput.
    clearEscTimer();
    const carry = decoderState.carry;
    // Arm the flush timer whenever the leftover bytes BEGIN with ESC (any length), not only for a
    // lone ESC. A carried `ESC [` (Alt+`[`) or `ESC O` would otherwise wait forever and fuse with the
    // next keypress into a phantom control sequence; the timer flushes it as an Alt-prefixed / bare escape.
    if (carry.length >= 1 && carry[0] === ESC) {
      // A trailing ESC-prefixed carry: arm the disambiguation timer; new bytes cancel it.
      escTimer = adapter.setTimer(() => {
        escTimer = null;
        const flushed = flush(decoderState, { caps });
        decoderState = flushed.state;
        dispatch(flushed.events);
      }, ESC_TIMEOUT_MS);
    }
  }

  /** Shared crash path: restore the terminal → print the error → onBeforeExit(1) → exit 1. */
  function handleFatal(err: unknown): void {
    if (!adapter) return;
    restore?.run();
    adapter.writeError(formatError(err));
    options.onBeforeExit?.(1);
    adapter.exit(1);
  }

  /** The bound output's `'error'` handler: an EPIPE disconnect is a clean end, everything else is fatal. */
  function onOutputError(err: unknown): void {
    if (!adapter) return;
    if (isEpipe(err)) {
      restore?.run(); // best-effort; secondary failures swallowed inside run()
      options.onBeforeExit?.(0);
      adapter.exit(0); // a disconnect is an expected end
    } else {
      handleFatal(err); // never throw out of an error listener
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
    // Reset the render diff baseline and decoder carry on every start, so a stop()→start()
    // restart paints a FULL first frame onto the fresh alternate screen (diffing against a stale
    // `prev` would paint garbage) and no leftover ESC bytes from before the restart fuse into the
    // first key after it. Done here (not in stop()) so a crash between the two can never leave a
    // half-reset state.
    prev = null;
    lastBuffer = null;
    decoderState = createDecoderState();
    streams = bindStreams(options);
    isTTY = streams.isTTY;
    // Resolve the adapter after binding so the real one is bound to the actual output stream.
    adapter = options.runtime ?? realRuntime(streams.output);

    const enterStr = enterMode(caps, modeOpts);
    const leaveStr = leaveMode(caps, modeOpts);

    // Create restore + register the on-exit backstop FIRST, so a crash mid-setup still restores.
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
      // Run the width probe in this window — raw mode on, alternate screen not yet entered —
      // so the probe glyphs and their erase land on the primary screen, never the UI.
      // Skipped when the effective caps are already fully ASCII-safe (env-forced, already
      // degraded, or non-UTF-8) — there is nothing to learn or swap.
      if ((options.warnAmbiguousWidth || options.adaptAmbiguousWidth) && !isAsciiSafe(effectiveCaps)) {
        await probeWidthAdaptAndWarn(streams.input, streams.output);
      }
      streams.output.write(enterStr); // a throw here is still caught by the on-exit restore backstop
    }

    // Opt-in input diagnostics (JSVISION_INPUT_DIAG): record what the host sees —
    // TTY state, whether raw mode engaged, and the effective caps — so an
    // unresponsive launch (e.g. a Windows double-click) can be diagnosed from a file.
    inputDiag = createInputDiagnostics({
      env: options.env ?? process.env,
      input: streams.input,
      output: streams.output,
      hostIsTTY: isTTY,
      caps: effectiveCaps,
    });

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
      // The resume repaint must use the same (possibly width-adapted) caps as render().
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
      // Removing the last 'data' listener does not pause the stream: the flowing-mode ref it took on
      // the input handle persists and keeps the Node event loop alive, so the process would hang after
      // the app quits instead of returning to the shell. Pause to release that ref. Best-effort — a
      // teardown throw must never jump over the terminal restore below.
      try {
        streams.input.pause();
      } catch {
        /* releasing the input is best-effort; restore still runs */
      }
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
    inputDiag = null;
    return Promise.resolve();
  }

  function render(next: ScreenBuffer, trailer?: string): void {
    if (!streams) return;
    // The effective caps swap wide chrome to ASCII when the probe or env forced adaptation.
    const out = serialize(next, prev, { caps: effectiveCaps });
    // The trailer (e.g. the caret show+move) rides the SAME write as the damage: a separate write
    // lets the terminal repaint in the gap with the visible cursor parked at the last damage span.
    const payload = trailer === undefined ? out : out + trailer;
    if (payload) streams.output.write(payload);
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
