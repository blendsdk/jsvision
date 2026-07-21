# Preflight Report: Tree (RD-15)

> **Artifact**: `codeops/features/jsvision-ui/plans/tree/` (9 docs)
> **Implements**: jsvision-ui/RD-15
> **Date**: 2026-07-03
> **Scan**: 13-dimension, codebase-grounded (TV C++ oracle + jsvision reuse surfaces)
> **Result**: ✅ **PASSED** — 0 critical, 0 major, 3 minor (all FIXED), 1 observation (accepted)
> **Fixes applied**: 2026-07-03 — PF-001/002/003 resolved in the plan docs + roadmaps.

⚠️ **SAME-SESSION NOTE**: This preflight ran in a fresh session (post-`/clear`), independent of the
authoring session — review independence is preserved.

## Codebase Context Summary

The plan builds `packages/ui/src/tree/` on existing primitives with only additive surface. Every
material claim was verified against the real source:

**TV fidelity oracle (the heart — all citations accurate to the line):**
- `cpOutlineViewer "\x6\x7\x3\x8"` — `toutline.cpp:15` ✅
- `graphChars = "\x20\xB3\xC3\xC0\xC4\xC4+\xC4"`, `levelWidth=3`/`endWidth=3` — `toutline.cpp:367,364-370` ✅
- `createGraph(...)` — `toutline.cpp:165` ✅
- `drawTree` row colour `getColor(0x0202/0x0303/0x0401)` + two-tone `c = (flags & ovExpanded) ? color : (color >> 8)` (line 82) + graph at `x = strwidth(graph) - delta.x` — `toutline.cpp:54-102` ✅ **transcribed exactly**
- palette `sizeof` (benign trailing null) — `toutline.cpp:353` ✅
- flags `ovExpanded=0x01/ovChildren=0x02/ovLast=0x04`, `cmOutlineItemSelected=301`, palette layout 1=Normal/2=Focus/3=Select/4=NotExpanded — `outline.h:27-29,32,66-70` ✅
- mouse: single-click graph-zone (`mouse.x < strwidth(graph)`) → toggle; double-click → `selected(foc)` — `toutline.cpp:433-481` ✅ (the plan §6 decode is **correct**; the graph-zone toggle is in the single-click `else` branch, PA-14 legitimately drops double-click)
- keys `ctrlToArrow` maps ←/→ to up/down (PA-12 override), sizing `update()`/`setLimit(updateMaxX, updateCount)` — `toutline.cpp:484-540,563-594` ✅

**jsvision reuse surfaces (verified):**
- `virtual.ts` `clampIndex`(:12)/`keepVisible`(:29) ✅
- `list-rows.ts` = 336 lines (template for `TreeRows`) ✅
- `list-view.ts` `[rows fr | bar 1]` wiring, `this.rows.bar = this.bar` (:75-77) ✅
- `scroll-bar.ts` `ScrollBarOptions`, `setRange`(:127), `focusable=false`(:83), `setCapture` seam ✅
- `theme.ts` `ThemeRole`(:17-22), additive `history*` pattern (:147-180, :263-267); **no pre-existing `outline` role** — additive claim holds ✅
- `ThemeRoleName = keyof Theme` (`view/types.ts:31`) — new roles auto-usable via `ctx.color(...)` ✅
- RD-15 requirement exists with **AC-1…AC-13**; feature register **AR-141…AR-150** all ✅ Resolved.

**AC coverage:** all 13 ACs map to ST-1…ST-24 (AC-6 corrected by PA-14, disclosed).

The plan is exceptionally faithful and well-grounded. No fidelity, dependency, security, or
architecture defect found. The findings below are cosmetic/consistency only.

## Findings

### 🟡 PF-001 (MINOR) — Task-count summary off by one (34 vs 35) — ✅ FIXED

`99-execution-plan.md:6` header reads `0/34 tasks` and the roadmap row (`00-roadmap.md:40`) says
`4 phases / 34 tasks`, but the **master checklist and the per-session tables both contain 35 tasks**
(verified: `grep -c` = 35 in both). The bulk of the plan is internally consistent at 35; only the
summary counts say 34.

- **Recommendation**: update the header to `0/35` and the roadmap to `35 tasks`. (The alternative —
  removing a task to reach 34 — is wrong; no task is redundant.)
- **Options considered & dropped**: merging two tasks to hit 34 — rejected, every task is distinct.

### 🟡 PF-002 (MINOR) — Kitchen-sink story category left vague / references a non-existent category — ✅ FIXED

`03-03-theme-packaging.md:66` says the Tree story is registered "likely under a 'Data' or the
existing category." The kitchen-sink gate is NON-NEGOTIABLE, and its sibling container-tier stories
(`Scroller`/`ScrollBar`/`ListView`) all use `category: 'Containers'` (verified). No `'Data'`
category exists (only `Containers`/`Controls`/`Dropdowns`/`Foundations`).

- **Recommendation**: pin the story to `category: 'Containers'` — the Tree is `ListView`'s
  structural twin (`[rows fr | bar 1]`, virtual-scroll, owned bar), so it belongs alongside it.
- **Options considered & dropped**: adding a new `'Data'` category — rejected as needless taxonomy
  churn for a single story; revisit only if a data-grid cluster later warrants it.

### 🟡 PF-003 (MINOR) — Empty-tree placeholder text diverges from the sibling renderer — ✅ FIXED

The plan's impl-test description (`07-testing-strategy.md:86`) specifies an empty tree renders
`<no rows>`. The sibling `ListRows` renders `<empty>` (`list-rows.ts:36`, `EMPTY_TEXT`). TV has no
oracle for an empty outline (`TOutlineViewer` assumes a root), so this is a free choice — and the
established convention is `<empty>`.

- **Recommendation**: use `<empty>` to match `ListRows`, keeping the two virtual-scroll renderers
  consistent. If `<no rows>` is intentional, state why in `03-03`/`07`.

### 🔵 PF-004 (OBSERVATION) — ST-20 colour-byte oracle is pinned at exec-time, not plan-time

PA-9 defers the four concrete `{fg,bg}` bytes to the exec **GATE-1 BEFORE** task, so ST-20 (theme
roles = pinned bytes) is only structurally "red" until implementation walks the `getColor` chain.
This is deliberate, precedented (RD-14 `history*`), and legitimate under the fidelity directive (the
C++ is the oracle, and the byte depends on the gray-dialog owner host). **No action** — flagged for
awareness so the exec run treats the GATE-1 byte-pinning as a real, source-cited step (not a guess),
and writes ST-20 only after it.

## Not findings (verified, holds up)

- **Mouse model** — the plan §6 graph-zone-toggle-vs-double-click-select decode is accurate to
  `toutline.cpp:433-481`; PA-14's no-double-click adaptation is disclosed and directive-permitted.
- **`focused` as a numeric flattened-index re-clamped on expand/collapse** — consistent with the
  `ListView` model and covered by an impl test (collapse-ancestor clamp); not a defect.
- **Additive-only surface** — confirmed: no existing theme role or UI file is modified except the 4
  new `defaultTheme` roles.
- Minor line-citation off-by-ones in `02-current-state` (e.g. `list-view.ts:44` vs `:45`) are within
  the stated ranges — not worth individual findings.

## Verdict

**✅ PASSED.** No blocking issues. All three MINOR findings (PF-001…PF-003) were **fixed** in the
plan docs + roadmaps on 2026-07-03; PF-004 is an accepted informational note. The plan is cleared
for `exec_plan tree`.
