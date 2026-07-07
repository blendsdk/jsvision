/**
 * Terminal signal handling — resize coalescing, terminating-signal exit, and
 * suspend/resume (Ctrl+Z) for the host.
 *
 * `installSignals()` wires, over the injected {@link RuntimeAdapter}:
 * - **resize** — a pending flag plus one deferred callback collapses a burst of
 *   resize signals into a single {@link ResizeEvent};
 * - **interrupt/terminate/hangup** — restore the terminal, then exit with the
 *   conventional code (130/143/129);
 * - **suspend** — run `onSuspend`, do a *soft* leave (leave-mode + raw off), then
 *   suspend the process; the guaranteed on-exit restore is deliberately left
 *   armed so a later real exit still restores;
 * - **continue** — re-assert the terminal modes, fully repaint the last frame,
 *   then run `onResume`.
 *
 * On Windows the adapter never emits `suspend`/`continue`, so those handlers are
 * simply inert and the same code runs unchanged.
 */
import { serialize } from '../render/serialize.js';
import type { CapabilityProfile } from '../capability/profile.js';
import type { ScreenBuffer } from '../render/buffer.js';
import type { GuaranteedRestore } from './restore.js';
import type { ResizeEvent, RuntimeAdapter } from './types.js';

/** Inputs the signal handlers need; assembled by the host so every path shares one restore. */
export interface SignalContext {
  readonly adapter: RuntimeAdapter;
  readonly output: NodeJS.WriteStream;
  readonly input: NodeJS.ReadStream;
  /** The one idempotent restore used by the terminating-signal paths. */
  readonly restore: GuaranteedRestore;
  /** Enter-mode string re-asserted on resume. */
  readonly enterStr: string;
  /** Leave-mode string written on the suspend soft-leave. */
  readonly leaveStr: string;
  /** Whether the terminal is a TTY; gates mode writes and raw-mode toggles. */
  readonly isTTY: boolean;
  /**
   * Getter for the effective serialize caps used by the resume repaint — the same
   * caps `render()` uses, so a width-adapted host repaints ASCII-safe chrome after
   * resume instead of un-swapped wide glyphs. A getter (rather than a value) so it
   * is correct regardless of when `start()` adapted the caps.
   */
  getSerializeCaps(): CapabilityProfile;
  readonly onResize?: (event: ResizeEvent) => void;
  readonly onSuspend?: () => void;
  readonly onResume?: () => void;
  /** When false, terminating signals restore the terminal but do not exit the process. */
  readonly exitOnSignal: boolean;
  readonly onBeforeExit?: (code: number) => void;
  /** Getter for the last rendered frame, used by the resume full repaint. */
  getLastBuffer(): ScreenBuffer | null;
}

/** Exit codes for the terminating signals (128 + the signal number). */
const EXIT_CODES = { interrupt: 130, terminate: 143, hangup: 129 } as const;

/** Run a handler step, swallowing any failure — a signal handler must never throw. */
function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    /* best-effort: never throw out of a signal handler */
  }
}

/**
 * Install resize/signal/suspend/resume handlers over the adapter.
 *
 * @param ctx - the adapter, bound streams, shared restore, mode strings, and callbacks.
 * @returns a teardown that removes every handler installed here.
 */
export function installSignals(ctx: SignalContext): () => void {
  const unsubscribes: (() => void)[] = [];

  // resize — collapse a burst of resize signals into a single coalesced event.
  let resizePending = false;
  unsubscribes.push(
    ctx.adapter.on('resize', () => {
      if (resizePending) return;
      resizePending = true;
      ctx.adapter.scheduleImmediate(() => {
        resizePending = false;
        const columns = ctx.output.columns ?? 80;
        const rows = ctx.output.rows ?? 24;
        ctx.onResize?.({ type: 'resize', columns, rows });
      });
    }),
  );

  // interrupt/terminate/hangup — restore the terminal, then exit with the conventional code.
  for (const signal of ['interrupt', 'terminate', 'hangup'] as const) {
    const code = EXIT_CODES[signal];
    unsubscribes.push(
      ctx.adapter.on(signal, () => {
        ctx.restore.run();
        ctx.onBeforeExit?.(code);
        if (ctx.exitOnSignal) ctx.adapter.exit(code);
      }),
    );
  }

  // suspend — soft leave (restore modes without disarming the exit backstop) then stop the process; inert on Windows.
  unsubscribes.push(
    ctx.adapter.on('suspend', () => {
      ctx.onSuspend?.();
      if (ctx.isTTY) {
        safely(() => ctx.output.write(ctx.leaveStr));
        safely(() => ctx.adapter.setRawMode(ctx.input, false));
      }
      ctx.adapter.suspendSelf();
    }),
  );

  // continue — re-assert the terminal modes + full repaint, then notify.
  unsubscribes.push(
    ctx.adapter.on('continue', () => {
      if (ctx.isTTY) {
        safely(() => ctx.adapter.setRawMode(ctx.input, true));
        safely(() => ctx.output.write(ctx.enterStr));
        const last = ctx.getLastBuffer();
        if (last) {
          // Use the effective (possibly width-adapted) caps, matching render().
          const out = serialize(last, null, { caps: ctx.getSerializeCaps() });
          if (out) safely(() => ctx.output.write(out));
        }
      }
      ctx.onResume?.();
    }),
  );

  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
