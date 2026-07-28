# RD-05: Code Editor Kitchen-Sink

> **Document**: RD-05-code-editor-kitchen-sink.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: JSVision Code Editor
> **Depends On**: RD-01, RD-02, RD-03, RD-04
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

The code editor must ship with its own standalone, interactive kitchen-sink application in the
`@jsvision/examples` package. Like the existing DataGrid example surfaces, it must make the
component understandable through live interaction, visible state, narrated controls, and automated
headless verification. Because the code editor has substantially more facets than one ordinary
story can present, its standalone showcase is the canonical comprehensive demonstration.

The repository-wide kitchen-sink must also contain a concise registered CodeEditor story, satisfying
the standing showcase gate and directing users to the standalone comprehensive application. The
standalone showcase is development and demonstration material; it is not published as part of the
runtime editor package. (AR-01, AR-02, AR-03, AR-04, AR-06, AR-11)

---

## Functional Requirements

### Must Have

#### FR-5.1 — Standalone examples application *(Complexity: L; AR-01, AR-04)*

- [ ] Add a dedicated `packages/examples/code-editor-demo/` application with its own entry point,
      composition modules, fixtures, and demo-only language-service support.
- [ ] Add a discoverable `demo:code-editor` script to `@jsvision/examples` that launches the
      interactive terminal application through the repository's normal application lifecycle.
- [ ] Import CodeEditor APIs from their public package entry point exactly as an external consumer
      would; do not use source-relative or package-internal imports.
- [ ] Keep the example deterministic and self-contained: it must not require a browser, database,
      network connection, installed language server, workspace, credentials, or user source files.
- [ ] Clearly label simulated language-service behavior as demonstration data rather than a real
      compiler, PostgreSQL connection, or production LSP server.
- [ ] Include concise in-application help covering launch command, navigation, principal bindings,
      active scenario, and how to reset demo state.

#### FR-5.2 — Showcase navigation and layout *(Complexity: L; AR-02, AR-11)*

- [ ] Present an editor-focused window with a navigable scenario list or menu, the live CodeEditor
      surface, contextual interaction hints, and a visible state/host-event inspector.
- [ ] Make every scenario and demonstrated operation reachable by keyboard; mouse support may be
      additive.
- [ ] Preserve the active editor's focus when help, status, completion, hover, signatures,
      diagnostics, symbol lists, and host-event details are dismissed.
- [ ] Adapt to narrow terminals by reducing optional inspector/help content before making the
      editable surface unusable.
- [ ] Provide an ASCII/monochrome-compatible presentation and avoid relying on color alone.
- [ ] Allow a deterministic reset that restores the active scenario's fixture text, language,
      revision, settings, diagnostics, and simulated session state.

#### FR-5.3 — Document and editor-surface scenarios *(Complexity: L; AR-01, AR-02)*

- [ ] Demonstrate `CodeEditor` embedded in the showcase and a launch path that demonstrates the
      ready-made `CodeEditorWindow`.
- [ ] Demonstrate ordinary editing, selection, undo/redo, search/replace, dirty state, save request,
      dirty-close request, external-change decision, and read-only behavior.
- [ ] Display live logical line, visual column, selection size, document revision, modified state,
      language, local-parser state, and language-service state.
- [ ] Demonstrate customizable command bindings and deterministic conflict reporting without
      modifying built-in command definitions.
- [ ] Emit save, close, navigation, authorization, and other host-owned effects into the visible
      inspector; the showcase must not read or write arbitrary user files.
- [ ] Include fixtures with tabs, combining characters, wide graphemes, line-ending variants,
      bidi/zero-width controls, and hostile terminal-control text while visibly preserving safe
      rendering.

#### FR-5.4 — Local language-feature scenarios *(Complexity: L; AR-03)*

- [ ] Provide editable PostgreSQL SQL, JavaScript, and TypeScript fixtures plus an unknown/plain
      fixture.
- [ ] Demonstrate extension/explicit language selection, runtime language switching, syntax
      highlighting, line-number gutter, folding, bracket matching, indentation/dedent, comment
      toggle, and parser degradation/retry.
- [ ] Include incomplete and invalid source fixtures that retain partial highlighting and editing.
- [ ] Include a missing-adapter/plain-mode scenario that shows local feature degradation without
      disabling core editing.
- [ ] Expose the active semantic theme roles and provide at least one theme/capability toggle that
      demonstrates style remapping, monochrome output, and ASCII fallbacks.

#### FR-5.5 — Language-intelligence scenarios *(Complexity: XL; AR-03, AR-06)*

- [ ] Provide an in-process deterministic demonstration session implementing the same public LSP
      session boundary used by real integrations.
- [ ] Demonstrate explicit and triggered completion, bounded result navigation, primary/additional
      edits, snippet placeholders, hover, signature help, diagnostics, definition navigation,
      multiple-target choice, document symbols, document formatting, range formatting, and
      opt-in format-on-save.
- [ ] Demonstrate dynamic capability enablement/loss, pending state, cancellation, timeout, stale
      result rejection, disconnection, degraded state, reconnect, and resynchronization.
- [ ] Demonstrate same-document navigation locally and show cross-document navigation/edit
      requests in the host-event inspector without silently applying them.
- [ ] Provide explicit controls to authorize or reject a simulated cross-document edit and show
      transactional success, rejection, and version-conflict outcomes.
- [ ] Demonstrate safe Markdown, hostile Markdown/terminal content, invalid ranges, oversized
      result truncation, rejected commands, and allowlisted host command forwarding.
- [ ] Demonstrate PostgreSQL schema names/types as simulated service metadata while making clear
      that no database connection, credential, or table-row data exists.

#### FR-5.6 — Size, degradation, and accessibility scenarios *(Complexity: L; AR-07, AR-08, AR-11)*

- [ ] Provide generated fixtures representing the full-feature, large/degradable, and
      confirmation-required document tiers without committing unnecessarily large source files.
- [ ] Show which features are enabled, suspended, truncated, pending, or degraded and why.
- [ ] Include keyboard-only instructions and visible non-color cues for selection, diagnostics,
      active line, folding, pending, read-only, truncation, and degraded state.
- [ ] Include a terminal resize/narrow-layout scenario and verify that overlays remain clipped and
      dismissible with the caret reachable.
- [ ] Keep stress demonstrations bounded and cancellable so the kitchen-sink itself remains
      responsive and safe to run.

#### FR-5.7 — Repository kitchen-sink story *(Complexity: M; AR-04)*

- [ ] Add and register one CodeEditor story under
      `packages/examples/kitchen-sink/stories/` using the established `Story` contract.
- [ ] The story includes a one-line blurb, a live editable CodeEditor, bound state echo, keyboard
      and mouse interaction hints, and sizing based on `StoryContext`.
- [ ] The story demonstrates a focused representative subset: syntax highlighting, line numbers,
      status, editing, selection, search, folding, completion, and diagnostics.
- [ ] The story tells users that the standalone `demo:code-editor` application contains the
      comprehensive scenarios.
- [ ] Register the story in `STORIES` without modifying kitchen-sink shell architecture.

#### FR-5.8 — Automated example verification *(Complexity: XL; AR-04)*

- [ ] Extend the repository kitchen-sink smoke specification so the registered story mounts
      headlessly, paints non-empty output, has unique metadata, and exposes a focusable editor.
- [ ] Add specification tests for the standalone scenario registry requiring a unique stable ID,
      title, description, fixture/reset function, demonstrated capability list, and mount function
      for every scenario.
- [ ] Mount and draw every standalone scenario headlessly at normal, narrow, monochrome, and ASCII
      capability profiles.
- [ ] Add interaction tests for representative editing, local-language, LSP, degradation, host
      authorization, reset, and keyboard-only journeys.
- [ ] Add an end-to-end launch test analogous to the DataGrid `table-demo` test: start the
      standalone entry without a real TTY or external service, drive a deterministic walkthrough,
      verify narrated frames/state transitions, and require a clean exit within a bounded timeout.
- [ ] Include the example typecheck, unit/specification tests, end-to-end tests, and repository
      kitchen-sink smoke gate in the feature's full verification.

### Should Have

#### FR-5.9 — Scenario extensibility *(Complexity: M; AR-04)*

- [ ] Define a small typed scenario contract and explicit registry so a new CodeEditor facet can be
      demonstrated primarily by adding one scenario module and one registry entry.
- [ ] Keep shared fixtures, simulated-session behavior, application chrome, and scenario content in
      separate modules.

### Won't Have (Version 1)

- [ ] A production language server bundled into the examples package.
- [ ] Real filesystem mutation, PostgreSQL connectivity, credential prompts, or network access.
- [ ] Examples for deferred product features such as rename, code actions, semantic tokens,
      workspace symbols, multiple carets, or word wrap.
- [ ] Publication of the kitchen-sink as a supported runtime package.

---

## Constraints

- The standalone application follows existing `packages/examples` conventions and is named/run
  independently from the repository-wide `demo:kitchen`.
- Demo-only simulation must implement public boundaries rather than adding special behavior to the
  production editor.
- Generated large documents and hostile fixtures remain bounded in tests and demos.
- Production code and API documentation must not reference requirement or planning identifiers;
  example narration may describe capabilities but not internal planning history.

---

## Acceptance Criteria

1. [ ] `yarn workspace @jsvision/examples demo:code-editor` launches a dedicated interactive
       terminal application that imports CodeEditor only through its public package API.
2. [ ] The standalone application runs without a browser, DOM, network, database, external language
       server, workspace, credentials, or access to arbitrary user files.
3. [ ] Its registry has unique stable scenario IDs and covers every version 1 capability in
       RD-01–RD-04, with each capability mapped to at least one discoverable scenario.
4. [ ] PostgreSQL SQL, JavaScript, TypeScript, plain, incomplete, invalid, Unicode-heavy, hostile,
       read-only, degraded, and size-tier fixtures can be selected and deterministically reset.
5. [ ] Live state and host-event inspectors accurately report document/revision/selection/language/
       service state plus save, close, navigation, command-authorization, and cross-document-edit
       requests.
6. [ ] The simulated session demonstrates completion/snippets, hover, signatures, diagnostics,
       navigation/symbols, formatting/format-on-save, cancellation/staleness, dynamic capabilities,
       timeout, reconnect, malicious results, truncation, and host authorization without external
       services.
7. [ ] Keyboard-only navigation reaches every scenario and required operation; popups dismiss
       predictably and return focus to the editor.
8. [ ] Normal, narrow, resized, monochrome, and ASCII profiles keep the editor usable, overlays
       bounded, status understandable, and all required state distinguishable without color.
9. [ ] The generated large-document scenarios visibly enter the correct feature tier and remain
       cancellable and responsive without storing oversized fixture files.
10. [ ] A registered repository kitchen-sink CodeEditor story contains the live component, blurb,
        bound-state echo, interaction hints, representative local/LSP features, and a pointer to
        `demo:code-editor`.
11. [ ] The existing kitchen-sink smoke suite mounts and paints the CodeEditor story headlessly
        without duplicate IDs, missing metadata, clipping at its reference size, or focus failure.
12. [ ] Every standalone scenario mounts and paints headlessly under normal, narrow, monochrome,
        and ASCII profiles; representative scripted interactions produce the expected state and
        terminal-safe output.
13. [ ] The standalone end-to-end walkthrough starts with no real TTY/service, narrates representative
        edit → local-language → intelligence → degradation → recovery → host-authorization states,
        exits successfully within its timeout, and produces non-empty deterministic frames.
14. [ ] Example typechecking, specification tests, interaction tests, end-to-end tests, the global
        kitchen-sink smoke gate, and the repository's complete verification command all pass.

---

## Techdocs Update

When implemented, add the standalone CodeEditor kitchen-sink launch command and scenario catalog to
the developer examples documentation. Document how its deterministic LSP session differs from a
production integration, how to add a scenario, which scenarios cover each public capability, and
how the standalone showcase relates to the concise repository kitchen-sink story.
