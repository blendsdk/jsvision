---
title: Crash safety & terminal restore
description: Learn normal exit, exception, and signal paths that restore terminal ownership safely.
---

# Crash safety & terminal restore

## Who is this course for?

This course is for developers whose application takes over a native terminal. You should first
complete [Application shell](/guide/application-shell) and [Debugging](/guide/debugging): this
course assumes you can run an application and collect bounded evidence without writing over its
screen.

You will build a safe lifecycle, explain who owns terminal modes and process handlers, diagnose a
terminal left in the wrong state, and verify normal, failure, signal, partial-start, and degraded
paths. The motivating failure is familiar: an application crashes, but the shell remains in raw
mode, the cursor stays hidden, or the user is stranded on the alternate screen.

This is a native-process course. A browser terminal cannot prove operating-system signal delivery,
raw-mode restoration, or the synchronous process-exit channel, so there is no embedded lab. The
[deterministic trace](https://github.com/blendsdk/jsvision/blob/master/packages/docs-site/src/example-fixtures/crash-safety/lifecycle-trace.ts)
and
[runnable artifact](https://github.com/blendsdk/jsvision/blob/master/packages/docs-site/test/crash-safety-example.spec.test.ts)
exercise the real public host through an injected runtime.

## What is the terminal-ownership mental model?

One host owns one terminal session. Acquisition and restoration are strict inverses:

```text
shell
  → host.start()
  → raw mode + enabled terminal modes + hidden/managed cursor
  → application work
  → one restoration path
  → cooked mode + main screen + normal cursor
  → shell
```

`Application.run()` owns the high-level session. Internally, the host owns input/output streams,
raw mode, the alternate screen and other enabled modes, cursor policy, and its process handlers.
The invariant is: after any terminal state is acquired, every exit path reaches the same
idempotent, best-effort restoration before control leaves the process.

Keep these layers distinct:

| Layer               | Owns                                         | Evidence                                   |
| ------------------- | -------------------------------------------- | ------------------------------------------ |
| Application         | UI loop, quit result, application resources  | quit code, cleanup counters                |
| Host                | streams, terminal modes, runtime handlers    | ordered mode and handler trace             |
| Runtime adapter     | OS signal and exit boundary                  | signal category, callback order, exit code |
| Supervisor or shell | restart policy and final process environment | child status, usable shell                 |

Restoration makes the terminal usable again. It does not roll back application data, finish an
unsafe transaction, or guarantee that every arbitrary process failure can execute JavaScript.

## How do I get the first safe lifecycle?

Use the application runner for an ordinary JSVision application:

```ts
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const app = createApplication({
  caps: resolveCapabilities().profile,
});

const exitCode = await app.run();
process.exitCode = exitCode;
```

`run()` checks terminal essentials by default, starts the host, paints the first frame, waits for
the application quit command, then stops the loop and host in a `finally` path. Prefer this path to
assembling a second set of signal handlers around the application.

For a custom renderer, own the lower-level host explicitly:

```ts
import { createHost, resolveCapabilities } from '@jsvision/core';

const host = createHost({
  caps: resolveCapabilities().profile,
});

await host.start();
try {
  // Render and consume input while this scope owns the terminal.
} finally {
  await host.stop();
}
```

Acquisition and cleanup appear together so a later return or throw cannot skip restoration.

## What is the authentic lifecycle artifact?

The fixture calls public `createHost()` with a deterministic `RuntimeAdapter` and TTY-shaped
in-memory streams. It records only stable categories and bounded lengths. The runnable test covers:

| Scenario                        | Observable ordering                                                       |
| ------------------------------- | ------------------------------------------------------------------------- |
| Normal and repeated stop        | enter once → restore once → owned handlers removed                        |
| Uncaught exception or rejection | restore → safe diagnostic → `onBeforeExit(1)` → exit 1                    |
| Interrupt, terminate, hangup    | restore → matching callback code → conventional exit                      |
| Partial start                   | backstop armed → setup fails → synchronous restore → cleanup remains safe |
| Existing observer               | host handlers detach; the pre-existing observer remains                   |

Run the linked Vitest artifact and inspect the `interrupt` result: both `beforeExitCodes` and
`exitCodes` must equal `[130]`.

The injected adapter proves host ordering deterministically. The core child-process signal suite
owns evidence that a real operating system delivers signals. Do not describe an injected signal as
an end-to-end OS test.

## What does the host own?

After `start()` begins, the host binds streams and installs one restoration backstop before it
enters raw mode or writes the alternate-screen sequence. A successful start then owns:

- the input data listener and output error listener;
- raw/cooked input mode;
- every terminal mode enabled by the capability profile, including the alternate screen;
- cursor and focus-reporting policy;
- resize, terminating, suspend, and continue handlers;
- uncaught-exception and unhandled-rejection handlers; and
- a synchronous process-exit backstop.

The public boundary is intentionally small:

```ts
import { createHost, resolveCapabilities } from '@jsvision/core';

const host = createHost({
  caps: resolveCapabilities().profile,
  onBeforeExit: (code) => {
    safeLogger.info('lifecycle', 'host exit requested', { code });
  },
});

await host.start();
await host.stop();
```

`stop()` gives the terminal back but does not exit the process. It is safe to await more than once.

## What happens on normal exit?

An application quit resolves `run()` with a code. Its `finally` path invalidates late clipboard
work, stops the event loop, awaits `host.stop()`, ends the protected screen session, detaches frame
and caret callbacks, and releases the quit resolver.

At the host boundary, normal stop:

1. gates further frames;
2. removes input and output listeners;
3. removes signal, exception, and rejection handlers;
4. restores enabled terminal modes and cooked input exactly once while the exit backstop remains
   armed;
5. removes the exit backstop after restoration; and
6. releases bound streams.

Do not replace `run()` with a fire-and-forget call:

```ts
// Keep the promise owned so startup, quit, and restoration failures are observable.
const code = await app.run();
process.exitCode = code;
```

If your application owns timers, subscriptions, or host resources, release those in their own
owners as well. Terminal restoration is not a substitute for application cleanup.

## What happens when work throws or rejects?

The host subscribes to uncaught exceptions and unhandled rejections after its restore backstop is
armed. Both fatal paths use the same ordering:

1. run idempotent restore;
2. write the formatted error through the diagnostic channel, not the UI stream;
3. call `onBeforeExit(1)`; and
4. request exit code 1.

An exception thrown through the awaited `Application.run()` scope also reaches its `finally`, so
the host is stopped before the error continues outward.

Use `onBeforeExit` for bounded metadata, not recovery that may hang:

```ts
import { createHost, resolveCapabilities } from '@jsvision/core';

const host = createHost({
  caps: resolveCapabilities().profile,
  onBeforeExit: (code) => {
    lifecycleLog.error('host', 'fatal exit', { code });
  },
});
```

Do not catch an uncaught exception and continue using a potentially inconsistent application.
Handle expected failures at their feature boundary; reserve the fatal path for process-level
failure.

## What happens on process signals?

The public host works with abstract signal categories; the runtime maps them to the platform:

| Category  | Typical source                             | Restore order                 | Exit |
| --------- | ------------------------------------------ | ----------------------------- | ---- |
| interrupt | `SIGINT`                                   | restore → `onBeforeExit(130)` | 130  |
| terminate | `SIGTERM` on POSIX, `SIGBREAK` on Windows  | restore → `onBeforeExit(143)` | 143  |
| hangup    | `SIGHUP` on POSIX, output close on Windows | restore → `onBeforeExit(129)` | 129  |

The values follow `128 + signal number` for the POSIX sources. The host restores before
`onBeforeExit` and before the exit request.

For an embedded process or supervisor-owned exit, opt out of the final exit request:

```ts
import { createHost, resolveCapabilities } from '@jsvision/core';

const host = createHost({
  caps: resolveCapabilities().profile,
  exitOnSignal: false,
  onBeforeExit: (code) => supervisor.noteRestoredChild(code),
});
```

`exitOnSignal` defaults to `true`. Setting it to `false` leaves restoration and the callback in
place; it only prevents the host from requesting process exit. The embedder must then decide what
happens next.

Suspend is different from termination. On POSIX, `SIGTSTP` performs a soft leave: it calls
`onSuspend`, writes leave modes, turns raw mode off, and suspends while keeping the final backstop
armed. `SIGCONT` re-asserts raw and terminal modes, fully repaints the last frame, then calls
`onResume`. Windows has no corresponding suspend/continue mapping, so those categories are inert
at the platform adapter.

## How does partial startup remain recoverable?

Startup can fail after one terminal property changed but before setup completes. The host therefore
registers the process exit handler first, before raw mode, the width probe, alternate-screen entry,
or application handlers.

If `start()` throws mid-setup, the synchronous backstop can still restore what may have been
entered. It uses `writeSync` because the event loop is draining during process exit; an asynchronous
write may never flush.

```ts
const host = createHost({ caps });

try {
  await host.start();
} catch (error) {
  await host.stop(); // safe even when setup completed only partially
  throw error;
}
```

The host's backstop remains the last-resort guarantee. Calling `stop()` in an owned catch or
`finally` also removes partially installed listeners when normal asynchronous cleanup is still
possible.

## Why must restoration be idempotent?

A single failure may touch several paths: a signal can restore, then the process-exit backstop can
fire; application cleanup can call `stop()` after a lower layer already restored; an output error
can race with shutdown. Restoration therefore has an at-most-once guard.

```ts
await host.stop();
await host.stop(); // no second leave sequence or raw-mode transition
```

Every restoration step is best-effort. If the output is already disconnected or raw-mode teardown
throws, that secondary restore failure is swallowed so later restore steps still run. This is
deliberately different from hiding the original application failure.

A non-TTY host never entered terminal modes, so raw-mode setup and restore are skipped: there is
nothing to restore. Headless rendering can still write frames when the caller explicitly disables
the application TTY requirement.

## Who owns process handlers?

`start()` registers host-owned signal, uncaught-exception, unhandled-rejection, output-error, and
process-exit handlers. `stop()` unsubscribes or removes those exact handlers. It must not remove a
pre-existing application-owned or supervisor handler; it must not remove any other handler.

Concretely, the runtime registers SIGINT and the other mapped signal callbacks alongside
`uncaughtException` and `unhandledRejection` observers. They share restoration but retain distinct
diagnostic and exit semantics.

Do not install a competing second SIGINT, uncaught-exception, or restore handler around `app.run()`.
Two owners can reorder diagnostics, exit twice, or restore while the UI still paints. Prefer:

- feature cleanup in feature owners;
- terminal restoration in the host;
- bounded telemetry through `onBeforeExit`; and
- restart/relaunch policy in the supervisor.

If an embedder needs to chain behavior, use `onBeforeExit` or `exitOnSignal: false` and delegate
after the host restores. Keep telemetry synchronous and bounded; application cleanup that can wait
belongs before the fatal boundary, not inside the exit callback.

## What is essential and what degrades gracefully?

An interactive TTY with raw-mode keyboard input is the single hard runtime requirement. Evaluate it
before startup:

```ts
import { detectTty, evaluateEssentials, resolveCapabilities } from '@jsvision/core';

const caps = resolveCapabilities().profile;
const report = evaluateEssentials(caps, { isTTY: detectTty() });

if (!report.met) showLaunchError(report.missing);
for (const item of report.degradations) safeLogger.info('startup', item.message);
```

Or fail fast with the typed gate:

```ts
import { assertEssentials, createHost, detectTty, resolveCapabilities } from '@jsvision/core';

const caps = resolveCapabilities().profile;
assertEssentials(caps, { isTTY: detectTty() });
const host = createHost({ caps });
await host.start();
```

Capability gaps degrade instead of blocking startup:

| Missing capability                       | Mode          |
| ---------------------------------------- | ------------- |
| Mouse SGR                                | keyboard-only |
| No colour / `mono`                       | monochrome    |
| No alternate screen / `altScreen: false` | inline        |

A degradation or fallback must not prevent startup when the interactive TTY essential is met. Show
the reason in text so monochrome and keyboard-only users receive the same information.

## How do I collect safe lifecycle diagnostics?

An active TUI owns stdout. `console.log` or another stdout write can corrupt the UI stream. Use a
screen-safe bounded ring or authorized file sink:

```ts
import { createLogger } from '@jsvision/core';

const lifecycleLog = createLogger({
  sink: 'ring',
  size: 100,
  level: 'info',
});
```

Record stable fields such as phase, signal category, exit code, TTY status, and capability mode.
Never record raw input, paste text, tokens, secrets, clipboard values, or visitor paths. Redact or
sanitize error context before it crosses the logger boundary.

Fatal host diagnostics are ordered after restoration, so stderr no longer competes with the active
screen. Host error formatting is not a sanitizer: never put raw input, tokens, or secrets in a
thrown error message or attached stack context. The course fixture is stricter: it retains category
names and bounded lengths only, never the thrown value.

## How do I compose crash safety with the application shell?

The application shell owns user intent; the host owns terminal safety:

```ts
import { Commands } from '@jsvision/ui';

app.onCommand('workspace.quit', () => {
  app.loop.emitCommand(Commands.quit, 0);
});

const code = await app.run();
process.exitCode = code;
```

Let modal validation or unsaved-work policy decide whether quit may proceed before emitting the
final quit command. Once a fatal signal or uncaught failure owns the path, do not open UI or begin
unbounded asynchronous work.

For a reusable embedding host, set `requireTty: false` only for a deliberate injected/headless
environment, and coordinate `exitOnSignal: false` with its supervisor policy. Neither flag weakens
the responsibility to call `stop()`.

## What belongs in advanced restoration?

Advanced work belongs at the real boundary that owns it:

- child-process tests verify OS signal delivery and conventional exit status;
- injected adapter tests verify deterministic restore ordering and handler removal;
- pseudo-terminal tests verify shell usability and terminal mode state;
- supervisor tests verify restart limits, backoff, and external termination; and
- platform matrices verify Windows and POSIX signal mappings.

An `EPIPE` output disconnect is treated as a clean end: best-effort restore, `onBeforeExit(0)`, then
exit code 0. Suspend/resume is a reversible soft leave, not a terminating restore. Keep both cases
separate from fatal exceptions in evidence and alerts.

No JavaScript cleanup can be guaranteed after unconditional external termination or a runtime that
cannot execute handlers. Operational supervision and shell recovery remain necessary production
layers; do not turn a tested host guarantee into a claim about every possible machine failure.

## How do I diagnose restoration failures?

| Symptom                               | Likely cause                       | Correction                            | Distinguishing evidence       |
| ------------------------------------- | ---------------------------------- | ------------------------------------- | ----------------------------- |
| Keystrokes do not echo after exit     | raw mode was not released          | use one awaited host owner            | missing `raw:off`             |
| Shell content seems missing           | alternate screen was not left      | keep host restoration intact          | no leave write before exit    |
| Cursor stays hidden                   | duplicate or incomplete mode owner | remove competing restore code         | enter/leave sequence mismatch |
| Failure text damages UI               | diagnostic written before restore  | use host fatal ordering and safe sink | diagnostic precedes restore   |
| Works on quit, fails on startup throw | backstop armed too late            | use public host startup               | no backstop before raw/enter  |
| Duplicate callbacks after restart     | handlers leaked across cycles      | await `stop()` and verify counts      | live handler count grows      |
| App refuses a usable mono terminal    | degradation treated as essential   | gate only interactive TTY             | `met: true` with degradations |

Start with the [Debugging](/guide/debugging) evidence ladder. Reproduce one exit path, capture
bounded ordering, identify its owner, change one boundary, and rerun the same scenario.

## What are the best practices?

- Prefer `await app.run()` for complete applications. Otherwise you must reproduce its loop, host,
  cursor, warning, and cleanup ownership.
- Put `start()` and `stop()` in one owned scope. Otherwise an early return or throw can strand the
  terminal.
- Keep one terminal restore owner. Competing handlers create ordering races and double exits.
- Arm recovery before acquisition. Partial setup is the path most likely to expose an unprotected
  terminal change.
- Keep restore idempotent and best-effort. Secondary failures must not block remaining restore
  steps or replace the original diagnosis.
- Preserve other owners' handlers. Remove only the callbacks your host registered.
- Keep diagnostics bounded and payload-free. Crash evidence is often shared when sensitivity is
  highest.
- Test deterministic ordering with an injected adapter, then test OS delivery separately. One does
  not prove the other.
- Treat keyboard reachability, monochrome state labels, inline mode, and ASCII-safe output as normal
  operating modes, not post-crash extras.

## What should I practice next?

1. Run the authentic artifact for normal, exception, rejection, and all three terminating signal
   categories. Explain each restore, callback, and exit position.
2. Break setup at the first terminal write. Verify the backstop was armed first and synchronous
   restoration occurs once.
3. Start and stop the same host repeatedly. Prove handler counts return to the pre-existing
   baseline and raw mode changes once per cycle.
4. Compare `evaluateEssentials()` for non-TTY, monochrome, no mouse, and no alternate screen.
   Explain which one blocks startup and why.
5. Inject a restore-step failure. Verify later best-effort steps still run and the original failure
   remains the primary diagnosis.
6. Design a supervisor test that sends a real signal to a child process without exposing visitor
   input or secrets.

Continue with [Displaying untrusted text safely](/guide/untrusted-text) and
[In production](/guide/in-production). [Terminal capabilities &
portability](/guide/terminal-capabilities) extends the degradation and platform matrix.

Public references:

- [`createHost()`](/api/core/functions/createHost)
- [`evaluateEssentials()`](/api/core/functions/evaluateEssentials)
- [`assertEssentials()`](/api/core/functions/assertEssentials)
- [`createApplication()`](/api/ui/functions/createApplication)
