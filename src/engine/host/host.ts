/**
 * The `createHost` orchestrator (RD-07, plan doc 03-01).
 *
 * Ties the bound streams, the resolved runtime adapter, RD-06's `decode()`, and
 * RD-04's `serialize()` into a running terminal application: `start()` takes over
 * the terminal (raw mode + enter-mode), the input pump turns stdin bytes into
 * `onInput` events (routing query replies away and owning the lone-ESC flush
 * timer, AR-14), `render()` diffs each frame to a single coalesced write (AR-3),
 * and `stop()` restores the terminal without exiting (AR-8). Signal handling,
 * the guaranteed/panic restore, and the EPIPE path are wired in Phase 4.
 *
 * The `.js` extensions in the import specifiers are required by NodeNext ESM
 * resolution (they resolve to the `.ts` sources during development via tsx).
 */
import { bindStreams } from './streams.js';
import type { BoundStreams } from './streams.js';
import { enterMode, leaveMode } from './modes.js';
import { realRuntime } from './platform.js';
import type { Host, HostOptions, RuntimeAdapter, TimerHandle } from './types.js';
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

/**
 * Create a terminal host. Wires caps→modes, stdin→decode→dispatch, and
 * buffer→serialize→write, and restores the terminal on `stop()`. [AR-1]
 *
 * @param options - host configuration; only `caps` is required.
 * @returns a {@link Host}; call `start()` to take over the terminal.
 */
export function createHost(options: HostOptions): Host {
  const caps = options.caps;
  const modeOpts = { focus: options.focus };

  let running = false;
  let streams: BoundStreams | null = null;
  let adapter: RuntimeAdapter | null = null;
  let decoderState: DecoderState = createDecoderState();
  let prev: ScreenBuffer | null = null;
  let escTimer: TimerHandle | null = null;
  let isTTY = false;
  let dataListener: ((chunk: Uint8Array | string) => void) | null = null;

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
    if (carry.length === 1 && carry[0] === ESC) {
      // A lone trailing ESC: arm the disambiguation timer; new bytes cancel it (AR-14).
      escTimer = adapter.setTimer(() => {
        escTimer = null;
        const flushed = flush(decoderState, { caps });
        decoderState = flushed.state;
        dispatch(flushed.events);
      }, ESC_TIMEOUT_MS);
    }
  }

  function start(): Promise<void> {
    if (running) return Promise.resolve();
    running = true;
    streams = bindStreams(options);
    isTTY = streams.isTTY;
    // Resolve the adapter after binding so the real one is bound to the output (PF-010).
    adapter = options.runtime ?? realRuntime(streams.output);
    if (isTTY) {
      adapter.setRawMode(streams.input, true);
      streams.output.write(enterMode(caps, modeOpts));
    }
    dataListener = (chunk: Uint8Array | string): void => onData(chunk);
    streams.input.on('data', dataListener);
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
    if (streams && adapter && isTTY) {
      streams.output.write(leaveMode(caps, modeOpts));
      adapter.setRawMode(streams.input, false);
    }
    streams?.dispose();
    streams = null;
    adapter = null;
    return Promise.resolve();
  }

  function render(next: ScreenBuffer): void {
    if (!streams) return;
    const out = serialize(next, prev, { caps });
    if (out) streams.output.write(out);
    prev = next;
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
