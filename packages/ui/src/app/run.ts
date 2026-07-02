/**
 * `runApplication` — the `run()` lifecycle (RD-05 AR-71/AR-83/AR-86).
 *
 * Wires core's `createHost` to the composed `EventLoop`: `onInput → dispatch`, `onResize → resize`,
 * and the `onFrame` seam → `host.render`, then runs until the `'quit'` command resolves the exit
 * code and guarantees terminal restore on **every** exit path via `finally(host.stop())` (which is
 * idempotent with the host's own crash/signal backstop). Suspend/resume are host-owned: `onSuspend`/
 * `onResume` are notify-only (the host re-asserts modes + repaints), so the app writes no modes and
 * fires no inert flush (PF-09).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { createHost, cursor } from '@jsvision/core';
import type { CapabilityProfile, RuntimeAdapter } from '@jsvision/core';
import type { Group, Point } from '../view/index.js';
import type { EventLoop } from '../event/index.js';

/**
 * Encode a hardware-caret cell as a terminal sequence (RD-07 PA-5): show + move the cursor to the
 * cell (converting the loop's 0-based `Point` to `cursor.to`'s 1-based row/col), or hide it when there
 * is no caret requester. Written to the co-owned output stream right after each frame render.
 *
 * @param cell The absolute 0-based caret cell, or `null` for "no caret" (hide the cursor).
 * @returns The ANSI sequence to write.
 */
function caretSequence(cell: Point | null): string {
  return cell === null ? cursor.hide() : cursor.show() + cursor.to(cell.y + 1, cell.x + 1);
}

/** Shared, mutable quit-resolver cell: the command sink resolves it, `run()` assigns it (PA-12). */
export interface QuitState {
  /** The pending `run()` promise's resolver while a run is active; `null` otherwise. */
  resolve: ((code: number) => void) | null;
}

/** Everything `runApplication` needs from the composed application. */
export interface RunContext {
  /** The composed event loop. */
  readonly loop: EventLoop;
  /** Capability profile for the host's encoding/modes. */
  readonly caps: CapabilityProfile;
  /** Injectable OS boundary (default real Node runtime). */
  readonly runtime?: RuntimeAdapter;
  /** Injectable input stream (default `process.stdin`). */
  readonly input?: NodeJS.ReadStream;
  /** Injectable output stream (default `process.stdout`). */
  readonly output?: NodeJS.WriteStream;
  /** Warn at startup on double-width chrome glyphs (real TTY only). Default `true`; see `createHost`. */
  readonly warnAmbiguousWidth?: boolean;
  /** Adapt to ASCII-safe chrome when the startup probe measures wide glyphs. Default `true`; see `createHost`. */
  readonly adaptAmbiguousWidth?: boolean;
  /** The absolute overlay layer, kept full-viewport across terminal resizes. */
  readonly overlay: Group;
  /** The shared quit-resolver cell wired to the command sink. */
  readonly quitState: QuitState;
}

/**
 * Run the application against a real (or injected) terminal until `'quit'`.
 *
 * @param ctx The composed loop + OS boundary + overlay + quit-resolver cell.
 * @returns The exit code resolved by the `'quit'` command (default 0).
 */
export async function runApplication(ctx: RunContext): Promise<number> {
  // The output stream the host writes to; run() co-writes cursor + clipboard sequences to it, ordered
  // right after each frame render (PA-5/PA-7). Resolved the same way createHost resolves its default.
  const output = ctx.output ?? process.stdout;
  // The last caret cell the loop reported, re-applied verbatim after a host resume repaint (AR-83):
  // the host re-renders the last frame but does not re-fire onCaret, so run() re-positions the cursor.
  let lastCaret: Point | null = null;

  const host = createHost({
    caps: ctx.caps,
    runtime: ctx.runtime,
    input: ctx.input,
    output: ctx.output,
    // Zero-config policy: on a real TTY, warn once at startup if the terminal
    // renders our ambiguous-width chrome glyphs double-width (alignment shift).
    // Default on; a headless/test harness can pass `false` to skip the probe.
    warnAmbiguousWidth: ctx.warnAmbiguousWidth ?? true,
    // Zero-config policy: on a real TTY, a wide-rendering terminal automatically
    // gets aligned ASCII chrome. Default on; mirrors warnAmbiguousWidth.
    adaptAmbiguousWidth: ctx.adaptAmbiguousWidth ?? true,
    onInput: (event) => ctx.loop.dispatch(event),
    onResize: (event) => {
      // Keep the absolute overlay full-screen, then reflow the loop to the new viewport.
      ctx.overlay.layout = {
        position: 'absolute',
        rect: { x: 0, y: 0, width: event.columns, height: event.rows },
      };
      ctx.loop.resize({ width: event.columns, height: event.rows });
    },
    onSuspend: () => {
      // host-owned soft restore (AR-83) — notify-only hook
    },
    onResume: () => {
      // host already re-asserted modes + repainted (AR-83 / PF-09); re-position the hardware cursor,
      // which the repaint does not restore (RD-07 PA-5).
      output.write(caretSequence(lastCaret));
    },
  });

  // Bridge every coalesced frame to the terminal (PA-6 / PF-04): the loop's onFrame is a settable
  // member, wired only now that the host exists.
  ctx.loop.onFrame = (buffer) => host.render(buffer);
  // Position the hardware cursor right after each frame (fired after onFrame, so it lands past the
  // frame's writes), and stream OSC-52 clipboard sequences to the same output (RD-07 PA-5/PA-7).
  ctx.loop.onCaret = (cell) => {
    lastCaret = cell;
    output.write(caretSequence(cell));
  };
  ctx.loop.writeClipboard = (seq) => output.write(seq);

  // The quit promise: resolved by the command sink (via the shared quitState cell) on `'quit'`.
  const quitPromise = new Promise<number>((resolve) => {
    ctx.quitState.resolve = resolve;
  });

  try {
    await host.start(); // raw mode + alt-screen
    host.render(ctx.loop.renderRoot.buffer()); // paint the first frame
    ctx.loop.refreshCaret(); // position the initial cursor (the first render is not a loop tick)
    return await quitPromise;
  } finally {
    await host.stop(); // GUARANTEED restore on every path (normal / throw / signal); idempotent
    ctx.loop.onFrame = undefined;
    ctx.loop.onCaret = undefined;
    ctx.loop.writeClipboard = undefined;
    ctx.quitState.resolve = null;
  }
}
