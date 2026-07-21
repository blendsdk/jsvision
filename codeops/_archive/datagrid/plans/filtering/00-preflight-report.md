# Preflight Report: Filtering (datagrid/RD-06)

> **Artifact**: `codeops/features/datagrid/plans/filtering/` (implementation plan, 10 docs)
> **Scan date**: 2026-07-15
> **CodeOps Skills Version**: 3.7.0
> **Iteration**: 1
> **Result**: ✅ PASSED — all 5 findings resolved (amendments applied 2026-07-15; see Resolution)

> ⚠️ **SAME-SESSION REVIEW** — this plan was created earlier in the same session that is now
> reviewing it. Systematic same-agent blind spots are likely. Counter-measures applied: every
> `file:line` claim re-verified against the real source; the one MAJOR finding was put to an
> **independent challenger agent** (read-only, un-primed) which confirmed it against the code before
> it was recorded. For full independence, consider re-running preflight in a fresh session.

---

## Codebase Context Summary

The plan targets `packages/datagrid/src/`. Reconnaissance read: `data-source.ts`, `sort.ts`,
`sort-header.ts`, `column.ts`, `grid.ts`, `overlay.ts`, `editing.ts`, `index.ts`, plus `RD-06` and
`kitchen-sink/stories/sorting.story.ts`, and listed the test dir + stories.

**Verified accurate** (no phantom references):

- Line anchors: `data-source.ts` FilterModel `:16`, `setFilter` `:43`, `distinct` `:45`, `fromRows`
  `:65`; `grid.ts` `display` `:174`, push-down effect `:183`, `applySort` `:359`; `sort-header.ts`
  reserve block `:128`, `onEvent` `:149`, `columnAtX` `:169`. All correct.
- `absoluteRect` **is** exported from `overlay.js` (barrel `:55`) and returns `{x,y}` (origin only).
- Every `@jsvision/ui` primitive the plan leans on exists: `Text`, `Input`, `CheckGroup`, `ComboBox`,
  `DatePicker`, `CalendarDate`, `ListView`/`ListBox`, `PopupHost`, `MenuPopup`, `apportionColumns`,
  `alignCell`, `stringWidth`, `measureAutoWidths`.
- `security.spec.test.ts`, `sort-header.spec.test.ts`, `kitchen-sink.smoke.spec.test.ts` all exist —
  so the plan's "additions to" phrasing is correct (not new-file phantoms).
- The reactive story echo the plan assumes (`new Text(() => …)`) is a proven pattern
  (`sorting.story.ts:62`).
- The `filter.ts`-mirrors-`sort.ts` architecture is sound; the pure-model / signal / guarded-push-down
  seams the plan extends are exactly as described.

**The one architecture mismatch** (PF-001, below): imperatively-mounted overlays in this package get
their focus + popup-host seam from the **live `DispatchEvent` envelope**, never from a stored `loop`;
the plan's funnel→popup callback signature drops that seam.

---

## Findings

### PF-001 — 🟠 MAJOR — `onFunnelClick(columnId, anchor)` drops the focus/popup seam the popup needs

**Dimensions**: 13 Codebase Alignment (Architecture Mismatch) · 4 Completeness · 6 Feasibility · 11 Ordering
**Docs**: `03-02 §Event — funnel-vs-title routing`, `03-04 §Funnel → popup`, `99 Phase 3/4`
**Verdict**: CONFIRMED (independent challenger + primary-source).

**The gap.** In this codebase, every imperatively-mounted interactive overlay is focused, and every
dropdown nested inside it is opened, using the seam carried on the **live event envelope**, not a
stored reference:

- The cell editor mounts with `loop: { focusView: (v) => ev.focusView?.(v) }` — the seam is built
  inline from the envelope passed into the handler (`editing.ts:196`); it focuses the mounted editor
  with `ev.focusView?.(…)` (`editing.ts:218`, via `editing.ts:33`).
- The F4 value-help ComboBox opens its dropdown by **spreading the live envelope**:
  `editor.onEvent({ ...ev, event: {…Alt+Down…} })` — the code comment states this "reuses the real
  envelope's popupHost/focusView" (`editing.ts:220–228`).
- A `ComboBox` reads its host straight off the envelope and **silently no-ops when it is undefined**:
  `const host = ev.popupHost; if (host === undefined) return;` (`packages/ui/src/dropdown/combo-box.ts:200–201`).
- `EditableDataGrid` stores **no** loop / `focusView` / `popupHost` (`grid.ts:135–158`); the existing
  `onHeaderClick` only calls pure sort-model mutators — it never mounts or focuses anything.
- `SortHeader.onEvent` **has** `ev` in hand but forwards only plain data to its callback:
  `this.onHeaderClick(columnId, ctrl)` (`sort-header.ts:158`); the envelope is dropped at the boundary.

The plan's `onFunnelClick(columnId, anchor)` (03-02) and `openFilterPopup(columnId, anchor)` (03-04)
carry only a columnId and an `{x,y}`. So the FilterPopup — which the plan mounts via the same
`mountCellOverlay`/overlay pattern and fills with a **ComboBox operator selector and a DatePicker** —
would **render but be unfocusable**, and its nested dropdowns would be **dead no-ops**. The plan cites
the RD-03 precedent ("proven pattern") but omits the exact mechanism that precedent depends on.

**Ordering wrinkle.** Phase 3 (task 3.2.2/3.2.3) introduces `onFunnelClick` wired to a Phase-4
placeholder. The seam parameter must land in the **Phase 3** signature, or Phase 4 has to retro-change
`SortHeaderConfig` and `SortHeader.onEvent`.

**Test impact.** The isolated `FilterPopup`/`ValueList` component specs (ST-21…ST-26) drive the popup
directly via its config and are unaffected. The container-integration path (funnel click → mount →
focus → operate) does need the harness to supply a `DispatchEvent` with `focusView`/`popupHost`.

**Options.**
- **(A, recommended)** Forward the live envelope: `onFunnelClick(columnId, anchor, ev)` and
  `openFilterPopup(columnId, anchor, ev)`; `SortHeader.onEvent` passes `ev` through at the funnel
  branch; the container builds the mount loop as `{ focusView: (v) => ev.focusView?.(v) }` and lets the
  popup's widgets consume the spread envelope — a byte-for-byte mirror of the cell-editor path
  (`editing.ts`). Lowest risk, maximum precedent fidelity. Land the signature in Phase 3.
- **(B)** Forward a narrowed seam object `{ focusView, popupHost }` instead of the whole envelope. Less
  coupling, but diverges from `editing.ts` (which spreads the entire envelope to open the ComboBox), so
  the nested-dropdown open path would need its own adapter. More work, weaker fidelity.
- ~~(C) Store a loop/host on the container at mount~~ — rejected: nothing in the package exposes a
  focus seam outside an event envelope; this would invent a new pattern the rest of the grid doesn't use.

**Recommendation: Option A.** Amend `03-02` (SortHeaderConfig `onFunnelClick` signature + the
`onEvent` funnel branch), `03-04` (`openFilterPopup` signature + the `mountCellOverlay` loop wiring),
and the Phase 3 tasks in `99` so the seam is threaded from the start; note the harness requirement on
the container-integration test.
**Confidence: High.** **Hardening: independent challenger agent confirmed against source (combo-box.ts:200 no-op), plus direct read of editing.ts/overlay.ts/grid.ts/sort-header.ts.**

---

### PF-002 — 🟡 MINOR — value-list "omit the section" (03-03) contradicts "always compute" (03-04)

**Dimensions**: 3 Logical Contradictions · 12 Consistency · 13 (Migration/forward-compat)
**Docs**: `03-03 §Integration Points`, `03-04 §Distinct delegation`

`03-03` says a windowed source **without** `distinct` "omits the [value-list] section", but `03-04`'s
`distinctFor` **always** returns a result — falling back to `computeDistinct(materialize(source), col)`
— so the section is never omitted. Two frictions: (1) the docs disagree; (2) client-scanning a windowed
source's materialized rows contradicts RD-06's "large datasets never scan client-side for distinct
values" and would compute distinct over only the *loaded* window (silently incomplete).

Latent for v1 — the only source today is in-memory `fromRows`, where client compute is correct and
desired, and no windowed source exists (RD-11, not built). But the contradiction should be resolved so
execution isn't ambiguous.

**Recommendation.** Make `03-03` agree with `03-04` for v1: **in-memory always offers the value-list
via grid-owned client compute** (delete the "omits the section" clause), and add a one-line forward
note that an RD-11 windowed source will gate the client scan (offer the value-list only when
`source.distinct` is present). No code change — a doc reconciliation.
**Confidence: High. Hardening: in-context (both docs read; RD-06 §Distinct enumeration cited).**

---

### PF-003 — 🟡 MINOR — quick-filter Input ⇄ popup filter on the same column is unspecified

**Dimensions**: 1 Ambiguities · 4 Completeness · 9 Edge Cases
**Docs**: `03-02 §Component A`, `03-04 §Filter API`

`FilterModel` is `Map<columnId, ColumnFilter>` — **one filter per column**. So a quick-filter text and
a popup-set filter (`set`/`number`/`date`) on the *same* column overwrite each other (last-writer-wins),
and the quick-filter `Input` shows blank while a popup-set filter is active (yet the funnel shows).
Typing one character into that Input would silently replace the value-list/condition filter with a
`text/contains`. The plan doesn't state this interaction.

**Recommendation.** Adopt and **document** last-writer-wins for v1 (the natural consequence of the Map):
the quick-filter Input reflects only `text` filters; a popup-set non-text filter leaves the Input blank
with the funnel indicating the active filter; the newest write wins. Add a one-line note to `03-02`/
`03-04` (and optionally a small impl-test). A richer "Input mirrors the active filter" sync is out of
scope for v1. Confirm this is the intended behavior.
**Confidence: Medium (a genuine product choice, not a code fact). Hardening: in-context.**

---

### PF-004 — 🔵 OBSERVATION — "mirrors sort.ts type detection" is an over-claim for `resolveFilterType`

**Dimensions**: 12 Consistency · 13 (accuracy of a code claim)
**Docs**: `03-01 §resolveFilterType`, `00-index Key Decisions`

`resolveFilterType` detects `number → number`, `Date`/`CalendarDate → date`, else `text`. But
`sort.ts`'s `compareValues` (`sort.ts:42–46`) detects only `typeof number` and `instanceof Date` — it
has **no** `CalendarDate` branch (a `CalendarDate` value would fall to its string collator). So the plan
*extends* the detection rather than *mirroring* it. The extension is correct and desirable (DatePicker
operands are `CalendarDate`), but the wording is slightly inaccurate.

**Recommendation.** Reword to "extends sort.ts's runtime type detection (adds `CalendarDate → date`,
which the sort comparator has no need for)". Trivial doc edit.
**Confidence: High. Hardening: in-context (sort.ts:42–46 read).**

---

### PF-005 — 🟡 MINOR — `filteredCount()` mechanism: `07` says `source.length()`, `03-04` implements `display().length`

**Dimensions**: 3 Logical Contradictions · 12 Consistency
**Docs**: `07 ST-14`, `03-04 §Filter API`

`07`'s ST-14 says on a push-down source "`filteredCount()` reads `source.length()`", but `03-04`
implements `filteredCount(): number { return this.display().length }`. For an **eager** push-down source
these coincide (`materialize` fills every slot, so `display().length === source.length()`); for a future
**windowed** source they can diverge (`materialize` skips not-yet-loaded holes, so `display().length ≤
source.length()`). The ST-14 spy is eager, so the test passes either way — but the two docs describe the
mechanism differently.

**Recommendation.** Align `07` ST-14's wording with `03-04`'s implementation: `filteredCount()` returns
`display().length`, which equals `source.length()` for an eager push-down source. Trivial doc edit.
**Confidence: High. Hardening: in-context.**

---

## Resolution (applied 2026-07-15)

User decisions from the preflight batch, applied to the plan and logged as AR #18–#22 in
`00-ambiguity-register.md`:

| Finding | Decision | Docs amended |
|---------|----------|--------------|
| PF-001 🟠 | **Forward the live envelope** (Option A) — `onFunnelClick`/`openFilterPopup` carry `ev`; seam lands in Phase 3 | `03-02`, `03-04`, `99` (3.2.2/3.2.3/4.2.2) |
| PF-002 🟡 | v1 in-memory always offers the value-list; windowed source gates on `source.distinct` (RD-11 forward note) | `03-03` |
| PF-003 🟡 | Last-writer-wins, documented (one filter/column; Input mirrors only `text`) | `03-02`, `03-04` |
| PF-004 🔵 | Reword "mirrors" → "extends" sort.ts detection | `03-01` |
| PF-005 🟡 | Align ST-14 wording to `display().length` | `07` |

No source code was changed — every amendment is to the plan documents. The MAJOR (PF-001) is now
structurally correct: the funnel click threads the `DispatchEvent` from `SortHeader.onEvent` to
`openFilterPopup`, which builds the `mountCellOverlay` loop from `ev.focusView` exactly as `editing.ts`
does — so the condition/value-list popups will be focusable with live nested dropdowns.

## Dimension coverage

| # | Dimension | Result |
|---|-----------|--------|
| 1 | Ambiguities | PF-003 |
| 2 | Implicit Assumptions | PF-001, PF-002 |
| 3 | Logical Contradictions | PF-002, PF-005 |
| 4 | Completeness Gaps | PF-001, PF-003 |
| 5 | Dependency Issues | Clean (RD-07/RD-09 correctly forward-noted) |
| 6 | Feasibility | PF-001 (fixable); quick-filter Input reposition feasible (plan flags it) |
| 7 | Testability | Clean; ST-cases concrete (PF-001 notes a harness need on integration tests) |
| 8 | Security Blind Spots | Clean — structured literals to `setFilter`, no query building, unknown-column ignored (ST-15/ST-27 cover AC-9) |
| 9 | Edge Cases | PF-003; number `between` reversed range (`b<a`) keeps nothing — acceptable, worth a test |
| 10 | Scope Creep | Clean — Should-Haves correctly deferred; no creep |
| 11 | Ordering & Sequencing | PF-001 (seam must land in Phase 3) |
| 12 | Consistency | PF-004, PF-005 |
| 13 | Codebase Alignment | PF-001 (only architecture mismatch); all references verified accurate |

## Verdict

The plan is architecturally sound and unusually well-grounded — file:line anchors, primitive names, and
test-file references all check out, and the `filter.ts`-mirrors-`sort.ts` design is faithful. **One
MAJOR (PF-001) blocks execution**: the funnel→popup callback must forward the live event envelope, or
the condition/value-list popups will render unfocusable with dead dropdowns. Three MINORs and one
OBSERVATION are doc reconciliations. Once PF-001 is amended into `03-02`/`03-04`/`99` (and the minors
resolved as the user chooses), the plan is ready for `exec_plan`.

**Status: ✅ PASSED — all findings resolved.** User decisions (2026-07-15): PF-001 → forward the live
envelope (Option A); PF-003 → last-writer-wins (documented); PF-002/PF-004/PF-005 → accepted the
recommended doc reconciliations. Amendments applied to `03-01`/`03-02`/`03-03`/`03-04`/`07`/`99` and
recorded as AR #18–#22 in `00-ambiguity-register.md`. The plan is ready for `exec_plan filtering`.
