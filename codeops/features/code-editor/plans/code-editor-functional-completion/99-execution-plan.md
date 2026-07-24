# Task T-04: Code Editor functional completion

> **Type**: Task (lightweight) · **Feature**: code-editor · **CodeOps Artifact Schema**: 1
> **Progress**: 6/27 tasks (22%)
> **Last Updated**: 2026-07-25 00:01
> **Phase baseline tree**: 7beeae3152295fb1877aeb59bf5b9451a9dcac6a

## Objective

Close the remaining gaps between the approved Code Editor requirements and the product users can
actually operate. Unify the editor and LSP assistance paths, add complete terminal-native
search/replace and host-owned lifecycle interactions, finish live theme and degradation behavior,
and make every kitchen-sink capability claim executable and visibly verifiable.

## Scope and delegated design decisions

- Preserve the product boundary: this is a terminal-native editor component and ready-made editor
  window, not an IDE, file manager, workspace manager, tab manager, terminal, debugger, or build
  runner.
- Keep one active in-memory document per `CodeEditor`. Demonstrate multiple files with multiple
  editor instances; do not add an editor collection or tabs.
- Establish one authoritative assistance state bridge between `CodeEditorLspCoordinator`,
  `CodeEditorController`, and `CodeEditor`. Retain existing public manual-completion entry points
  for compatibility, but route manual and LSP results through the same bounded terminal
  presentation and keyboard behavior.
- Add a disposable, bounded coordinator-state notification seam so asynchronous completion,
  hover, signature, diagnostic, navigation, symbol, capability, pending, failure, and recovery
  changes invalidate the editor without polling or retaining disposed views.
- Funnel accepted completion, snippet, formatting, search replacement, and external replacement
  through one controller-visible mutation completion path. It must update fold reconciliation,
  parsing callbacks, protocol synchronization, viewport/caret following, status, and repaint
  exactly once per accepted logical operation.
- Complete LSP interaction through typed terminal surfaces: completion navigation and acceptance,
  primary/additional edits, snippet traversal, hover, signature help, diagnostic detail,
  definition target choice, document symbols, range/document formatting, navigation back,
  cancellation, timeout, stale-result rejection, capability loss, disconnect, reconnect, and
  host authorization. Popup focus and Escape dismissal always return control to the editor.
- Use literal bounded search with the existing case-sensitivity support. Next and previous wrap at
  most once; an empty query is inert. Replace-current and replace-all are unavailable in read-only
  mode, and replace-all applies one bounded atomic transaction and creates one undo step.
- Keep persistence and conflict resolution host-owned. Save uses opt-in format-on-save before the
  host effect but never blocks saving current text after unavailable, invalid, stale, cancelled,
  failed, or timed-out formatting. Dirty close and external change expose typed decisions;
  keep/reload/compare never perform filesystem access or silently overwrite either version.
- Replace silent keybinding object merging with validated canonical registration. A collision
  identifies both commands and fails unless the host explicitly marks that exact binding as an
  override. Existing valid `keyBindings` construction remains source-compatible.
- Complete the approved hybrid theme behavior before demonstrating it: application-derived,
  application override, editor override, and independent preset changes repaint reactively without
  parsing, LSP, document, selection, history, fold, or scroll changes. Invalid live overrides keep
  the last valid palette or use the documented safe fallback.
- Make degradation observable and recoverable. Parser/service failures, missing adapters,
  truncation, pending operations, large-document suspension, capability loss, and recovery expose
  a sanitized reason and retain core editing/navigation according to the approved degradation
  policy.
- Replace label-based demo evidence with executable evidence:
  capability → scenario → control/key → state transition → visible frame, public state, or host
  effect. A capability without that chain is `automated-only` or `unsupported`.
- The deterministic demo may simulate an LSP but never starts an external process, accesses a
  database/network/workspace, reads arbitrary files, or executes server commands.
- Correct the repository kitchen-sink story so every advertised representative capability,
  including optional line numbers, is actually enabled and observable.
- Page navigation, word deletion shortcuts, go-to-line, automatic structural indentation, word
  wrap, multiple carets, rename, code actions, semantic tokens, workspace symbols, mouse hover,
  taskbar-style minimization, and a bundled language server remain out of scope.

## Phase dependencies

| Phase | Depends on | Outcome |
|---|---|---|
| A — Integration foundation | Existing document/controller/LSP/UI contracts | One reactive assistance and mutation boundary |
| B — End-to-end intelligence | A | Operable LSP presentation and recovery |
| C — Search, replace, and lifecycle | A; B save sequencing | Complete document workflow with host-owned I/O |
| D — Theme and degradation | A observable-state seam | Live accessible presentation and recovery |
| E — Honest examples and release | A–D | Executable kitchen-sink evidence and release closure |

## Specification cases

- **ST-01**: A coordinator response changes one immutable controller presentation snapshot,
  schedules one editor invalidation, and cannot notify after disposal.
- **ST-02**: Manual and LSP completion use one popup model and identical navigation, acceptance,
  dismissal, focus, clipping, sanitization, and retained-item limits.
- **ST-03**: Every accepted provider/search/external mutation produces one document revision and
  one undo unit, then reconciles folds, schedules parsing and protocol sync, follows the caret,
  refreshes status, and repaints once; rejected/stale/read-only mutations do none of these.
- **ST-04**: Valid legacy construction and exports remain compatible, while duplicate canonical
  bindings identify both commands unless the exact collision is explicitly overridden.
- **ST-05**: Completion arrows/page keys change the visible selected item; Enter/Tab acceptance
  applies validated primary and additional edits atomically; snippet Tab/Shift+Tab/Escape and
  conflicting edits preserve the documented precedence and never evaluate snippet content.
- **ST-06**: Explicit and trigger-driven hover/signature results appear in bounded terminal-safe
  popups near the caret, expose active parameters without color alone, and dismiss or refresh on
  caret, revision, session, or capability changes.
- **ST-07**: Diagnostics expose range styling, gutter severity, bounded counts/truncation, ordered
  keyboard navigation, and sanitized detail text without hiding selection or the caret.
- **ST-08**: Single and multiple definition targets, document symbols, navigation back, and
  cross-document navigation use validated choices; only same-document choices move the local
  caret and every other target remains host-authorized.
- **ST-09**: Document and selected-range formatting apply one valid current edit transaction;
  invalid, overlapping, excessive, stale, or read-only edits leave the document unchanged.
- **ST-10**: Pending, cancellation, timeout, failure, disconnect, capability loss, reconnect, and
  resynchronization update visible state without blocking local editing or accepting late results.
- **ST-11**: Find accepts keyboard-entered bounded literal text, next/previous wrap once, Escape
  restores editor focus, and empty or missing queries do not mutate state.
- **ST-12**: Replace-current changes only the selected current match; replace-all applies bounded
  non-overlapping matches as one atomic search-origin transaction and one undo step; read-only and
  over-limit replacement attempts change nothing.
- **ST-13**: Format-on-save is opt-in and supplies valid current formatted text/revision to the
  host; every formatter fallback still offers the unformatted current text without indefinite
  blocking or stale application.
- **ST-14**: Save success marks the exact submitted revision saved; rejection retains modified
  state. Dirty close and external clean/dirty changes expose confirm, keep, reload, and compare
  decisions without direct I/O or silent replacement.
- **ST-15**: Application-derived, application/editor overrides, light, dark, and classic palettes
  repaint live with deterministic precedence and contrast/capability adaptation but no semantic
  work or editor-state loss.
- **ST-16**: Invalid theme input, monochrome/ANSI/ASCII capability reduction, and hostile labels
  remain terminal-safe and expose fallback/adjustment details without color-only meaning.
- **ST-17**: Parser failure/retry, missing adapter, service degradation/recovery, truncation,
  pending state, and full/large/confirmation document tiers visibly identify enabled, suspended,
  truncated, pending, or degraded features and why.
- **ST-18**: The deterministic simulated session responds to live editor requests for every
  advertised LSP journey, and host accept/reject/version-conflict controls produce visible,
  content-free evidence.
- **ST-19**: Two editors sharing one session retain distinct URIs, revisions, selections,
  presentation, cancellation, diagnostics, and host effects with no cross-document leakage or
  editor-manager behavior.
- **ST-20**: Every interactive inventory entry executes a reachable control/key and verifies a
  visible state/frame/effect transition; profile-bound or unsafe live behaviors remain honestly
  automated-only, and unsupported/deferred behaviors remain named.
- **ST-21**: Dedicated fixtures demonstrate extension and explicit language selection,
  PostgreSQL/JavaScript/TypeScript/plain and missing adapters, incomplete/invalid source,
  line-ending variants, invisible/hostile Unicode, folding commands, lifecycle decisions,
  themes, degradation, resize, and size tiers.
- **ST-22**: The repository kitchen-sink story enables every capability in its blurb, including
  line numbers, while the standalone E2E journey remains deterministic, terminal-safe, bounded,
  keyboard-operable, and independent of external services.

## Auto-design record

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal state ownership, notification and mutation seams, compatibility
  mechanisms, component decomposition, failure recovery, security/performance hardening, test
  strategy, and sequencing inside the user-approved corrective scope.
- **Objective**: Make approved Code Editor behavior genuinely operable and demonstrable while
  preserving its terminal-native, host-owned, non-IDE boundaries.
- **Decision**: Use five dependency-ordered phases: integration foundation, LSP interaction,
  search/lifecycle, theme/degradation, and executable examples/release. Unify assistance and
  mutation before adding UI so asynchronous results cannot drift across parallel state machines.
- **Evidence**: `CodeEditor` retains private manual completion/snippet state while
  `CodeEditorLspCoordinator` retains a separate presentation and snippet state; `assist` requests
  coordinator work but the demo manually opens a UI completion; coordinator presentation is not
  reactive; save bypasses coordinator format-on-save; Ctrl+F has no editable field; custom
  bindings silently overwrite defaults; theme and capability actions do not exercise the approved
  live model; inventory tests mainly prove labels point to scenarios.
- **Rejected alternatives**: Three broad phases conceal the prerequisite state/mutation seams;
  demo-only simulation would preserve broken production integration; replacing the LSP
  coordinator or generic JSVision editor would add compatibility risk; implementing deferred IDE
  features would expand product scope.
- **Strongest counterargument**: Five phases and executable evidence add more work than repairing
  individual demo controls. The existing split state machines mean isolated fixes would duplicate
  behavior, miss invalidation and mutation invariants, and make completion claims unreliable.
- **Confidence**: High for the dependency order and product boundaries; Medium-High for exact
  public type placement until Phase A compatibility specifications test the existing consumers.
- **Hardening**: A blind independent challenger rejected the initial three-phase outline, identified
  the duplicate assistance state machines, missing async notification and mutation integration
  seams, and confirmed the five-phase dependency order. Forced reframing favored additive public
  compatibility and bounded terminal presentation over replacement or demo-only fixes.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: Compatibility specifications show the manual completion API cannot share
  presentation safely; the existing LSP session cannot isolate multiple document URIs; approved
  requirements conflict on lifecycle ownership; or measured live theme/search work violates the
  accepted viewport/document-size budgets.

## Tasks

### Phase A — Integration foundation

> **Phase baseline tree**: 22fc4a72c0d0f1547f4ceeb2b07e16ae22586f2a

- [x] T-04.1 `[spec-author]` Add immutable specification tests for ST-01 through ST-04 in focused
  controller, UI, LSP, and compatibility specification files. ✅ (completed: 2026-07-24 23:28)
- [x] T-04.2 Run the Phase A specification suites and record the expected red failures before
  changing implementation. ✅ (completed: 2026-07-24 23:28)
- [x] T-04.3 Add the bounded disposable LSP-presentation notification and controller snapshot
  bridge; route manual and protocol assistance into one editor presentation model. ✅ (completed: 2026-07-25 00:01)
- [x] T-04.4 Add the controller-visible post-mutation integration seam for provider, search, and
  external edits, preserving one-revision/one-undo semantics and all invalidation consumers. ✅ (completed: 2026-07-25 00:01)
- [x] T-04.5 Add canonical keybinding registration, descriptive conflict validation, exact
  override support, and compatibility for existing valid `CodeEditorOptions`. ✅ (completed: 2026-07-25 00:01)
- [x] T-04.6 Confirm Phase A specifications green, then add implementation, disposal, hostile-input,
  retained-state, and compatibility coverage and run focused package checks. ✅ (completed: 2026-07-25 00:01)

### Phase B — End-to-end language intelligence

- [ ] T-04.7 `[spec-author]` Add immutable specification tests for ST-05 through ST-10, covering
  every user-visible assistance, navigation, formatting, and recovery transition.
- [ ] T-04.8 Run the Phase B specification suites and record the expected red failures before
  changing implementation.
- [ ] T-04.9 Complete the shared completion/snippet popup behavior, keyboard precedence, atomic
  provider edits, trigger handling, clipping, focus restoration, and read-only enforcement.
- [ ] T-04.10 Add typed hover, signature, diagnostic-detail, definition-target, and document-symbol
  terminal surfaces with sanitized bounded content and caret-aware dismissal.
- [ ] T-04.11 Complete document/range formatting, navigation back, host-authorized cross-document
  effects, command forwarding, pending/cancel/timeout/stale/capability/disconnect/reconnect paths,
  and non-blocking degraded operation.
- [ ] T-04.12 Confirm Phase B specifications green, then add implementation, hostile protocol,
  lifecycle, accessibility, performance, and retained-resource coverage and run focused checks.

### Phase C — Search, replace, and document lifecycle

- [ ] T-04.13 `[spec-author]` Add immutable specification tests for ST-11 through ST-14, including
  read-only, empty, excessive, stale, rejected, timeout, and external-conflict boundaries.
- [ ] T-04.14 Run the Phase C specification suites and record the expected red failures before
  changing implementation.
- [ ] T-04.15 Build the bounded keyboard-operable find/replace surface and canonical commands for
  next, previous, replace-current, replace-all, dismissal, and focus restoration.
- [ ] T-04.16 Implement atomic bounded replacement plus format-on-save, saved-revision tracking,
  dirty-close, and external keep/reload/compare controller/host contracts without direct I/O.
- [ ] T-04.17 Confirm Phase C specifications green, then add implementation, Unicode, hostile
  replacement, transaction, lifecycle, accessibility, and large-document performance coverage.

### Phase D — Theme and degradation completion

- [ ] T-04.18 `[spec-author]` Add immutable specification tests for ST-15 through ST-17 across live
  theme layers, terminal profiles, invalid inputs, parser/service recovery, and size tiers.
- [ ] T-04.19 Run the Phase D specification suites and record the expected red failures before
  changing implementation.
- [ ] T-04.20 Implement the reactive application/editor theme resolution seam, last-valid fallback,
  coalesced viewport repaint, inspectable resolution report, and capability-depth adaptation.
- [ ] T-04.21 Complete observable parser/LSP/size degradation and recovery state while preserving
  the approved local core and non-color indicators.
- [ ] T-04.22 Confirm Phase D specifications green, then add implementation, hostile-theme,
  accessibility, semantic-inertness, repaint-coalescing, and performance coverage.

### Phase E — Honest examples and release closure

- [ ] T-04.23 `[spec-author]` Add immutable executable-evidence and E2E specifications for ST-18
  through ST-22 before changing the standalone or repository kitchen sinks.
- [ ] T-04.24 Run the Phase E specification suites and record the expected red failures.
- [ ] T-04.25 Make the deterministic session answer live requests; add host decision controls,
  multi-editor isolation, language/error/line-ending/theme/degradation/lifecycle fixtures, and
  correct the repository story's advertised configuration.
- [ ] T-04.26 Replace label-only inventory assertions with executable journeys; confirm all Phase E
  specifications green, then add implementation, terminal-profile, hostile, resize, E2E, and
  bounded-resource coverage.
- [ ] T-04.27 Refresh package/docs-site/canonical plugin documentation, run `yarn plugin:update`
  for every mapped SDK impact, run focused checks and `yarn plugin:check`, run authoritative
  `yarn verify`, complete the required correctness/security/performance/accessibility quality
  review, resolve accepted findings, and synchronize traceability and roadmaps.

**Verify**: `yarn verify`
