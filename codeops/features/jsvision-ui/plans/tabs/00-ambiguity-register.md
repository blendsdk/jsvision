# Ambiguity Register: Tabs (RD-17) — Plan Zero-Ambiguity Gate

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Plan**: `codeops/features/jsvision-ui/plans/tabs/`
> **Implements**: jsvision-ui/RD-17
> **Gate status**: ✅ **GATE PASSED** — every row Resolved; user confirmed 2026-07-03 11:53
> **CodeOps Skills Version**: 3.2.0

This register is the Phase 1C audit trail for the **plan**. RD-17 already resolved every
behavioral/scope decision through its own `make_requirements` gate + preflight
(`requirements/00-ambiguity-register.md`, entries **AR-172…AR-185**); those import here as
**pre-resolved context** (rule 3 — not re-litigated). Only the **new plan-time** decisions —
naming, file structure, and the technical choices RD-17 explicitly deferred "to plan time" —
needed the user's confirmation. They are the **PA-NN** rows below.

---

## Imported (pre-resolved) — RD-17 requirement decisions

These were decided at requirements time and are binding here without re-confirmation. See
`requirements/00-ambiguity-register.md` for the full text.

| AR | Decision (summary) |
|----|--------------------|
| AR-172 | RD-17 is a **documented new component** — GATE-1 whole-tree search proved TV has no tab/notebook/tabstrip class; the pieces are grounded in shipped TV-decoded facilities. |
| AR-173 | **Folder-tab** box-drawing style, **top** strip joined to the content frame; active brighter, inactive dimmed; bottom/side strips deferred. |
| AR-174 | **Self-contained** container — owns both the strip and the surrounding frame. |
| AR-175 | **Eager** child pages, one visible at a time; lazy factory deferred. *(Mechanism refined at plan preflight PF-001: a reactive `state.visible` binding, **not** `Show` — `Show` disposes the inactive page and loses its state; behavioral decision unchanged.)* |
| AR-176 | MVP includes disabled tabs, `~X~` hotkey accelerators, `◄`/`►` overflow scrolling, and closeable + dynamic add/remove (all four). |
| AR-177 | **`active: Signal<number>`** — clamped to the tab count; clamps to the neighbour on remove. |
| AR-178 | **`tabs: Signal<Tab[]>`** (caller-owned); built-in `×` handler removes the entry + fires `onClose(tab)`; `Tab = {title, content, disabled?, closeable?}`. |
| AR-179 / AR-183 | Navigation: **Ctrl+PageUp/PageDown** global cycle (reliable, decoder-produced) + **`←→`** on the focused strip + **Alt-hotkey** jump; **Ctrl+Tab/Ctrl+Shift+Tab** best-effort (keyboard-protocol-gated, unshipped DEF-2); plain **Tab/Shift+Tab** keep content-focus meaning. AC-4 feeds real decoder bytes. |
| AR-180 | Additive **`tab*` theme roles** (active/inactive/disabled), decoded through `cpAppColor`, pinned to exact bytes at **plan GATE-1**. |
| AR-181 | New `src/tabs/` subsystem, explicit named re-exports. |
| AR-182 | Kitchen-sink `Tabs` story + headless `demo:tabs`. |
| AR-184 | Chrome reuses the frame set's line/corner glyphs and **adds the tab-junction tees `┬ ┴ ├ ┤`** (frame set ships no tee, its glyph consts are module-private). |
| AR-185 | Kitchen-sink story id **`containers/tabs`**, category `Containers`. |

---

## New plan-time decisions (PA-NN)

> Category legend (12-cat scan): all rows fall under **Naming & terminology**, **Technical
> unknowns**, or **Scope boundaries**. All other categories reviewed → no new ambiguity (the
> requirement-level items are covered by the imported AR rows).

| # | Category | Ambiguity / question | Options considered | Resolution | Status |
|---|----------|----------------------|--------------------|------------|--------|
| **PA-1** | Scope boundaries | RD-17's three Should-Haves (`select()/next()/prev()`, snap-to-first-enabled active, `onChange`) — include in this plan or defer? | (A) Include all three; (B) methods + snap now, defer `onChange`; (C) defer all three | **(A) Include all three** — thin additions completing the public API in one pass (user, 2026-07-03) | ✅ Resolved |
| **PA-2** | Technical unknowns | Folder-tab glyph source — the frame set's `SINGLE_BORDER` const (`window/frame.ts:78-85`) is module-private and ships no tee (`┬┴├┤`). | (A) Local self-contained glyph set in `src/tabs/` (identical Unicode code points); (B) export `SINGLE_BORDER` from `frame.ts` + add tees locally | **(A) Local tab glyph set** — self-contained, no core/frame.ts edit; tabs need the tees + a different arrangement anyway, so reusing the frame object gains little; identical code points preserve fidelity (user, 2026-07-03) | ✅ Resolved |
| **PA-3** | Naming & terminology | The additive `tab*` theme-role set (bytes pinned at GATE-1). | (A) 3 roles `tabActive`/`tabInactive`/`tabDisabled`; (B) 4 roles + `tabStrip` background | **(A) 3 roles** — folder-tab labels abut with no strip gaps and the content border already draws in the frame role; no separate strip-background role needed (user, 2026-07-03) | ✅ Resolved |
| **PA-4** | Naming & terminology | The strip-renderer split filename (keeps `tab-view.ts` ≤500, mirrors `list-view.ts` + `list-rows.ts`). | (A) `tab-strip.ts`; (B) `tab-rows.ts` | **(A) `tab-strip.ts`** — the renderer draws a horizontal labelled strip, not a column of rows; reads truer while staying the clear renderer-split sibling (user, 2026-07-03) | ✅ Resolved |
| **PA-5** | Technical unknowns | The project verify command that fills every plan Verify line. | Detected from CLAUDE.md → `yarn verify` (= `turbo run typecheck build test`) | **`yarn verify`** — confirmed from project CLAUDE.md Commands section | ✅ Resolved |
| **PA-6** | Naming & terminology | Public API surface names for the new subsystem. | Derived from house convention (`ListView`/`Tree`/`DataGrid` idiom) | `TabView` (class), `Tab` (descriptor type), `TabViewOptions` (ctor opts), files `tab-view.ts`/`tab-strip.ts`/`index.ts` under `src/tabs/`; explicit named re-exports from `src/index.ts` | ✅ Resolved (source-determined, AR-181 convention) |
| **PA-7** | Technical unknowns | Demo + story wiring names. | Derived from AR-182/AR-185 + shipped demo pattern | `packages/examples/tabs-demo/main.ts` behind `demo:tabs`; `kitchen-sink/stories/tabs.story.ts` (id `containers/tabs`) + one line in `stories/index.ts` | ✅ Resolved (source-determined) |

---

## Gate confirmation

- Every row Status = ✅ Resolved.
- Zero items deferred (Should-Haves are **included**, not deferred — PA-1 A).
- The user confirmed PA-1…PA-5 explicitly (2026-07-03 11:53); PA-6/PA-7 are source-determined
  from the AR-181/AR-182 conventions and recorded for traceability.
- **Header: ✅ GATE PASSED** — plan documents may be written.
