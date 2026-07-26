# Code Editor — Discovery Notes

> **CodeOps Artifact Schema**: 1
> **Status**: Discovery complete
> **Last Updated**: 2026-07-23

## Purpose

Create a modern, terminal-native source-code editor for developers working inside a JSVision
application. The product is an editor, not an IDE: host applications retain responsibility for
files, workspaces, multiple editor windows, language-server processes, and broader application
chrome.

The previous feature draft is preserved under `codeops/_archive/code-editor/` as historical
evidence only. None of its product or technical decisions are authoritative for this discovery.

## Confirmed product direction

- Provide an embeddable `CodeEditor` component and a ready-made `CodeEditorWindow`.
- Preserve the existing general-purpose `Editor` API and behavior.
- Use one document per editor instance; applications open multiple editor instances for multiple
  files.
- Remain terminal-native, responsive, safe with hostile text, and independent of browser/DOM
  rendering.
- Support an industry-standard Language Server Protocol integration through a caller-provided
  transport/session.
- Keep language-server process spawning and supervision in a separate runtime adapter.
- Require explicit host authorization before applying edits outside the current document.
- Keep plain editing available when parsing or language intelligence is slow, unavailable, or
  fails.

## Launch languages

- PostgreSQL SQL
- JavaScript
- TypeScript

Bash is explicitly excluded.

## Accepted capability classification

### Version 1

- Syntax highlighting
- Line-number gutter
- Line/column/selection status
- Code folding
- Bracket assistance
- Indentation
- Comment toggle
- Search and replace
- Completion
- Caret-invoked hover information; mouse activation is optional
- Signature help
- Diagnostics
- Go-to navigation
- Document-symbol navigation
- Document/range formatting

### Later

- Multiple selections/carets
- Word wrapping
- Workspace-symbol navigation
- Rename
- Code actions
- Semantic tokens

## Confirmed document workflow

- `CodeEditor` edits an in-memory document and never reads or writes files directly.
- A file-bound adapter owns open, save, save-as, dirty-close validation, and external-change
  handling.
- `CodeEditorWindow` can host any configured `CodeEditor`; a separate convenience factory may open
  a file-backed editor.
- When a file changes externally while the editor is clean, the host asks before reloading it. When
  the editor is dirty, the host requires an explicit keep/reload/compare decision and never
  overwrites either version silently.
- Saving and closing remain available when parsing or language intelligence is unavailable.

## Confirmed language workflow

- The host supplies a document URI and may supply an explicit language identifier. Otherwise, the
  editor selects a language from the filename extension. Unknown files use plain-text mode.
- Language selection can change while a document remains open. Changing it cancels stale work and
  rebuilds language state without altering text or undo history.
- Multiple editors may share one host-provided LSP session for the same workspace and language.
- Same-document navigation moves the caret. Cross-document navigation emits a host request
  containing the target URI, range, and focus intent.
- PostgreSQL schema knowledge comes from the language service or host-provided metadata. The editor
  never opens a database connection or stores database credentials.
- Parser and language-service results are bound to a document revision. Stale results are discarded
  unless an operation explicitly supports safe rebasing.
- Closing or switching a document cancels outstanding requests, sends the applicable document
  lifecycle notification, and ignores late responses.

## Confirmed terminal interactions

| Surface | Normative interaction |
|---------|-----------------------|
| Completion | Anchored cell-based popup; arrows/page keys navigate; Enter/Tab accept; Escape closes |
| Hover | Explicit command/key at the caret; mouse hover is optional |
| Signature help | Non-modal popup near the caret, repositioned when space is limited |
| Diagnostics | Gutter severity marker, styled source range, and command to show the full message |
| Folding | Gutter marker plus commands/menu; keyboard shortcut is secondary |
| Go to definition | Command/key; the host opens another editor when the target URI differs |
| Formatting | Explicit document/range command |
| Status | Line, visual column, selection size, language, and language-service state |

Format-on-save is supported in version 1 as an opt-in document setting and is disabled by default.
Saving does not depend on formatter success: a failed, unavailable, timed-out, or stale formatting
request is reported separately and the unformatted current revision remains saveable.

## Confirmed degraded operation

- Expose visible service states: `plain`, `parsing`, `connecting`, `ready`, and `degraded`.
- Parser failure disables syntax-dependent features while editing, search, line numbers, status,
  saving, and closing remain available.
- LSP failure disables only LSP-provided features. Local parsing and editing features continue.
- Repeated failures update the status indicator without repeated modal dialogs; a details command
  exposes the latest error.
- The host-provided LSP session owns reconnect policy. After reconnection, the editor resynchronizes
  the current document before issuing feature requests.
- Completion, hover, signature, formatting, and navigation requests are cancellable. Superseded
  requests are cancelled or ignored.
- Diagnostic and parsing updates are coalesced so they cannot continually repaint or starve input.

## Confirmed security boundaries

- Treat document content, filenames, LSP messages, Markdown, diagnostics, completion text, and edits
  as untrusted input.
- Render LSP Markdown through a terminal-safe subset, ignore raw HTML, and sanitize control
  characters before drawing.
- Never execute an LSP command directly. Route it to a host authorization callback and require an
  allowlisted command identifier.
- Validate returned ranges, document versions, edit counts, replacement sizes, and URI schemes.
- Current-document edits may be previewed and applied by the editor. Cross-document edits always
  pass through the host's authorization and transactional application boundary.
- Bound message size, result count, diagnostic count, completion count, popup dimensions, and
  retained history.
- User-facing language-service errors exclude environment variables, credentials, and unrestricted
  process output.
- PostgreSQL schema completion contains names and types only unless the host explicitly provides
  more; credentials and table data do not enter editor completion state.

## Confirmed responsiveness profile

| Document tier | Required behavior |
|---------------|-------------------|
| Up to 1 MiB or 50,000 lines | All local features enabled; edit plus render remains within a 16 ms uncontended frame budget |
| 1–10 MiB | Editing, search, gutter, and status remain available; parsing is incremental and may disable expensive features when budgets are exceeded |
| Above 10 MiB | Open only after host or user confirmation; start in plain reduced-feature mode |
| LSP latency | Never blocks input or rendering; show pending state after 150 ms |
| Interactive request timeout | Default 5 seconds, configurable by the host; timeout degrades only that request |
| Parser scheduling | Bounded work slices with keyboard and input work taking priority |
| Result volume | Display bounded pages or lists and retain no unbounded server result |

The implementation plan must include a committed validation probe that determines parser slice
duration and bounded completion/diagnostic limits without weakening these observable requirements.

## Confirmed extension boundary

- Languages register through an open `LanguageAdapter` contract rather than a closed enum.
  PostgreSQL SQL, JavaScript, and TypeScript are the launch adapters.
- Parsing/highlighting and LSP intelligence are separate optional capabilities. A language may
  support either or both.
- Hosts supply adapter objects explicitly. The editor does not discover packages, dynamically
  import arbitrary paths, or install language support.
- Capability negotiation controls commands and indicators; unsupported operations are disabled.
- Commands are the canonical interaction API. Menus, keys, mouse actions, and application chrome
  invoke commands.
- Hosts may add or replace key bindings without mutating built-in command definitions. Conflicts
  are detected deterministically.
- Syntax styles use named semantic categories resolved through the JSVision theme system.
  Applications may override styles without changing parser output.
- LSP transports and process adapters are independently replaceable.
- Public adapter contracts are additive and versioned. Unknown capabilities and fields are ignored
  safely where protocol compatibility permits.

## Confirmed terminal and accessibility behavior

- Every required operation is accessible through the keyboard and command API; mouse support is
  never the sole path.
- Diagnostics, selection, folding, pending state, and active-line presentation do not rely on color
  alone.
- Unicode gutter and popup symbols have ASCII fallbacks; monochrome terminals retain all behavior.
- Narrow windows shorten status text, hide optional status fields, reduce popup width, and finally
  hide the line-number gutter if the text area would otherwise become unusable.
- Wide characters, combining marks, tabs, and UTF-16/LSP positions use explicit conversions between
  document offsets, protocol positions, and visual columns.
- Bidirectional and zero-width characters remain in document content while security-sensitive
  invisible controls receive a visible warning or placeholder.
- Completion, hover, signature, and diagnostic popups are dismissible and never trap focus.
- Version 1 supports read-only documents: navigation and language intelligence remain available
  while edit-producing commands are disabled.

## Confirmed snippet completion

- Version 1 supports LSP completion snippets with numbered placeholder ranges.
- Tab and Shift+Tab traverse placeholders; Escape ends snippet mode.
- An incompatible edit safely exits snippet mode.
- Snippets do not execute code, evaluate variables, or interpolate shell input.
- Unsupported snippet constructs fall back to safe plain text.

## Selected domain lenses

| Lens | Evidence |
|------|----------|
| Compiler and language | Syntax parsing, highlighting, language metadata, partial/invalid source, and incremental invalidation |
| Distributed and concurrent | Asynchronous parsing and LSP requests, cancellation, stale results, backpressure, and degraded dependencies |
| Data and migration | Existing `Editor` compatibility and evolution of public package/API boundaries |

## Historical implementation ideas requiring fresh evaluation

- Reusing selected headless CodeMirror packages
- Using Lezer parsers directly
- Package placement and dependency boundaries
- Extracting the existing editor into a separate package

These are candidates for later architecture evaluation, not requirements.

## Discovery outcome

All 24 ambiguity-register items were resolved, the consolidated scope was confirmed, and the
resulting requirements were approved as RD-01 through RD-05. The authoritative requirement-set
index is `../README.md`; these notes remain supporting discovery evidence only.
