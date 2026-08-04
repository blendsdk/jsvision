# Requirements: Data Grid Escape-to-Revert

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

An edited row may temporarily fail `validateRow` after its individual cell commits have succeeded.
The grid must continue trapping row-leave attempts, but once trapped it must offer a discoverable
Escape recovery that restores only the values committed during the current row visit. Recovery must
remain coherent with in-memory rows, reactive master-detail sources, and application persistence
without turning the feature into general undo/redo (AR-1, AR-3, AR-5, AR-9).

## Functional Requirements

### Must Have

- [ ] **R1 — Session lifecycle:** the first successful cell commit starts a row edit session; a failed
      `validateRow` leave marks it trapped; a successful leave or successful revert ends it (AR-3).
- [ ] **R2 — Bounded baseline:** record only successfully committed editable columns, keep the earliest
      pre-session value per column, and update only its latest committed value on repeated edits
      (AR-6, AR-12).
- [ ] **R3 — Escape priority:** Escape in an open editor cancels only that edit; body Escape reverts only
      the trapped focused session and does not move the cursor (AR-4).
- [ ] **R4 — Atomic rollback:** revert every recorded cell as one optimistic row transaction and invoke
      exactly one `onRevertRow` decision whenever that callback is supplied (AR-5, AR-10, AR-14).
- [ ] **R5 — Persistence safety:** without `onRevertRow`, a grid with neither `beforeSave` nor
      `onCommit` may accept internally; a grid configured with either per-cell callback must refuse
      rollback (AR-8).
- [ ] **R6 — Retryable failure:** callback false/throw/rejection restores the committed pre-revert values,
      keeps the row trapped, and permits another Escape attempt (AR-10, AR-13).
- [ ] **R7 — Race control:** while rollback is pending, prevent duplicate rollback, editing, navigation,
      deletion, and focus transfer through grid-owned input paths (AR-10).
- [ ] **R8 — Identity safety:** sorting, column hiding, and collection republication retain the session
      while key+object identity is stable. Observable removal, row-object replacement, key reuse, or
      disposal invalidates UI/session ownership. A late veto may compensate only its captured original
      row. A live stale attempt detaches only presentation it owns and reconciles when needed; it must
      not mutate replacement data/focus/session state or any disposed grid state (AR-7, AR-10).
- [ ] **R9 — Reactive coherence:** restore through the recorded typed-column setters and publish a
      coherent version update so `fromReactiveRows` and `masterDetail` consumers observe the same row
      values (AR-9).
- [ ] **R10 — Discoverability:** the message band uses the localized trapped template and the exact
      pending/failure/unavailable messages approved in AR-13.
- [ ] **R11 — Remapping:** `GridAction` includes `revertRow`, plain Escape maps to it by default, and a
      caller may replace that chord or bind the action elsewhere under the existing merge rules (AR-12).
- [ ] **R12 — Documentation and distribution:** public JSDoc/API, package docs, showcase, docs-site lesson
      and laboratory, canonical JSVision skill references, and generated plugin content teach and prove
      the contract (AR-13, AR-14).

### Should Have

- [ ] **R13 — Atomic repaint:** batch rollback presentation into one version bump when the existing view
      architecture permits it, avoiding intermediate mixed-row frames (AR-9).
- [ ] **R14 — Non-color cue:** pending, trapped, failed, and unavailable states remain understandable
      through text without relying on color (AR-13).

### Won't Have (Out of Scope)

- General undo/redo, multi-level history, or reverting a session after a successful leave (AR-1, AR-3).
- Rejecting individually valid cell commits merely because the current row combination is invalid
  (AR-1).
- Escape moving the row cursor or automatically choosing a destination row (AR-4).
- Whole-row cloning, serializing generic records, or replacing row prototypes/accessors (AR-6).
- Per-cell callback replay, silent local rollback beside configured persistence callbacks, or a new
  persistence implementation owned by the grid (AR-5, AR-8).
- A new `GridDataSource` rollback method or changes to source sorting/filtering protocols (AR-5, AR-9).

## Technical Requirements

### Performance and Resource Bounds

- State is proportional to active row sessions and their changed columns, never total rows or full row
  size; all terminal session paths release it (R2, R8; AR-12).
- Key handling and validation retain constant-time focused-session lookup; no row scan is introduced for
  an ordinary Escape (AR-7, AR-12).
- Rollback uses at most one host callback and one coherent repaint per mutation stage: accepted or
  internal rollback has one apply stage, while a callback veto has an apply stage and a compensation
  stage (R4, R13; AR-5, AR-9).

### Compatibility

- The new option, callback types, action literal, default chord, and locale keys are additive public SDK
  changes; existing constructors compile and behave as before when the feature is not eligible (AR-12,
  AR-14).
- Existing editor Escape behavior and caller keymap precedence remain unchanged (R3, R11; AR-4, AR-12).
- Official locale catalogs remain complete, generated API/skill artifacts are synchronized, and the
  plugin remains consumer-runtime independent (R10, R12; AR-13).

### Security

- Treat `validateRow`, column setters, and persistence callbacks as trusted application code.
  Editable setters must be synchronous, deterministic, and non-throwing for atomicity; a violated
  setter precondition receives bounded best-effort recovery and must not escape through the input
  event loop. Isolate callback false/throw/rejection into bounded user-facing outcomes (AR-10, AR-11).
- Never log row values, rollback payloads, or host exception text; display package-owned bounded messages
  through the existing terminal sanitization boundary (AR-11, AR-13).
- Freeze the public cells array and cell descriptor objects before callback delivery so the callback
  cannot alter the transaction description (AR-11, AR-14).
- No authentication, authorization service, network, filesystem, secret, encryption, rate-limit, or
  server-input surface is introduced; application persistence remains authoritative (AR-5, AR-11).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Capability boundary | Repair validation / scoped recovery / general undo | Scoped recovery | Preserve necessary transient-invalid editing without growing history | AR-1 |
| Planning boundary | Maintenance task / reopen archive / standalone feature | Standalone feature | Public async SDK capability warrants full traceable planning | AR-2 |
| Baseline | Clone row / snapshot all columns / journal committed columns | Journal committed columns | Avoid generic-row corruption and unrelated overwrites | AR-6 |
| Persistence | Row callback / cell replay / local-only | Atomic row callback | Prevent partial persistence and storage/UI divergence | AR-5, AR-8 |
| Input | Non-remappable Escape / remappable action / command-only | Remappable default action | Matches the existing keymap contract while preserving editor priority | AR-4, AR-12 |
| Presentation | English concatenation / localized template / extra row | Localized template | Gives each locale control of message ordering without extra layout height | AR-13 |

## Acceptance Criteria

1. [ ] **C1:** A committed edit that traps on row leave is restored by body Escape; the message and
       touched/session state clear, focus stays on that row, and the next leave succeeds.
2. [ ] **C2:** Multiple changed columns restore together, and repeated commits to one column restore its
       earliest value from the current session.
3. [ ] **C3:** Editor Escape cancels only the uncommitted edit; a following body Escape may revert the
       previously trapped committed session.
4. [ ] **C4:** Escape is a no-op for untouched, untrapped, successfully-left, read-only, and empty states.
5. [ ] **C5:** A corrected but not successfully-left trapped session remains revertible; a successful
       validated leave discards it permanently.
6. [ ] **C6:** A callback sees one frozen, commit-aligned `RowRevert<T>` payload containing all changed
       cells and the optimistically restored row.
7. [ ] **C7:** Pending rollback is visible and serialized; callback veto, throw, or rejection compensates
       without partial visible rollback and keeps recovery retryable.
8. [ ] **C8:** A persistence-configured grid without `onRevertRow` refuses local rollback and shows the
       localized unavailable message.
9. [ ] **C9:** Sorting, filtering, column hiding, same-identity collection republication, reactive rows,
       master-detail, deletion, replacement, key reuse, and disposal satisfy R8–R9 without restoring
       into the wrong record or stale grid state.
10. [ ] **C10:** Default and remapped key behavior is deterministic and retains open-editor precedence.
11. [ ] **C11:** Every official locale and its digest-bound review evidence, showcase, docs-site
       laboratory/page, generated API, canonical skill reference, and plugin copy reflects the
       shipped behavior.
12. [ ] **C12:** Focused package/docs/plugin gates and `yarn verify:local` pass; a manual 80×24 run proves
       trap → hint → Escape → restored row → normal navigation.
