# RD-03: Language Server Intelligence

> **Document**: RD-03-language-server-intelligence.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: JSVision Code Editor
> **Depends On**: RD-01, RD-02
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

The code editor must add asynchronous language intelligence without becoming responsible for a
workspace or a language-server process. It integrates with the Language Server Protocol (LSP)
through a host-provided session and maps supported server capabilities onto terminal-native
commands and presentations.

Completion, snippets, hover, signature help, diagnostics, navigation, document symbols, and
formatting are version 1 capabilities. Workspace symbols, rename, code actions, semantic tokens,
and direct execution of server commands are outside version 1. Every language-service result is
untrusted and revision-sensitive; failure or absence of the service never removes plain editing,
local language features, saving, or closing. (AR-03, AR-05, AR-06, AR-12, AR-13, AR-17, AR-20,
AR-23)

---

## Functional Requirements

### Must Have

#### FR-3.1 — Host-provided LSP session *(Complexity: L; AR-03, AR-10)*

- [ ] Integrate with Language Server Protocol 3.18 over an asynchronous, caller-provided session
      contract that carries JSON-RPC requests, responses, notifications, cancellation, and
      lifecycle state without depending on a browser or DOM.
- [ ] Allow multiple editors to share one session; correlate all traffic by document URI, request
      identity, and document revision so results cannot leak between editor instances.
- [ ] Keep transport selection, server process spawning, supervision, initialization options,
      workspace folders, reconnection, and shutdown outside `CodeEditor`.
- [ ] Permit a separate runtime adapter to provide those process and transport responsibilities
      without making that adapter mandatory for embedded use.
- [ ] Negotiate static and dynamic server capabilities and enable only the commands supported by
      both the active `LanguageAdapter` and current session.
- [ ] Treat unknown additive protocol fields and capabilities as ignorable; report malformed
      messages or incompatible required behavior without terminating the editor.

#### FR-3.2 — Document synchronization and revision safety *(Complexity: XL; AR-05, AR-12)*

- [ ] Send `textDocument/didOpen`, ordered `textDocument/didChange`, and
      `textDocument/didClose` notifications for an active URI using the negotiated synchronization
      kind and a monotonically increasing protocol version.
- [ ] Do not issue document requests until the session has synchronized the current text after
      initial connection, reconnection, or language/session replacement.
- [ ] Bind every request to the initiating document revision and discard a response when the
      document, URI, language, or session generation no longer matches, unless the operation has an
      explicitly specified and validated rebase rule.
- [ ] Cancel superseded completion, hover, signature, navigation, symbol, and formatting requests
      when supported, and ignore their late responses regardless of cancellation support.
- [ ] On document close, URI change, language change, or session replacement, close the old
      protocol document, cancel its outstanding work, and ignore all subsequent old-generation
      messages.
- [ ] Coalesce synchronization and diagnostic presentation without reordering changes or starving
      keyboard input.

#### FR-3.3 — Completion and snippet interaction *(Complexity: XL; AR-06, AR-17)*

- [ ] Offer completion by explicit command and, when configured, after server-declared trigger
      characters or a host-configurable idle delay.
- [ ] Show a bounded, anchored cell-based list with label, kind, and concise detail; arrows and page
      keys navigate, Enter or Tab accepts, Escape dismisses, and typing continues to edit/filter
      without trapping focus.
- [ ] Give an open completion popup deterministic priority for its documented navigation and
      acceptance keys while leaving unrelated editor commands available.
- [ ] Validate the primary text edit, any additional current-document edits, insert/replace ranges,
      and commit characters against the initiating revision before applying them as one undo unit.
- [ ] Never apply cross-document completion edits inside the editor; submit them to the host
      authorization boundary defined by FR-3.8.
- [ ] Support LSP snippet syntax for numbered placeholders and final tab stop. Tab and Shift+Tab
      traverse placeholders, Escape exits, and edits that invalidate placeholder ranges safely end
      snippet mode.
- [ ] Treat snippet text as data: never evaluate variables, execute code, interpolate shell input,
      or honor command-bearing constructs. Unsupported constructs degrade to safe plain insertion.
- [ ] Bound retained completion items and documentation; present additional results through
      bounded paging or server-supported incomplete-result refresh.

#### FR-3.4 — Hover and signature help *(Complexity: L; AR-06, AR-13)*

- [ ] Request hover only through an explicit caret command/key in version 1; mouse-triggered hover
      may be added without changing the command contract.
- [ ] Request signature help through explicit invocation and server-declared trigger or retrigger
      characters.
- [ ] Render hover and signature content in dismissible, non-modal terminal popups anchored near
      the caret and repositioned or clipped to remain within the editor viewport.
- [ ] Render plaintext directly and Markdown through the safe subset in FR-3.9; ignore raw HTML.
- [ ] Visually identify the active signature and parameter without relying only on color.
- [ ] Close or refresh stale popups when caret context, document revision, session generation, or
      active signature changes.

#### FR-3.5 — Diagnostics *(Complexity: XL; AR-05, AR-06, AR-12)*

- [ ] Accept publish-diagnostic updates for the current URI and associate them with the stated
      document version when present.
- [ ] Reject versioned diagnostics for an obsolete revision. For unversioned diagnostics, replace
      the prior set only for the matching URI/session generation and label the set as unversioned.
- [ ] Present diagnostics through bounded gutter severity markers, styled source ranges, status
      counts, and a command that opens the full sanitized message.
- [ ] Preserve overlapping diagnostics and deterministic severity ordering without allowing
      diagnostics to hide the caret or selection.
- [ ] Coalesce rapid diagnostic updates and cap retained/displayed results while exposing that the
      server result was truncated.
- [ ] Clear diagnostics on document close, URI/language/session replacement, or an authoritative
      empty result for the active document.

#### FR-3.6 — Navigation and document symbols *(Complexity: L; AR-06, AR-20)*

- [ ] Provide commands for supported definition-style navigation and document-symbol navigation;
      disable each command when its server capability is absent.
- [ ] Validate and normalize locations, location links, symbol ranges, and selection ranges before
      presentation or navigation.
- [ ] For a valid target in the current document, move the caret, reveal the range, and retain a
      bounded navigation-back location.
- [ ] For a target with another URI, emit a host navigation request containing the URI, range,
      origin revision, and focus intent; the editor never opens or reads that resource directly.
- [ ] When multiple targets exist, show a bounded keyboard-operable chooser rather than selecting
      an arbitrary target.
- [ ] Show document symbols as a bounded hierarchical or flat chooser according to valid server
      data; selecting one navigates within the current document only.
- [ ] Report no-result, invalid-result, timeout, and host-rejected navigation non-modally without
      changing the document.

#### FR-3.7 — Document and range formatting *(Complexity: XL; AR-13, AR-20)*

- [ ] Provide explicit document-format and selected-range-format commands when advertised by the
      server.
- [ ] Validate that formatting edits target the active URI, are non-overlapping or deterministically
      normalizable, stay within the initiating revision, and satisfy configured count and
      replacement-size limits.
- [ ] Apply a successful explicit formatting response as one undo unit while preserving a valid
      caret/selection mapping.
- [ ] Support an opt-in per-document format-on-save setting that is disabled by default.
- [ ] On save, request formatting for the current revision before handing text to the host. Apply
      and submit the formatted revision only when the response is valid and current.
- [ ] A missing formatter, timeout, cancellation, invalid/stale response, or server failure must not
      block save; report the formatting outcome separately and allow the host to save the
      unformatted current revision.
- [ ] Reject all formatting edits in read-only mode while permitting non-mutating intelligence.

#### FR-3.8 — Host-mediated cross-document effects *(Complexity: XL; AR-13, AR-20)*

- [ ] Represent cross-document navigation and edits as typed host requests; never read, open,
      modify, or save another URI directly.
- [ ] Include originating URI, revision, session generation, target URIs/ranges, operation kind,
      and focus intent needed for host validation.
- [ ] Require explicit host authorization before any cross-document edit is applied.
- [ ] Require the host to validate all target versions and apply an authorized multi-document edit
      transactionally or reject it without partial application.
- [ ] Never execute an LSP `Command`. A command identifier may be forwarded only to a host callback
      that applies an explicit allowlist and owns execution.
- [ ] Treat host rejection, unsupported URI schemes, version conflicts, and partial-capability
      responses as non-modal operation failures with no current-document mutation.

#### FR-3.9 — Untrusted protocol-content boundary *(Complexity: XL; AR-13, AR-23)*

- [ ] Validate JSON-RPC envelopes, method names, IDs, document URIs, protocol positions, ranges,
      versions, edit topology, item counts, nesting depth, and text/message sizes before use.
- [ ] Accept only host-configured URI schemes and reject traversal or ambiguous resource identities
      after host canonicalization.
- [ ] Sanitize all control characters before terminal rendering, including diagnostic, completion,
      hover, signature, symbol, error, and server-log content.
- [ ] Support a terminal-safe Markdown subset limited to plain paragraphs, emphasis, strong text,
      inline code, fenced code, and bounded lists; render links as inert labeled text and ignore raw
      HTML, images, embedded resources, and executable constructs.
- [ ] Never expose environment variables, credentials, unrestricted server output, or protocol
      payload dumps in user-facing errors.
- [ ] PostgreSQL intelligence may retain schema object names and types supplied by the host or
      language service, but the editor must never connect to PostgreSQL or retain credentials or
      table-row data.

#### FR-3.10 — Service state, timeouts, and recovery *(Complexity: L; AR-05, AR-12)*

- [ ] Reflect LSP lifecycle through the shared `plain`, `connecting`, `ready`, and `degraded`
      service states without overwriting independent local parsing state.
- [ ] Never block input or rendering while waiting for the server; expose a pending indicator when
      an interactive request remains unresolved for 150 milliseconds.
- [ ] Use a host-configurable interactive timeout with a 5-second default. Timeout or cancellation
      fails only that operation and does not itself disconnect the session.
- [ ] Rate-limit repeated user-visible failures and retain one sanitized latest-error detail for an
      explicit status command.
- [ ] Let the host/session own reconnection. After reconnection, resynchronize the active document
      before returning to `ready` or issuing document requests.
- [ ] Continue editing, local parsing, search, line numbers, status, save, and close while the
      session is absent, connecting, degraded, timed out, or reconnecting.

### Should Have

#### FR-3.11 — Completion configuration *(Complexity: M; AR-06)*

- [ ] Allow the host to configure automatic completion on/off, idle delay, visible result count,
      and acceptance keys within bounded safe ranges.
- [ ] Preserve explicit completion even when automatic completion is disabled.

### Could Have

#### FR-3.12 — Mouse hover activation *(Complexity: M; AR-06)*

- [ ] A host may enable delayed mouse hover when terminal mouse tracking and stable cell-to-source
      mapping are available.
- [ ] Mouse hover must use the same request, sanitation, cancellation, and popup behavior as the
      explicit hover command.

### Won't Have (Version 1)

- [ ] Workspace-symbol navigation.
- [ ] Rename.
- [ ] Code actions.
- [ ] Semantic tokens.
- [ ] Editor-owned language-server process or workspace management.
- [ ] Direct execution of server commands.

---

## Constraints

- The editor depends only on protocol/session abstractions and terminal-native JSVision surfaces;
  it must not require browser, DOM, Electron, or VS Code internals.
- PostgreSQL SQL, JavaScript, and TypeScript adapters may provide different LSP servers and
  capability subsets while obeying one editor-side contract.
- Protocol positions use UTF-16 code units as required by LSP unless a negotiated position encoding
  says otherwise; conversion to document offsets and visual columns uses RD-02's validated mapping.
- Language-server availability is optional at runtime.
- All edit-producing language-service operations must respect RD-01's document revision, undo, host
  I/O, and read-only contracts.

---

## Acceptance Criteria

1. [ ] Two editors sharing one fake session receive only responses and diagnostics matching their
       URI, request identity, session generation, and revision across interleaved traffic.
2. [ ] Open, incremental/full change (as negotiated), close, reconnect, language switch, and URI
       change produce correctly ordered lifecycle messages; no request is sent before the current
       document has been resynchronized.
3. [ ] Late responses after edit, cancellation, close, language switch, or reconnect do not change
       text, selection, diagnostics, popups, navigation, undo history, or service state.
4. [ ] Explicit and triggered completion work with bounded results; keyboard filtering,
       navigation, acceptance, dismissal, and unrelated commands follow FR-3.3 without trapping
       focus.
5. [ ] A completion with a primary edit, valid additional same-document edits, and numbered snippet
       placeholders applies as one undo unit; Tab/Shift+Tab traverse; Escape and a conflicting edit
       exit safely; unsupported or malicious snippet constructs never execute.
6. [ ] Hover and signature popups render plaintext and the allowed Markdown subset, reposition in a
       narrow viewport, identify the active parameter without color alone, and disappear when their
       context becomes stale.
7. [ ] Versioned stale diagnostics are rejected; an authoritative empty current result clears
       diagnostics; overlapping and truncated results retain deterministic markers, ranges, counts,
       and sanitized detail access.
8. [ ] Same-document definition and symbol targets move and reveal the caret; multiple targets use
       a bounded chooser; cross-document targets emit a host request and never access a file.
9. [ ] Explicit document and range formatting apply valid current edits as one undo unit and reject
       overlapping, out-of-range, oversized, stale, foreign-URI, or read-only edits.
10. [ ] Format-on-save is off by default. When enabled, valid formatting is included in the saved
        revision, while timeout, failure, cancellation, unavailable capability, or stale/invalid
        edits still allow the unformatted current revision to be saved with a separate outcome.
11. [ ] Cross-document edits cannot mutate any document without explicit host authorization; a
        version conflict or target failure produces zero partial application.
12. [ ] Fuzzed protocol content containing malformed envelopes, invalid encodings/ranges, hostile
        URIs, deep Markdown, raw HTML, terminal escapes, bidi controls, huge lists, and oversized
        edits is rejected or safely bounded and emits no unsafe terminal sequence.
13. [ ] An LSP command is never executed by the editor; only an allowlisted identifier reaches the
        host callback, and rejection has no document effect.
14. [ ] A PostgreSQL language-service fixture can contribute schema names and types, while tests
        demonstrate that no database connection, credential, or table-row data enters editor state.
15. [ ] Requests show pending state after 150 milliseconds, use the configured timeout (5 seconds
        by default), and leave input/rendering responsive before, during, and after timeout.
16. [ ] With no session, a failed session, or a reconnecting session, editing, local parsing,
        search, gutter, status, save, and close continue; capability commands disable or report
        unavailability non-modally.
17. [ ] All version 1 intelligence remains keyboard/command accessible and functional in a
        terminal test environment with no browser or DOM globals.

---

## Techdocs Update

When implemented, document the LSP session and runtime-adapter boundaries, lifecycle and
resynchronization sequence, capability mapping, request cancellation/revision model, host
navigation and transactional-edit contracts, safe Markdown subset, snippet subset, diagnostic
version policy, formatting/save sequence, configurable bounds, and supported launch-language
server integrations. Record the selected LSP client/session architecture in an ADR during planning
or implementation.
