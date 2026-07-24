# Code Editor functional completion — ambiguity register

> **CodeOps Artifact Schema**: 1
> **Last Updated**: 2026-07-25 01:15
> **Runtime items added during execution**: yes

## Resolved ambiguities

### AR-03 (runtime) — Phase B review correction boundaries

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal request ordering, stale-state invalidation, bounded resource ownership,
  and additive keyboard commands inside the approved language-intelligence scope. No host,
  filesystem, workspace, or protocol scope is expanded.
- **Objective**: Correct the independent review findings without weakening language-service
  safety, responsiveness, or existing valid editor construction.
- **Decision**: Treat all assistance except diagnostics publications as revision-bound, and clear
  all retained assistance plus navigation history after any accepted edit. Diagnostics are also
  cleared until republished for the new revision. A request may bypass an unresolved notification
  promise only when the session explicitly guarantees synchronous transport enqueueing; all other
  requests wait. Cancellation and timeout authority is enforced locally regardless of transport
  cooperation. Explicit hover and document-symbol commands use `Ctrl+Shift+H` and `Ctrl+Shift+O`;
  these bindings avoid the existing `Ctrl+K` customization surface. Formatting a non-empty
  selection is inert without range-formatting capability.
- **Evidence**: Independent correctness, security, and performance review demonstrated stale
  overlays surviving edits, cancelled callbacks remaining authoritative, trigger requests racing
  asynchronous `didChange`, unbounded aggregate completion payloads, and missing user input paths.
- **Rejected alternatives**: Trusting transport cancellation would leave late callbacks
  authoritative; keeping unversioned diagnostics across edits would retain invalid ranges;
  silently falling back from range to document formatting could rewrite unrelated source;
  reserving `Ctrl+K` would break an existing valid customization.
- **Strongest counterargument**: Clearing assistance can cause a popup to close while typing.
  Correct source-to-result identity is more important than retaining a visually stale candidate;
  negotiated trigger characters immediately request a fresh result.
- **Confidence**: High — focused tests exercise asynchronous enqueueing, stale pre-issue
  settlement, late callbacks, post-edit invalidation, capability loss, and keyboard reachability.
- **Hardening**: Three independent lenses reviewed the baseline-bounded phase diff. Every Major
  finding was accepted, and one scoped re-review is required after correction.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: A supported transport cannot state its notification enqueueing semantics,
  a language service supplies safely rebasable completion identity, or compatibility evidence
  shows either new default binding collides with an established command.

### AR-02 (runtime) — Phase B terminal intelligence ownership

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal presentation composition, interaction routing, and public additive
  controller seams inside the approved language-intelligence scope. No filesystem, workspace,
  process, protocol, security-policy, or deferred IDE scope is added.
- **Objective**: Make existing protocol operations operable from one terminal editor without
  recreating coordinator state inside widgets.
- **Decision**: Extend the controller-owned assistance projection with one bounded overlay model
  for completion, hover, signature help, diagnostic detail, definition choices, and document
  symbols. The editor view renders that model through its existing clipped assistance view and
  routes overlay keys before editor commands. Trigger characters are requested only after an
  accepted local insertion. Formatting selects range or document protocol operations from the
  current selection and remains inert in read-only mode. Same-document navigation changes only
  selection and bounded back history; cross-document targets remain host-authorized effects.
- **Evidence**: The coordinator already validates and retains all six protocol result families,
  but the editor only projects completion labels. Its hard-coded key router never triggers
  completion/signature requests, diagnostics have no gutter marker or detail navigation, format
  always requests the whole document, and navigation/symbol choices are not exposed through the
  terminal view.
- **Rejected alternatives**: Separate widget-owned popup state would recreate the split state
  machine removed in Phase A; demo-only controls would leave production keyboard interaction
  broken; direct filesystem/workspace navigation would violate host ownership; multiple
  simultaneous popups would create ambiguous Escape and focus behavior.
- **Strongest counterargument**: Different assistance kinds could use specialized widgets. A
  shared bounded overlay is preferable here because all approved terminal interactions require
  the same clipped rows, selection, dismissal, focus restoration, and hostile-text guarantees.
- **Confidence**: High — the immutable Phase B oracle exercises the shared behavior end to end,
  while existing coordinator tests retain protocol-specific validation coverage.
- **Hardening**: The Phase A review established controller presentation as the authoritative
  boundary; Phase B preserves that ownership and keeps every source mutation on the reviewed
  atomic mutation seam.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: A terminal surface needs independent simultaneous focus, chooser rows need
  structured columns rather than bounded labels, or host authorization cannot represent a
  required cross-document action.

### AR-01 (runtime) — Phase A integration API placement

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal architecture, additive interface placement, compatibility mechanisms,
  disposal, and event sequencing inside the approved integration-foundation scope. No product
  behavior, acceptance criterion, public compatibility break, security policy, or scope boundary
  changes.
- **Objective**: Establish one reactive assistance and mutation boundary without coupling the LSP
  coordinator to terminal views or breaking valid existing construction.
- **Decision**: Use a controller-centric additive bridge. The coordinator exposes a bounded,
  immutable state snapshot and disposable state subscription. The controller owns the normalized
  presentation used by both manual and LSP assistance and exposes bounded disposable controller
  events. Accepted edits flow through one origin-aware controller mutation method; a single-owner
  coordinator mutation sink delegates to it while standalone coordinators retain their validated
  direct fallback. Existing `CodeEditor.openCompletion`, `applyDocumentEdits`, and valid
  `keyBindings` construction remain compatibility wrappers. Custom bindings are canonicalized;
  an override separately names the exact default command expected to be displaced, and conflict
  errors identify the binding and both commands.
- **Evidence**: The coordinator currently mutates public presentation and operation fields from
  asynchronous callbacks, while the editor separately retains manual completion and snippet state.
  Completion and formatting can mutate the document inside the coordinator, bypassing the
  controller and the editor's post-mutation path. The editor currently merges binding records with
  object spread, which silently replaces defaults and can invoke accessors.
- **Rejected alternatives**: Constructor-only coordinator callbacks cannot retrofit a controller
  because coordinators are already constructed before controllers; polling misses asynchronous
  transitions and wastes terminal work; importing the controller or UI into the coordinator adds
  a dependency cycle and can retain disposed views; replacing the existing construction API would
  create an unnecessary compatibility break; a boolean override cannot prove which existing
  command the host intended to replace.
- **Strongest counterargument**: Additive subscriptions, controller events, and a mutation sink add
  more public surface than a direct editor callback. The extra seams are necessary because the
  coordinator must remain usable standalone, the controller is the document-policy owner, and
  disposed views must not be retained by protocol state.
- **Confidence**: High — current ownership and construction order make the controller-centric
  bridge the only viable option that preserves compatibility and avoids a dependency cycle.
- **Hardening**: A blind independent design challenger inspected the current controller,
  coordinator, completion, and editor seams and independently recommended the same
  controller-centric bridge. It additionally required bounded listener retention, idempotent
  disposal, exception isolation, one logical notification per response, exact-document sink
  validation, stale completion stamps, and expected-command keybinding overrides.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: Compatibility tests show a valid existing construction no longer works; a
  coordinator cannot remain standalone; one logical operation emits multiple document or
  presentation events; a disposed subscriber is called; or an exact-document mutation sink cannot
  be enforced without a dependency cycle.
