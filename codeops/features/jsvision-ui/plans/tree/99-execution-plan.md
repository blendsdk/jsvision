# Execution Plan: Tree

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-03 (Phase 2 COMPLETE — navigation + expand/collapse + mouse + selection)
> **Progress**: 27/35 tasks (77%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Implements RD-15: `Tree<T>` — an expandable virtual-scroll outline — as a new
`packages/ui/src/tree/` subsystem + 4 additive core theme roles. Foundation-first: Phase 0 lands the
theme roles + pure graph/flatten builder, Phase 1 the `TreeRows` renderer + `Tree` composition,
Phase 2 navigation/mouse/selection, Phase 3 the story/demo + fidelity + gate. Spec-first ordering per
phase (spec RED → implement GREEN → impl tests). The TV-derived renderer + theme carry the GATE-1
decode ([03-01](03-01-tree.md)) and a GATE-2 cell-by-cell diff.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 0 | Core theme roles + pure graph/flatten builder | 1 | 90 min |
| 1 | `TreeRows` renderer + `Tree` composition (render + virtual scroll) | 1-2 | 150 min |
| 2 | Navigation + expand/collapse + mouse + selection | 1 | 120 min |
| 3 | Story + `demo:tree` + fidelity (GATE-2) + gate | 1 | 90 min |

**Total: 4-5 sessions, ~7-8 hours**

---

## Phase 0: Core theme roles + pure graph/flatten builder

**Reference**: [03-03](03-03-theme-packaging.md) §Theme, [03-02](03-02-graph-and-model.md)
**Objective**: Land the 4 decoded `cpOutlineViewer` theme roles and the pure `graph.ts`
builder+flatten — the stable, testable base with no `View` yet.

### Session 0.1: Spec tests (RED)
| # | Task | File |
|---|------|------|
| 0.1.1 | Spec: outline theme roles present with the **GATE-1-pinned** bytes, each `encode()`s (ST-20) | `packages/core/test/outline-theme.spec.test.ts` |
| 0.1.2 | Spec: `createGraph` markers/glyphs/widths + `guides=false`; `flattenVisible` visible-set + flags + depth guard (ST-1…ST-7) | `packages/ui/test/tree-graph.spec.test.ts` |
| 0.1.3 | Run spec tests — verify FAIL (red) | — |

### Session 0.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 0.2.1 | **GATE-1 BEFORE**: walk the real `getColor(0x0202/0x0303/0x0401)` → `mapColor` chain through the gray-dialog owner → `cpAppColor`; pin the 4 concrete `{fg,bg}` bytes (PA-9); cite `file:line` | `packages/core/src/engine/color/theme.ts` (JSDoc) |
| 0.2.2 | Add the 4 additive roles to `Theme` + `defaultTheme` (decoded bytes, [03-03](03-03-theme-packaging.md)) | `packages/core/src/engine/color/theme.ts` |
| 0.2.3 | Implement `graph.ts`: `GRAPH`/widths, `createGraph` (2-phase, guides-aware), `flattenVisible` (iterative, MAX_DEPTH guard), `FlatRow`/`OV_*`, `TreeNode<T>` type | `packages/ui/src/tree/graph.ts` |
| 0.2.4 | Run spec tests — verify PASS (green); fix **code** (not oracles) on failure | — |

### Session 0.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 0.3.1 | Impl tests: `lines` bitmask deep/mixed context, `guides=false` width parity, MAX_DEPTH, empty forest | `packages/ui/test/tree-graph.impl.test.ts` |
| 0.3.2 | `yarn verify` green | — |

**Verify**: `yarn verify`

---

## Phase 1: `TreeRows` renderer + `Tree` composition

**Reference**: [03-01](03-01-tree.md) §draw, [02-current-state](02-current-state.md)
**Objective**: The Tree-specific row renderer (graph prefix + two-tone text + virtual window) and the
`Tree` Group `[rows fr | bar 1]` owning the expand state + `ScrollBar` — render + scroll only (keys
in Phase 2).

### Session 1.1: Spec tests (RED)
| # | Task | File |
|---|------|------|
| 1.1.1 | Spec: virtual-window draw, graph+text composition, two-tone collapsed, role priority, scroll range/keepVisible (ST-8…ST-11) | `packages/ui/test/tree.spec.test.ts` |
| 1.1.2 | Run — verify FAIL (red) | — |

### Session 1.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 1.2.1 | **GATE-1 BEFORE**: transcribe the [03-01 §4](03-01-tree.md) draw decode (row colour `getColor(0x0202/0x0303/0x0401)`, two-tone `color>>8`, graph at `x=strwidth(graph)`, fill remainder) into the renderer — cite `file:line` in JSDoc | `packages/ui/src/tree/tree-rows.ts` |
| 1.2.2 | Implement `TreeRows<T> extends View`: `draw()` (bar `setRange`, `keepVisible`, per-row `createGraph`+`getText`, role priority focused>selected>normal, two-tone text) | `packages/ui/src/tree/tree-rows.ts` |
| 1.2.3 | Implement `Tree<T> extends Group`: `[rows fr | ScrollBar 1]` wiring (`rows.bar=bar`, shared `focused`), expand-state model (`Set`+`expandVersion`, `expandedByDefault` seed), `bind` on `roots`+`expandVersion` | `packages/ui/src/tree/tree.ts` |
| 1.2.4 | Barrel + explicit re-exports from `src/index.ts` (`Tree`, `TreeNode`, `TreeOptions`) | `packages/ui/src/tree/index.ts`, `packages/ui/src/index.ts` |
| 1.2.5 | Run spec tests — verify PASS (green) | — |

### Session 1.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 1.3.1 | Impl tests: `expandedByDefault:true` seeding, `roots` swap resets expand, empty tree `<empty>` (matches `ListRows`), ScrollBar wiring | `packages/ui/test/tree.impl.test.ts` |
| 1.3.2 | `yarn verify` green | — |

**Verify**: `yarn verify`

---

## Phase 2: Navigation + expand/collapse + mouse + selection

**Reference**: [03-01 §6](03-01-tree.md), register PA-12/PA-14/PA-15
**Objective**: Make the Tree interactive — faithful `+`/`-`/`*` + ↑↓/paging, the ←/→ override, the
graph-zone-toggle vs text-select mouse model, single-select emit, and the `expandAll`/`collapseAll`
methods.

### Session 2.1: Spec tests (RED)
| # | Task | File |
|---|------|------|
| 2.1.1 | Spec: `+`/`-`/`*`, ← collapse/to-parent, → expand/to-child, expandAll/collapseAll, graph-click toggle, text-click/Enter select, generic getText (ST-12…ST-19) | `packages/ui/test/tree.spec.test.ts` |
| 2.1.2 | Run — verify FAIL (red) | — |

### Session 2.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 2.2.1 | **GATE-1 BEFORE**: transcribe the [03-01 §6](03-01-tree.md) event decode (`+`/`-`/`*` `adjust`/`expandAll`, mouse `mouse.x<strwidth(graph)` toggle, `cmOutlineItemSelected`) — cite `file:line`; apply PA-12 (←/→) + PA-14 (no double-click) | `packages/ui/src/tree/tree-rows.ts` |
| 2.2.2 | Implement keys: ↑↓/PgUp/PgDn/Home/End/Ctrl+Pg, `+`/`-`/`*`, ←/→ (collapse-or-parent / expand-or-child); focus re-clamp via `clampIndex` (PA-15) | `packages/ui/src/tree/tree-rows.ts` |
| 2.2.3 | Implement mouse: focus clicked row; `mouse.x<graphWidth` → toggle; else focus+select+emit (PA-14) | `packages/ui/src/tree/tree-rows.ts` |
| 2.2.4 | Implement `expand`/`collapse`/`toggle`/`expandAll()`/`collapseAll()` on `Tree` + Enter select+emit | `packages/ui/src/tree/tree.ts` |
| 2.2.5 | Run spec tests — verify PASS (green); fix **code** (not oracles) | — |

### Session 2.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 2.3.1 | Impl tests: focus clamp when collapsing the focused subtree's ancestor; wheel; navigation-doesn't-select; `command`/`onSelect` emit once | `packages/ui/test/tree.impl.test.ts` |
| 2.3.2 | `yarn verify` green | — |

**Verify**: `yarn verify`

---

## Phase 3: Story + `demo:tree` + fidelity (GATE-2) + gate

**Reference**: [03-03](03-03-theme-packaging.md) §Story/demo, kitchen-sink + TV-fidelity gates
**Objective**: The mandatory kitchen-sink story, the headless demo, the GATE-2 fidelity diff, and the
final gate.

### Session 3.1: Kitchen-sink story (+ smoke)
| # | Task | File |
|---|------|------|
| 3.1.1 | `Tree` story (file-tree forest, focused/selected echo, ← / → / +−* / click hints, faithful colours) | `packages/examples/kitchen-sink/stories/tree.story.ts` |
| 3.1.2 | Register in the story index; smoke test passes (ST-24) | `packages/examples/kitchen-sink/stories/index.ts` |

### Session 3.2: Headless demo
| # | Task | File |
|---|------|------|
| 3.2.1 | `demo:tree` walkthrough (expand → navigate → collapse → select, ASCII frame per step) + script | `packages/examples/tree-demo/`, `packages/examples/package.json` |
| 3.2.2 | `tree-demo.e2e.test.ts` (spawn tsx, exit 0, assert graph glyphs + step narration) | `packages/examples/test/tree-demo.e2e.test.ts` |

### Session 3.3: GATE-2 + fidelity + final gate
| # | Task | File |
|---|------|------|
| 3.3.1 | **GATE-2 AFTER**: re-open `toutline.cpp`/`outline.h`; diff rendered graph glyphs/widths + two-tone + the 4 resolved colours + mouse graph-zone + `+`/`-`/`*`/arrow semantics cell-by-cell; record the diff in the commit (ST-21) | `packages/ui/test/fidelity.tree.spec.test.ts` |
| 3.3.2 | Packaging + security specs green (ST-22/ST-23); `yarn check:deps`; files ≤ 500 lines | `packages/ui/test/tree.packaging.*.test.ts` |
| 3.3.3 | Full `yarn verify` + `yarn test:e2e`; CHANGELOG entry; RD-15 roadmap row → implemented | root |
| 3.3.4 | Commit via **/gitcm** | — |

**Verify**: `yarn verify && yarn check:deps && yarn test:e2e`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp immediately on completion; update the
> Progress header after every task; never batch. Spec tests come BEFORE implementation in every
> phase. TV-derived draw code is NOT `[x]` until its GATE-2 AFTER-diff task passes.

### Phase 0: Theme roles + graph builder
- [x] 0.1.1 Spec: outline theme roles (ST-20) — 2026-07-03 (`outline-theme.spec.test.ts`, blue-window PA-16 bytes)
- [x] 0.1.2 Spec: `createGraph` + `flattenVisible` (ST-1…ST-7) — 2026-07-03 (`tree-graph.spec.test.ts`)
- [x] 0.1.3 Verify spec FAIL (red) — 2026-07-03 (theme 3 failed; graph import error)
- [x] 0.2.1 **GATE-1 BEFORE**: pin the 4 colour bytes via the getColor chain (PA-9→**PA-16 blue-window**) — 2026-07-03 (register PA-16; 0x1E/0x71/0x1A/0x1F)
- [x] 0.2.2 Implement the 4 additive core roles — 2026-07-03 (`theme.ts` interface + `defaultTheme`)
- [x] 0.2.3 Implement `graph.ts` (createGraph + flattenVisible + types) — 2026-07-03 (`tree/graph.ts`, TV decode in JSDoc)
- [x] 0.2.4 Verify spec PASS (green) — 2026-07-03 (theme 3/3, graph 7/7)
- [x] 0.3.1 Impl tests (bitmask, guides parity, depth guard, empty) — 2026-07-03 (`tree-graph.impl.test.ts`, 6 tests)
- [x] 0.3.2 `yarn verify` green — 2026-07-03 (8/8 turbo tasks; ui 675 tests)

### Phase 1: Renderer + composition
- [x] 1.1.1 Spec: render + virtual scroll (ST-8…ST-11) — 2026-07-03 (`tree.spec.test.ts`)
- [x] 1.1.2 Verify spec FAIL (red) — 2026-07-03 (Tree import error)
- [x] 1.2.1 **GATE-1 BEFORE**: transcribe the draw decode (§4) — 2026-07-03 (`tree-rows.ts` JSDoc; row colour/graph/two-tone/setLimit)
- [x] 1.2.2 Implement `TreeRows` draw — 2026-07-03 (virtual window + graph prefix + two-tone + role priority + vertical nav)
- [x] 1.2.3 Implement `Tree` composition + expand-state model — 2026-07-03 (`[rows fr|bar 1]`, Set+expandVersion, isExpanded/expand/collapse/toggle, seed)
- [x] 1.2.4 Barrel + re-exports — 2026-07-03 (`tree/index.ts` + `src/index.ts` block)
- [x] 1.2.5 Verify spec PASS (green) — 2026-07-03 (ST-8…ST-11 green)
- [x] 1.3.1 Impl tests (seeding, roots swap, empty, scrollbar) — 2026-07-03 (`tree.impl.test.ts`; **caught marker mis-decode**)
- [x] 1.3.2 `yarn verify` green — 2026-07-03 (8/8; ui 679 tests). **Fidelity fix:** marker = TV literal `expanded ? '─' : '+'` (`:200`), not the plan-03-02 `children`-based form (ovChildren is expanded-only) — corrected `graph.ts` + the ST-4 oracle

### Phase 2: Navigation + mouse + selection
- [x] 2.1.1 Spec: keys/arrows/expand/mouse/select (ST-12…ST-19) — 2026-07-03 (`tree.spec.test.ts` +8)
- [x] 2.1.2 Verify spec FAIL (red) — 2026-07-03 (8 failed)
- [x] 2.2.1 **GATE-1 BEFORE**: transcribe the event decode (§6) + PA-12/PA-14 — 2026-07-03 (`tree-rows.ts` onEvent JSDoc, cites `:419-541`/`:472`/`:523-531`)
- [x] 2.2.2 Implement keys (nav + `+`/`-`/`*` + ←/→ + clamp) — 2026-07-03 (Ctrl+Pg, collapseOrParent/expandOrChild PA-12)
- [x] 2.2.3 Implement mouse (graph-toggle vs text-select) — 2026-07-03 (`handleMouseDown`, `mouse.x < graphWidth` PA-14)
- [x] 2.2.4 Implement expandAll/collapseAll + Enter select — 2026-07-03 (`Tree.expandAll/collapseAll/expandSubtree` + `select`)
- [x] 2.2.5 Verify spec PASS (green) — 2026-07-03 (ST-12…ST-19 green; fixed test mouse coords to 1-based)
- [x] 2.3.1 Impl tests (clamp, wheel, nav-no-select, emit-once) — 2026-07-03 (`tree.impl.test.ts` +5, incl. Ctrl+Pg)
- [x] 2.3.2 `yarn verify` green — 2026-07-03 (8/8; ui 696 tests; eslint clean)

### Phase 3: Story + demo + fidelity + gate
- [ ] 3.1.1 `Tree` kitchen-sink story
- [ ] 3.1.2 Register + smoke test (ST-24)
- [ ] 3.2.1 `demo:tree` headless walkthrough
- [ ] 3.2.2 `tree-demo.e2e.test.ts`
- [ ] 3.3.1 **GATE-2 AFTER**: diff vs `toutline.cpp` (ST-21)
- [ ] 3.3.2 Packaging + security + `check:deps` (ST-22/ST-23)
- [ ] 3.3.3 Full verify + e2e + CHANGELOG + roadmap
- [ ] 3.3.4 Commit via /gitcm

---

## Dependencies

```
Phase 0 (theme roles + pure graph/flatten)
    ↓
Phase 1 (TreeRows renderer + Tree composition — render/scroll)
    ↓
Phase 2 (navigation + mouse + selection)
    ↓
Phase 3 (story + demo + GATE-2 fidelity + gate)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed; all ST-1…ST-24 pass
2. ✅ `yarn verify` + `yarn check:deps` + `yarn test:e2e` green
3. ✅ No warnings/errors; no dead code
4. ✅ Security hardened — sanitized draws, bounds-checked flattened access, depth-guarded flatten
5. ✅ **GATE-2 passed** for the TV-derived renderer + theme (glyphs/widths/two-tone/colours) with the
   decode recorded in the commit
6. ✅ Kitchen-sink `Tree` story registered + smoke green; `demo:tree` runs headless
7. ✅ Documentation updated (CHANGELOG, roadmap row)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
