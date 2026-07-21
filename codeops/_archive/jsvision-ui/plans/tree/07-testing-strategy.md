# Testing Strategy: Tree

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Spec-first per the CodeOps ordering (spec RED → implement GREEN → impl tests). Expectations derive
**only** from RD-15 (AC-1…AC-13, with the PA-14 correction to AC-6), the TV GATE-1 decode
([03-01](03-01-tree.md)), and this plan's register — never from implementation. For TV-derived facts
the **C++ source is the oracle** (a spec oracle that disagrees with a faithful decode is the defect —
fix the oracle against the source, citing `file:line`).

Headless throughout (buffer assertions pre-`serialize`, synthetic dispatch) — matches the RD-11
`containers` test style; no TTY.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

### Graph builder + flatten (`tree-graph.spec.test.ts`) — pure

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | `createGraph(0, 0, OV_CHILDREN)` (root, collapsed, has children, not last) | Ends in the **`+`** marker; no `[+]` brackets; width = `END_WIDTH` (3) | AC-2, decode §1-3 |
| ST-2 | `createGraph(0, 0, OV_CHILDREN|OV_EXPANDED)` | Ends in **`─`** (expanded marker), not `+` | AC-2/AC-4, §3 |
| ST-3 | `createGraph(1, lines, OV_LAST)` last child at level 1 | Level-1 end graphic uses **`└`**; a non-last uses **`├`**; ancestor column is `│` iff its `lines` bit set, else space | AC-2, §1-3 |
| ST-4 | Leaf node (`children:[]`) graph | Marker column = `─` (never `+`) | AC-2, §3 |
| ST-5 | `createGraph(..., guides=false)` | `│├└─` connectors render as spaces; the **marker column is unchanged**; total width identical | PA-6 |
| ST-6 | `flattenVisible(forest, isExpanded)` with a collapsed subtree | Collapsed node's descendants **absent**; expanding it re-flattens to include them in display order; each row's `flags` carries OV_CHILDREN/OV_EXPANDED/OV_LAST correctly | AC-1/AC-4, §6 |
| ST-7 | `flattenVisible` over a forest of 2 roots | Both roots + their expanded descendants in order; a pathological deep chain is depth-guarded (no throw) | AC-1/AC-13, §6 |

### Tree render + virtual scroll (`tree.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-8 | A `Tree` over a nested forest, drawn in a short viewport | Only the visible (expanded) rows in view are drawn (not the whole tree); each row = graph prefix + `getText(value)` at the post-graph column | AC-1/AC-10, §4 |
| ST-9 | ↑↓ then PgDn | `focused` moves ±1 / ±viewport; the focused row stays visible (`keepVisible`); the owned `ScrollBar` range = flattened count, `value` follows `focused` | AC-1, §6 |
| ST-10 | Two-tone: a **collapsed** normal node vs an **expanded** one | Collapsed node's **text** uses `outlineNotExpanded`; expanded uses `outlineNormal` (low byte); focus/select rows single-tone | AC-3, §4, PA-11 |
| ST-11 | Row role priority | focused row = `outlineFocused`, else selected = `outlineSelected`, else `outlineNormal` | AC-3/AC-10, §4 |

### Navigation + expand/collapse (`tree.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-12 | `+` / `-` / `*` on the focused node | `+` expands, `-` collapses, `*` expands the whole subtree; the flattened list grows/shrinks; `focused` re-clamped valid | AC-4, §6, PA-15 |
| ST-13 | **←** on an expanded node / on an already-collapsed node | Collapses it / moves focus to its **parent** | AC-5, PA-12 |
| ST-14 | **→** on a collapsed node / on an already-expanded node | Expands it / descends to its **first child** | AC-5, PA-12 |
| ST-15 | `expandAll()` / `collapseAll()` instance methods | Whole forest expands / collapses (one repaint); flattened count reflects it | Should-Have, PA-6 |

### Mouse + selection (`tree.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-16 | Click within the **graph-prefix width** of a row | That node's expand state **toggles** (no select); `focused` = clicked row | AC-6 (corrected), PA-14, §6 |
| ST-17 | Click on a row's **text** (past the graph) | `focused` = `selected` = that row; the `command` is emitted / `onSelect` fires | AC-6 (corrected)/AC-7, PA-14 |
| ST-18 | **Enter** on the focused row | `selected` set + command emitted (single-select) | AC-7, §6 |
| ST-19 | Generic `TreeNode<T>` with a `getText` | Rows show `getText(node.value)`; user node data carries no reactive wrapper; updating `roots`/expand re-flattens + repaints | AC-8, AR-141 |

### Theme + packaging + fidelity + demo

| # | Input / Scenario | Expected Output / Behavior | Source | File |
|---|------------------|----------------------------|--------|------|
| ST-20 | `defaultTheme` outline roles | `outlineNormal`/`outlineFocused`/`outlineSelected`/`outlineNotExpanded` present with the **GATE-1-pinned** bytes; each `encode()`s without throwing; only new core role symbols | AC-9, PA-8/PA-9 | `packages/core/test/outline-theme.spec.test.ts` |
| ST-21 | Rendered tree vs TV (buffer pre-`serialize`) | Graph glyphs, indent/end widths, two-tone collapsed text, and the 4 resolved colours match `toutline.cpp` cell-by-cell | AC-10, decode | `packages/ui/test/fidelity.tree.spec.test.ts` |
| ST-22 | Packaging | `tree/` files exist with explicit named re-exports from `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines | AC-11, PA-7 | `packages/ui/test/tree.packaging.spec.test.ts` |
| ST-23 | Security | Node text sanitized to screen (no raw escapes); flattened access bounds-checked; flatten depth-guarded | AC-13, security | `packages/ui/test/tree.packaging.spec.test.ts` |
| ST-24 | Story + demo | `Tree` story passes the headless smoke test; `demo:tree` runs headless (expand → navigate → collapse → select, ASCII frame per step) | AC-12, AR-150 | `kitchen-sink.smoke.spec` + `tree-demo.e2e.test.ts` |

## Test Categories

### Specification Tests (written BEFORE implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/ui/test/tree-graph.spec.test.ts` | ST-1…ST-7 | `graph.ts` builder + flatten (pure) |
| `packages/ui/test/tree.spec.test.ts` | ST-8…ST-19 | `Tree`/`TreeRows` render + nav + mouse + select |
| `packages/core/test/outline-theme.spec.test.ts` | ST-20 | Core theme roles |
| `packages/ui/test/fidelity.tree.spec.test.ts` | ST-21 | TV fidelity (buffer diff, GATE-2) |
| `packages/ui/test/tree.packaging.spec.test.ts` | ST-22, ST-23 | Packaging / security |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (extend) | ST-24 | Story smoke |

### Implementation Tests (edge cases, internals — written AFTER)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `tree-graph.impl.test.ts` | `lines` bitmask for deep/mixed sibling context; `guides=false` width parity; MAX_DEPTH guard; empty forest | High |
| `tree.impl.test.ts` | `expandedByDefault:true` seeding; focus clamp when collapsing the focused subtree's ancestor; `roots` swap resets expand; wheel; Home/End/Ctrl+Pg; empty tree `<empty>` (matches `ListRows` `EMPTY_TEXT`, `list-rows.ts:36` — no TV oracle for an empty outline); ScrollBar wiring | High |
| `tree.packaging.impl.test.ts` | Re-export surface; file line-count guard | Low |

### Integration / E2E

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `tree-demo.e2e.test.ts` | Tree + shell | `demo:tree` headless walkthrough (ASCII frame per step) |

## Test Data / Fixtures
- A small file-tree forest (`src/{index.ts,engine/{render}}`, `docs`) with mixed depth + a
  last/non-last mix; a seeded `focused`/`selected`. Real objects throughout (headless views +
  synthetic dispatch; no mocks).

## Verification Checklist
- [ ] All ST-1…ST-24 defined with concrete input/output pairs
- [ ] Every ST traces to an AC / decode `file:line` / PA
- [ ] Spec tests written + verified FAIL (red) before implementation
- [ ] All spec tests pass after implementation (green); fidelity oracle diffed against C++ (GATE-2)
- [ ] Impl tests written for edge cases; full `yarn verify` + `yarn check:deps` green; no regressions
