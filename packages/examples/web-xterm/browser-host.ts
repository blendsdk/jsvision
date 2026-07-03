/**
 * `createBrowserHost` — a browser "host" for jsvision, driving an
 * [xterm.js](https://xtermjs.org) `Terminal` in place of core's native `tty`
 * host (`@jsvision/core`'s `createHost`).
 *
 * It reuses core's **pure** engine wholesale — `serialize()` (damage-diff → ANSI),
 * `decode()`/`flush()` (bytes → input events), and `cursor` (caret sequences) — and
 * only replaces the OS boundary:
 *
 *   - **out:** `render(buffer)` diffs against the previous frame and `term.write()`s
 *     the resulting ANSI string — exactly what the native host writes to stdout.
 *   - **in:**  xterm's `onData` hands us the ANSI bytes a keystroke/mouse-click
 *     produced (`\x1b[A`, SGR mouse reports, bracketed paste); we feed them straight
 *     into `decode()`. The lone-ESC disambiguation timer mirrors the native host
 *     (`host.ts`, HR-24 / AR-14): a carried leading-ESC is flushed after
 *     `ESC_TIMEOUT_MS` so a bare Escape / Alt-prefix never fuses with the next key.
 *
 * This is the whole browser port: the pure render + decode contract is the ANSI
 * byte stream, which is precisely xterm.js's input and output contract.
 */
import { serialize, decode, flush, createDecoderState, cursor, ESC_TIMEOUT_MS } from '@jsvision/core';
import type { CapabilityProfile, ScreenBuffer, InputEvent } from '@jsvision/core';
import type { Terminal } from '@xterm/xterm';

/** The byte value of ESC (0x1b); a leading-ESC carry arms the disambiguation timer. */
const ESC = 0x1b;

/**
 * DECSET modes the native host would enable at startup, minus the alternate
 * screen (the demo owns the whole terminal). Sent once from {@link BrowserHost.start}
 * so xterm reports mouse in SGR form and brackets pastes — matching the caps we
 * hand the decoder. Cursor is hidden here; the loop's caret sink re-shows it only
 * while a text control is focused.
 */
const ENTER_MODES =
  '\x1b[?1006h' + // SGR mouse encoding
  '\x1b[?1000h' + // basic button tracking
  '\x1b[?1002h' + // button-event tracking (drag)
  '\x1b[?2004h' + // bracketed paste
  '\x1b[?1004h' + // focus reporting
  '\x1b[?7l' + //   line-wrap off
  '\x1b[?25l'; //   hide cursor (caret sink re-shows on demand)

/** A 0-based absolute caret cell, matching the event loop's `onCaret` payload. */
export interface CaretCell {
  readonly x: number;
  readonly y: number;
}

/** The browser host surface the demo wires to the event loop. */
export interface BrowserHost {
  /** Enable input modes and start pumping xterm bytes into the decoder. */
  start(): void;
  /** Diff `buffer` against the previous frame and write the ANSI delta to xterm. */
  render(buffer: ScreenBuffer): void;
  /** Position (or hide, when `null`) the hardware caret — wired to the loop's `onCaret`. */
  setCaret(cell: CaretCell | null): void;
}

/** Options for {@link createBrowserHost}. */
export interface BrowserHostOptions {
  /** The xterm.js terminal to render into and read input from. */
  readonly term: Terminal;
  /** The capability profile driving `serialize()`/`decode()` (browser-fixed; see `app.ts`). */
  readonly caps: CapabilityProfile;
  /** Sink for decoded input events (wire to `loop.dispatch`). */
  readonly onInput: (event: InputEvent) => void;
}

/**
 * Build a {@link BrowserHost} over an xterm.js `Terminal`.
 *
 * @param options - the terminal, the capability profile, and the input sink.
 * @returns the host: `start()` once, then `render()` each frame and `setCaret()` each caret update.
 */
export function createBrowserHost(options: BrowserHostOptions): BrowserHost {
  const { term, caps, onInput } = options;
  const encoder = new TextEncoder();

  let previous: ScreenBuffer | null = null;
  let decoderState = createDecoderState();
  let escTimer: number | null = null;

  /** Disarm the lone-ESC flush timer if armed (a new byte cancels it). */
  function clearEscTimer(): void {
    if (escTimer !== null) {
      clearTimeout(escTimer);
      escTimer = null;
    }
  }

  /** The input pump: xterm string → bytes → decode → dispatch, managing the ESC timer. */
  function pump(data: string): void {
    const result = decode(encoder.encode(data), decoderState, { caps });
    decoderState = result.state;
    for (const event of result.events) onInput(event);

    clearEscTimer();
    const carry = decoderState.carry;
    // A trailing ESC-prefixed carry: flush it as a bare/Alt escape once the gap elapses (AR-14).
    if (carry.length >= 1 && carry[0] === ESC) {
      escTimer = window.setTimeout(() => {
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
      // Snapshot: the loop hands us one LIVE buffer it keeps mutating, so alias-free clone (as the
      // native host does) — otherwise the next diff compares the frame against itself.
      previous = buffer.clone();
    },
    setCaret(cell: CaretCell | null): void {
      term.write(cell === null ? cursor.hide() : cursor.show() + cursor.to(cell.y + 1, cell.x + 1));
    },
  };
}
