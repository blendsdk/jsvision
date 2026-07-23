# Preflight Report — Columns & Layout

> **Document**: 00-preflight-report.md
> **Parent**: [Index](00-index.md)
> **Artifact**: `codeops/features/datagrid/plans/columns-layout/` (implementation plan, 11 docs)
> **Scanned**: 2026-07-15 · git `1770133c`
> **CodeOps Skills Version**: 3.7.0

## ✅ PREFLIGHT PASSED — all 10 findings resolved

⚠️ **SAME-SESSION REVIEW** — the plan was authored in this session. To counteract same-agent bias,
an **independent challenger agent** verified the seven load-bearing technical claims against the
actual source; every MAJOR is backed by primary-source `file:line` evidence from that independent
pass. Consider a fresh-session re-read for full independence.

## Codebase Context Summary

Recon was completed earlier this session (the full seam map in `02-current-state.md`): the column
geometry engine (`packages/ui/src/table/columns.ts`), the pointer-capture seam
(`event-loop.ts:458`, `hit-test.ts:144`, exposed on `DispatchEvent`), the sticky `SortHeader`, the
`indent` H-scroll signal, the reactive `signal`/`computed` primitives, and hazards H1–H7. The 13
dimensions were scanned against this grounding; document-only dimensions by the lead, code-grounded
claims by the independent challenger.

## Load-bearing feasibility — all CONFIRMED by the independent challenger

| Claim | Verdict | Evidence |
| ----- | ------- | -------- |
| Capture on the non-focusable `SortHeader` works | ✅ CONFIRMED | `hit-test.ts:144-148` short-circuits to `captureTarget` with no focus gate; only guard is `mounted` (`event-loop.ts:495`) |
| Geometry over a column subset is pure | ✅ CONFIRMED | `apportionColumns` (`columns.ts:118`) has no global-column-set dependency |
| Per-panel `EditController` + per-body overlay origin | ✅ CONFIRMED | `editing.ts:194` uses `absoluteRect(host.body)`; controller is per-instance (`editable-grid-rows.ts:118`) |
| Reorder/resize hit-zone classification | ✅ CONFIRMED | `sort-header.ts:189` sees mouse-down with a classifiable `ev.local` |
| Shared vertical scroll via identical heights | ✅ CONFIRMED (invariant) | `keepVisible` is deterministic; lockstep holds while height/focused/range/seed match — guard retained (PF-008) |

## Findings & resolutions

### 🟠 MAJOR

**PF-001 — Density `gap=0` had no "no-ui-change" path as written.** *(challenger REFUTED)* The divider
reservation is hardcoded at `columns.ts:126` (`- numCols`) and `:157` (`+ 1`), not routed through
`solveTrack`'s `gap` (a different mechanism). Forwarding `gap` cannot zero it.
→ **Resolved (user-decided, AR-17):** compact mode adds an **additive optional divider param** to
`apportionColumns` (gates both spots; existing callers byte-identical when omitted) — the plan's one
honest ui touch. Updated `03-05`, `00-index`, `99` (task 6.2.2 + success criterion #3), register
(AR-12 amended, AR-17 added). Inline-reimplementation alternative rejected (drift risk).

**PF-002 — Filter-popup anchoring breaks with per-panel headers.** *(challenger finding A — missed by
the lead scan)* `onFunnelClick(columnId, anchor, ev)` carries no header (`sort-header.ts:51`); the
container anchors to one retained `this.header` (`grid.ts:542`). Three panel headers → cannot resolve
which `absoluteRect`.
→ **Resolved:** `03-04` now specifies extending `onFunnelClick` to carry the clicked header (or its
origin); `99` task 3.2.3 updated.

**PF-003 — `columnOrder()`/`setColumnOrder` full-vs-visible contract ambiguous.**
→ **Resolved (user-decided, AR-18):** `columnOrder()` returns the **visible** order; `setColumnOrder`
permutes the **visible** ids, splicing them into the full order with hidden columns keeping their
anchor slots. Updated `03-04` (signal comment + API + a contract paragraph), register (AR-18).

### 🟡 MINOR

**PF-004 — Cross-panel keyboard routing under-specified.** → **Resolved:** `03-02` "Where the keys
live" now pins the focused-panel → global-`focusedCol` → container re-focus-hop mechanism.

**PF-005 — Cross-panel mouse-click cursor coordination unspecified.** → **Resolved:** `03-02` adds a
mouse-click section (clicked panel maps local→global col, sets shared `focusedCol`, re-focus hop).

**PF-006 — Edge cases undefined (all-frozen empty center; hide-all empty grid).** → **Resolved:**
`03-02` "Edge cases" — empty center allowed on explicit all-freeze; hide-all → `<empty>` placeholder.

**PF-007 — Live drag is capability-gated, unmentioned.** → **Resolved:** `03-03` adds a
terminal-capability note (`modes.ts:47`; degrades to apply-on-release without `caps.mouse.drag`;
web/tests unaffected).

### 🔵 OBSERVATION

**PF-008 — `topItem` lockstep is an invariant, not inherent.** → **Resolved:** `03-02` marks the
lockstep impl test load-bearing; `99` task 3.3.1 flags it as the required guard.

**PF-009 — Double-click hedge unnecessary (`ev.clickCount` is live).** → **Resolved:** `03-03` uses
`ev.clickCount === 2` (`view/types.ts:130`), hedge removed.

**PF-010 — Phase 3 must keep the single-body path byte-identical.** → **Resolved:** `99` Phase 3
deliverables add the byte-identical acceptance (default the new `EditableGridRows`/`SortHeader`
seams).

## Adversarial checklist (same-session safeguard)

- Behavior bound to an external standard? None (this is an internal TUI framework).
- Every MAJOR verified against primary source by an independent agent? Yes.
- Any finding invented to justify the review? No — the load-bearing claims genuinely CONFIRMED; the
  three MAJORs are real (one refuted design path, one missed gap, one contract ambiguity).

## Verdict

**✅ PASSED** — 3 MAJOR + 4 MINOR + 3 OBSERVATION, all 10 resolved (user-decided on PF-001/PF-003;
recommended fixes applied on the rest). No CRITICAL — the highest-risk claim (capture on a
non-focusable header) CONFIRMED, so the architecture holds. Cleared for `exec_plan`.
