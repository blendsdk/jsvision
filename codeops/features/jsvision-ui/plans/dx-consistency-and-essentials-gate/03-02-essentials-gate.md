# 03-02 — P7: essentials gate in `run()`

Implements FR-6…FR-8. Decision: AR-3 (opt-out flag, default on). Zero new `@jsvision/core` surface (NFR-1).

## New option

`ApplicationOptions` gains:

```ts
  /**
   * Require an interactive TTY at startup. When `true` (the default), `run()` asserts the terminal
   * essentials before taking over the screen and throws `EssentialsNotMetError` when there is no
   * interactive terminal at all — a cron/CI job, a container with no tty, or stdin and stdout both
   * redirected with no controlling terminal — instead of silently starting a keyboard-less app.
   * (Piping output while a controlling terminal exists still works: the host binds `/dev/tty`.) Set
   * `false` for headless/automated runs that drive the loop without a real terminal.
   */
  requireTty?: boolean;
```

Thread it through `createApplication` into the assembled `RunContext` (alongside `caps`/`quitState`),
and add the field to `RunContext` (`packages/ui/src/app/run.ts`):

```ts
  /** Assert an interactive TTY before starting (default true). See {@link ApplicationOptions.requireTty}. */
  readonly requireTty?: boolean;
```

## The gate

In `runApplication`, imports:

```ts
import { createHost, cursor, assertEssentials, detectTty } from '@jsvision/core';
```

Immediately before `await host.start()` (`run.ts:122`):

```ts
  // Fail fast on an unusable terminal: a non-TTY launch (piped output, no keyboard) would otherwise
  // start a screen-owning app with no input. `detectTty` reads the injected streams, so an opted-in
  // headless run (`requireTty: false`) or a test double is never mis-judged.
  if (ctx.requireTty ?? true) {
    assertEssentials(ctx.caps, { isTTY: detectTty({ input: ctx.input, output: ctx.output }) });
  }
  try {
    await host.start();
    // …
```

`assertEssentials` throws `EssentialsNotMetError` (message: *"Terminal does not meet the SDK
essentials: interactive TTY (raw-mode keyboard input)."*) when `isTTY` is false; otherwise returns and
`run()` proceeds unchanged. `detectTty` returns `true` when both stream ends are a TTY **or** the
POSIX `/dev/tty` fallback binds (piped output with a controlling terminal is fine), so `isTTY` is
false only for a genuinely non-interactive launch. The throw happens **before** `host.start()`, so no
terminal state is ever entered on the failing path — nothing to restore.

## Headless callers

The `run()`-driving app-shell tests set `requireTty: false` in their shared harness (their fakes
present no TTY by design). The interactive demos keep the default so a mis-launch (piped output) fails
loudly with the actionable message — which is the whole point of the proposal.

## `@example` (on `ApplicationOptions.requireTty` and/or the class)

```ts
// A headless integration test drives run() without a terminal:
const app = createApplication({ caps, requireTty: false });
const exit = app.run(); // starts against injected streams; no EssentialsNotMetError
```
