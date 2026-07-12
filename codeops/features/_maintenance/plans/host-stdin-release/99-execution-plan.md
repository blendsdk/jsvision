# Task T-01: Release stdin on host `stop()` so the process exits after quit

> **Type**: Task (lightweight) · **Feature**: _maintenance · **CodeOps Skills Version**: 3.4.1
> **Progress**: 5/5 tasks (100%)
> **Last Updated**: 2026-07-12

## Objective

Fix GH #69: after the app quits, the Node process hangs (the shell prompt never returns until
`Ctrl+C`) even though the terminal is correctly restored. The host's `start()` attaches a `'data'`
listener to the input stream, which switches it to flowing mode and **refs the libuv handle** (that
ref is what keeps the process alive to receive keys). `stop()` removes the listener but never
releases the ref: removing the last `'data'` listener does **not** pause the stream, and
`setRawMode(false)` does not unref it. On the common `process.stdin` path `streams.dispose()` is a
no-op, so nothing releases the handle and the event loop cannot drain.

Release the input in `stop()` so the process can exit once the app has quit.

## Root cause (verified against source)

- `packages/core/src/engine/host/host.ts:270` — `start()` does `streams.input.on('data', dataListener)`
  (flowing mode → refs the handle).
- `packages/core/src/engine/host/host.ts:280-283` — `stop()` removes the listener but does nothing
  else to the input stream.
- `packages/core/src/engine/host/streams.ts:110` — the standard/injected `dispose()` is a documented
  no-op ("owned elsewhere — nothing to close"), so the common `process.stdin` path leaks.
- The POSIX `/dev/tty` bind path does **not** leak — its `dispose()` calls `input.destroy()`
  (`streams.ts:70`). Only the standard `process.stdin` path (the ordinary `npm start` case) hangs.

## Scope

- **IN:** `@jsvision/core` host — release the input stream in `stop()`; a spec + impl regression test.
- **OUT:** the `@jsvision/ui` desktop repaint fix (#67, already landed on this branch), the #68
  broad missing-flush audit, and the pre-existing v0.1.1 release debt (version-sync / CHANGELOG
  prettier) — all unrelated to this change.

## Design

- **D1 — Fix location: `host.ts` `stop()`, not `streams.ts` `dispose()`.** The host is what took the
  ref (it added the `'data'` listener in `start()`), so the host releases it in `stop()` — a
  symmetric `.on('data')` ⇄ `.pause()` pairing. `dispose()`'s contract is "close what this module
  opened"; the standard/injected input is explicitly *not* owned by that module, so pausing there
  would conflate two concerns and also fire from `detectTty()`'s probe path. One fix, one place.
- **D2 — `pause()`, not `unref()`.** `Readable.pause()` is Node's documented idiom for letting a
  stdin-reading process exit (it stops flowing mode and drops the read that holds the ref;
  `readline.close()` pauses its input for exactly this reason). It is defined on every `Readable`, so
  it is type-clean with no unsafe cast, unlike `unref()` (TTY/socket-only). `pause()` is harmless on
  the `/dev/tty` streams (destroyed anyway) and on injected test streams (never resumed).
- **D3 — Best-effort, restore-safe.** Wrap the `pause()` in a local `try/catch`. This host's core
  guarantee is terminal restore on every exit path; a (theoretical) throw from `pause()` must never
  jump over the `restore.run()` that follows. Placed right after the listener removal so the
  release reads as the counterpart to it.
- **D4 — Release only on `stop()` while running, never on `start()`.** The ref must be held for the
  whole session so keystrokes arrive; releasing early would break input. The existing `if (!running)
  return` guard in `stop()` already makes a never-started / double-`stop()` call a no-op.

## The fix (`packages/core/src/engine/host/host.ts`, in `stop()`)

```ts
if (streams && dataListener) {
  streams.input.removeListener('data', dataListener);
  // Removing the last 'data' listener does not pause the stream: the flowing-mode ref it took on
  // the input handle persists and keeps the Node event loop alive, so the process would hang after
  // the app quits instead of returning to the shell. Pause to release that ref. Best-effort — a
  // teardown throw must never jump over the terminal restore below.
  try {
    streams.input.pause();
  } catch {
    /* releasing the input is best-effort; restore still runs */
  }
  dataListener = null;
}
```

## Affected files

| File | Change |
|------|--------|
| `packages/core/src/engine/host/host.ts` | `stop()`: pause the input after removing the `'data'` listener (best-effort). |
| `packages/core/test/host-stop-release.spec.test.ts` | NEW — spec oracle (ST-1). |
| `packages/core/test/host-stop-release.impl.test.ts` | NEW — impl edge cases. |

## Specification test cases

- **ST-1 (spec oracle, from the issue's suggested regression test):** drive `start()` then `stop()`
  against an injected fake TTY input; the input is released — `input.pause()` is called by `stop()`.
  - **ST-1a:** after `start()` (before `stop()`), `input.pause()` has **not** been called — the ref
    is still held so keystrokes flow.
  - **ST-1b:** after `stop()`, `input.pause()` **has** been called — the ref is released.
- **ST-2 (impl):** `stop()` on a never-started host does **not** call `pause()` (the `!running`
  guard); a second `stop()` after a real one does not pause again.
- **ST-3 (impl):** the release does not break teardown — after `stop()` the last recorded raw-mode
  toggle is `false` (terminal restored) *and* `pause()` was called, proving the best-effort pause
  runs alongside, not instead of, the restore.

## Tasks

- [x] T-01.1 Write `host-stop-release.spec.test.ts` (ST-1a/ST-1b); run it → **red** (pause not yet called on stop).
- [x] T-01.2 Implement the `stop()` pause fix in `host.ts`; re-run the spec → **green**.
- [x] T-01.3 Write `host-stop-release.impl.test.ts` (ST-2, ST-3); run → green.
- [x] T-01.4 Run core unit suite + lint on the changed files.
- [x] T-01.5 Commit (`fix(host): …`, `closes #69`); close #67 + #69 on GitHub, leave #68 open.

**Verify**: `TUI_SKIP_PERF=1 yarn verify` (fix is validated by the `@jsvision/core` unit suite +
`eslint`/`prettier` on the touched files; the pre-existing v0.1.1 release debt in
`@jsvision/ui`/`@jsvision/web` `version.ts` + `CHANGELOG.md` prettier is unrelated and out of scope).

## Execution notes

- Spec-first: ST-1 was **red** before the fix (ST-1a green — input live while running; ST-1b failed —
  `pause()` not called on `stop()`), then **green** after adding the `stop()` pause. Confirmed the fix
  is load-bearing (removing it re-reds ST-1b).
- The `FakeInput` test double already exposes a no-op `pause()`, so the spy asserts the release with
  no change to the shared doubles.
- Verification (fix scope): `@jsvision/core` unit suite **722/722**, `eslint` + `prettier` clean on
  the 3 touched files, `tsc -p tsconfig.json --noEmit` clean, `check:docs` clean (no new public
  export — only internal code comments were added, so JSDoc governance is unaffected).
- The full `TUI_SKIP_PERF=1 yarn verify` remains red **only** on pre-existing, unrelated v0.1.1 release
  debt (`@jsvision/ui`/`@jsvision/web` `version.ts` = `0.1.0` vs `package.json` `0.1.1`, and
  `CHANGELOG.md` prettier failures) — reproduces on the pre-change baseline, out of scope here.
- Disposition: committed with `closes #69`; closed #67 (fixed by the earlier desktop commit on this
  branch) and #69 on GitHub; left #68 open (the broad missing-flush audit was never in scope).
