# Code Editor architecture

The Code Editor is a terminal-native, document-scoped editor. It deliberately separates exact
source state, language computation, language-server intelligence, terminal presentation, and
host-owned effects so each boundary remains deterministic and independently testable.

## Component boundaries

| Layer      | Responsibility                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Document   | Exact text, positions, revision identity, selection, history, search, and size tier                                      |
| Languages  | Public adapters, scheduling, syntax spans, folds, brackets, indentation, and comments                                    |
| LSP        | Protocol validation, document synchronization, cancellation, stale-result rejection, and bounded presentation            |
| Controller | One resolved safety policy, host effects, degradation, and content-free observations                                     |
| UI         | Keyboard and pointer routing, viewport/scroll ownership, terminal-cell projection, window chrome, status, and assistance |
| Theme      | Stable semantic roles resolved from application, override, or independent palette sources                                |
| Node       | Optional process and JSON-RPC transport kept outside the browser-neutral root entry point                                |

All source mutation passes through a document transaction. Asynchronous language and protocol
results carry document identity and are discarded when stale. Effects outside one document—save,
close, navigation, commands, and cross-document edits—are requests to the embedding application.

The document model maintains exact per-line terminal widths and sparse source-to-column
checkpoints alongside each accepted transaction. Simple local edits update or shift that geometry
without rescanning long unchanged suffixes. The viewport owns clamped horizontal and vertical
offsets, maps terminal cells back to source offsets through the same grapheme model used for
projection, and minimally reveals the active caret after editing or navigation. Window scrollbars
are passive controls bound to those offsets; they do not independently derive document geometry.

## Safety and degradation

One controller limit policy bounds document bytes and lines, edits, history, diagnostics,
completions, decorations, popup geometry, protocol messages, and observations. Input objects are
read through descriptor-safe validation so getters and hostile prototypes cannot execute during
normalization. Terminal control characters are projected as safe visible cells.

Failure is local: parser, protocol, host-callback, and presentation failures produce bounded,
content-free degradation state while core editing remains available whenever safe. Disposal
cancels or releases history, protocol requests, assistance state, and observation delivery.

## Example integration

`packages/examples/code-editor-demo/` is the exhaustive standalone kitchen sink. Its scenario
registry and simulated in-process language-service session are deterministic and use only public
package boundaries. The repository kitchen sink carries a smaller representative Code Editor
story. Neither example accesses a browser, network, database, workspace, credentials, external
language server, or arbitrary user files.
