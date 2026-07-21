# Portfolio Roadmap: Ink

> **Status**: Active
> **Last Updated**: 2026-07-21
> **Features**: 2 / 4 done — the engine counts only the four rows with machine-countable RD progress; `split-panes`, `dsl-hardening` and `layout-dsl-adoption` carry hand-maintained Progress cells and are excluded, so in truth **5 of the 7 tracked features are complete**. Per-feature status is in the table below; deferred datagrid follow-ons (CSV/paste import · windowed-source row export · treeshake check) live on its own roadmap
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| bun-runtime | [→](features/bun-runtime/00-roadmap.md) | RD-01 ✏️ drafted (Bun runtime support & self-contained executables) | 0/1 RDs | ⬜ | 2026-07-03 |
| docs-website | [→](features/docs-website/00-roadmap.md) | RD-01/02/03/06 ✅ Done (site-foundation · @jsvision/web runtime · live-example system · TypeDoc API ref) · RD-04/05/07…10 ✏️ drafted | 4/10 RDs | ⬜ | 2026-07-13 |
| datagrid | [→](features/datagrid/00-roadmap.md) | 16/16 RDs ✅ — editing · cell editors · sorting · filtering · columns · rows · footer + master-detail · navigation · validation · virtual scroll · export/variants · personalization · 55-demo showcase | 16/16 RDs | ✅ | 2026-07-18 |
| split-panes | [→](features/split-panes/plans/split-panes/00-index.md) | ✅ Done — `SplitView`: fr-track container, captured-drag + keyboard resize, `minSize` clamp, nesting · follow-ups: grab-mark toggle · scroll-in-pane demo · amiga-clock window · hover deferred → GH #97 | 45/45 tasks · 4/4 phases · +followups ✅ | ✅ | 2026-07-17 |
| jsvision-forms | [→](features/jsvision-forms/00-roadmap.md) | 9/9 RDs ✅ — store · sync Zod validation · widget binding · async validation · async loading · `formDialog` + modal submit gate · `Text.severity` + `Input.placeholder` · comprehensive showcase | 9/9 RDs done | ✅ | 2026-07-17 |
| dsl-hardening | [→](features/dsl-hardening/00-roadmap.md) | ✅ Done — layout-DSL hardening (`min` · `at()` · `cover()`/`center()` · `Placement` offsets · `dsl/` module split), merged via PR #119 — the prerequisite of epic GH #108 | 1/1 plans | ✅ | 2026-07-19 |
| layout-dsl-adoption | [→](features/layout-dsl-adoption/00-roadmap.md) | ✅ Done 2026-07-21 — epic GH #108 closed: 12 issues / 9 plans via PR #133 · `View.layout` read-only with `setLayout` its only writer · TV dialogs + canvases on flex · non-gating follow-on #131 | 12 / 12 issues · 9 / 9 plans | ✅ | 2026-07-21 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| jsvision-ui | [→](_archive/jsvision-ui/00-roadmap.md) | 22/22 RDs | 2026-07-08 |
| theme-designer | [→](_archive/theme-designer/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-ui-enhancements | [→](_archive/jsvision-ui-enhancements/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-plugin | [→](_archive/jsvision-plugin/00-roadmap.md) | 2/2 RDs | 2026-07-11 |
