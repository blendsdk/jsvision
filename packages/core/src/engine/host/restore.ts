/**
 * The guaranteed terminal-restore mechanism — how the host makes sure the
 * terminal is always handed back, even on a crash.
 *
 * `createRestore()` builds a restore closure that writes the leave-mode sequence
 * and returns the terminal to cooked mode, and installs a synchronous
 * `process.on('exit')` backstop so a crash that bypasses `stop()` still restores.
 * A single guard ensures the restore body runs **at most once**, even if a signal
 * handler and the `'exit'` backstop both fire. Suspend/resume deliberately do
 * *not* go through this guard — they manage modes directly so a later real exit
 * still restores.
 *
 * Every write is best-effort: a secondary failure (e.g. the output is already
 * gone after a pipe disconnect) is swallowed so restore never throws.
 */
import { leaveMode } from './modes.js';
import type { CapabilityProfile } from '../capability/profile.js';
import type { RuntimeAdapter } from './types.js';

/** Inputs the restore closure needs. The leave sequence is precomputed so the on-exit path allocates nothing. */
export interface RestoreContext {
  readonly adapter: RuntimeAdapter;
  readonly output: NodeJS.WriteStream;
  readonly input: NodeJS.ReadStream;
  readonly caps: CapabilityProfile;
  /** The focus-reporting host-policy toggle, threaded into the leave sequence. */
  readonly focus?: boolean;
  /** Whether the terminal was actually entered; a non-TTY host has nothing to restore. */
  readonly isTTY: boolean;
}

/** The idempotent restore handle returned by {@link createRestore}. */
export interface GuaranteedRestore {
  /**
   * Restore the terminal exactly once. `sync` selects the write channel: `false`
   * (default) uses the async `output.write` (event loop still running); `true`
   * uses a synchronous write for the draining on-exit backstop, where an async
   * write would never flush.
   */
  run(sync?: boolean): void;
  /** Remove the process-level `'exit'` backstop (called by `stop()`). */
  teardown(): void;
}

/** Read a stream's file descriptor, defaulting to stdout's fd 1 (not on the WriteStream type). */
function outputFd(output: NodeJS.WriteStream): number {
  const fd = (output as { fd?: number }).fd;
  return typeof fd === 'number' ? fd : 1;
}

/** Run a restore step, swallowing any secondary failure — restore must never throw. */
function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    /* best-effort: the terminal may already be gone */
  }
}

/**
 * Build an idempotent restore closure and install the on-exit backstop.
 *
 * @param ctx - the adapter, bound streams, caps, focus policy, and TTY flag.
 * @returns a {@link GuaranteedRestore} whose `run()` is safe to call repeatedly.
 */
export function createRestore(ctx: RestoreContext): GuaranteedRestore {
  const leaveStr = leaveMode(ctx.caps, { focus: ctx.focus });
  let done = false;

  function run(sync = false): void {
    if (done) return;
    done = true;
    if (!ctx.isTTY) return; // nothing was entered → nothing to restore
    if (sync) {
      safely(() => ctx.adapter.writeSync(outputFd(ctx.output), leaveStr));
    } else {
      safely(() => ctx.output.write(leaveStr));
    }
    safely(() => ctx.adapter.setRawMode(ctx.input, false));
  }

  // Register the synchronous last-resort restore immediately, before anything can crash.
  const unsubExit = ctx.adapter.onProcessExit(() => run(true));

  return {
    run,
    teardown(): void {
      unsubExit();
    },
  };
}
