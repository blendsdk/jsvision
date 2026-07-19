# RD-01: Deliberate TV-Divergence Flex-Elimination Policy

> **Document**: RD-01-deliberate-divergence-policy.md
> **Status**: Draft
> **Created**: 2026-07-19
> **Project**: jsvision — `layout-dsl-adoption`
> **Depends On**: — (governs GH #115, #120, #110, #112; assumes the #113 DSL hardening, already shipped)
> **CodeOps Skills Version**: 3.9.0

---

## Feature Overview

The jsvision widget set inherited Borland Turbo Vision's habit of placing every child at hand-computed cell coordinates (`view.layout = { position:'absolute', rect }`) and reflowing on resize with bespoke per-child machinery. Now that the layout DSL is hardened (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`/`center`/`cover`/`at`), most of that absolute placement turns out to be **structurally flex** — it only used coordinates to stay pixel-faithful to TV.

This RD records a deliberate policy decision: **jsvision will break Turbo Vision geometry parity where doing so lets absolute placement be replaced by flex composition.** The payoff is not an `at()`-for-`at()` swap — it is *deletion* of the coordinate math and resize machinery, plus ~470 example/story/docs sites converging on the recommended idiom. Because this overrides two standing disciplines (the TV-fidelity porting guideline and the immutable-spec-test rule), the policy, the affected components, and the keep-absolute boundary are recorded here so the change is auditable and not silently reversed by a future porter.

---

## Functional Requirements

### Must Have

- [ ] **FR-1 — Divergence is sanctioned for the recorded component set only.** The following components MAY have their rendered geometry (child rects, on-screen positions) diverge from Turbo Vision: `messageBox` / `confirm` / `inputBox` (`ui/dialog/message-box.ts`); `findDialog` / `replaceDialog` / `confirmBox` (`ui/editor/dialogs.ts`); `errorBox` (`files/dialog/error-dialog.ts`); `FileDialog` (`files/dialog/file-dialog.ts`); `ChDirDialog` (`files/dialog/chdir-dialog.ts`); `formDialog` (`forms/form-dialog.ts`). No component outside this list (plus the example/story/docs canvases in FR-6) may diverge without a new recorded decision. [AR-1, AR-7]
- [ ] **FR-2 — Behavior is invariant.** For every converted component, only geometry/position may change. Entries/content, reactive signals, keyboard + mouse behavior, validation, focus + **tab-traversal order**, resolved theme roles + glyphs (colors), the dialog-level `minWidth`/`minHeight` resize floor, and public return values MUST remain identical to the pre-conversion behavior. [AR-9]
- [ ] **FR-3 — Tab-traversal order is preserved exactly.** Because keyboard focus traversal follows view-tree child add-order in this framework, each rebuilt component MUST preserve its current logical tab order even where the visual layout changes, and MUST carry a per-component traversal-order spec test asserting the focus sequence. [AR-4]
- [ ] **FR-4 — The keep-absolute boundary is honored.** The following stay absolutely placed and MUST NOT be flexed: window/desktop/drag-resize gestures; cursor/caret-anchored popups (menu, dropdown, `replacePrompt`'s outer frame); measure-anchored extents (datagrid `personalize`, `filter-popup`, `overlay`, `quick-filter reposition`); the `theme-designer/gallery.ts` scatter scene; the movable-window desktop apps; the polar `analog-clock`; and `keyboard-mouse-playground` (raw `ScreenBuffer`, no view tree). The base `Window` has no separable inner flex shell and is not split. [AR-8]
- [ ] **FR-5 — Machinery is deleted, not ported.** The conversion MUST remove, not re-express:
  - `packages/files/src/dialog/grow-dialog.ts` and `packages/files/src/dialog/grow.ts` (whole files — imported only by `file-dialog.ts` + `chdir-dialog.ts`, not re-exported), together with the `growItems` fields and `onResized()` grow-mode overrides;
  - the local `at()` / `tv()` / `place()` / `centerX()` / `PAIR_WIDTH` / `buttonRects` coordinate helpers in the ui/editor/forms dialogs;
  - the manual full-viewport resize re-anchoring on the 5 catcher/host overlays, replaced by `cover()`. [AR-10]
- [ ] **FR-6 — Example / story / docs canvases adopt the DSL where structurally flex.** The maximal scope extends to `@jsvision/examples`, `@jsvision/docs-site`, and `theme-designer` panels: canvases that are actually forms / shells / grids (~470 sites) are converted to flex; genuine scatter (per FR-4) is left absolute. This is didactic — converted examples model the recommended idiom. [AR-1, AR-12]
- [ ] **FR-7 — The deliberate-divergence record is durable in two places.** The non-faithful component list (FR-1) is recorded (a) in this RD and (b) as a short carve-out added to the "Turbo Vision fidelity" section of the project `CLAUDE.md`, so a porter reading the fidelity guideline on the job sees that these components are intentionally non-faithful and must not be "restored." [AR-5]
- [ ] **FR-8 — Spec-oracle re-derivation is a recorded requirement change, not a test "fix."** Where a conversion changes geometry, the affected `*.spec.test.ts` oracles are RE-DERIVED to the new flex geometry (or deleted where they only assert removed machinery). This is the explicit, recorded exception to the CodeOps immutable-spec-oracle rule; the per-file protocol is in RD-02. [AR-2, AR-8]

### Should Have

- [ ] **FR-9 — Ship in tiers, parity-safe first.** Sequence the work Tier 0 → Tier 2 → Tier 3 (see *Tiering* below) so the zero-oracle-cost, zero-geometry-change changes land and prove the direction before any oracle is re-derived. [AR-6]

### Won't Have (Out of Scope)

- Datagrid `col`/`row` ports (GH #116) — behavior-preserving flex adoption, not parity-breaking; stays an ordinary epic child. [AR-11]
- The `setLayout(partial)` primitive (GH #117) — orthogonal primitive work. [AR-11]
- Any change to keyboard/mouse semantics, validation, or theming — geometry-only per FR-2.
- Re-flexing the keep-absolute set (FR-4).

---

## Technical Requirements

### The divergence policy (what may bend, what may not)

| Axis | Rule |
|------|------|
| Geometry (child rects, positions) | **May diverge** from TV, for the FR-1 set + FR-6 canvases only. |
| Behavior (input, signals, validation, focus/tab order, return values) | **Invariant** (FR-2, FR-3). |
| Colors (resolved theme roles + glyphs) | **Invariant** — re-layout must not change which role/glyph paints, only where. |
| Dialog min-size resize floor | **Invariant** — enforced by the `Window` resize path, untouched by removing grow-mode. |

### Tiering (drives sequencing; full oracle cost in RD-02)

| Tier | Content | Geometry change | Oracle cost |
|------|---------|-----------------|-------------|
| **Tier 0 — parity-safe** | base `Dialog` `center(this)/at(this)`; 5 `cover()` overlays (`app/application.ts:335/435`, `menu/controller.ts:230/286`, `dropdown/popup.ts:250`); `formDialog` body `cover(body)`; walkthrough demos → `cover()/center()`; `demo-shell` inner → `center()` | none | **none** — centering/resize tests survive as parity witnesses |
| **Tier 2 — dialog bodies** | `file`/`chdir` rebuild + delete grow-dialog/grow; `messageBox`/`confirm`/`inputBox`; editor `findDialog`/`replaceDialog`/`confirmBox`; `errorBox` | deliberate | re-baseline / delete a bounded set (RD-02) |
| **Tier 3 — maximal demos/stories/docs** | ~470 example/story/docs canvas conversions | deliberate (didactic) | **none** (no rect oracles; smoke = "renders ≥1 cell") |

### Machinery-deletion inventory (FR-5)

| Delete | Why safe |
|--------|----------|
| `files/dialog/grow-dialog.ts`, `files/dialog/grow.ts` | Imported only by file/chdir dialogs; not re-exported. Flex reflows on resize for free; grow-mode captured **no** per-child minimum, so no floor is lost. |
| local `at()`/`tv()`/`place()`/`centerX()`/`PAIR_WIDTH`/`buttonRects` in ui/editor/forms dialogs | Superseded by DSL `col`/`row`/`fixed`/`grow` + `justify:'center'`. Removing them also clears the #114 name-shadow findings. |
| manual resize re-anchoring on 5 overlays | `cover()` (`position:'fill'`) re-solves on resize for free. |

---

## Integration Points

### With RD-02 (Non-Functional & Verification)
- RD-02 owns the behavior-invariant test strategy (FR-2/FR-3), the per-file oracle re-derivation protocol (FR-8), the kitchen-sink quality gate (FR-6), performance, and security. RD-01 states *what* diverges; RD-02 states *how it is proven safe*.

### With the GitHub issues (executable scope)
- **#115** — ui/forms dialog family (Tier 0 base-Dialog + `cover()` overlays; Tier 2 message/editor/form bodies).
- **#120** — files dialogs (`FileDialog`/`ChDirDialog`/`errorBox`) + grow-dialog deletion (Tier 2).
- **#110 / #112** — the maximal example/story/docs conversion (Tier 3, FR-6).
- Per-package PRs (repo ground rule); each PR that changes geometry re-derives its oracles per RD-02 and cites this RD.

### With the project `CLAUDE.md`
- FR-7 mandates a carve-out added to the "Turbo Vision fidelity" section listing the FR-1 components as deliberately non-faithful.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Aggressiveness of `at()`-elimination | Dialogs-only / Conservative / Maximal | Maximal (dialogs + demos, break parity) | Payoff is machinery deletion + didactic idiom convergence, not a swap | AR-1 |
| Oracle handling for the parity break | Re-derive w/ record / minimal / defer | Re-derive with a recorded decision | Parity break is a requirement change; must be auditable | AR-2 |
| RD structure | Policy+NFR / per-tier / single | Policy RD + NFR RD | Feature is GitHub-issue-driven; issues carry per-package how-to | AR-3 |
| Tab-traversal order under flex | Preserve exactly / follow visual / per-dialog | Preserve logical order exactly + spec test | Traversal follows child add-order; a silent reorder is a behavior change | AR-4 |
| Non-faithful record location | RD+CLAUDE.md / RD-only / CLAUDE.md+ADR | RD + CLAUDE.md carve-out | The RD is the record; CLAUDE.md is where a porter actually reads it | AR-5 |
| First slice / MVP | Tier 0 / dialogs / demos | Tier 0 parity-safe first | Zero-risk proof of direction before any oracle re-derivation | AR-6 |
| #116 / #117 relationship | In / out of this set | Out (separate epic children) | Not parity-breaking work | AR-11 |

> **Traceability:** every decision above references its Ambiguity Register entry. See `00-ambiguity-register.md`.

---

## Security Considerations

> **🚨 MANDATORY section.** See the project CLAUDE.md security standard.

- **Data sensitivity**: none new. The affected dialogs handle user-entered text (`inputBox`, find/replace) and filesystem paths (`FileDialog`/`ChDirDialog`), exactly as today.
- **Input validation**: unchanged. `Input` validators, `inputBox`'s validator hook, and file-path handling via the injected `FileSystem` seam are not touched — the work is composition-only (FR-2).
- **Authentication & authorization**: N/A (local TUI, no auth surface).
- **Injection risks**: unchanged. File-dialog path handling / canonicalization and any escaping stay in place; no new shell/eval/query path is introduced by re-composing views.
- **Encryption needs**: N/A.
- **Rate limiting**: N/A.
- **Infrastructure**: N/A (zero runtime deps; deleting `grow-dialog.ts`/`grow.ts` reduces surface, adds none).

---

## Acceptance Criteria

1. [ ] The `CLAUDE.md` "Turbo Vision fidelity" section contains a carve-out block naming exactly the FR-1 components as **deliberately non-faithful (geometry may diverge from TV; do not "restore fidelity")**, cross-referencing this RD. (FR-7)
2. [ ] No component outside the FR-1 set + the FR-6 canvases shows any geometry change (a golden/emulator diff over the keep-absolute set in FR-4 is byte-identical before/after each PR). (FR-1, FR-4)
3. [ ] For every FR-1 dialog, a traversal-order spec test asserts the exact keyboard focus sequence, and that sequence equals the pre-conversion sequence. (FR-3)
4. [ ] For every FR-1 dialog, its content, reactive signals, keyboard + mouse behavior, validation, resolved theme roles/glyphs, `minWidth`/`minHeight` floor, and public return values are unchanged, proven by the surviving behavioral tests passing without edit. (FR-2)
5. [ ] `packages/files/src/dialog/grow-dialog.ts` and `grow.ts` no longer exist; `grep -r "grow-dialog\|captureGrowItems\|applyGrowMode\|GrowMode\|growRect" packages/*/src` returns zero matches; the `@jsvision/files` barrel is unchanged. (FR-5)
6. [ ] The local `at`/`tv`/`place`/`centerX`/`PAIR_WIDTH`/`buttonRects` helpers are gone from the ui/editor/forms dialogs, and the 5 named overlays use `cover()` with no manual resize re-anchoring. (FR-5)
7. [ ] Every geometry-changing PR either re-derives or deletes its affected `*.spec.test.ts` oracle per the RD-02 protocol and cites this RD as the recorded exception; no spec oracle asserting old TV geometry remains green by accident. (FR-8)
8. [ ] Every converted Tier-3 story passes both the headless smoke test AND the kitchen-sink quality bar (no clipped text, faithful colors, keyboard + mouse working), verified by a manual showcase pass. (FR-6)
9. [ ] Security requirements verified: input validation, file-path handling, and validators are provably unchanged (behavioral security tests pass unedited). (Security)
10. [ ] `yarn verify` green on each PR; `yarn lint:fix` run before each PR (repo prime directive).
