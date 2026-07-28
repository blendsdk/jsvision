# RD-01: Editor Surface and Document Lifecycle

> **Document**: RD-01-editor-surface-and-document-lifecycle.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: JSVision Code Editor
> **Depends On**: —
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

JSVision applications need an embeddable source-code editor that behaves like a modern editor
without turning the existing general-purpose text editor into an IDE. This requirement defines the
public product surface, document ownership, commands, status, read-only behavior, and host
integration shared by every language feature.

The feature provides a `CodeEditor` component and a ready-made `CodeEditorWindow`. Each editor owns
one in-memory document. The host application owns files, workspaces, multiple editor instances,
language-server processes, and cross-document operations. The existing `Editor` remains compatible
and does not acquire code-editor defaults. (AR-01, AR-04)

---

## Functional Requirements

### Must Have

#### FR-1.1 — Component and window surfaces *(Complexity: M; AR-01)*

- [ ] Provide an embeddable `CodeEditor` component.
- [ ] Provide a ready-made `CodeEditorWindow` that hosts a configured `CodeEditor` with scroll
      controls and status information.
- [ ] Allow applications to host `CodeEditor` in other JSVision containers without constructing a
      window.
- [ ] Do not add code-editor presentation or language behavior to a plain existing `Editor`.

#### FR-1.2 — One in-memory document per editor *(Complexity: M; AR-04, AR-19)*

- [ ] Each `CodeEditor` owns exactly one active in-memory document.
- [ ] A document exposes its text, monotonically increasing revision, optional URI, optional
      explicit language identifier, read-only state, modified state, and line-ending metadata.
- [ ] The host may replace the active document. Replacement cancels document-scoped asynchronous
      work and starts a new revision lineage without merging undo history.
- [ ] Multiple files are represented by multiple editor instances; this feature does not manage an
      editor collection or tab set.
- [ ] An untitled document may use a stable synthetic URI supplied by the host. Without a URI,
      local editing remains available and URI-dependent language services remain disabled.

#### FR-1.3 — Host-owned persistence *(Complexity: M; AR-04, AR-14)*

- [ ] `CodeEditor` performs no direct filesystem, database, network, or process operation.
- [ ] A file-bound adapter may provide open, save, save-as, dirty-close validation, and external
      change detection through host-owned services.
- [ ] Saving and closing remain possible while parsing or language services are unavailable.
- [ ] When an externally changed document is unmodified locally, the host asks before replacing its
      text.
- [ ] When an externally changed document is modified locally, the host offers keep, reload, and
      compare choices; no choice silently overwrites either version.

#### FR-1.4 — Commands and input bindings *(Complexity: M; AR-18, AR-24)*

- [ ] Every editor operation has a canonical command identifier callable independently of menus,
      keys, or mouse input.
- [ ] Built-in, language-adapter, and host bindings resolve through one keybinding registry.
- [ ] Duplicate bindings fail configuration with a descriptive conflict identifying both commands,
      unless the host explicitly overrides that exact binding.
- [ ] Menus, keyboard bindings, mouse affordances, and application chrome invoke commands instead
      of duplicating editor behavior.
- [ ] When a completion popup is open, it receives Enter and Tab before editor commands. When a
      snippet session is active, Tab and Shift+Tab next traverse placeholders. Otherwise Tab invokes
      indentation.

#### FR-1.5 — Read-only documents *(Complexity: S; AR-23)*

- [ ] Read-only mode disables typing, deletion, indentation, comment toggling, completion
      acceptance, snippets, formatting, and every other edit-producing command.
- [ ] Read-only mode rejects edit-producing parser or language-service results.
- [ ] Selection, copying, search, folding, navigation, hover, diagnostics, completion browsing, and
      status remain available.
- [ ] Switching read-only mode does not change text, selection, scroll position, folds, or undo
      history.

#### FR-1.6 — Status and observable state *(Complexity: M; AR-07, AR-11)*

- [ ] Expose reactive state for document revision, modified state, caret line, visual column,
      selection length, language identifier, read-only state, and language-service state.
- [ ] Language-service state uses the visible states `plain`, `parsing`, `connecting`, `ready`, and
      `degraded`.
- [ ] `CodeEditorWindow` displays line and visual column at minimum; it displays selection size,
      language, and service state when width permits.
- [ ] Narrow-window reduction follows this order: shorten status labels, hide optional status
      fields, reduce popup width, then hide the line-number gutter if the text area would otherwise
      have no usable column.

#### FR-1.7 — Undo transaction boundary *(Complexity: M; AR-15)*

- [ ] A single accepted completion, initial snippet insertion, formatting result, or accepted
      language-service edit set creates exactly one undo step.
- [ ] Undoing that step restores the exact document text and selection that preceded the operation.
- [ ] Snippet placeholder navigation creates no undo entry; text entered at placeholders follows
      normal user-edit grouping.
- [ ] A rejected, cancelled, invalid, read-only, or stale edit creates no undo entry.

### Should Have

- [ ] A convenience factory may combine a host file adapter, `CodeEditor`, and
      `CodeEditorWindow`, following the existing file-editor composition without making persistence
      part of `CodeEditor`.

### Won't Have (Out of Scope)

- IDE shell, file explorer, project manager, terminal, debugger, build runner, source-control UI,
  or multi-editor manager — owned by the host application (AR-01).
- Multiple carets and multiple selections — post-v1 capability (AR-02).
- Word wrapping — post-v1 capability (AR-02).
- Parser, syntax presentation, and language intelligence behavior — RD-02 and RD-03.

---

## Technical Requirements

### Document identity and revisions

- A revision identifies one exact text state within one document lineage.
- Every successful text mutation increments the revision exactly once, including an atomic
  multi-range edit.
- Replacing the document creates a new lineage so a result from the prior document can never match a
  revision in the replacement.
- Document offsets use UTF-16 code units. Visual columns and protocol line/character positions are
  separate typed concepts and require explicit conversion. (AR-11)

### Host contracts

The public contracts must separate:

1. document content and editor state;
2. persistence and external-change handling;
3. URI navigation and cross-document mutation;
4. language adapters and language-service sessions; and
5. commands and input bindings.

The requirement selects these responsibilities, not their package placement or implementation
classes. Reusing CodeMirror, Lezer, or another engine remains an implementation decision.

### Compatibility

- Existing `Editor` construction, defaults, editing behavior, exports, and tests remain supported.
- `CodeEditor` may reuse or compose existing editing internals, but code-oriented defaults are
  activated only through `CodeEditor`.
- Any future package move requires its own compatibility decision and migration contract; this RD
  authorizes no public compatibility break. (AR-01, AR-10)

---

## Integration Points

### With RD-02 (Local Language Features)

RD-02 consumes document snapshots, revision notifications, commands, typed positions, status, and
theme integration without taking ownership of persistence.

### With RD-03 (Language Server Intelligence)

RD-03 consumes document URI/revision lifecycle, host navigation and edit authorization, command
availability, read-only state, and atomic edit transactions.

### With RD-04 (Quality, Security, and Performance)

RD-04 validates compatibility, responsiveness, terminal degradation, untrusted-input handling, and
bounded resource use across this surface.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Product surface | IDE / window only / component plus window | Component plus ready-made window | Supports embedding without imposing an IDE shell | AR-01 |
| Document ownership | Editor-managed files / one in-memory document with host persistence | Host-owned persistence | Matches current JSVision separation and keeps the component runtime-neutral | AR-04 |
| Existing editor | Change existing defaults / preserve and add `CodeEditor` | Preserve existing `Editor` | Avoids turning general text controls into code editors | AR-01 |
| Untitled identity | Editor-generated URI / host URI / no service | Optional host synthetic URI; otherwise no URI-dependent service | Keeps identity ownership with the host | AR-19 |
| Undo grouping | Provider-defined steps / one logical operation | One atomic step | Predictable reversal and no partial provider edits | AR-15 |
| Binding conflicts | Silent priority / explicit conflict and override | Explicit conflict and exact override | Deterministic configuration | AR-24 |
| Read-only service edits | Apply with preview / reject edits | Reject edit-producing operations | Read-only is an enforceable mutation boundary | AR-23 |

---

## Security Considerations

- **Data sensitivity**: Source text, filenames, URIs, schema names, diagnostics, and completion
  content may be confidential. The editor does not persist or transmit them except through explicit
  host services.
- **Input validation**: Validate document offsets, revisions, URIs, language identifiers,
  keybindings, external-change choices, and all edit ranges before state mutation.
- **Authentication and authorization**: The component defines no user authentication. The host
  authorizes file access, process access, URI navigation, and cross-document operations.
- **Injection risks**: `CodeEditor` invokes no shell, SQL connection, HTML renderer, dynamic import,
  or arbitrary command. Control characters are sanitized at the rendering boundary.
- **Encryption needs**: No persistence or transport is owned here. Hosts must protect source and LSP
  transport data according to their environment.
- **Rate limiting**: No public endpoint exists. Command and service-result rates are bounded under
  RD-04 to prevent event-loop starvation.
- **Infrastructure**: No credentials, database connections, server processes, or network listeners
  are created by this RD.

---

## Acceptance Criteria

1. [ ] A `CodeEditor` can be mounted directly in a non-window JSVision container, and a
       `CodeEditorWindow` can host the same configured component with scrolling and status.
2. [ ] Creating and using a plain existing `Editor` produces the same default presentation,
       commands, and editing behavior as before this feature.
3. [ ] Two `CodeEditor` instances can hold different texts, URIs, revisions, languages, selections,
       undo histories, and service states without shared document state.
4. [ ] Replacing a document cancels its document-scoped work, clears the prior undo lineage, and
       prevents a result tagged with the old lineage/revision from mutating the replacement.
5. [ ] With no URI, text editing and local language features remain enabled while URI-dependent
       LSP commands report unavailable; supplying a stable synthetic URI enables document
       synchronization without changing text.
6. [ ] `CodeEditor` performs zero direct filesystem, database, network, process-spawn, dynamic
       import, or package-install operation during open, edit, save request, navigation, or close.
7. [ ] For an external change, the clean-document flow requires reload confirmation and the
       dirty-document flow exposes keep/reload/compare; neither path overwrites content before an
       explicit choice.
8. [ ] In read-only mode, every edit-producing command and returned edit is rejected with unchanged
       text, revision, and undo depth, while copy, search, folding, navigation, hover, diagnostics,
       and completion browsing remain available.
9. [ ] Accepting one completion, snippet insertion, formatting result, or multi-range service edit
       increments the revision once and creates one undo entry; one undo restores the exact prior
       text and selection.
10. [ ] A duplicate keybinding identifies both conflicting commands and fails registration unless
        the host explicitly overrides that exact binding; registration order never silently chooses
        a winner.
11. [ ] At widths too narrow for the full status and gutter, reduction occurs in the specified
        order and leaves at least one usable text column; all hidden status values remain available
        through the command/API surface.
12. [ ] Security tests demonstrate rejection of negative, non-finite, reversed, out-of-document,
        stale-revision, and prior-lineage edit coordinates without text mutation or terminal control
        output.

---

## Techdocs Update

When this RD is implemented, update technical documentation for the editor/document ownership
boundary, host integration contracts, command model, revision semantics, and compatibility
guarantee. Record architecture choices only after the implementation plan selects them.
