# Task T-03: Code Editor folding and demo coverage

> **Type**: Task (lightweight) · **Feature**: code-editor · **CodeOps Artifact Schema**: 1
> **Progress**: 9/10 tasks (90%)
> **Last Updated**: 2026-07-24 21:52
> **Phase baseline tree**: 969b1a6a58cb8357a903ce3d1cd54a4d451aa466

## Objective

Finish structural code folding as a real editor behavior, make every supported Code Editor window
geometry operation resize its contents correctly, and replace the kitchen sink's coarse coverage
claims with an honest capability-level inventory backed by interactive scenarios.

## Scope and delegated design decisions

- Treat "all possible scenarios" as every distinct user-visible capability currently supported by
  the public Code Editor, not the combinatorial product of documents, themes, terminal profiles,
  key bindings, and window sizes.
- Keep an explicit inventory with `interactive`, `automated-only`, or `unsupported` status. A
  capability may be called demonstrated only when a user can reach and observe it in the standalone
  demo; tests or configuration labels alone do not count.
- Add dedicated or tightly cohesive scenarios for supported capabilities. Reuse one scenario only
  when its controls and visible state make every claimed capability independently observable.
- Never simulate missing production behavior in the demo. Unsupported capabilities remain visible
  inventory gaps with a reason and follow-up boundary.
- Implement parser-backed structural folding from validated current-revision adapter ranges.
  Collapsed state is presentation-only: it never changes source text, revision, modified state, or
  undo history.
- Reconcile collapsed folds conservatively after analysis. Preserve a fold only when its adapter,
  structural header path, and bounded region still identify one unambiguous current fold; otherwise
  unfold it rather than hide uncertain source.
- Use one visible-row map for projection, viewport limits, caret following, keyboard navigation,
  mouse mapping, line-number/fold-marker gutters, and scrollbar ranges. Hidden rows must not remain
  independently reachable through another coordinate path.
- Support toggle fold, fold, unfold, fold all, and unfold all through the public command boundary.
  Existing Ctrl+[ behavior remains a toggle; new commands need not claim terminal chords that the
  current keymap cannot represent reliably.
- Show Unicode fold markers with ASCII fallbacks and non-color collapsed/expandable states. Fold
  markers appear only when the line-number gutter is enabled and usable.
- Collapsing a range that contains the caret or selection moves the caret to the header and clears
  the hidden selection before changing visible rows.
- A stale, malformed, single-line, overlapping, excessive, or foreign-revision fold result never
  hides text and never creates invalid viewport coordinates.
- Harden `CodeEditorWindow` for every existing size-changing path: corner resize, maximize, restore,
  terminal resize while maximized, cascade, and tile. Moving changes only origin and preserves
  child geometry. The UI framework has no minimize state; the second zoom action is restore, not a
  separate taskbar-style minimize operation.
- Keep the demo deterministic and self-contained: no filesystem mutation, network, database,
  credentials, external language server, or browser/DOM dependency.
- Keep generated plugin surfaces synchronized whenever the source-impact map reports an affected
  SDK or documentation surface.

## Specification cases

- **ST-01**: Maximizing and restoring a mounted `CodeEditorWindow` immediately re-fit the editor,
  both scrollbars, status line, viewport metrics, and caret without waiting for another resize.
- **ST-02**: Corner resize, terminal resize while maximized, cascade, and tile publish matching
  frame/content dimensions; moving changes only the window origin and retains content dimensions;
  the demo window remains movable, resizable, and shadowed.
- **ST-03**: Current-revision adapter folds spanning multiple logical lines become validated
  foldable regions; stale, foreign, malformed, single-line, crossing, and excessive ranges are
  ignored or bounded without hiding source.
- **ST-04**: Fold, unfold, toggle, fold-all, and unfold-all hide and restore only region interiors
  while document text, identity, modified state, and history remain unchanged.
- **ST-05**: Collapsing a range containing the caret or selection places one caret at the header;
  unrelated edits preserve an unambiguous structural fold after fresh analysis, while touched,
  stale, or ambiguous structure unfolds safely.
- **ST-06**: Projection, caret following, arrows, page-independent vertical navigation, mouse
  placement/dragging, edge auto-scroll, scrollbar limits, and line numbers all use visible rows
  while one or more nested regions are collapsed.
- **ST-07**: The gutter exposes expandable/collapsed markers that can be activated by keyboard
  command and primary click, with Unicode and ASCII/monochrome presentations and narrow fallback.
- **ST-08**: The demo inventory names every supported public user-visible capability and rejects a
  claimed interactive capability with no reachable scenario action or observable state.
- **ST-09**: Dedicated scenarios cover direct embedded and windowed surfaces, editing/read-only
  lifecycle, local languages and structure, assistance/LSP behavior, host authorization and
  failures, themes/accessibility/hostile text, viewport/window operations, and document-size tiers.
- **ST-10**: The folding scenario obtains real parser ranges, collapses nested TypeScript and
  PostgreSQL structures, exposes fold state in the inspector, and proves that hidden source returns
  unchanged after unfolding.
- **ST-11**: Existing unsupported product capabilities are listed honestly and are not counted as
  interactive demo coverage; future support can replace the inventory gap with a scenario without
  changing the registry contract.
- **ST-12**: Normal, narrow, monochrome, ASCII, hostile-text, large-document, and repeated
  fold/unfold fixtures stay responsive, clipped, terminal-safe, and within configured bounds.

## Auto-design record

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal fold identity, visible-row mapping, validation, demo-registry
  structure, test strategy, and implementation sequencing within the confirmed behavior.
- **Objective**: Deliver honest, observable Code Editor coverage while making folding and window
  resizing correct rather than cosmetic.
- **Decision**: Use a conservative controller-owned structural fold model plus one immutable
  visible-row map consumed by all UI geometry; replace broad facet labels with capability-level
  evidence and explicit unsupported entries.
- **Evidence**: Adapters already emit validated offset fold ranges, but the controller currently
  creates zero-length line markers and projection iterates every logical row. The demo's broad
  twelve-label manifest can pass while many required actions have no interactive control. The
  generic window invokes `onResized()` for drag, arrange, and maximized desktop resize, while
  `CodeEditorWindow` lacks the zoom override used by the established `EditWindow`.
- **Rejected alternatives**: Projection-only folding would leave navigation, mouse, and
  scrollbars inconsistent; line-number-only folds would break after edits; clearing every fold
  after any edit violates preservation; retaining ambiguous ranges risks hiding unrelated source;
  one scenario per combinatorial state is unbounded and adds no distinct learning value.
- **Strongest counterargument**: A shared visible-row map and structural reconciliation add state
  to an editor that previously projected logical lines directly. The alternative creates several
  incompatible coordinate systems and cannot meet navigation or safety requirements.
- **Confidence**: High for the shared geometry boundary and honest inventory; Medium-High for
  conservative structural reconciliation until hostile edit/property coverage validates it.
- **Hardening**: The design was reframed against minimal, projection-only, and demo-only fixes;
  correctness, performance, and accessibility reviewers must challenge hidden-row mapping and
  inventory truthfulness before closure.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-folding-demo-2026-07-24`.
- **Reopen triggers**: Adapter fold identities gain a stable public ID, terminal input gains a
  reliable multi-chord folding key contract, or the UI framework adds a real minimized-window state.

## Tasks

- [x] T-03.1 `[spec-author]` Add immutable specification tests for ST-01 through ST-12, including
  real window gestures, maximize/restore, nested folding, hidden-row navigation, hostile ranges,
  inventory truthfulness, and dedicated scenario reachability. ✅ (completed: 2026-07-24 21:52)
- [x] T-03.2 Run the focused specification suites and record the expected red phase before changing
  folding, projection, window, or scenario implementation. ✅ (completed: 2026-07-24 21:52)
- [x] T-03.3 Implement validated structural fold regions, conservative reconciliation, command
  semantics, caret/selection safety, and document-invariant preservation.
  ✅ (completed: 2026-07-24 21:52)
- [x] T-03.4 Implement the shared visible-row map across projection, viewport, caret/navigation,
  mouse interaction, scrollbars, fold-marker gutter presentation, and marker activation.
  ✅ (completed: 2026-07-24 21:52)
- [x] T-03.5 Harden `CodeEditorWindow` maximize/restore and all existing size-changing window paths;
  confirm ST-01 and ST-02 green through the real desktop event loop.
  ✅ (completed: 2026-07-24 21:52)
- [x] T-03.6 Replace coarse demo facets with a capability-level inventory that distinguishes
  interactive, automated-only, and unsupported behavior and cannot accept label-only evidence.
  ✅ (completed: 2026-07-24 21:52)
- [x] T-03.7 Add or refine deterministic scenarios and controls until every currently supported
  interactive capability has reachable behavior and visible state, including real folding.
  ✅ (completed: 2026-07-24 21:52)
- [x] T-03.8 Run all specification tests green, then add implementation, property, hostile-boundary,
  lifecycle, accessibility, and performance coverage without weakening the immutable oracle.
  ✅ (completed: 2026-07-24 21:52)
- [x] T-03.9 Refresh Code Editor architecture/user documentation and every impacted canonical and
  generated plugin surface; run documentation, reference, formatting, and plugin-integrity checks.
  ✅ (completed: 2026-07-24 21:52)
- [ ] T-03.10 Run focused checks and authoritative `yarn verify`, complete independent correctness,
  performance, and accessibility/semantics review, resolve every accepted Critical/Major finding,
  then synchronize traceability and roadmaps.

**Verify**: `yarn verify`

## Execution evidence

- **Red phase (2026-07-24 21:32)**: Package typechecks passed. Focused immutable specifications
  produced 10 expected failures: two maximize/restore geometry cases, five structural
  folding/visible-row cases, and three capability-inventory/scenario-reachability cases. Existing
  move/resize/cascade/tile and hostile-boundary cases remained green.
- **Green phase (2026-07-24 21:52)**: New focused Code Editor specifications, implementation, and
  performance tests pass 13/13; focused showcase specifications pass 34/34; the serial
  authoritative repository gate passes 34/34 tasks with plugin integrity green.
