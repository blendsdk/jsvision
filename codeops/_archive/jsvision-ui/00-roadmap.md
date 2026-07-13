# Roadmap: jsvision UI

> **Feature-Set**: jsvision UI
> **Status**: Archived
> **Created**: 2026-06-29
> **Last Updated**: 2026-07-13
> **Progress**: 22 / 22 (100%)
> **CodeOps Skills Version**: 2.0.0

The `@jsvision/ui` layer — a reimagined Turbo Vision widget framework on
`@jsvision/core`, using the **disciplined hybrid** model (retained widget tree +
fine-grained signals + `Show`/`For`). Scope and triage: the component map at
[`tui-ui/01-component-map.md`](tui-ui/01-component-map.md). This roadmap is the
successor to the completed foundation feature-set (RD-01…RD-10), which is finished
and archived at [`_archive/foundation/`](_archive/foundation/00-roadmap.md).

RD numbering restarts for this feature-set; these RDs are **not** the archived
foundation RDs of the same number.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Reactive core — `signal`/`computed`/`effect` + `Show`/`For` | [RD-01](requirements/RD-01-reactive-core.md) | [reactive-core](plans/reactive-core/00-index.md) | Done | ✅ | 2026-06-29 | Shipped — fine-grained signals in `src/reactive/`. |
| RD-02 | Layout engine — cell-native flex `row`/`col` | [RD-02](requirements/RD-02-layout-engine.md) | [layout-engine](plans/layout-engine/00-index.md) | Done | ✅ | 2026-06-29 | Shipped — integer flex `layout()` in `src/layout/`. |
| RD-03 | View/Group spine + `DrawContext` + theming | [RD-03](requirements/RD-03-view-group-spine.md) | [view-group-spine](plans/view-group-spine/00-index.md) | Done | ✅ | 2026-06-29 | Shipped — retained View/Group tree + clipped DrawContext + reflow; `src/view/`. |
| RD-04 | Event loop + focus + modality + commands | [RD-04](requirements/RD-04-event-loop.md) | [event-loop](plans/event-loop/00-index.md) | Done | ✅ | 2026-06-30 | Shipped — host-agnostic EventLoop: 3-phase dispatch, focus, hit-test, commands. |
| RD-05 | App shell — Application/Desktop/Window/Frame/MenuBar/StatusLine | [RD-05](requirements/RD-05-app-shell.md) | [app-shell](plans/app-shell/00-index.md) | Done | ✅ | 2026-06-30 | Shipped — `Application`/`run()` over a live TTY: Desktop WM, Window, MenuBar, StatusLine. |
| RD-06 | Essential controls + validators | [RD-06](requirements/RD-06-essential-controls.md) | [essential-controls](plans/essential-controls/00-index.md) | Done | ✅ | 2026-07-01 | Shipped — Text/Label/Button/Input/CheckGroup/RadioGroup + filter/range/lookup validators. |
| RD-11 | Containers, scrolling & lists | [RD-11](requirements/RD-11-containers-scrolling-lists.md) | [containers-scrolling-lists](plans/containers-scrolling-lists/00-index.md) | Done | ✅ | 2026-07-01 | Shipped — ScrollBar·Scroller·ListView/ListBox·Dialog; `src/{scroll,list,dialog}/`. |
| RD-07 | Essential-control completions | [RD-07](requirements/RD-07-essential-control-completions.md) | [essential-control-completions](plans/essential-control-completions/00-index.md) | Done | ✅ | 2026-07-02 | Shipped — Input selection + caret + clipboard + `picture(mask)` validator. |
| RD-13 | Runtime hardening & defect remediation | [RD-13](requirements/RD-13-runtime-hardening.md) | [runtime-hardening](plans/runtime-hardening/00-index.md) | Done | ✅ | 2026-07-02 | Shipped — five-agent audit backlog remediated (3 critical + 12 major + ~25 minor). |
| RD-08 | Editor family | [RD-08](requirements/RD-08-editor-family.md) | [editor-family](plans/editor-family/00-index.md) | Done | ✅ | 2026-07-07 | Shipped — Editor/Memo/EditWindow + editor dialogs (TEditor port); `src/editor/`. |
| RD-09 | Files package `@jsvision/files` | [RD-09](requirements/RD-09-files-package.md) | [files-package](plans/files-package/00-index.md) | Done | ✅ | 2026-07-06 | Shipped — `@jsvision/files`: FileDialog/ChDirDialog + panes + openFile/errorBox. |
| RD-14 | Input dropdowns — History · ComboBox | [RD-14](requirements/RD-14-input-dropdowns.md) | [input-dropdowns](plans/input-dropdowns/00-index.md) | Done | ✅ | 2026-07-02 | Shipped — History + ComboBox over the shared `openAnchoredPopup`; `src/dropdown/`. |
| RD-15 | Tree — expandable outline | [RD-15](requirements/RD-15-tree.md) | [tree](plans/tree/00-index.md) | Done | ✅ | 2026-07-03 | Shipped — collapsible outline with box-drawing graphics + marker styles; `src/tree/`. |
| RD-16 | Table / DataGrid — multi-column grid | [RD-16](requirements/RD-16-table.md) | [table](plans/table/00-index.md) | Done | ✅ | 2026-07-03 | Shipped — `DataGrid<T>` (pure width/sort math + virtual body + sticky header); `src/table/`. |
| RD-17 | Tabs — tabbed layout container | [RD-17](requirements/RD-17-tabs.md) | [plan](plans/tabs/00-index.md) | Done | ✅ | 2026-07-03 | Shipped — TabView folder-tab container (new component, TV has none) · `src/tabs/`. |
| RD-18 | Feedback — ProgressBar + Spinner | [RD-18](requirements/RD-18-feedback.md) | [plan](plans/feedback/00-index.md) | Done | ✅ | 2026-07-03 | Shipped — ProgressBar (smooth sub-cell fill) + Spinner + runSpinner; `src/feedback/`. |
| RD-19 | Surface / SurfaceView | [RD-19](requirements/RD-19-surface.md) | [surface-family](plans/surface-family/00-index.md) | Done | ✅ | 2026-07-05 | Shipped — offscreen Surface buffer + passive SurfaceView delta-viewport; `src/surface/`. |
| RD-20 | Date family — Calendar + DatePicker | [RD-20](requirements/RD-20-date-family.md) | [date-family](plans/date-family/00-index.md) | Done | ✅ | 2026-07-04 | Shipped — Calendar + DatePicker + CalendarDate value; `src/date/`. |
| RD-21 | Color family — ColorSwatch + ColorPicker | [RD-21](requirements/RD-21-color-family.md) | [color-family](plans/color-family/00-index.md) | Done | ✅ | 2026-07-05 | Shipped — ColorSwatch + ColorPicker over the anchored popup; `src/color/`. |
| RD-10 | TV behavioral fidelity — status press/release · cascade · tile · left-grow resize | [RD-10](requirements/RD-10-tv-behavioral-fidelity.md) | [tv-behavioral-fidelity](plans/tv-behavioral-fidelity/00-index.md) | Done | ✅ | 2026-06-30 | Shipped — status press/emit-on-release, cascade/tile geometry, left-grow resize. |
| RD-22 | Theming — Fluent-inspired color theme system | [RD-22](requirements/RD-22-theming.md) | [theming](plans/theming/00-index.md) | Done | ✅ | 2026-07-08 | Shipped — tiered theme system (OKLab ramp + WCAG contrast + createTheme + 13 presets). |
| DEF-23 | Glyph auto-swap fallback — probe-driven ASCII-safe chrome | [DEF-23](requirements/DEFERRED.md) | [glyph-auto-swap](plans/glyph-auto-swap/00-index.md) | Done | ✅ | 2026-07-02 | Shipped — probe-driven glyph auto-swap ASCII-safe chrome (sibling DEF-24 deferred). |
