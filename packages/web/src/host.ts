/**
 * `createBrowserHost` — a browser host that drives an [xterm.js](https://xtermjs.org) terminal in
 * place of the native `tty` host, so any JSVision app renders in a browser tab with no backend.
 *
 * It reuses the engine's **pure** core wholesale — `serialize()` (damage-diff → ANSI), `decode()` /
 * `flush()` (bytes → input events), and `cursor` (caret sequences) — and replaces only the OS boundary:
 *
 *   - **out:** `render(buffer)` diffs against the previous frame and writes the resulting ANSI delta to
 *     the terminal — exactly what the native host writes to stdout.
 *   - **in:**  the terminal's `onData` hands back the ANSI bytes a keystroke/mouse-click produced
 *     (`\x1b[A`, SGR mouse reports, bracketed paste); those feed straight into `decode()`. A lone-ESC
 *     disambiguation timer mirrors the native host: a carried leading-ESC is flushed after
 *     `ESC_TIMEOUT_MS`, so a bare Escape (or an Alt-prefix) never fuses with the next key.
 *
 * The whole browser port is this one boundary swap: the pure render/decode contract is the ANSI byte
 * stream, which is precisely xterm.js's input and output contract.
 */
import { serialize, decode, flush, createDecoderState, cursor, ESC_TIMEOUT_MS } from '@jsvision/core';
import type { CapabilityProfile, ScreenBuffer, InputEvent, TimerHandle } from '@jsvision/core';

/** The byte value of ESC (0x1b); a leading-ESC carry arms the disambiguation timer. */
const ESC = 0x1b;

/**
 * DECSET modes the native host enables at startup, minus the alternate screen (a browser demo owns the
 * whole terminal). Sent once from `start()` so the terminal reports mouse in SGR form and brackets
 * pastes — matching the caps handed to the decoder. The cursor is hidden here; the caret sink re-shows
 * it only while a text control is focused.
 */
const ENTER_MODES =
  '\x1b[?1006h' + // SGR mouse encoding
  '\x1b[?1000h' + // basic button tracking
  '\x1b[?1002h' + // button-event tracking (drag)
  '\x1b[?2004h' + // bracketed paste
  '\x1b[?1004h' + // focus reporting
  '\x1b[?7l' + //   line-wrap off
  '\x1b[?25l'; //   hide cursor (the caret sink re-shows it on demand)

/**
 * The narrow slice of an xterm.js terminal the host (and `mountApp`) actually touch, declared as a
 * local structural interface so that **both** a real `@xterm/xterm` terminal **and** an
 * `@xterm/headless` terminal satisfy it. A concrete `@xterm/xterm` `Terminal` carries DOM-only members
 * (`focus`/`blur`/`element`/`textarea`/…) that `@xterm/headless` lacks; annotating against it would
 * reject the headless test terminal, so the host stays free of any `@xterm/xterm` import.
 */
export interface TerminalLike {
  /** Write a string (ANSI/text) to the terminal. */
  write(data: string): void;
  /** Subscribe to input bytes the terminal produced; returns a disposer. */
  onData(handler: (data: string) => void): { dispose(): void };
  /** Subscribe to terminal resize; returns a disposer. */
  onResize(handler: (size: { cols: number; rows: number }) => void): { dispose(): void };
  /** Present on a DOM terminal, absent on `@xterm/headless` — always call it optionally. */
  focus?(): void;
  /** Present on a DOM terminal — tear the terminal down. */
  dispose?(): void;
}

/**
 * A minimal timer seam. Defaults to the global `setTimeout`/`clearTimeout`; a test injects a
 * deterministic fake so the lone-ESC flush is verified without a wall-clock wait. The handle is opaque
 * (whatever `setTimeout` returns on the host platform).
 */
interface TimerSeam {
  setTimeout(handler: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

/** The default timer seam over the platform's global timers (browser: number; Node: NodeJS.Timeout). */
const defaultTimer: TimerSeam = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  // The handle round-trips as the opaque TimerHandle; at runtime it is whatever setTimeout returned.
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/** A 0-based absolute caret cell, matching the event loop's `onCaret` payload. */
export interface CaretCell {
  readonly x: number;
  readonly y: number;
}

/** The browser host surface wired to the event loop. */
export interface BrowserHost {
  /** Enable input modes and start pumping terminal bytes into the decoder. */
  start(): void;
  /** Diff `buffer` against the previous frame and write the ANSI delta to the terminal. */
  render(buffer: ScreenBuffer): void;
  /** Position (or hide, when `null`) the hardware caret — wire to the loop's `onCaret`. */
  setCaret(cell: CaretCell | null): void;
}

/** Options for {@link createBrowserHost}. */
export interface BrowserHostOptions {
  /** The terminal to render into and read input from (any object satisfying {@link TerminalLike}). */
  readonly term: TerminalLike;
  /** The capability profile driving `serialize()`/`decode()` (build one with `buildBrowserCaps`). */
  readonly caps: CapabilityProfile;
  /** Sink for decoded input events (wire to `loop.dispatch`). */
  readonly onInput: (event: InputEvent) => void;
  /** Timer seam; defaults to the global timers. Inject a fake to drive the lone-ESC flush in tests. */
  readonly timer?: TimerSeam;
}

/**
 * Build a {@link BrowserHost} over an xterm.js-style terminal.
 *
 * Call `start()` once, then `render()` each frame and `setCaret()` on each caret update. The bytes
 * `render()` writes with no previous frame equal `serialize(buffer, null, { caps })` exactly — the
 * engine is reused, not reimplemented.
 *
 * @param options - the terminal, the capability profile, the input sink, and an optional timer seam.
 * @returns the host handle.
 *
 * @example
 * import { Terminal } from '@xterm/xterm';
 * import { createBrowserHost, buildBrowserCaps } from '@jsvision/web';
 * import { createEventLoop, Group } from '@jsvision/ui';
 *
 * const term = new Terminal({ allowProposedApi: true });
 * term.open(document.getElementById('terminal')!);
 * const caps = buildBrowserCaps();
 *
 * const loop = createEventLoop({ width: 80, height: 24 }, { caps });
 * loop.mount(new Group());
 *
 * const host = createBrowserHost({ term, caps, onInput: (event) => loop.dispatch(event) });
 * host.start();
 * host.render(loop.renderRoot.buffer()); // paint the first frame
 */
export function createBrowserHost(options: BrowserHostOptions): BrowserHost {
  const { term, caps, onInput } = options;
  const timer = options.timer ?? defaultTimer;
  const encoder = new TextEncoder();

  let previous: ScreenBuffer | null = null;
  let decoderState = createDecoderState();
  let escTimer: TimerHandle | null = null;

  /** Disarm the lone-ESC flush timer if armed (a new byte cancels it). */
  function clearEscTimer(): void {
    if (escTimer !== null) {
      timer.clearTimeout(escTimer);
      escTimer = null;
    }
  }

  /** The input pump: terminal string → bytes → decode → dispatch, managing the ESC timer. */
  function pump(data: string): void {
    const result = decode(encoder.encode(data), decoderState, { caps });
    decoderState = result.state;
    for (const event of result.events) onInput(event);

    clearEscTimer();
    const carry = decoderState.carry;
    // A trailing ESC-prefixed carry: flush it as a bare/Alt escape once the disambiguation gap elapses.
    if (carry.length >= 1 && carry[0] === ESC) {
      escTimer = timer.setTimeout(() => {
        escTimer = null;
        const flushed = flush(decoderState, { caps });
        decoderState = flushed.state;
        for (const event of flushed.events) onInput(event);
      }, ESC_TIMEOUT_MS);
    }
  }

  return {
    start(): void {
      term.write(ENTER_MODES);
      term.onData(pump);
    },
    render(buffer: ScreenBuffer): void {
      const out = serialize(buffer, previous, { caps });
      if (out) term.write(out);
      // The loop hands one LIVE buffer it keeps mutating, so snapshot an alias-free clone (as the
      // native host does) — otherwise the next diff compares the frame against itself.
      previous = buffer.clone();
    },
    setCaret(cell: CaretCell | null): void {
      term.write(cell === null ? cursor.hide() : cursor.show() + cursor.to(cell.y + 1, cell.x + 1));
    },
  };
}
