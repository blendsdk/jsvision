# Preflight Report — Table / DataGrid plan (`plans/table/`)

> **Artifact**: `codeops/features/jsvision-ui/plans/table/` (implementation plan, 9 docs) · implements RD-16
> **Reviewed**: 2026-07-03 · **Skill**: preflight 3.1.0
> **⚠️ SAME-SESSION REVIEW** — this plan was authored earlier in the *same session* that is now reviewing
> it. Same-agent blind spots are likely; findings below were re-checked against **primary-source code**
> (cited `file:line`), not reasoning from memory. Consider a fresh-session re-scan for full independence.

---

## Outcome

**✅ PASSED WITH NOTES** (after resolution) — scanned **0 🔴 / 1 🟠 / 3 🟡 / 2 🔵**.

The plan's core is sound and grounded: the `Group = focusable-renderer(View) + owned bar` idiom, the
`solveTrack`/`virtual.ts`/`ScrollBar` reuse, the single additive `tableHeader` role, and the TV GATE-1
decode all verify against the real code. **One MAJOR layout defect** was found by re-checking the layout
engine — the header/data columns would misalign as drawn — plus small precision/edge/consistency notes.

---

## Codebase Context Summary (recon — mostly reused from this session's make_plan recon)

**Verified against the real code this session:**

| Plan claim | Reality | Verdict |
|---|---|---|
| `Group = renderer(View) + owned bar` idiom | `ListView`/`Tree` both `extends Group`, compose focusable `*Rows extends View` + `ScrollBar` | ✅ grounded |
| `stringWidth`/`glyphWidth` for cell measure/clip | Exported from `controls/measure.ts:19,29` (`WIDTH_MODE='wcwidth'`) — **no `clip` helper** | ⚠️ PF-104 |
| `ctx.color('tableHeader')` auto-works | `ThemeRoleName = keyof Theme` (`view/types.ts:31`); `color(role: ThemeRoleName)` (`:47`) | ✅ grounded |
| Adding `tableHeader` breaks no Theme literal | The only external literal spreads `...defaultTheme` (`view.drawcontext-role.impl.test.ts:42`) | ✅ safe (suspicion dissolved) |
| `solveTrack` `fixed\|flex`, no `auto` | `apportion.ts:17-19,74-89` — confirmed; `auto` pre-measure required | ✅ grounded |
| Header + rows share column geometry | **Layout gives them different widths** (`layout.ts:209` stretch) | 🟠 **PF-101** |
| `MouseEvent` has no double-click | `events.ts:30` = `down\|up\|move\|drag` | ✅ (AR-177 handled) |

**References mapped:** ~18 · verified 17 · 1 defective (PF-101). No phantom references; no redundancy
(the grid builds only what's missing); dependency reality clean (all deps Done, zero runtime deps).

---

## Findings

### 🟠 PF-101 — The `03-01` layout diagram misaligns the header from the data columns
**Dimension:** 13 (Architecture Mismatch) / 6 (Feasibility).
`03-01-data-grid.md` §Architecture draws the structure as a `column` with the **header as a direct child**
(`{fixed, cells:1}`) and a separate `body` child = `[rows fr | vbar 1]`. But the layout engine defaults to
`align:'stretch'`, which **fills a child to the full parent cross-axis** (`layout.ts:198-212` — "`stretch`
(default) fills the content cross extent"). So the header stretches to the **full width `W`**, while `rows`
(the `fr` sibling of the 1-cell `vbar` inside `body`) gets **`W − 1`**. The header and the rows therefore
call `resolveColumns` with **different viewport widths** → different `fr`/`auto` apportionment → the header
column boundaries **do not line up** with the data column boundaries. This directly breaks **AC-5** ("header
column starts align with the data column starts"), **ST-6**, and the plan's own Risk-2 mitigation.
**Recommendation:** restructure `DataGrid` so the header, rows, and hbar all sit in an `fr` band beside a
fixed 1-cell sibling — a 3-row column of rows, each `direction:'row'`:
```
DataGrid (column):
  ├─ topRow (fixed 1, row):  [ header (fr) | corner (fixed 1) ]
  ├─ body   (fr, row):       [ rows   (fr) | vbar   (fixed 1) ]
  └─ botRow (fixed 1, row):  [ hbar   (fr) | corner (fixed 1) ]
```
Now header/rows/hbar are all width `W − 1` → they apportion identically and align; the two corner cells
(above/below the vbar) are blank in the background role. This matches the ASCII preview the user approved at
plan time (AR-174) — the *preview* was right; the *structure diagram* under-implemented it. Update
`03-01` §Architecture + §"Shared column geometry" and note the corner cells. (No AR change — AR-174's
decision stands; only the realization diagram was wrong.)

### 🟡 PF-102 — `resolveColumns` conflates O(rows) `auto` measurement with per-draw apportion
**Dimension:** 3 (Logical Contradiction) / 6 (Feasibility).
`03-02` states the `auto` measurement "is a `computed` upstream … re-runs on the `rows` signal change, not
per frame" (honouring AR-173), but `03-01`'s `draw()` pseudocode calls
`resolveColumns(columns, rowsSnapshot, ctx.size.width)` **inside `draw`** — i.e. the whole thing (including
the O(rows) widest-cell scan) runs **every frame**. The two docs contradict, and the draw-path reading
violates AR-173's explicit "no per-frame O(rows)".
**Recommendation:** split the concern in `columns.ts`: `measureAutoWidths(columns, rows) → number[]` (the
O(rows) part, wrapped in a `computed` over the `rows` signal in `data-grid.ts`) vs.
`apportionColumns(measuredWidths, columns, viewportWidth) → ColumnGeometry` (the O(cols) `solveTrack` +
clamp part, called per-draw with the current `bounds.width`, since width isn't reactive). Update both docs
to reference the two-function split.

### 🟡 PF-103 — The sort `▲`/`▼` indicator overwrites the last title character on a narrow column
**Dimension:** 9 (Edge Cases).
`03-01` §GridHeader draws the indicator "at the last content cell of the column … so the title doesn't
shift." For a column whose width equals its title width (e.g. a width-3 `"Age"` column), the indicator
**overwrites the `e`** → `"Ag▲"` — the title is silently truncated, not merely un-shifted.
**Recommendation:** when a column is the active sort column, clip its title to `width − 1` and reserve the
last cell for the indicator (so `"Age"` in a 3-wide col shows `"Ag▲"` *by design*, or widen via `minWidth`);
or draw the indicator only when `width > titleWidth`. Pin the choice in `03-01` + a `grid-columns` ST.
Recommend: reserve `width − 1` for the title on the active column (predictable, always shows the arrow).

### 🟡 PF-104 — `alignCell` needs a width-aware clip; `ListRows`' `.slice` is the wrong precedent
**Dimension:** 13 (Convention / Test Impact).
`03-02`'s `alignCell` must "clip to `width` (width-aware, never mid-wide-glyph)", but the sibling `ListRows`
clips with a naïve `text.slice(0, textWidth)` (`list-rows.ts:211`) — **character**-based, not width-based,
so a CJK/wide glyph miscounts. `measure.ts` exports `stringWidth`/`glyphWidth` but **no clip helper**
(`measure.ts:19,29`). The plan is right to be width-correct, but should state that `alignCell` builds a
width-aware clip from `glyphWidth` (new, in `columns.ts`) — an intentional improvement over `ListRows`, not
a reuse of its `.slice`.
**Recommendation:** add a note in `03-02` that `alignCell` implements width-aware clipping via `glyphWidth`
(deliberately unlike `ListRows.slice`), and an impl test for a wide-glyph cell (already listed as
`grid-columns.impl` "wide-glyph clip/align" — cross-reference it).

### 🔵 PF-105 — Zebra grey rows show a cyan divider notch
**Dimension:** 12 (Consistency).
On a zebra (odd) row the background is `staticText` (lightGray `0x70`), but the `│` divider is drawn in
`listDivider` (blue-on-**cyan** `0x31`) — so each divider cell is a **cyan notch** in the grey stripe.
Faithful non-zebra rows are cyan throughout, so the divider blends; zebra breaks that.
**Recommendation (non-blocking):** on a zebra row, draw the divider glyph in the *row's* background (grey)
rather than `listDivider`, or accept the notch. Recommend: keep `listDivider` for faithful (non-zebra) rows
and match the row bg on zebra rows — a one-line branch in `grid-rows.ts`. Note in `03-01`.

### 🔵 PF-106 — The source RD-16 AC-8 still says "double-click"; the plan supersedes it
**Dimension:** 12 (Consistency / cross-document).
`RD-16-table.md` AC-8 still reads "Enter, Space, or double-click"; the plan defers double-click (AR-177,
feasibility). The register cross-references this, but a reader of the RD alone would miss it.
**Recommendation (non-blocking):** add a one-line pointer in RD-16 AC-8 ("double-click deferred at plan
time — see plan AR-177") for traceability, or accept the register cross-ref as sufficient.

---

## Dimension scan summary

| # | Dimension | Result |
|---|-----------|--------|
| 1 | Ambiguities | clean (gate resolved AR-172…182) |
| 2 | Implicit Assumptions | clean (measure/theme/ThemeRoleName all verified) |
| 3 | Logical Contradictions | PF-102 (auto-measure per-frame vs computed) |
| 4 | Completeness Gaps | clean (empty/zero-col/security ACs present) |
| 5 | Dependency Issues | clean (all deps Done; zero runtime deps) |
| 6 | Feasibility | PF-101, PF-102 |
| 7 | Testability | clean (ST-1…ST-24 ↔ AC-1…AC-14; red/green ordering) |
| 8 | Security Blind Spots | clean (sanitize + bounds-check + width-clip; AC-13/ST-23) |
| 9 | Edge Cases | PF-103 |
| 10 | Scope Creep | clean (Should-Haves user-approved; Won't/Deferred bounded) |
| 11 | Ordering & Sequencing | clean (spec-first 3-session; deps Phase 1→4; GATE tasks in P3) |
| 12 | Consistency | PF-105, PF-106 |
| 13 | Codebase Alignment | PF-101, PF-104 (+ Theme-literal suspicion dissolved) |

---

## Adversarial checklist (same-session safeguard)

- Re-verified every code claim against `file:line` (not memory): `layout.ts:209`, `measure.ts:19,29`,
  `view/types.ts:31`, `apportion.ts:17-19`, `events.ts:30`, `list-rows.ts:211`. ✅
- Actively tried to break the layout composition → **found PF-101** (the one my authoring missed). ✅
- Checked the additive Theme edit for impact-blindness → the only other literal spreads `defaultTheme`
  (no breakage). ✅
- No invented findings; a clean pass on 8 of 13 dimensions is reported as clean.

---

## Resolutions

User decision (2026-07-03): **apply PF-101…PF-104; accept PF-105, PF-106**.

| PF | Severity | Decision | Applied |
|----|----------|----------|---------|
| PF-101 | 🟠 | **Fixed** — restructured `DataGrid` to `topRow[header fr\|corner 1] / body[rows fr\|vbar 1] / botRow[hbar fr\|corner 1]` so header/rows/hbar share width `W−1`. | `03-01` §Architecture + §Shared geometry; `99` task 3.2.2; register AR-174 cross-ref |
| PF-102 | 🟡 | **Fixed** — split `resolveColumns` → `measureAutoWidths` (O(rows) computed) + `apportionColumns` (O(cols) per-draw). | `03-02` signatures + integration; `03-01` draw path + composition; `99` tasks 2.1.1/2.2.1; `07` test tables |
| PF-103 | 🟡 | **Fixed** — active sort column clips its title to `width−1`, reserves the last cell for the indicator. | `03-01` §GridHeader; register AR-180 cross-ref; `07` datagrid.impl case |
| PF-104 | 🟡 | **Fixed** — `alignCell` builds a `glyphWidth`-based width-aware clip (deliberately unlike `ListRows.slice`); draw path uses `alignCell` for clip+pad. | `03-02` §alignCell; `03-01` draw path; `99` task 2.2.1 |
| PF-105 | 🔵 | **Accepted** — zebra divider cyan notch left as-is (cosmetic). | — |
| PF-106 | 🔵 | **Accepted** — RD-16 AC-8 double-click supersession left to the register cross-ref (AR-177). | — |

**Outcome after resolution: ✅ PASSED WITH NOTES** — 4 resolved, 2 accepted; 0 🔴/🟠 outstanding.
