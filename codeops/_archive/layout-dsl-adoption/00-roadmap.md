# Roadmap: Layout-DSL Adoption

> **Feature-Set**: Layout-DSL Adoption
> **Status**: Done
> **Created**: 2026-07-18
> **Last Updated**: 2026-07-21 (**epic complete — PR #133 merged to `develop` (`6bde898e`)**; the last plan `layout-field-lockdown` closed 55/55. GH #108/#112/#117/#129/#132 all closed on GitHub 2026-07-21 — they needed a manual close because PRs merge into `develop` while the repo's default branch is `master`, so `Closes #N` never fires. #131 remains open as the uncoupled non-gating lane)
> **Progress**: 12 / 12 issues done · 9 / 9 plans done — shipped via **PR #133** (merged to `develop` 2026-07-21). Requirements RD-01/RD-02 ✏️ drafted. Plans: [tier0-parity-safe](plans/tier0-parity-safe/00-index.md) ✅ 12/12 · [focus-traversal-primitive](plans/focus-traversal-primitive/00-index.md) ✅ 11/11 (#122) · [flex-dialog-bodies](plans/flex-dialog-bodies/00-index.md) ✅ 14/14 (#115) · [files-flex-elimination](plans/files-flex-elimination/00-index.md) ✅ 27/27 (#120, PR #125) · [widget-flex-adoption](plans/widget-flex-adoption/00-index.md) ✅ 35/35 (#109 + #116) · [canvas-flex-adoption](plans/canvas-flex-adoption/00-index.md) ✅ 32/32 (#110 + #111, PR #127) · [docs-example-modernization](plans/docs-example-modernization/00-index.md) ✅ 41/41 (#112) · [demo-app-flex-port](plans/demo-app-flex-port/00-index.md) ✅ 20/20 (#114, PR #130) · [layout-field-lockdown](plans/layout-field-lockdown/00-index.md) ✅ 55/55 (#132 → #117-P4 → #129). Per-issue outcomes are in the tracker below; the prior narrative summary is in git history
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
- **[Plan: focus-traversal-primitive](plans/focus-traversal-primitive/00-index.md)** — ✅ Done (exec_plan 11/11, 2026-07-19; GH **#122**; merged to `feat/dsl-adoptation`; ships to `develop` via PR #123) · 🔎 Preflighted 2026-07-19 ([report](plans/focus-traversal-primitive/00-preflight-report.md) — 7 findings, all resolved + fixed) (Primitive; enables RD-01 FR-2/FR-3) — a Tier-2 blocker surfaced during planning: `col`/`row` nest `Group`s but Tab traversal was group-scoped (emergent behavior of `advance()`, not spec-locked), and an empirical probe showed `FileDialog`/`ChDirDialog` Tab **already dead-ended in the list** today. Fix = scope-ceilinged tree-order `advance()` (with a `descendLast` reverse mirror + exited-group memory reset) so nested-flex dialogs become keyboard-traversable. Shipped: ST-F1…F7 spec oracles, all focus witnesses unedited, verify + bench green. **Prerequisite of #115 + #120.**
- **[Plan: flex-dialog-bodies](plans/flex-dialog-bodies/00-index.md)** — ✅ Done (exec_plan 14/14, 2026-07-19; merged to `feat/dsl-adoptation`; ships to `develop` via PR #123) · 🔎 Preflighted 2026-07-19 ([report](plans/flex-dialog-bodies/00-preflight-report.md) — 6 findings all resolved + fixed; PF-001 confirmed live during execution) · implements RD-01 Tier-2 ui/forms, verification RD-02; GH **#115** — the #122-unblocked dialog-body rebuilds: `messageBox`/`confirm`/`inputBox` + editor `findDialog`/`replaceDialog`/`confirmBox`/`replacePrompt`-inner + `formDialog` buttons → flex (`cover(col)` / centered `row`), deleting the local `at`/`tv`/`place`/`centerX`/`PAIR_WIDTH`/`buttonRects`. Oracle cost (per NFR-3): **message-box survives outright**; only `editor-dialogs.spec:51,89` + `form-dialog.impl:80` re-baselined; per-dialog traversal specs + a message-box render guard added (NFR-2, PF-002). **App-overlay `cover()` split out to a separate follow-up task** (user decision — a ~7-file overlay-locator ripple not in NFR-3, 2-line payoff), tracked as **T-AO1** — since **closed won't-do** (2026-07-19): the attempt proved the overlay is a hidden host whose geometry cannot come from the layout pass, now recorded as RD-01 FR-4's hidden-host exclusion. Splitting it out was the right call — it kept a 14/14 green plan clean of a dead end. 14 tasks.

#115 is re-scoped (ui/forms dialog family, deliberate divergence) and **#120** is new (files dialogs +
grow-dialog deletion). #116 (datagrid) and #117 (setLayout) stay behavior-preserving — out of the
divergence set. First slice = Tier 0 parity-safe — **planned** in `tier0-parity-safe`: base `Dialog`
`center()`/`at()`, menu + dropdown catchers + `formDialog` body `cover()`, the enumerated demo/shell
canvases, and the CLAUDE.md carve-out. **Note (plan gate finding):** the app overlay (`application.ts`)
`cover()` is **deferred to #115** — its `position:'absolute'` descriptor is a spec-test locator, so
it is not zero-spec-oracle-cost like the rest of Tier 0.

## Legend

⬜ Backlog · 📋 Plan Created · 🔎 RD Preflighted · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred · ❌ Won't do

## Tracker (GitHub-issue-driven)

| GH | Title | Kind | Stage | Notes |
|----|-------|------|-------|-------|
| [#108](https://github.com/blendsdk/jsvision/issues/108) | Adopt the layout DSL across the codebase | Epic | ✅ | ✅ **Done 2026-07-21** — umbrella, re-oriented to flex-elimination · all 12 tracked issues done across 9 plans, shipped via **PR #133** (`feat/dsl-adoptation` → `develop`, `6bde898e`) |
| [#113](https://github.com/blendsdk/jsvision/issues/113) | DSL hardening (prerequisite) | Prereq | ✅ | Feature [`dsl-hardening`](../dsl-hardening/00-roadmap.md) — done, merged to `develop` via PR #119 |
| [#117](https://github.com/blendsdk/jsvision/issues/117) | Primitive fix — `setLayout(partial)` (read-only field at release) | Primitive | ✅ | ✅ **Done 2026-07-21** via [layout-field-lockdown](plans/layout-field-lockdown/00-index.md) — `View.layout` is now `readonly` + `Readonly<LayoutProps>`, written only by `setLayout` |
| [#132](https://github.com/blendsdk/jsvision/issues/132) | examples `tsconfig` include covers 107 of 255 files | Prereq | ✅ | ✅ **Done 2026-07-20** — Phase 1 of [layout-field-lockdown](plans/layout-field-lockdown/00-index.md): `packages/examples` typechecks all 255 files (153 were invisible), every package its own `test/` |
| [#129](https://github.com/blendsdk/jsvision/issues/129) | Tier-3 canvas maximal + the residual `at()`/`row()` name shadows | Port | ✅ | ✅ **Done 2026-07-21** — Phase 3 of [layout-field-lockdown](plans/layout-field-lockdown/00-index.md): 14 Tier-3 canvas sites converted, 4 left absolute, all `at()`/`row()` shadows retired |
| [#122](https://github.com/blendsdk/jsvision/issues/122) | **Focus-traversal primitive** — tree-order `Tab` across flex containers | Primitive | ✅ | ✅ **Done 2026-07-19** — prereq of #115 + #120 · tree-order `Tab` across flex containers, via [focus-traversal-primitive](plans/focus-traversal-primitive/00-index.md), in PR #123 |
| [#109](https://github.com/blendsdk/jsvision/issues/109) | ui widgets — data-grid / tab-view / application | Port | ✅ | ✅ **Done 2026-07-19** — behavior-preserving · 12 conversions in 3 files via [widget-flex-adoption](plans/widget-flex-adoption/00-index.md), `datagrid.spec`'s 22 golden cases green and unedited |
| [#110](https://github.com/blendsdk/jsvision/issues/110) | example app-shell demos + maximal canvas flex | Port | ✅ | ✅ **Done 2026-07-20** via [canvas-flex-adoption](plans/canvas-flex-adoption/00-index.md) — 25 conversions, frames cell-identical · `view-demo` + `layout.story` ❌ won't-do by policy · remainder → #129 |
| [#111](https://github.com/blendsdk/jsvision/issues/111) | theme-designer panels + workspace | Port | ✅ | ✅ **Done 2026-07-20** — theme-designer panels + workspace via [canvas-flex-adoption](plans/canvas-flex-adoption/00-index.md) (PR #127), 7 conversions in 3 files, same governance as #110 |
| [#112](https://github.com/blendsdk/jsvision/issues/112) | JSDoc `@example` + docs modernization | Docs | ✅ | ✅ **Done 2026-07-20** via [docs-example-modernization](plans/docs-example-modernization/00-index.md) — a permanent `@example` compile guard (161 blocks grandfathered → #131) plus the full `at()` sweep |
| [#114](https://github.com/blendsdk/jsvision/issues/114) | local `place()`/`row()` shadow cleanup | Cleanup | ✅ | ✅ **Done 2026-07-20** via [demo-app-flex-port](plans/demo-app-flex-port/00-index.md) — the two exported shadow `at()` helpers retired by re-export, covering 411 call sites across 84 files |
| [#115](https://github.com/blendsdk/jsvision/issues/115) | **flex-eliminate ui/forms dialog family** (deliberate divergence) | Rebuild | ✅ | ✅ **Done 2026-07-19** — ui/forms dialog family flex-eliminated via [flex-dialog-bodies](plans/flex-dialog-bodies/00-index.md) · leftover T-AO1 closed won't-do |
| T-AO1 | app-overlay `cover()` (`application.ts:335/435`) | Task | ❌ | ❌ **Won't do — attempted 2026-07-19, reverted, do not re-attempt.** A hidden (`visible:false`) host gets no solved bounds from the layout pass — recorded as RD-01's hidden-host exclusion |
| [#116](https://github.com/blendsdk/jsvision/issues/116) | datagrid widgets (button-row / grid-lifecycle / popups) | Port | ✅ | ✅ **Done 2026-07-19** — behavior-preserving datagrid ports via [widget-flex-adoption](plans/widget-flex-adoption/00-index.md), 35 conversions in 6 modules, both full-screen goldens zero-diff |
| [#120](https://github.com/blendsdk/jsvision/issues/120) | **flex-eliminate FileDialog/ChDirDialog/errorBox + retire grow-dialog.ts** | Rebuild | ✅ | ✅ **Done 2026-07-19** — FileDialog/ChDirDialog/errorBox rebuilt on flex via [files-flex-elimination](plans/files-flex-elimination/00-index.md), retiring `grow.ts` + `grow-dialog.ts` (−208 lines) |

## Non-gating follow-on lane

Tracked here for visibility only — this row did **not** gate the epic (recorded decision), so it is
deliberately not an `## Open follow-ons` entry and does not hold the feature's ✅ status.

| GH | Title | Kind | Stage | Notes |
|----|-------|------|-------|-------|
| [#131](https://github.com/blendsdk/jsvision/issues/131) | Drain the `@example` compile-guard allowlist | Docs | ⬜ | Born from #112's `@example` compile guard — `packages/docs-site/test/jsdoc-examples.allowlist.json` still carries ~161 grandfathered blocks, drainable incrementally under a shrink-only ratchet |

**Governed by RD-01/RD-02:** #115, #120, and the Tier-3 parts of #110/#112. **Keep-absolute (excluded, RD-01
FR-4):** window/desktop/gesture, cursor/caret/measure-anchored popups, `theme-designer/gallery.ts` scatter,
movable-window desktop apps, polar `analog-clock`, `keyboard-mouse-playground`. Full line-level map lives in
the sweep artifacts + the GitHub issue bodies.
