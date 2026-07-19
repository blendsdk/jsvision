# Roadmap: Layout-DSL Adoption

> **Feature-Set**: Layout-DSL Adoption
> **Status**: In Progress
> **Created**: 2026-07-18
> **Last Updated**: 2026-07-19
> **Progress**: 0 / 10 issues done · requirements: RD-01/RD-02 ✏️ drafted · plan: [tier0-parity-safe](plans/tier0-parity-safe/00-index.md) 🔄 executing (Tier-0 MVP — Phase 1 base Dialog ✅)
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
- **[Plan: tier0-parity-safe](plans/tier0-parity-safe/00-index.md)** — 🔄 Executing (implements RD-01 Tier-0; verification RD-02)

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
| [#109](https://github.com/blendsdk/jsvision/issues/109) | ui widgets — data-grid / tab-view / application | Port | ⬜ | behavior-preserving; split-view already done |
| [#110](https://github.com/blendsdk/jsvision/issues/110) | example app-shell demos + maximal canvas flex | Port | ⬜ | Tier 3 (RD-01 FR-6); learning material |
| [#111](https://github.com/blendsdk/jsvision/issues/111) | theme-designer panels + workspace | Port | ⬜ | independent; inspector-panel joins Tier 3 |
| [#112](https://github.com/blendsdk/jsvision/issues/112) | JSDoc `@example` + docs modernization | Docs | ⬜ | expands with Tier 3 |
| [#114](https://github.com/blendsdk/jsvision/issues/114) | local `place()`/`row()` shadow cleanup | Cleanup | ⬜ | largely subsumed by flex-elimination |
| [#115](https://github.com/blendsdk/jsvision/issues/115) | **flex-eliminate ui/forms dialog family** (deliberate divergence) | Rebuild | 📋 | RD-01/02; Tier-0 parts planned ([tier0-parity-safe](plans/tier0-parity-safe/00-index.md)); app-overlay `cover()` + Tier-2 bodies still here |
| [#116](https://github.com/blendsdk/jsvision/issues/116) | datagrid widgets (button-row / grid-lifecycle / popups) | Port | ⬜ | behavior-preserving; out of divergence set |
| [#120](https://github.com/blendsdk/jsvision/issues/120) | **flex-eliminate FileDialog/ChDirDialog/errorBox + retire grow-dialog.ts** | Rebuild | ⬜ | RD-01/02; Tier 2; deletes 2 source files |

**Governed by RD-01/RD-02:** #115, #120, and the Tier-3 parts of #110/#112. **Keep-absolute (excluded, RD-01
FR-4):** window/desktop/gesture, cursor/caret/measure-anchored popups, `theme-designer/gallery.ts` scatter,
movable-window desktop apps, polar `analog-clock`, `keyboard-mouse-playground`. Full line-level map lives in
the sweep artifacts + the GitHub issue bodies.
