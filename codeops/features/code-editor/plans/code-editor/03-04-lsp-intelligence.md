# LSP Intelligence: Code Editor

> **Document**: 03-04-lsp-intelligence.md
> **Parent**: [Index](00-index.md)

## Overview

The LSP coordinator implements editor-side LSP 3.18 semantics over a transport-neutral session.
Raw protocol data is validated into bounded internal DTOs before presentation or mutation
(AR-P08–AR-P10, AR-P13).

## Session and lifecycle

```ts
interface CodeEditorLspSession {
  readonly contractVersion: 1;
  readonly state: ReadonlySignal<LspSessionState>;
  request<M extends SupportedRequest>(request: LspRequest<M>): CancellablePromise<LspResult<M>>;
  notify<M extends SupportedNotification>(notification: LspNotification<M>): Promise<void>;
  subscribe(listener: LspNotificationListener): Disposable;
}
```

The coordinator owns didOpen/change/close ordering, negotiated sync, capabilities, protocol
versions, pending requests, stale-result rejection, and resynchronization. The session/Node adapter
owns initialization, transport, process, reconnect, and shutdown. Multiple editors can share one
session without sharing document state (AR-P08–AR-P10).

## Feature controllers

- Completion filters bounded items and applies validated primary/additional edits atomically.
- The safe snippet parser supports numbered placeholders and final tab stop; unsupported constructs
  become plain text and no variable or command is evaluated.
- Hover/signature controllers parse only the approved bounded safe-Markdown subset.
- Diagnostics retain bounded overlapping validated ranges with version/session semantics.
- Navigation/symbol controllers handle current-document targets locally and emit typed host effects
  for other URIs.
- Formatting normalizes valid current-document edits into one transaction. Format-on-save is
  opt-in and failure never blocks the unformatted save path (AR-P15).

## Runtime adapter

`@jsvision/code-editor/node` may wrap official JSON-RPC/stdin/stdout process primitives. It accepts
an executable and argument configuration already authorized by the host; it never derives commands
from document/server content, never invokes a shell, and bounds/log-sanitizes server output.
Process policy remains opt-in host authority (AR-P09, AR-P13, AR-P24).

## Error handling

| Error case | Strategy | AR Ref |
|------------|----------|--------|
| Late/cancelled/wrong-generation response | Discard at coordinator and final consumer boundary | AR-P10 |
| Malformed/oversized protocol data | Reject before conversion/retention; degrade operation only | AR-P13, AR-P14 |
| Timeout/server failure | End operation, rate-limit safe status, retain local editing | AR-P07, AR-P10 |
| Cross-document edit/command | Emit typed request; require host allowlist/transaction | AR-P24 |
| Format-on-save failure | Report outcome and submit current unformatted revision | AR-P15 |

## Testing requirements

- Deterministic shared-session lifecycle/race/reconnect/capability tests.
- Feature specification tests for every RD-03 operation.
- Protocol, URI, Markdown, snippets, range, flood, and terminal-control fuzz/security tests.
- Node adapter process tests use a committed inert fixture server, never a production server.
