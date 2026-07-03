# Tree Implementation Plan

> **Feature**: `Tree<T>` — expandable virtual-scroll outline (TV `TOutlineViewer`/`TOutline`)
> **Status**: Planning Complete
> **Created**: 2026-07-03
> **Implements**: jsvision-ui/RD-15
> **CodeOps Skills Version**: 3.1.0

## Overview

RD-15 adds the **tree/outline tier** of `@jsvision/ui` — a focusable, virtual-scrolling **`Tree<T>`**
that renders a hierarchy of expandable/collapsible nodes with faithful Turbo Vision tree-line
graphics, reimagined from `TOutlineViewer`/`TOutline` (`magiblot/tvision`
`source/tvision/toutline.cpp`, `include/tvision/outline.h`) per the **NON-NEGOTIABLE TV-fidelity
directive**.

The **drawing/geometry/glyphs match TV exactly** (the `│├└─` connectors + bare `+`/`─` expand
marker, the two-tone collapsed text, the `cpOutlineViewer` colours), while the **data model and
behaviour modernize** (a concrete reactive `TreeNode<T>`, view-owned expand state, ←/→
collapse/expand) — the directive's "may extend behaviour; visuals must match" rule.

The Tree is a new `packages/ui/src/tree/` subsystem built **entirely on existing engine primitives**
(RD-11 virtual-scroll helpers `list/virtual.ts` + the owned-`ScrollBar` pattern, RD-03 `View`/
`DrawContext`/`bind`, RD-01 signals, RD-02 layout). The only additive surface is small and
non-breaking: **four additive core `@jsvision/core` `cpOutlineViewer` theme roles**. There are **no
new engine primitives and no changes to existing UI/core code** (unlike RD-14, which needed intra-ui
seams). Every TV-derived pixel is transcribed from the **GATE-1 decode** captured in
[03-01](03-01-tree.md) and re-verified cell-by-cell at GATE-2.

## Document Index

| #   | Document                                          | Description                                          |
| --- | ------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)    | Zero-Ambiguity Gate decisions (PA-1…PA-15)           |
| 00  | [Index](00-index.md)                              | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                | Feature requirements and scope (from RD-15)          |
| 02  | [Current State](02-current-state.md)              | The exact code the subsystem builds on / reuses      |
| 03-01 | [Tree + renderer](03-01-tree.md)                | `Tree<T>` + `TreeRows<T>` + nav/select + **TV GATE-1 decode** |
| 03-02 | [Graph + model](03-02-graph-and-model.md)       | `graph.ts` line-prefix builder + flatten-visible + `TreeNode<T>` model |
| 03-03 | [Theme + packaging](03-03-theme-packaging.md)   | 4 additive `cpOutlineViewer` roles · re-exports · story/demo |
| 07  | [Testing Strategy](07-testing-strategy.md)        | ST-1…ST-N spec cases traced to AC-1…AC-13            |
| 99  | [Execution Plan](99-execution-plan.md)            | Phases, sessions, task checklist, GATE-1/2 tasks     |

## Quick Reference

### Usage Examples

```ts
// A file-tree outline — forest of roots, view owns expand state (all collapsed by default).
type Entry = { name: string };
const roots = signal<TreeNode<Entry>[]>([
  { value: { name: 'src' }, children: [
    { value: { name: 'index.ts' }, children: [] },
    { value: { name: 'engine' }, children: [
      { value: { name: 'render' }, children: [] },
    ]},
  ]},
  { value: { name: 'docs' }, children: [] },
]);
const focused = signal(0);
const selected = signal(-1);
const tree = new Tree<Entry>({
  roots,
  getText: (e) => e.name,
  focused, selected,
  command: 'open',              // emitted on Enter / text-click (TV cmOutlineItemSelected)
  expandedByDefault: false,     // PA-3
  guides: true,                 // PA-6 — the │├└─ connectors (default on)
});
tree.expandAll();               // PA-6 — or the `*` key on the focused node's subtree
```

### Key Decisions

| Decision                     | Outcome                                                             | AR    |
| ---------------------------- | ------------------------------------------------------------------ | ----- |
| Source shape                 | Forest `roots: Signal<TreeNode<T>[]>` (single-root = 1-elem case)   | PA-2  |
| Initial expand state         | Collapsed default + `expandedByDefault?`; node data stays plain     | PA-3  |
| Expand-Set key               | Object-reference `Set<TreeNode<T>>` in a Signal (`getKey` deferred) | PA-4  |
| Scroll axis                  | Vertical-only (H deferred); wide rows clip                          | PA-5  |
| Should-Haves                 | `guides?` toggle + `expandAll()`/`collapseAll()` both in MVP        | PA-6  |
| File split                   | `graph` · `tree-rows` (renderer) · `tree` · `index`                | PA-7  |
| Theme roles                  | `outlineNormal`/`outlineFocused`/`outlineSelected`/`outlineNotExpanded` | PA-8  |
| Mouse select                 | Graph-zone click = toggle; text-click/Enter = select (no dbl-click) | PA-14 |

## Related Files

**New:** `packages/ui/src/tree/{graph,tree-rows,tree,index}.ts` ·
`packages/ui/test/{tree,tree-graph,tree.packaging,fidelity.tree}.{spec,impl}.test.ts` ·
`packages/core/test/outline-theme.spec.test.ts` ·
`packages/examples/tree-demo/` + `packages/examples/kitchen-sink/stories/tree.story.ts`.

**Modified (additive only):** `packages/core/src/engine/color/theme.ts` (4 `cpOutlineViewer` roles) ·
`packages/ui/src/index.ts` (re-exports) · `packages/examples/kitchen-sink/stories/index.ts` ·
`packages/examples/package.json` (`demo:tree`) · `CHANGELOG.md` · roadmap rows.
