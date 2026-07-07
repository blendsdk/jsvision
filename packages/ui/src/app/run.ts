/**
 * `runApplication` — connects an assembled event loop to a real terminal and runs it.
 *
 * It starts a terminal host (raw mode + alternate screen), forwards input to the loop, forwards
 * resizes, paints every frame the loop produces, and runs until the `'quit'` command resolves the
 * exit code. The terminal is always restored on exit — normal, thrown, or signalled. Terminal
 * suspend/resume (Ctrl+Z) is handled by the host, which re-asserts modes and repaints; `run()` only
 * re-positions the cursor afterward. This backs {@link Application.run}.
 */
import { createHost, cursor } from '@jsvision/core';
import type { CapabilityProfile, RuntimeAdapter, ScreenBuffer } from '@jsvision/core';
import type { Point } from '../view/index.js';
import type { EventLoop } from '../event/index.js';

/**
 * Encode a caret cell as a terminal sequence: show and move the cursor to the cell (converting the
 * 0-based cell to the terminal's 1-based row/column), or hide the cursor when there is no caret.
 *
 * @param cell The absolute 0-based caret cell, or `null` to hide the cursor.
 * @returns The terminal escape sequence to write.
 */
function caretSequence(cell: Point | null): string {
  return cell === null ? cursor.hide() : cursor.show() + cursor.to(cell.y + 1, cell.x + 1);
}

/** A shared cell holding the `run()` promise's resolver: `run()` fills it in, the quit sink calls it. */
export interface QuitState {
  /** The active `run()` promise's resolver while a run is in progress; `null` otherwise. */
  resolve: ((code: number) => void) | null;
}

/** Everything `runApplication` needs from the assembled application. */
export interface RunContext {
  /** The assembled event loop. */
  readonly loop: EventLoop;
  /** Terminal capability profile for the host's encoding and mode setup. */
  readonly caps: CapabilityProfile;
  /** OS boundary the host runs against; defaults to the real Node runtime. */
  readonly runtime?: RuntimeAdapter;
  /** Input stream; defaults to `process.stdin`. */
  readonly input?: NodeJS.ReadStream;
  /** Output stream; defaults to `process.stdout`. */
  readonly output?: NodeJS.WriteStream;
  /** Warn at startup if the terminal renders the ambiguous-width frame glyphs double-width. Default `true`. */
  readonly warnAmbiguousWidth?: boolean;
  /** Switch to ASCII-safe chrome if the startup probe finds those glyphs render double-width. Default `true`. */
  readonly adaptAmbiguousWidth?: boolean;
  /** The shared quit-resolver cell that the app's quit sink calls. */
  readonly quitState: QuitState;
}

/**
 * Run the application against a real (or injected) terminal until the `'quit'` command.
 *
 * @param ctx The assembled loop, OS boundary, streams, and quit-resolver cell.
 * @returns The exit code carried by the `'quit'` command (0 if none was given).
 */
export async function runApplication(ctx: RunContext): Promise<number> {
  // The stream the host and run() both write to; run() writes cursor and clipboard sequences to it
  // right after each frame. Resolved the same way the host resolves its default.
  const output = ctx.output ?? process.stdout;
  // The last caret cell the loop reported. After a suspend/resume the host repaints the last frame but
  // does not re-report the caret, so run() re-applies this to re-position the cursor.
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
      // Reflow to the new size. The loop's resize handler keeps the overlay full-screen and re-anchors
      // the menu and maximized windows, so real and headless resizes take the same path.
      ctx.loop.resize({ width: event.columns, height: event.rows });
    },
    onSuspend: () => {
      // Nothing to do — the host handles the terminal restore on suspend.
    },
    onResume: () => {
      // The host has already re-asserted modes and repainted; re-position the cursor, which the
      // repaint does not restore.
      output.write(caretSequence(lastCaret));
    },
  });

  // Paint every frame the loop produces. The frame is held and painted together with the caret
  // sequence the loop reports immediately afterward, so the screen update and the cursor move go out
  // as one write — splitting them lets the terminal briefly show the cursor parked at the last
  // updated cell, which flickers while typing.
  let pendingFrame: ScreenBuffer | null = null;
  ctx.loop.onFrame = (buffer) => {
    pendingFrame = buffer;
  };
  // Fired right after each frame: paint the held frame together with the caret sequence in one write.
  // A caret-only report (the initial cursor placement) writes just the sequence.
  ctx.loop.onCaret = (cell) => {
    lastCaret = cell;
    if (pendingFrame !== null) {
      const frame = pendingFrame;
      pendingFrame = null;
      host.render(frame, caretSequence(cell));
    } else {
      output.write(caretSequence(cell));
    }
  };
  ctx.loop.writeClipboard = (seq) => output.write(seq);

  // Resolved by the app's quit sink (through the shared quitState cell) when the 'quit' command fires.
  const quitPromise = new Promise<number>((resolve) => {
    ctx.quitState.resolve = resolve;
  });

  try {
    await host.start(); // enter raw mode + the alternate screen
    host.render(ctx.loop.renderRoot.buffer()); // paint the first frame
    ctx.loop.refreshCaret(); // position the initial cursor (the first paint is not a loop tick)
    return await quitPromise;
  } finally {
    await host.stop(); // always restore the terminal — on normal exit, a throw, or a signal
    ctx.loop.onFrame = undefined;
    ctx.loop.onCaret = undefined;
    ctx.loop.writeClipboard = undefined;
    ctx.quitState.resolve = null;
  }
}
