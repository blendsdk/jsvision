# Modes, Signals & Platform: RD-07 Host & Lifecycle

> **Document**: 03-02-modes-signals-platform.md
> **Parent**: [Index](00-index.md)
> **Files**: `src/engine/host/modes.ts`, `src/engine/host/signals.ts`, `src/engine/host/platform.ts`

## Overview

The cross-platform heart of the host: the exact enter/leave escape sequences gated by `caps`
(`modes.ts`), the signal install/teardown + suspend/resume + resize coalescing (`signals.ts`), and
the per-OS runtime adapter that maps abstract `HostSignal`s onto POSIX signals or Windows
equivalents and enables VT processing (`platform.ts`).

## `modes.ts` — enter/leave sequence builders

Pure string builders driven by `caps` (no I/O). They reuse RD-04's `CSI`/cursor vocabulary where
possible and emit the private-mode `?…h`/`?…l` pairs. **[RD-07 Must]**

```ts
/** Build the enter-TUI-mode byte string, gating each mode on caps. [AR per RD-07 Must] */
export function enterMode(caps: CapabilityProfile): string;
/** Build the exact inverse leave-TUI-mode string (modes off, screen/cursor/wrap restored). */
export function leaveMode(caps: CapabilityProfile): string;
```

### Sequence table (order matters — leave is the strict inverse)

| Step | Mode | Enter | Leave | Gate |
|------|------|-------|-------|------|
| 1 | Alternate screen | `CSI ?1049h` | `CSI ?1049l` | `caps.altScreen` |
| 2 | Cursor visibility | `CSI ?25l` (hide) | `CSI ?25h` (show) | always |
| 3 | Line wrap | `CSI ?7l` (off) | `CSI ?7h` (on) | always |
| 4 | Mouse SGR ext | `CSI ?1006h` | `CSI ?1006l` | `caps.mouse.sgr` |
| 5 | Mouse tracking | `CSI ?1000h` + `?1002h` (drag) + `?1003h` (any-motion) | inverse | `caps.mouse.sgr` (+`.drag`) |
| 6 | Bracketed paste | `CSI ?2004h` | `CSI ?2004l` | `caps.bracketedPaste` |
| 7 | Focus reporting | `CSI ?1004h` | `CSI ?1004l` | always (host-gated) |
| 8 | Keyboard protocol | Kitty `CSI >…u` / modifyOtherKeys `CSI >4;…m` | pop / `CSI >4;0m` | `caps.keyboard.kittyFlags`/`.modifyOtherKeys` |

`leaveMode` emits the disable sequences in reverse order so the terminal unwinds exactly as it was
set up (AC-1). Re-assert on resume (`SIGCONT`) reuses `enterMode`. **[AR-10]**

## `signals.ts` — handler install/teardown, resize, suspend/resume

Pure orchestration over the injected `RuntimeAdapter` (`adapter.on(...)` returns an unsubscribe).
Returns a teardown that removes every handler — `stop()` calls it. **[AR-8]**

```ts
/** Install resize/signal/suspend handlers; returns a teardown that removes them all. */
export function installSignals(ctx: SignalContext): () => void;
```

`SignalContext` carries the adapter, the bound output (for size + writes), the one idempotent
`restore`, the user callbacks, and the `exitOnSignal`/`onBeforeExit` policy.

- **resize** (`adapter.on('resize')`): pending-flag + `adapter.scheduleImmediate`; the immediate
  reads `output.columns`/`output.rows` once and fires `onResize({type:'resize',columns,rows})`,
  then clears the flag. Collapses a SIGWINCH burst to one event (AC-3). **[AR-9]**
- **interrupt/terminate/hangup** (`'interrupt'|'terminate'|'hangup'`): `restore()` →
  `onBeforeExit?.(code)` → if `exitOnSignal` `adapter.exit(code)` (130/143/129). **[AR-6]**
- **suspend** (`'suspend'`, POSIX): `onSuspend?.()` → `restore()` →
  re-raise default-disposition stop so the process actually suspends (adapter maps to
  `process.kill(process.pid,'SIGSTOP')`). **[AR-10]**
- **continue** (`'continue'`, POSIX): re-`setRawMode(true)` + write `enterMode(caps)` →
  full repaint `serialize(lastBuffer, null, {caps})` → `onResume?.()`. **[AR-10]**

> On Windows the adapter simply never emits `suspend`/`continue` (documented unsupported, AR-4); the
> same `signals.ts` code runs unchanged.

## `platform.ts` — the real RuntimeAdapter + per-OS specifics

```ts
/** The production RuntimeAdapter over node:tty / node:process / node:os. [AR-13] */
export function realRuntime(): RuntimeAdapter;
```

Maps abstract `HostSignal` → concrete source per `process.platform`:

| HostSignal | POSIX (linux/darwin) | Windows (win32) |
|-----------|----------------------|-----------------|
| `resize` | `process.on('SIGWINCH')` | `output.on('resize')` |
| `interrupt` | `process.on('SIGINT')` | `process.on('SIGINT')` |
| `terminate` | `process.on('SIGTERM')` | `process.on('SIGBREAK')` |
| `hangup` | `process.on('SIGHUP')` | `output.on('close')` / stream end |
| `suspend`/`continue` | `SIGTSTP`/`SIGCONT` | *(never emitted — unsupported)* |
| `uncaughtException`/`unhandledRejection` | `process.on(...)` | `process.on(...)` |

- `setRawMode` → `stream.setRawMode(on)` (guarded; only called when `isTTY`). **[AR-11]**
- **Windows VT**: on `win32`, ensure `ENABLE_VIRTUAL_TERMINAL_PROCESSING` — Node 18+ enables VT
  automatically when `output.isTTY` on Win10+/ConPTY; the adapter verifies and, if VT is
  unavailable (legacy `conhost`), calls `warn(...)` once. **[AR-4]**
- `exit` → `process.exit(code)`; `onProcessExit` → `process.on('exit', handler)`;
  `scheduleImmediate` → `setImmediate`; `setTimer`/`clearTimer` → `setTimeout`/`clearTimeout`. **[AR-13, AR-17]**

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|-----------|-------------------|--------|
| Mode unsupported by caps | Sequence omitted entirely (never emitted) | RD-07 Must |
| SIGWINCH burst | Coalesced via pending-flag + setImmediate | AR-9 |
| Suspend on Windows | Adapter never emits `suspend`/`continue` | AR-4, AR-10 |
| Legacy conhost without VT | `warn()` once; continue best-effort | AR-4 |
| Re-asserting modes on resume | Reuse `enterMode(caps)` + forced full repaint | AR-10 |

> **Traceability:** every decision references `00-ambiguity-register.md`.

## Testing Requirements
- `modes.ts`: exact enter/leave strings for representative caps (full, mono, no-mouse, no-paste);
  leave is the strict inverse of enter (ST-1, ST-2).
- `signals.ts`: resize coalescing fires once per burst (ST-4); suspend restores then re-raises;
  continue re-asserts + repaints (ST-5); interrupt/terminate/hangup restore + exit codes via fake
  adapter (ST-3).
- `platform.ts`: HostSignal→source mapping per platform (fake `process.platform`); VT warn path.
