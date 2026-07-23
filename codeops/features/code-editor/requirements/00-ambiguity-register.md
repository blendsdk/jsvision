# Ambiguity Register: JSVision Code Editor

> **CodeOps Artifact Schema**: 1
> **Status**: ✅ GATE PASSED — all 24 items resolved
> **Last Updated**: 2026-07-23
> **Authority**: Auto-design active for eligible technical decisions; reserved decisions require
> explicit user confirmation
> **Auto-design Root Invocation ID**: `AD-CODE-EDITOR-20260723-01`
> **Auto-design Policy Version**: 1

## Confirmed during discovery

These decisions were explicitly confirmed during the current requirements-discovery session and do
not require reconfirmation.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-01 | Feature gaps | Product identity and boundary | IDE / editor-only component and window | Terminal-native editor-only `CodeEditor` component plus `CodeEditorWindow`; host owns IDE-level concerns | ✅ Resolved |
| AR-02 | Scope ambiguities | Version 1 versus later capability set | C1–C20 classification | Accepted classification: modern editing, local code presentation, baseline IntelliSense, navigation, document symbols, and formatting in v1; multi-caret, wrap, workspace symbols, rename, code actions, and semantic tokens later | ✅ Resolved |
| AR-03 | Naming & terminology | Launch languages | PostgreSQL SQL / JavaScript / TypeScript / Bash | PostgreSQL SQL, JavaScript, and TypeScript; Bash explicitly excluded | ✅ Resolved |
| AR-04 | Data & state | Document and file ownership | Editor-owned I/O / host-owned I/O | One in-memory document per editor; file-bound adapter and host own persistence, external changes, and multiple editor instances | ✅ Resolved |
| AR-05 | Integration points | Language-service boundary | Editor-spawned server / caller-provided session | Caller-provided LSP transport/session; separate runtime adapter may spawn and supervise servers; sessions may be shared | ✅ Resolved |
| AR-06 | Integration points | Cross-document navigation and mutation | Editor writes/opens directly / host-mediated | Same-document navigation is local; cross-document navigation and edits go through host callbacks and explicit authorization | ✅ Resolved |
| AR-07 | Behavioral gaps | Parser or LSP failure | Block editing / independent degradation | Plain editing, search, save, and close remain available; only dependent features degrade and status exposes the state | ✅ Resolved |
| AR-08 | Security & compliance | Trust boundary for documents and service results | Trust service / validate and sanitize | Treat all document, filename, parser, LSP, Markdown, URI, diagnostic, completion, command, and edit data as untrusted; sanitize, validate, bound, and allowlist | ✅ Resolved |
| AR-09 | Non-functional gaps | Responsiveness and large-document behavior | Unbounded/adaptive only / explicit tiers | Full local features through 1 MiB or 50,000 lines; bounded degradation through 10 MiB; confirmed reduced mode above 10 MiB; 16 ms uncontended local edit/render target | ✅ Resolved |
| AR-10 | Technical unknowns | Language extension model | Closed built-ins / open adapters | Open, versioned `LanguageAdapter` contract with independent parsing and LSP capabilities; hosts supply adapters explicitly | ✅ Resolved |
| AR-11 | UX & presentation | Terminal/accessibility degradation | Color/mouse-dependent / redundant interaction | Keyboard and command completeness, non-color cues, ASCII/monochrome fallbacks, narrow-window degradation, explicit position conversion, and dismissible popups | ✅ Resolved |
| AR-12 | Behavioral gaps | Format-on-save | Always / opt-in / explicit-only | Supported in v1, opt-in and disabled by default; failure, timeout, or stale output never blocks saving | ✅ Resolved |
| AR-13 | Feature gaps | LSP snippet behavior | Plain-text fallback only / basic snippets / full snippet system | Basic numbered placeholders in v1; safe traversal and cancellation; no execution or variable/shell interpolation; unsupported constructs become plain text | ✅ Resolved |
| AR-14 | Behavioral gaps | External file changes | Automatic overwrite/reload / explicit conflict flow | Clean documents ask before reload; dirty documents require keep/reload/compare; neither version is overwritten silently | ✅ Resolved |

## Remaining decisions

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-15 | Data & state | Undo grouping for completion, snippets, formatting, and service edits | One atomic undo step per accepted operation / expose provider edits as multiple steps | Authority: AI — one accepted logical operation is one undo step | ✅ Resolved |
| AR-16 | Behavioral gaps | Fold state when edits intersect or invalidate folded ranges | Preserve mapped folds where valid and unfold invalid/intersected folds / clear all folds after every edit | Authority: AI — preserve valid mapped folds and remove only invalidated folds | ✅ Resolved |
| AR-17 | Behavioral gaps | Applying asynchronous edits after the document changes | Exact revision only / attempt automatic rebasing | Authority: AI — edit-producing results require the exact requested revision | ✅ Resolved |
| AR-18 | Behavioral gaps | Completion triggering and acceptance priority | Explicit-only / automatic plus explicit, with deterministic Tab/Enter precedence | User accepted recommendation: automatic and explicit completion with popup, snippet, then indentation precedence | ✅ Resolved |
| AR-19 | Edge cases | Untitled documents without a stable URI | Host supplies a stable synthetic URI / disable LSP until a URI exists | Authority: AI — optional stable synthetic URI; LSP disabled when absent | ✅ Resolved |
| AR-20 | Integration points | Dynamic LSP capability registration or loss | Reflect capability changes live / use only initialization-time capabilities | Authority: AI — reflect dynamic capability changes live | ✅ Resolved |
| AR-21 | UX & presentation | Caret or selection inside a range being folded | Move caret to header and collapse / refuse fold while caret or selection intersects | User accepted recommendation: move caret to header, clear hidden selection, then collapse | ✅ Resolved |
| AR-22 | Edge cases | Parser recovery for incomplete or invalid source | Best available partial tree and styles / disable syntax features on any parse error | Authority: AI — use the best available partial structure; only adapter failure degrades syntax features | ✅ Resolved |
| AR-23 | Security & compliance | Read-only documents receiving edit-producing LSP results | Disable and reject every edit-producing operation / allow preview with host-authorized apply | User accepted recommendation: reject edit-producing actions/results while retaining non-mutating intelligence | ✅ Resolved |
| AR-24 | Stakeholder conflicts | Host key bindings conflict with built-in or adapter bindings | Reject conflicts unless explicit override / priority-based silent winner | Authority: AI — reject conflicts unless the host explicitly overrides the exact binding | ✅ Resolved |

### Resolution notes

**AR-15 — delegated resolution**

- Authority: AI — delegated by `--auto-design`
- Eligibility: Data-structure and transaction-boundary mechanism within the confirmed editing
  behavior; it changes no feature scope or security policy.
- Objective: Make every accepted language-assisted operation predictable and reversible.
- Decision: One accepted logical operation is one undo step. Placeholder navigation is not an edit;
  text entered into placeholders remains normal user editing.
- Evidence: The existing editor already exposes a single undo stack, and completion/formatting
  arrive as logically atomic edit sets.
- Rejected alternatives: Multiple provider-defined undo steps leak implementation detail and can
  leave a document partially reverted.
- Strongest counterargument: A whole-document format may be a coarse undo step.
- Confidence: High — reopen if the editor adopts selective or branch-aware undo.
- Hardening: Atomicity and partial-failure behavior were stress-tested; no stronger alternative
  survived.
- Policy version: 1
- Root invocation ID: `AD-CODE-EDITOR-20260723-01`
- Reopen triggers: A future public transaction API permits safe, user-visible sub-operation groups.

**AR-16 — delegated resolution**

- Authority: AI — delegated by `--auto-design`
- Eligibility: Incremental-state recovery mechanism within the already approved folding feature.
- Objective: Preserve useful view state without retaining stale hidden ranges.
- Decision: Preserve folds whose mapped structural identity remains valid; unfold and remove only
  folds touched or invalidated by an edit.
- Evidence: Clearing all folds makes unrelated edits disruptive; retaining stale ranges can hide
  unrelated text after structural changes.
- Rejected alternatives: Clear-all is safe but unnecessarily destructive to user view state.
- Strongest counterargument: Stable fold identity adds adapter and mapping complexity.
- Confidence: High — reopen if a launch parser cannot provide stable structural identities.
- Hardening: Compared clear-all, positional mapping, and structural identity; structural validity
  gives the strongest correctness/UX balance.
- Policy version: 1
- Root invocation ID: `AD-CODE-EDITOR-20260723-01`
- Reopen triggers: A parser adapter cannot prove fold identity after incremental edits.

**AR-17 — delegated resolution**

- Authority: AI — delegated by `--auto-design`
- Eligibility: Concurrency and consistency mechanism under the confirmed stale-result policy.
- Objective: Prevent asynchronous language services from corrupting newer user edits.
- Decision: Edit-producing results require the exact requested document revision. Reject stale
  results and offer retry; never automatically rebase general service edits.
- Evidence: Formatting, completion, and workspace edits can overlap arbitrary ranges, so positional
  rebasing cannot prove semantic equivalence.
- Rejected alternatives: Automatic rebasing improves apparent success rate but risks applying edits
  to the wrong syntax or symbol.
- Strongest counterargument: Active typing can cause more retries.
- Confidence: High — reopen if a protocol operation supplies a verified transformation against the
  newer revision.
- Hardening: Safety dominated convenience after testing overlapping and reordered-result cases.
- Policy version: 1
- Root invocation ID: `AD-CODE-EDITOR-20260723-01`
- Reopen triggers: A specific operation defines and verifies safe rebasing semantics.

**AR-18:** User accepted automatic completion after language-declared trigger characters or a
configured typing delay plus an explicit command. An open completion popup gets first refusal on
Enter/Tab; active snippet traversal gets Tab/Shift+Tab next; otherwise Tab performs indentation.

**AR-19 — delegated resolution**

- Authority: AI — delegated by `--auto-design`
- Eligibility: Internal integration identifier mechanism; no persistence ownership changes.
- Objective: Give LSP document lifecycle messages stable identity without fabricating filesystem
  ownership.
- Decision: The host may supply a stable, unique synthetic URI for an untitled document. Without
  one, local language features work and LSP remains disabled.
- Evidence: LSP document synchronization identifies documents by URI, while the confirmed host
  boundary owns document identity.
- Rejected alternatives: Editor-generated global URIs create collision, lifetime, and ownership
  ambiguity.
- Strongest counterargument: Hosts must manage one more identifier.
- Confidence: High — reopen if the adopted protocol version introduces URI-free document identity.
- Hardening: Host ownership aligns identity lifetime with the already confirmed document boundary.
- Policy version: 1
- Root invocation ID: `AD-CODE-EDITOR-20260723-01`
- Reopen triggers: The language-service protocol no longer requires stable document URIs.

**AR-20 — delegated resolution**

- Authority: AI — delegated by `--auto-design`
- Eligibility: Protocol capability-state mechanism within the confirmed capability-negotiation
  behavior.
- Objective: Keep commands truthful when a shared or reconnecting server changes capability.
- Decision: Honor dynamic capability registration and unregistration live and update commands and
  status without recreating the editor.
- Evidence: Shared LSP sessions and reconnects were confirmed, and LSP permits dynamic capability
  changes.
- Rejected alternatives: Initialization-only capability snapshots become stale after reconnect or
  dynamic registration.
- Strongest counterargument: Live registration adds session-state tests and transition handling.
- Confidence: High — reopen if launch servers provably never negotiate capabilities dynamically.
- Hardening: The extra state is proportional and prevents knowingly stale command availability.
- Policy version: 1
- Root invocation ID: `AD-CODE-EDITOR-20260723-01`
- Reopen triggers: The supported LSP subset explicitly forbids dynamic registration.

**AR-21:** User accepted that folding a range containing the caret or any selection moves the caret
to the fold header, clears the hidden selection, and then collapses. This keeps the active position
visible.

**AR-22 — delegated resolution**

- Authority: AI — delegated by `--auto-design`
- Eligibility: Compiler error-recovery mechanism inside the approved syntax feature.
- Objective: Keep code presentation useful while developers are typing incomplete programs.
- Decision: Use the parser's best available partial structure for invalid or incomplete source.
  Ordinary syntax errors do not disable syntax features; adapter failure does.
- Evidence: Source code is routinely invalid between keystrokes, and disabling highlighting on each
  transient error would cause visible flicker.
- Rejected alternatives: Fail-closed parsing is simpler but makes an interactive editor unstable
  during normal typing.
- Strongest counterargument: Highlighting near an error may be approximate.
- Confidence: High — reopen if an adapter cannot distinguish recoverable syntax errors from engine
  failure.
- Hardening: Minimal invalid-source counterexamples favor partial recovery in every launch language.
- Policy version: 1
- Root invocation ID: `AD-CODE-EDITOR-20260723-01`
- Reopen triggers: An adapter exposes no bounded or safe recovery mode.

**AR-23:** User accepted that read-only mode disables all edit-producing commands and rejects
returned edits. Navigation, hover, diagnostics, completion browsing, and other non-mutating
language operations remain available.

**AR-24 — delegated resolution**

- Authority: AI — delegated by `--auto-design`
- Eligibility: Deterministic configuration-validation mechanism within the confirmed customizable
  key-binding surface.
- Objective: Prevent environment-dependent or order-dependent command dispatch.
- Decision: Reject duplicate bindings with a descriptive conflict unless the host explicitly
  overrides the exact binding.
- Evidence: Built-in, adapter, and host bindings share one command surface; silent priority makes
  behavior depend on registration order.
- Rejected alternatives: Priority-based resolution is concise but silently disables a command.
- Strongest counterargument: Strict validation requires more explicit host configuration.
- Confidence: High — reopen if a future public keymap model defines visible, inspectable precedence.
- Hardening: Explicit override is the only option that is both customizable and deterministic.
- Policy version: 1
- Root invocation ID: `AD-CODE-EDITOR-20260723-01`
- Reopen triggers: A new keymap contract makes conflicts observable and safely resolvable at runtime.
