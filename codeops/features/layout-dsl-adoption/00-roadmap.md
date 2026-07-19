# Roadmap: Layout-DSL Adoption

> **Feature-Set**: Layout-DSL Adoption
> **Status**: In Progress
> **Created**: 2026-07-18
> **Last Updated**: 2026-07-18
> **Progress**: 0 / 9 issues done
> **CodeOps Skills Version**: 3.9.0

Adopt the layout DSL (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`/`place` + the #113 additions) across
the existing `.layout = {…}` call sites — the deferred **AR-4 follow-up** of the archived `layout-dsl`
plan. A full sweep classified **every** `.layout =` site across all 8 packages (313 sites / 127 files,
plus a separate 26-site `.layout.rect =` window family); the genuinely-portable work (~17 files) is
tracked as GitHub issues. **GitHub-issue-driven** (no per-target codeops plans) — this roadmap is the
codeops-side register pointing at the epic. The `dsl-hardening` prerequisite (GH #113) is its own
feature with a codeops plan.

## Legend

⬜ Backlog · 📋 Plan Created · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker (GitHub-issue-driven)

| GH | Title | Kind | Stage | Notes |
|----|-------|------|-------|-------|
| [#108](https://github.com/blendsdk/jsvision/issues/108) | Adopt the layout DSL across the codebase | Epic | ⬜ | Umbrella for the rows below |
| [#113](https://github.com/blendsdk/jsvision/issues/113) | DSL hardening (prerequisite — do first) | Prereq | 📋 | Feature [`dsl-hardening`](../dsl-hardening/00-roadmap.md) — plan on `feat/dsl-hardening` |
| [#117](https://github.com/blendsdk/jsvision/issues/117) | Primitive fix — `setLayout(partial)` (read-only field at release) | Primitive | ⬜ | Companion to #113 |
| [#109](https://github.com/blendsdk/jsvision/issues/109) | ui widgets — data-grid / tab-view / application | Port | ⬜ | `application.ts` part needs #113 |
| [#110](https://github.com/blendsdk/jsvision/issues/110) | example app-shell demos | Port | ⬜ | learning material |
| [#111](https://github.com/blendsdk/jsvision/issues/111) | theme-designer panels + workspace | Port | ⬜ | independent |
| [#112](https://github.com/blendsdk/jsvision/issues/112) | JSDoc `@example` + docs modernization | Docs | ⬜ | expands if #113 `at()` lands |
| [#114](https://github.com/blendsdk/jsvision/issues/114) | local `place()`/`row()` shadow cleanup | Cleanup | ⬜ | enabled by #113 `at()` |
| [#115](https://github.com/blendsdk/jsvision/issues/115) | TV-faithful dialogs (case-by-case) | Review | ⬜ | depends on #113 |
| [#116](https://github.com/blendsdk/jsvision/issues/116) | datagrid widgets (button-row / grid-lifecycle / popups) | Port | ⬜ | 51 sites; real ports |

**Not portable (surveyed, excluded):** TV absolute dialogs (files/forms), `this.layout` self-config,
per-frame `.layout.rect =` window/desktop/gesture mutations (26), spike-data-studio (inert). Full
line-level map lives in the sweep artifacts + the GitHub issue bodies.
