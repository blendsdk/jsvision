# Testing Strategy: Native Clipboard

> **Status**: Ready for execution
> **CodeOps Artifact Schema**: 1

## Specification-first policy

Each phase first adds requirements-derived `.spec.test.ts` cases and records their expected red
failures against the verified baseline. Production work then turns those immutable oracles green.
Only afterward may `.impl.test.ts` cover internal mechanics. Tests use real event loops,
applications, views, and events; only the external host callback is faked.

## Test inventory

| ID | Layer | Required cases |
|---|---|---|
| ST-01 | Core bound spec | Empty, ASCII exact fit/overflow, 2/3/4-byte Unicode boundaries, combining/wide text, default 1 MiB cap, valid prefix, accurate flag |
| ST-02 | Core bound impl | Invalid custom caps, unchanged fast path, fixed allocation behavior, large adversarial string |
| ST-03 | Public adapter spec | Application/direct-loop reader and writer configuration; sync and async callbacks; exported types/API docs |
| ST-04 | Write compatibility spec | Canonical-first copy/cut, exact raw text, async rejection, sync throw, payload-free warning, no rollback |
| ST-05 | No-adapter spec | Local copy/paste and OSC 52 behavior unchanged; paste disabled semantics unchanged where previously disabled |
| ST-06 | Command routing spec | Existing app handler first; unhandled configured paste reads once; other commands unchanged; modal scope authoritative |
| ST-07 | Reader availability spec | Configured reader makes paste reachable with empty local state; removal restores registry behavior |
| ST-08 | Success spec | Unicode/newlines raw, bounded, canonical adoption before widget observation, one dispatch/paint |
| ST-09 | Empty spec | Canonical clears; Input, Editor, CodeEditor selection/value/history remain unchanged |
| ST-10 | Failure spec | One payload-free warning; current ordered canonical fallback delivered once; queue continues |
| ST-11 | Ordering spec | Deferred reads start one at a time and deliver A then B despite arbitrary settlement controls |
| ST-12 | Focus continuity spec | Stable route delivers; focus change, focus-away/back, ancestor replacement, hidden/disabled/unfocusable leaf drop |
| ST-13 | Modal continuity spec | Modal open, close, replacement, and same-scope churn drop stale work; stable modal delivers inside modal |
| ST-14 | Mount/lifecycle spec | Unmount, same-object remount, stop, teardown, and late rejection cause no adoption/dispatch/paint/leak |
| ST-15 | Event separation spec | Direct terminal/bracketed `PasteEvent` never calls reader and retains truncation metadata |
| ST-16 | Adapter spec | Faked `clipboardy` mapping for read/write, empty, Unicode, rejection, exact raw strings, no sync API |
| ST-17 | Headless/security spec | Missing-helper-like failures preserve usability and sentinel payload/error text never reaches diagnostics |
| ST-18 | Docs/plugin spec | Public seams, examples, shortcut caveats, platform/headless/fallback text, impact-map and generated-copy parity |

## Deterministic concurrency harness

Use deferred promises exposing explicit `resolve`/`reject` controls and an invocation log. Assert the
second reader has not started until the first request completes. Mutate focus/modal/mount/lifecycle
between capture and settlement, then assert canonical text, handler calls, invalidation, and paint
counts. A rejected tail must be observed as settled before scheduling the next request.

## Security assertions

- Include unique sentinel text in clipboard payloads and thrown host errors.
- Capture warning/debug sinks and assert neither raw nor encoded/preview forms occur.
- Prove truncation does not copy beyond the configured capacity into results.
- Prove callbacks receive no implicit shell commands, paths, environment details, or retry inputs.
- Treat external clipboard callbacks as untrusted input; only string success values enter bounding.

## Compatibility matrix

| Path | Regression proof |
|---|---|
| App-local copy/cut/paste | Existing tests plus ST-04/ST-05 |
| OSC 52 writer | Capability-gated run tests with no application writer |
| Browser writer | Existing bridge tests and callback type compatibility |
| Terminal bracketed paste | Decoder cap/truncation tests and ST-15 |
| Application commands | Handled/unhandled precedence in ST-06 |
| Input/Editor/CodeEditor | Non-empty existing behavior plus ST-09 |
| Stop/dispose | Existing lifecycle tests plus ST-14 |

## Focused commands

Execution should discover exact workspace scripts before use. Expected focused gates are:

```text
yarn workspace @jsvision/core typecheck
yarn workspace @jsvision/core test
yarn workspace @jsvision/ui typecheck
yarn workspace @jsvision/ui test
yarn workspace @jsvision/examples typecheck
yarn workspace @jsvision/examples test
yarn plugin:update
yarn plugin:check
yarn verify
```

`yarn verify` is authoritative. `plugin:update` is a mutation and runs only after canonical sources
are correct; its diff must be reviewed before commit.

## Manual acceptance record

| OS/session | Terminal | Copy out | Paste in | Empty | Failure fallback | Status/evidence |
|---|---|---:|---:|---:|---:|---|
| Linux X11 | GNOME Terminal | — | — | — | — | Pending execution |
| Linux Wayland | GNOME Terminal | — | — | — | — | Pending execution |
| macOS | Terminal/iTerm2 available to executor | — | — | — | — | Pending/unavailable |
| Windows | Windows Terminal available to executor | — | — | — | — | Pending/unavailable |
| Headless/SSH | Available shell | — | — | — | — | Pending execution |

Manual cells cannot replace automated acceptance and may not be marked passed without direct
observation.
