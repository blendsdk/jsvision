# Requirements: Tree

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-15](../../requirements/RD-15-tree.md)

## Scope

Implement `Tree<T>` — a focusable, virtual-scrolling expandable outline — as a new
`packages/ui/src/tree/` subsystem, faithful to Turbo Vision `TOutlineViewer`/`TOutline` in
drawing/geometry/colour and modernized in data model + behaviour, plus the four additive core
`cpOutlineViewer` theme roles, a kitchen-sink story, and a headless `demo:tree`.

### In Scope

- **`Tree<T>`** — a `Group` `[rows fr | vertical-bar 1]` (mirrors `ListView`): flattens the visible
  (expanded) nodes of a **forest** of roots (PA-2) into an ordered row list, virtual-scrolls it, and
  owns a vertical `ScrollBar`. *(AR-141/AR-145, PA-2/PA-5)*
- **`TreeRows<T>`** — the Tree-specific row renderer `View` (sibling of `ListRows`): draws each
  visible row = faithful graph prefix + node text (two-tone for collapsed), handles keyboard/mouse/
  wheel, virtual-window draw. *(AR-145/AR-146)*
- **`TreeNode<T>`** — plain reactive node model `{ value: T, children: TreeNode<T>[] }`; expand state
  owned by the view (an object-reference `Set` in a Signal, PA-4); rendered via `getText`. *(AR-141)*
- **`graph.ts`** — the faithful `createGraph` line-prefix builder (`│├└─` + `+`/`─`, `levelWidth=3`/
  `endWidth=3`, no brackets) + the flatten-visible helper (depth-guarded). *(AR-146)*
- **Navigation** — ↑↓ ±1, PgUp/PgDn ±viewport, Home/End, Ctrl+PgUp/Dn to ends; `+`/`-`/`*` expand/
  collapse/expand-subtree (faithful); **← collapse (or to parent)** / **→ expand (or to first
  child)** (modern override, PA-12). *(AR-142)*
- **Mouse** — click sets focus; a click in the graph-prefix width toggles expand; a click on the
  node text (or Enter) selects + emits the command (PA-14, no double-click in the model). *(AR-142/AR-147)*
- **Selection** — single-select: two-way `focused`/`selected: Signal<number>` + `onSelect?`/
  `command?` seam; Enter/text-click emits (TV `cmOutlineItemSelected`). *(AR-144/AR-147, PA-13)*
- **Should-Haves (both in MVP, PA-6)** — `guides?: boolean` (default on) connector toggle;
  `expandAll()`/`collapseAll()` instance methods.
- **Theme** — 4 additive core roles `outlineNormal`/`outlineFocused`/`outlineSelected`/
  `outlineNotExpanded`, decoded through the `getColor` chain, pinned at GATE-1. *(AR-149, PA-8/PA-9)*
- **Demo vehicle** — a kitchen-sink `Tree` story (smoke-tested) + a headless `demo:tree`
  walkthrough (ASCII frame per step: expand → navigate → collapse → select). *(AR-150)*

### Out of Scope (deferred — tracked in the register)

- **Horizontal scroll** (owned HScrollBar + `delta.x`) — PA-5; wide rows clip.
- **Lazy-load-on-expand**, **checkbox/multi-select**, **abstract `TreeModel`** — RD-15 AR-143/144/141.
- **`getKey(node)`** expand-Set escape hatch — PA-4.
- Node editing (rename/drag-reorder) — TV's outline is read-only navigation.
- The other RD-12+ siblings (`Table`/`Tabs`/`ProgressBar`/`Surface`/`History`/`ComboBox`).

## Functional Requirements (from RD-15 Acceptance Criteria)

The plan realizes RD-15 **AC-1…AC-13** verbatim (the immutable oracles), with the register's
fidelity/input-model corrections applied:

- **AC-6 corrected by PA-14** — "double-click selects" → graph-zone click toggles expand; text-click
  or Enter selects (no double-click in the jsvision input model; the directive governs drawing, not
  this gap — same adaptation as RD-14 PA-16).

All other ACs stand as written. See [07-testing-strategy.md](07-testing-strategy.md) for the ST-*
mapping.

## Non-Functional Requirements

- **Fidelity (NON-NEGOTIABLE)** — glyphs, indent/end widths, two-tone colours, and every resolved
  `getColor` byte match `toutline.cpp`/`outline.h`; GATE-1 BEFORE decode + GATE-2 AFTER diff for the
  renderer + theme.
- **Zero runtime deps** — pure TS, ESM/NodeNext (`.js` specifiers); `yarn check:deps` holds.
- **File size** — every `tree/` file ≤ 500 lines (PA-7 split).
- **Additive/non-breaking** — the only cross-package edit is the 4 additive core theme roles; no
  existing role or UI code changes (menu/list/dialog untouched).
- **Security** — node text sanitized to the screen (RD-03 `DrawContext` → `sanitize`); flattened-row
  access bounds-checked (RD-11 `clampIndex`); eager flatten depth-guarded by the caller tree.

## Dependencies

- **RD-11** (done) — `list/virtual.ts` (`clampIndex`/`keepVisible`), `scroll/scroll-bar.ts`
  (`ScrollBar` + `setRange` + capture seam), the `ListView` `[rows fr | bar 1]` owned-bar pattern.
- **RD-03/04/02/01** (done) — `View`/`Group`/`DrawContext`/`bind`/`focusSignal`, focus + command
  routing, layout, signals.
- **`@jsvision/core`** (done) — `Theme`/`defaultTheme` (the additive roles land here), `sanitize`.
- **Kitchen-sink** (examples) — the story + `demo:tree` vehicles.
