# Roadmap: Layout-DSL Adoption

> **Feature-Set**: Layout-DSL Adoption
> **Status**: In Progress
> **Created**: 2026-07-18
> **Last Updated**: 2026-07-19
> **Progress**: 0 / 10 issues done · requirements: RD-01/RD-02 ✏️ drafted · plans: [tier0-parity-safe](plans/tier0-parity-safe/00-index.md) ✅ done (Tier-0 MVP — 12/12) · [focus-traversal-primitive](plans/focus-traversal-primitive/00-index.md) ✅ done (exec_plan 11/11, GH #122) · [flex-dialog-bodies](plans/flex-dialog-bodies/00-index.md) ✅ done 2026-07-19 (exec_plan 14/14) (#115 Tier-2 ui/forms dialog bodies — #122 unblocked)
> **CodeOps Skills Version**: 3.9.0

Adopt the layout DSL (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`/`place` + the #113 additions) across
the existing `.layout = {…}` call sites — the deferred **AR-4 follow-up** of the archived `layout-dsl`
plan. **GitHub-issue-driven** (no per-target codeops plans) — this roadmap is the codeops-side register
pointing at the epic. The `dsl-hardening` prerequisite (GH #113) is **done** (its own feature/plan).

**Direction update (2026-07-19) — flex-elimination sanctioned.** After a fresh flex-refactor sweep (now
that #113's `at()`/`cover()`/`center()` shipped), the maintainer decided to **deliberately break Turbo
Vision geometry parity** to *eliminate* absolute placement in favor of flex — including the TV dialogs
and demo canvases. The payoff is machinery deletion (`grow-dialog.ts` + `grow.ts` go) plus ~470 demo/
story/docs sites adopting the idiom, not an `at()`-for-`at()` swap. This is governed by a requirements
set (a departure from the pure issue-driven model, because it overrides the TV-fidelity + immutable-spec
disciplines and needs a recorded decision):

- **[RD-01 — Deliberate TV-divergence flex-elimination policy](requirements/RD-01-deliberate-divergence-policy.md)** ✏️ Drafted
- **[RD-02 — Non-functional & verification](requirements/RD-02-non-functional-and-verification.md)** ✏️ Drafted
- **[Ambiguity Register](requirements/00-ambiguity-register.md)** — ✅ GATE PASSED (13 items)
- **[Plan: tier0-parity-safe](plans/tier0-parity-safe/00-index.md)** — ✅ Done (implements RD-01 Tier-0; verification RD-02) — base `Dialog` center/at · catchers + formDialog body `cover()` · 13 demos · CLAUDE.md carve-out
- **[Plan: focus-traversal-primitive](plans/focus-traversal-primitive/00-index.md)** — ✅ Done (exec_plan 11/11, 2026-07-19; GH **#122**; on `feat/dsl-adoptation`, pending merge) · 🔎 Preflighted 2026-07-19 ([report](plans/focus-traversal-primitive/00-preflight-report.md) — 7 findings, all resolved + fixed) (Primitive; enables RD-01 FR-2/FR-3) — a Tier-2 blocker surfaced during planning: `col`/`row` nest `Group`s but Tab traversal was group-scoped (emergent behavior of `advance()`, not spec-locked), and an empirical probe showed `FileDialog`/`ChDirDialog` Tab **already dead-ended in the list** today. Fix = scope-ceilinged tree-order `advance()` (with a `descendLast` reverse mirror + exited-group memory reset) so nested-flex dialogs become keyboard-traversable. Shipped: ST-F1…F7 spec oracles, all focus witnesses unedited, verify + bench green. **Prerequisite of #115 + #120.**
- **[Plan: flex-dialog-bodies](plans/flex-dialog-bodies/00-index.md)** — ✅ Done (exec_plan 14/14, 2026-07-19; on `feat/dsl-adoptation`, pending merge) · 🔎 Preflighted 2026-07-19 ([report](plans/flex-dialog-bodies/00-preflight-report.md) — 6 findings all resolved + fixed; PF-001 confirmed live during execution) · implements RD-01 Tier-2 ui/forms, verification RD-02; GH **#115** — the #122-unblocked dialog-body rebuilds: `messageBox`/`confirm`/`inputBox` + editor `findDialog`/`replaceDialog`/`confirmBox`/`replacePrompt`-inner + `formDialog` buttons → flex (`cover(col)` / centered `row`), deleting the local `at`/`tv`/`place`/`centerX`/`PAIR_WIDTH`/`buttonRects`. Oracle cost (per NFR-3): **message-box survives outright**; only `editor-dialogs.spec:51,89` + `form-dialog.impl:80` re-baselined; per-dialog traversal specs + a message-box render guard added (NFR-2, PF-002). **App-overlay `cover()` split out to a separate follow-up task** (user decision — a ~7-file overlay-locator ripple not in NFR-3, 2-line payoff), tracked as **T-AO1**. 14 tasks.

#115 is re-scoped (ui/forms dialog family, deliberate divergence) and **#120** is new (files dialogs +
grow-dialog deletion). #116 (datagrid) and #117 (setLayout) stay behavior-preserving — out of the
divergence set. First slice = Tier 0 parity-safe — **planned** in `tier0-parity-safe`: base `Dialog`
`center()`/`at()`, menu + dropdown catchers + `formDialog` body `cover()`, the enumerated demo/shell
canvases, and the CLAUDE.md carve-out. **Note (plan gate finding):** the app overlay (`application.ts`)
`cover()` is **deferred to #115** — its `position:'absolute'` descriptor is a spec-test locator, so
it is not zero-spec-oracle-cost like the rest of Tier 0.

## Legend

⬜ Backlog · 📋 Plan Created · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker (GitHub-issue-driven)

| GH | Title | Kind | Stage | Notes |
|----|-------|------|-------|-------|
| [#108](https://github.com/blendsdk/jsvision/issues/108) | Adopt the layout DSL across the codebase | Epic | ⬜ | Umbrella; re-oriented to flex-elimination |
| [#113](https://github.com/blendsdk/jsvision/issues/113) | DSL hardening (prerequisite) | Prereq | ✅ | Feature [`dsl-hardening`](../dsl-hardening/00-roadmap.md) — done, on `feat/dsl-adoptation` |
| [#117](https://github.com/blendsdk/jsvision/issues/117) | Primitive fix — `setLayout(partial)` (read-only field at release) | Primitive | ⬜ | Companion to #113; out of the divergence set |
| [#122](https://github.com/blendsdk/jsvision/issues/122) | **Focus-traversal primitive** — tree-order `Tab` across flex containers | Primitive | ✅ | Companion to #117; **prereq of #115 + #120**; plan [focus-traversal-primitive](plans/focus-traversal-primitive/00-index.md) · ✅ done (exec_plan 11/11, 2026-07-19; on `feat/dsl-adoptation`, pending merge) · 🔎 preflighted 2026-07-19 |
| [#109](https://github.com/blendsdk/jsvision/issues/109) | ui widgets — data-grid / tab-view / application | Port | ⬜ | behavior-preserving; split-view already done |
| [#110](https://github.com/blendsdk/jsvision/issues/110) | example app-shell demos + maximal canvas flex | Port | ⬜ | Tier 3 (RD-01 FR-6); learning material |
| [#111](https://github.com/blendsdk/jsvision/issues/111) | theme-designer panels + workspace | Port | ⬜ | independent; inspector-panel joins Tier 3 |
| [#112](https://github.com/blendsdk/jsvision/issues/112) | JSDoc `@example` + docs modernization | Docs | ⬜ | expands with Tier 3 |
| [#114](https://github.com/blendsdk/jsvision/issues/114) | local `place()`/`row()` shadow cleanup | Cleanup | ⬜ | largely subsumed by flex-elimination |
| [#115](https://github.com/blendsdk/jsvision/issues/115) | **flex-eliminate ui/forms dialog family** (deliberate divergence) | Rebuild | 🔄 | RD-01/02; Tier-0 done ([tier0-parity-safe](plans/tier0-parity-safe/00-index.md)); **Tier-2 bodies ✅ DONE 2026-07-19** ([flex-dialog-bodies](plans/flex-dialog-bodies/00-index.md), exec_plan 14/14 — ui messageBox family + editor dialogs + forms formDialog buttons) — #122 unblocked them. App-overlay `cover()` leftover split to task **T-AO1** below |
| [T-AO1](plans/tier0-parity-safe/00-index.md) | app-overlay `cover()` (`application.ts:335/435`) + overlay-locator re-baseline | Task | ⬜ | #115 Tier-0 leftover (was PA-1). ~7 app-shell test files locate the overlay via `position==='absolute'` → `'fill'`; deletes the 2-line resize re-anchor. Not in NFR-3 (needs a recorded extension). Split from `flex-dialog-bodies` per user decision |
| [#116](https://github.com/blendsdk/jsvision/issues/116) | datagrid widgets (button-row / grid-lifecycle / popups) | Port | ⬜ | behavior-preserving; out of divergence set |
| [#120](https://github.com/blendsdk/jsvision/issues/120) | **flex-eliminate FileDialog/ChDirDialog/errorBox + retire grow-dialog.ts** | Rebuild | ⬜ | RD-01/02; Tier 2; deletes 2 source files; **blocked on the focus-traversal primitive** (nested-flex Tab traversal) |

**Governed by RD-01/RD-02:** #115, #120, and the Tier-3 parts of #110/#112. **Keep-absolute (excluded, RD-01
FR-4):** window/desktop/gesture, cursor/caret/measure-anchored popups, `theme-designer/gallery.ts` scatter,
movable-window desktop apps, polar `analog-clock`, `keyboard-mouse-playground`. Full line-level map lives in
the sweep artifacts + the GitHub issue bodies.
