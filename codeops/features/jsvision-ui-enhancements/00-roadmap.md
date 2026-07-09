# Roadmap: jsvision-ui Enhancements

> **Feature-Set**: jsvision-ui Enhancements
> **Status**: Executing
> **Created**: 2026-07-09
> **Last Updated**: 2026-07-09
> **Progress**: 0 / 1 (0%)
> **CodeOps Skills Version**: 3.3.2

A rolling home for small, GitHub-issue-driven enhancements to `@jsvision/ui` that are issue-sized
rather than RD-sized. Each batch is a lightweight plan; the GitHub issues are the requirements
source. All work here is **additive-only** to the shipped packages.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | Source | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|--------|------|-------|--------|--------------|-----------------|
| B-01 | UI small batch — Tree markers · duplicate-accelerator warning · Switch | GH #17 · #6 · #11 | [ui-small-batch](plans/ui-small-batch/00-index.md) | Executing | 🔄 | 2026-07-09 | Batch of three S/M enhancements. #17 opt-in `markerStyle` (`tv`/`brackets`/`triangle`, default `tv`). #6 duplicate-accelerator dev-warn across **all tilde scopes** (submenus + menu-bar titles + Dialog focus scope + TabView strip-only; StatusLine chord-collision deferred) via an additive `View.accelerators()` seam + a pure `findDuplicateAccelerators()`. #11 `Switch` over `View` (Slider idiom), no new core role. Additive-only. Preflight PASSED (6 findings resolved, AR-21…AR-24). Next: `exec_plan ui-small-batch`. |

## Notes

- 2026-07-09: **B-01 → EXECUTING** 🔄 (`exec_plan`). Phase 1 (Tree `markerStyle`, GH #17) complete —
  8/27 tasks. `MarkerStyle` (`'tv'`/`'brackets'`/`'triangle'`) added to `TreeOptions`, style-aware
  `createGraph`/`graphWidth`, caps-driven `triangle`→`brackets` fallback with a cached effective style
  driving the mouse hit-zone; new `tree-markers.{spec,impl}` (ST-1…ST-8 + edges), kitchen-sink tree
  story switched to `brackets`. `'tv'` path byte-unchanged. Full `yarn verify` green.
- 2026-07-09: **B-01 → PLAN PREFLIGHTED** 🔬 (`preflight`, fresh session). PASSED — 0 critical/major,
  6 findings (4 minor + 2 observation), all resolved by the user's "apply all" decision. Corrections:
  tree markers move to a new `tree-markers.spec` (no ST-ID collision); bar-title accelerator check lives
  in `menu/menubar.ts` (not `builders.ts`); tab-accelerator scope = strip tabs only (data-level over
  `tabs()`, no page descent); `yarn verify` already runs lint + check:docs. Recorded as AR-21…AR-24 +
  `00-preflight-report.md`.
- 2026-07-09: **B-01 → PLAN CREATED** 📋 (`make_plan`). Recon-grounded against the real code
  (`tree/graph.ts`, `menu/builders.ts`, `controls/cluster.ts`, `reactive/warnings.ts`). Four pivotal
  decisions taken by the user: one batch plan under a new feature · #17 build all three marker styles
  (default stays TV-faithful) · #6 **all** tilde-accelerator scopes (broader than the issue's
  menus-only recommendation) with StatusLine's chord mechanism deferred · #11 `Switch` extends `View`
  like `Slider`. Verify command confirmed `yarn verify` (+ a final `yarn lint` reminder).
