# Code Editor functional completion — ambiguity register

> **CodeOps Artifact Schema**: 1
> **Last Updated**: 2026-07-25 08:08
> **Runtime items added during execution**: yes

## Resolved ambiguities

### AR-07 (runtime) — Phase D hostile-boundary and lifecycle hardening

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal schema traversal, immutable snapshots, report provenance, repaint
  caching, observer scheduling, and language-service lifecycle projection inside the approved
  Phase D behavior. Contrast policy, unknown-field compatibility, product scope, and terminal
  support remain unchanged.
- **Objective**: Keep theme repaint and degradation publication bounded, exception-safe, immutable,
  and truthful under hostile runtime values and reentrant observers.
- **Decision**: Traverse only the fixed theme schema; never enumerate unknown caller keys. Guard
  every known own-data read and fall back to the safe dark palette when an outer boundary fails.
  Snapshot live sources before atomic installation, brand resolver reports internally, and accept
  only branded reports as inspection evidence. Cache live resolution until the source,
  application-role identities, or capability identity changes. Preserve inherited backgrounds
  during contrast repair and adjust the foreground. Map real language-service states into the
  shared degradation vocabulary. Validate degradation reasons strictly and publish coalesced
  observer notifications in a microtask with reentrancy suppression.
- **Evidence**: Independent correctness, security, and performance review reproduced escaping
  nested proxy traps, attacker-controlled key enumeration, forged reports, mutable live-source
  retention, inaccurate active-layer reporting, missing language-service lifecycle projection,
  invalid suspension transitions, and recursive observer publication.
- **Rejected alternatives**: Enumerating unknown keys conflicts with additive compatibility and
  makes repaint work attacker-controlled; retaining raw sources permits mutation after validation;
  structural report trust accepts forged evidence; repairing the background breaks the continuous
  editor surface; synchronous observer callbacks permit recursive publication.
- **Strongest counterargument**: Ignoring unknown fields provides less diagnostic detail than
  listing every rejected property. Fixed-schema rejected paths still explain malformed supported
  fields without retaining hostile labels or paying work proportional to unknown input width.
- **Confidence**: High — the decisions preserve approved semantics and directly close reproduced
  findings. The user explicitly authorized both conflicting immutable-expectation corrections on
  2026-07-25.
- **Hardening**: Three independent reviewers covered correctness, security, and performance. The
  single independent re-review confirmed the original correctness and performance findings
  resolved and identified two remaining security boundary cases: report-to-palette provenance and
  malformed limit counters. Both are accepted and closed through exact-result branding, strict
  own-data counter validation, hostile regressions, and final verification because only one
  re-review is permitted.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: The public theme schema becomes dynamically extensible, hosts require
  attacker-controlled report labels, application theme roles are mutated without identity
  replacement, or degradation observers require synchronous delivery.

### AR-06 (runtime) — Phase D live theme and degradation ownership

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Additive theme-layer types, immutable inspection state, repaint invalidation,
  degradation lifecycle records, and document-tier presentation inside the approved theme and
  recovery behavior. Product scope, terminal support, contrast policy, and essential feature
  availability remain unchanged.
- **Objective**: Make theme changes and optional-subsystem failures observable, accessible, and
  recoverable without coupling presentation updates to parsing, language services, or document
  mutation.
- **Decision**: Resolve application and editor overrides independently at role-field granularity,
  report the active layer and sanitized fallback source, and let `CodeEditor` retain the last valid
  immutable palette. Direct theme changes use the existing coalesced view invalidation path; an
  additive theme-source seam may derive from the application roles available in a draw context.
  Represent each degradable feature with an immutable `enabled`, `pending`, `suspended`,
  `truncated`, or `degraded` record and a bounded sanitized reason. Degradation transitions notify
  the controller presentation seam, while document-size classification exposes the same
  content-free status vocabulary and always preserves edit/search/line-number/status/save/close.
- **Evidence**: The resolver currently accepts only one override layer and reports neither its
  active layer nor fallback source. The editor accepts complete snapshots but cannot inspect an
  invalid live update. Degradation retains only active notices, has no pending state, and does not
  notify subscribed views when parser/service status changes. Size classification exposes the tier
  and essential actions but not why optional features are enabled or suspended.
- **Rejected alternatives**: Rebuilding parser/controller state on theme changes violates semantic
  inertness; storing raw theme errors or labels risks terminal/content leakage; separate failure
  booleans in parser, LSP, UI, and limits would drift; treating every large document as reduced
  would disable approved incremental behavior prematurely.
- **Strongest counterargument**: A complete per-feature degradation list adds snapshot data even
  when every feature is healthy. The feature set is fixed and small, so the bounded immutable list
  gives hosts stable accessible state without meaningful retention or render cost.
- **Confidence**: High — the existing resolver, controller event seam, view invalidation scheduler,
  and size classifier already provide the required ownership boundaries.
- **Hardening**: Forced reframing favored one shared status vocabulary and the existing coalesced
  repaint/event seams over a new scheduler or parallel state stores. No reserved decision or
  compatibility break is required.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: The application draw context cannot supply the semantic roles needed for
  derivation, a supported host needs unbounded dynamic feature names, or capability encoding must
  occur outside the existing core renderer.

### AR-05 (runtime) — Phase C quality correction boundaries

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal deadlines, identity binding, event ordering, bounded search, and
  hostile-input validation inside the approved Phase C behavior. The host callback contract and
  host-owned persistence decisions remain unchanged.
- **Objective**: Preserve responsiveness and exact-revision authority under stalled integrations,
  large documents, concurrent edits, and hostile runtime values.
- **Decision**: Give host-owned effects a configurable deadline with a conservative five-second
  default, cap concurrent effects at eight, settle owned deadlines during disposal, and ignore
  late completion. Bind save text and close authorization to exact document identities. Queue
  external reload events before best-effort language-service resynchronization and bound transport
  notifications with the existing interaction deadline. Retain no more search matches than the
  renderer's 5,000-span ceiling, cache deeply immutable span normalization, and replace
  whole-document case-fold maps with a streaming source-offset-aware matcher. Scan non-full-size
  documents in cancellable 256-KiB turns. Accept only primitive bounded search-field input, and
  enforce the same 4,096-code-point ceiling at the public document-search boundary.
- **Evidence**: Independent correctness, security, and performance review reproduced close and
  save identity races, reload/edit event reordering, a permanently blocked host queue, unresolved
  formatting saves, large case-fold memory amplification, excess retained decorations, and
  accessor execution through unvalidated runtime values.
- **Rejected alternatives**: An unbounded host callback can freeze every later queued action;
  trusting the current identity after awaiting formatting can pair old text with a newer revision;
  retaining 100,000 matches cannot help a renderer that rejects more than 5,000 spans; whole-text
  folding violates the accepted large-document target.
- **Strongest counterargument**: A fixed deadline can classify a legitimately slow host action as
  failed. Making the deadline configurable preserves bounded editor progress while allowing an
  embedding application to choose a value appropriate for its persistence boundary.
- **Confidence**: High — each decision directly closes a reproduced major finding without
  expanding product scope or changing successful host behavior.
- **Hardening**: Three independent reviewers covered correctness, security, and performance. All
  major findings are accepted for correction and will receive one independent re-review.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: A supported host needs cancellation propagation, renderer decoration
  capacity changes, Unicode folding semantics require overlapping matches, or the deadline cannot
  be configured without breaking existing construction.

### AR-04 (runtime) — Phase C search and lifecycle ownership

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Additive internal state ownership, command bindings, typed host effects, and
  compatibility mechanisms inside the approved search, replacement, save, close, and external
  change behavior. Persistence and conflict decisions remain host-owned.
- **Objective**: Make the complete document workflow keyboard-operable and revision-safe without
  adding I/O or duplicating document mutation policy in terminal widgets.
- **Decision**: Keep transient find/replace focus and field state in one focused UI search
  session, while every accepted replacement uses the controller mutation boundary with `search`
  origin. Add canonical previous, replace-current, replace-all, dismiss, and replace-open
  commands; use `Ctrl+H`, `Shift+F3`, field traversal with Tab, directional Enter, and Escape
  restoration. The controller owns save, dirty-close, and external-change orchestration. Save
  effects carry exact submitted text, revision, and formatting outcome; the document is marked
  saved only when the host accepts that still-current identity. External keep/reload/compare is
  supplied as an explicit typed host decision; only reload mutates locally, while compare remains
  a host effect. Existing boolean host callbacks and valid editor construction remain compatible.
- **Evidence**: The editor currently retains only a query string and forward search, while the
  document already supplies bounded literal matching and the controller supplies the reviewed
  atomic mutation seam. The coordinator already returns safe format-on-save text and outcomes,
  but the existing save effect omits both and marks no exact save checkpoint. The document model
  already supports modified state, exact save checkpoints, and lineage replacement.
- **Rejected alternatives**: Controller-owned modal keystroke state would couple terminal focus
  to document policy; widget-owned direct transactions would bypass controller invalidation;
  letting save callbacks mark whichever revision is current would incorrectly clear edits made
  during an in-flight save; automatic external reload would violate explicit conflict ownership;
  widening the existing host callback return type would add unnecessary compatibility risk.
- **Strongest counterargument**: A single controller-owned search model could make non-visual
  commands easier to share across multiple views. Each controller owns one editor document and
  the approved product has one terminal editor view per controller, so retaining field focus in
  the view avoids exposing presentation mechanics while controller mutations remain reusable.
- **Confidence**: High — current APIs already separate literal search, document mutation, LSP
  formatting, and host effects at the required boundaries.
- **Hardening**: Forced reframing favored an additive search-session module and typed controller
  lifecycle methods over expanding the document model or host callback. Reopen if independent
  review finds a second view must share live search field focus or exact-revision save cannot be
  enforced without changing the document checkpoint API.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-functional-completion-2026-07-24`.
- **Reopen triggers**: Multiple terminal views share one controller, a required key conflicts with
  an established valid binding, format-on-save cannot expose its submitted identity, or external
  reload must bypass the normal read-only mutation boundary.

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
