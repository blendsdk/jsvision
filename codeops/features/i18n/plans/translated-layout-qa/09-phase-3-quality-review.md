# Phase 3 quality review

> **Status**: Reviewer and auditor accepted; no unresolved critical or major findings
> **Reviewed**: 2026-07-26 15:23 UTC
> **Authority**: AI — delegated by `--auto-design`
> **Policy version**: 1
> **Root invocation ID**: i18n-layout-qa-2026-07-26

## Review result

The independent correctness reviewer and auditor inspected the complete Phase 3 worktree and the
focused fixes. They reported no critical findings. Every major finding was fixed, and the final
review of actual Button evidence and popup geometry reported no unresolved critical or major issue.

| ID | Severity | Finding | Ruling | Evidence |
|---|---|---|---|---|
| RV-301 | Major | Locale/story reconstruction commands could not escape an active modal scope | Fix | A modal-local bridge closes the scope and re-emits the validated reconstruction command; lifecycle specifications cover both commands |
| RV-302 | Major | Shell state did not visibly distinguish selection from reconstruction | Fix | The status line shows locale, story ID, and reconstruction behavior |
| RV-303 | Major | Modal action snapshots used synthetic command identities and mutated callbacks during probes | Fix | Button exposes frozen read-only activation metadata; snapshots report actual label, command, callback, and inert states without invocation |
| RV-304 | Major | Clickable-face evidence probed one local point and bypassed clipping and z-order | Fix | Every claimed face cell resolves through the EventLoop traversal shared with production pointer routing |
| RV-305 | Major | The ComboBox story did not prove an opened popup or expose overlay geometry | Fix | The story opens the real anchored popup and snapshots its overlay, catcher, frame, descendants, and open-frame cell evidence |
| RV-306 | Major | Code Editor coverage did not exercise the localized search, assistance, diagnostic, degradation, and invisible-character surfaces | Fix | The real editor window seeds each presentation path and implementation tests inspect the resulting state |
| RV-307 | Major | Application disposal could retain modal promises, focus, capture, command handlers, or mounted state | Fix | EventLoop and ModalManager disposal settle active modal frames, unmount the tree, and clear routed state; nested-modal disposal tests pass |
| RV-308 | Major | Unicode evidence did not prove wide leaders/continuations and combining-cell integrity | Fix | Snapshots expose exact cell glyphs and widths; infeasible-bound specifications validate every cell |
| RV-309 | Minor | Popup geometry and rendered-cell evidence represented different moments | Fix | Both are captured from the same open-overlay frame before non-destructive dismissal |
| RV-310 | Minor | Label-derived modal IDs changed across locales | Fix | Undeclared modal actions use stable index-based IDs while labels remain actual localized Button metadata |
| RV-311 | Minor | Button activation metadata tests omitted callback-only and inert controls | Fix | Dedicated implementation cases cover command-plus-callback, callback-only, and inert descriptors |
| RV-312 | Minor | The popup oracle could confuse ordinary dialog descendants with overlay descendants | Fix | The public snapshot separates overlay surfaces and descendants and the specification targets them directly |

## Delegated resolution

- **Eligibility**: Internal inspection, lifecycle, test, and harness architecture within the
  approved ten-locale QA behavior. No product scope, acceptance criterion, or compatibility policy
  changed.
- **Objective**: Prove translated geometry and reconstruction with real framework objects while
  preventing destructive test probes or state leakage.
- **Decision**: Keep the supervisor serializable and reconstructive; use actual public component
  metadata plus the production EventLoop traversal for headless evidence; settle all modal state on
  disposal; preserve open-popup render evidence before dismissing it for underlying action checks.
- **Evidence**: Modal routing intentionally confines application handlers, Buttons may bind commands,
  callbacks, both, or neither, and anchored popups are siblings in the application overlay rather
  than descendants of the story dialog.
- **Rejected alternatives**: Synthetic commands cannot prove real activation. Repeatedly invoking
  callbacks can close or mutate the surface. Reimplementing hit-testing in Examples could disagree
  with production clipping and z-order. Mutable locale state contradicts the approved lifecycle.
- **Strongest counterargument**: The read-only Button and EventLoop inspection seams enlarge the
  public SDK. They are additive, independently useful for headless applications, document actual
  existing behavior, and avoid exposing callback functions or mutation authority.
- **Confidence**: High — final independent review found no critical or major issue, focused and
  complete affected-package suites pass, and the interactive terminal command renders and exits.
- **Hardening**: The reviewer and auditor independently converged on the final action and popup
  model. Their remaining minor oracle-precision findings were implemented before the authoritative
  full gate.
- **Reopen triggers**: Any action descriptor diverges from runtime activation, `viewAt` diverges from
  pointer routing, popup evidence loses its open frame, package/plugin verification regresses, or
  full `yarn verify` fails.

## Verification

| Scope | Result |
|---|---|
| Focused UI | 17 tests passed before minor hardening; 15 relevant cases passed after final hardening |
| Focused multilingual Examples | 46 tests passed |
| UI package | 331 files, 1,932 tests passed |
| Examples package | 47 files, 376 tests passed |
| Documentation/plugin | UI `check:docs`, `yarn plugin:update`, and `yarn plugin:check` passed |
| Interactive command | `demo:i18n` rendered the 80×24 shell and exited through Alt+Q |
| Full gate | `yarn verify` passed in 248 seconds |
