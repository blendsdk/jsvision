# Component: Host-neutral Clipboard Adapter API

> **Implements**: RD-01 R1.1–R1.5, R1.12
> **Status**: Ready for execution
> **CodeOps Artifact Schema**: 1

## Responsibility

Expose optional raw-text host callbacks at application and direct event-loop construction boundaries
without leaking Node, browser, terminal, or `clipboardy` types into SDK contracts.

## Public contracts

```ts
export type ClipboardTextWriter = (text: string) => void | Promise<void>;
export type ClipboardTextReader = () => string | Promise<string>;

export interface ApplicationOptions {
  readonly writeClipboardText?: ClipboardTextWriter;
  readonly readClipboardText?: ClipboardTextReader;
}

export interface EventLoopOptions {
  readonly writeClipboardText?: ClipboardTextWriter;
  readonly readClipboardText?: ClipboardTextReader;
}
```

Final names should follow the repository's exported-type conventions, but their semantics may not
change without reopening the plan. Every export receives junior-readable JSDoc and a practical
host-adapter example.

## Write path

1. Copy/cut commits raw selection text to the loop's canonical value synchronously.
2. The configured writer receives exactly that raw string.
3. Sync throw or async rejection emits the existing stable payload-free write warning.
4. Failure never rolls back canonical state or affects the input tick.
5. `run()` installs OSC 52 only when the application did not provide a writer.
6. Teardown clears runtime callback references after stopping the loop.

## Construction and compatibility

| Host | Configuration |
|---|---|
| `Application` consumer | Supplies reader/writer in application options; application threads them to its loop. |
| Direct `EventLoop` consumer | Supplies the same callbacks in loop options. |
| Existing terminal app | Omits callbacks and retains local clipboard plus capability-gated OSC 52 writer. |
| Browser bridge | Existing browser raw writer remains compatible; no new browser-read policy is implied. |

Existing runtime writer getter/setter or clearing seams remain compatible where tests/hosts use
them. Reader runtime clearing must be available to application teardown without exposing dependency
specific behavior.

## Error boundary

Callbacks are trusted host capabilities but their results are untrusted data. The UI layer accepts
only strings, bounds successful read content before adoption, and never records exception values.
No automatic retries, prompts, package installation, shell execution, or permission changes occur.

## Verification

Public API extraction, application/run/event-loop specifications, existing clipboard/browser/OSC
regressions, package typecheck, documentation checks, and `yarn verify`.
