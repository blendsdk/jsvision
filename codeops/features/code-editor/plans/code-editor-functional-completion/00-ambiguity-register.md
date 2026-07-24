# Code Editor functional completion — ambiguity register

> **CodeOps Artifact Schema**: 1
> **Last Updated**: 2026-07-24 23:27
> **Runtime items added during execution**: yes

## Resolved ambiguities

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
