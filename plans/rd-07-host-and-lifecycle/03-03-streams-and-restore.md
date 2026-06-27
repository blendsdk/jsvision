# Streams & Restore: RD-07 Host & Lifecycle

> **Document**: 03-03-streams-and-restore.md
> **Parent**: [Index](00-index.md)
> **Files**: `src/engine/host/streams.ts`, `src/engine/host/restore.ts`

## Overview

Stream binding + TTY detection + optional `/dev/tty` (`streams.ts`), and the idempotent
guaranteed/panic restore primitive wired to every exit path including the synchronous
`process.on('exit')` backstop and EPIPE (`restore.ts`).

## `streams.ts` — bind input/output, detect TTY, /dev/tty

```ts
/** Resolve the bound streams + TTY state from options. [AR-11, AR-13] */
export function bindStreams(options: HostOptions): BoundStreams;

export interface BoundStreams {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WriteStream;
  readonly isTTY: boolean;        // true only when BOTH ends are TTYs (or /dev/tty bound)
  /** Close any stream this module opened (e.g. /dev/tty fds); no-op for injected/std streams. */
  dispose(): void;
}
```

- Defaults: `input = options.input ?? process.stdin`, `output = options.output ?? process.stdout`.
- `isTTY = Boolean(input.isTTY && output.isTTY)`. **[AR-11]**
- **/dev/tty** (POSIX, `preferDevTty !== false`): when stdout is piped (`!process.stdout.isTTY`) but
  a controlling terminal exists, open `/dev/tty` for read+write and bind to it so a piped app can
  still drive the terminal. Opened fds are tracked and closed by `dispose()`. On failure or
  Windows, fall back to the std streams (degrade, don't throw). **[AR-13, RD-07 Must]**
- Injected streams are used verbatim and never closed by `dispose()` (the test owns them). **[AR-13]**

## `restore.ts` — idempotent guaranteed/panic restore

```ts
/** Build an idempotent restore closure + install the panic backstop. [AR-17] */
export function createRestore(ctx: RestoreContext): GuaranteedRestore;

export interface GuaranteedRestore {
  /** Restore the terminal exactly once (cooked, leave-mode, cursor shown). Safe to call repeatedly. */
  run(): void;
  /** Remove the process-level backstop handlers (called by stop()). */
  teardown(): void;
}
```

`RestoreContext` carries the adapter, the bound `output`, the `input`, and the `caps` (to build
`leaveMode`).

### Behavior

- **Idempotent**: a `done` guard ensures the body runs at most once even if a signal handler and
  the `'exit'` backstop both fire. **[AR-17]**
- **run()** writes `leaveMode(caps)` to the output and `setRawMode(input,false)`. On the
  synchronous `'exit'` path it performs a **synchronous** write of the leave bytes to the output fd
  (no async, no allocation beyond the precomputed string) — the last-resort backstop that catches a
  crash during setup before `stop()` could run. **[AR-17]**
- **panic backstop**: `createRestore` registers `adapter.onProcessExit(run)` (real:
  `process.on('exit')`) immediately, plus the orchestrator wires `run()` into the
  `uncaughtException`/`unhandledRejection` handlers (which also print to stderr + `exit(1)`). **[AR-6, AR-17]**
- **best-effort**: every write inside `run()` is wrapped so a secondary failure (e.g. the output is
  already gone on an EPIPE) is swallowed — restore must never throw. **[AR-16]**

### EPIPE path (orchestrated in host.ts, served by restore + streams)

```ts
output.on('error', (err) => {
  if ((err as NodeJS.ErrnoException).code === 'EPIPE') {
    restore.run();              // best-effort, swallows secondary errors
    onBeforeExit?.(0);
    adapter.exit(0);           // clean shutdown — a disconnect is an expected end
  } else {
    // non-EPIPE write errors fall through to the uncaughtException path
    throw err;
  }
});
```
No unhandled rejection results because the listener handles the stream error synchronously. **[AR-16]**

## Exit-code matrix (host-owned paths) — [AR-6]

| Trigger | Restore? | onBeforeExit | exit code |
|---------|----------|--------------|-----------|
| `stop()` (normal) | yes (via leave-mode) | — | none (no exit) |
| SIGINT | yes | `onBeforeExit(130)` | 130 |
| SIGTERM | yes | `onBeforeExit(143)` | 143 |
| SIGHUP | yes | `onBeforeExit(129)` | 129 |
| uncaughtException | yes + print stderr | `onBeforeExit(1)` | 1 |
| EPIPE | yes (best-effort) | `onBeforeExit(0)` | 0 |
| `exitOnSignal:false` | yes | `onBeforeExit(code)` | none (app decides) |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|-----------|-------------------|--------|
| Restore called twice | `done` guard — body runs once | AR-17 |
| Output gone during restore | Each write wrapped; failures swallowed | AR-16 |
| Crash during setup | Sync `process.on('exit')` backstop restores | AR-17 |
| /dev/tty open fails | Fall back to std streams; no throw | AR-13 |
| Non-EPIPE output error | Falls through to uncaughtException path | AR-16 |

> **Traceability:** every decision references `00-ambiguity-register.md`.

## Testing Requirements
- `streams.ts`: isTTY computed from both ends; injected streams used verbatim + not closed;
  non-TTY reported (ST-6); /dev/tty fallback on failure.
- `restore.ts`: idempotency (run twice → one effect, ST-11); leave-mode bytes written; sync exit
  backstop fires; EPIPE → best-effort restore + exit 0 without unhandled rejection (ST-8); restore
  runs even when setup throws midway (ST-11 panic).
- Security: no raw input written to any log channel at default level (ST-9); raw mode never on
  non-TTY (ST-10).
