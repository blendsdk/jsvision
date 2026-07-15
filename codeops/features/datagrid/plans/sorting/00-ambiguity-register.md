## Ambiguity Register: Sorting (datagrid/RD-05)

> **Status**: ✅ GATE PASSED — all 16 items resolved
> **Last Updated**: 2026-07-15 01:20
> **Source RD**: [RD-05](../../requirements/RD-05-sorting.md) · **Preflight**: [Iteration 2](../../requirements/00-preflight-report.md) (PF-011…PF-019)

Most rows below arrived **pre-analysed** by the RD-05 iteration-2 preflight (code-grounded, and the
load-bearing header decision was independently challenger-hardened — converged A > B > C). The user
made the four pivotal picks explicitly and bulk-accepted the recommended remainder on 2026-07-15.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical / Architecture | Rendering surface for the multi-column, `columnId`-keyed sort header (exposed `GridHeader` is single-index, monolithic `draw()`/`onEvent()`, no `super` seam — `grid-rows.ts:412,443`) | A: own it — a from-scratch `SortHeader` View + container `Signal<SortKey[]>`; B: subclass `GridHeader`; C: extend ui `SortState` to multi-key | **A** — own the header + model; ui engine sort path untouched/unused | ✅ Resolved |
| 2 | Data & state / Behavioral | String comparison rule for the one sort comparator; AC-5 says "case-insensitive", shipped `defaultCompare` uses `localeCompare` | A: single comparator, strings via memoized case-insensitive `Intl.Collator`, numbers/Dates/nulls from `defaultCompare`'s logic; B: reuse `defaultCompare` verbatim | **A** — case-insensitive collator (honours AC-5), one code path | ✅ Resolved |
| 3 | Behavioral / Edge | Cursor + selection anchor across a re-sort (index signals — `grid.ts:105`) | A: re-anchor by row-key; B: keep display index; C: reset to top | **A** — re-anchor by row-key | ✅ Resolved |
| 4 | Scope | Which RD-05 Should-Haves in this plan (compare / nulls / tri-state) | A: all three (AC-5/6/7 require them); B: Must-only, defer to Phase B | **A** — all three; RD-05 fully satisfied in one plan | ✅ Resolved |
| 5 | Behavioral | Header-click state machine (v1 Must) incl. clicks on already-sorted columns | Recommended machine (Resolution Notes) | Accepted recommendation — see AR-5 note | ✅ Resolved |
| 6 | Behavioral / Integration | What "cleared sort" (tri-state none / `clearSort()` / last key removed) does per source kind | Client: restore source order; push-down: `setSort([])` | Accepted recommendation | ✅ Resolved |
| 7 | Technical (correctness) | Where push-down fires (PF-012) | `source.setSort(keys)` from a dedicated effect guarded `if (source.setSort)`; pure `display` never calls it | Accepted recommendation | ✅ Resolved |
| 8 | Behavioral / Edge | Re-sort trigger — does a committed edit to a sorted column reorder immediately? | A: pure-derived re-sort on any data change (row may jump); B: snapshot order | **A** — pure-derived; snapshot ordering noted as a future refinement | ✅ Resolved |
| 9 | Edge / UX | Max sort keys + priority-digit rendering beyond 3 | No hard cap; single-digit 1-based position; ≥10 keys display-degenerate (sort still correct) | Accepted recommendation | ✅ Resolved |
| 10 | UX / Presentation | Header indicator geometry (arrow + digit cell budget) | Single-sorted: 1 cell (arrow); multi-sorted (≥2 keys): 2 cells (digit+arrow); title clips, indicator never truncated | Accepted recommendation | ✅ Resolved |
| 11 | Naming & terminology | Sort-model file/symbol placement + header class name | New `sort.ts` owns `SortDir`/`SortKey`/`sortRowsMulti`/comparator; `data-source.ts` imports `SortKey` from it (same barrel export); from-scratch header = `SortHeader` in `sort-header.ts` | Accepted recommendation | ✅ Resolved |
| 12 | Naming / Scope (mandated) | Kitchen-sink story id/content (CLAUDE.md gate + AC-8) | `sorting.story.ts` (datagrid category): multi-column value-aware sort + live `grid.sort()` echo; smoke-tested | Accepted recommendation | ✅ Resolved |
| 13 | Data model | `GridColumn` additions for the Should-Haves (follows AR #4) | Additive `compare?(a: V, b: V): number` + `nulls?: 'first' \| 'last'` (datagrid-only, no ui change) | Accepted recommendation | ✅ Resolved |
| 14 | Security | Unknown `columnId` handling (AC-9) | `sortBy`/header/`setSort` ignore a `columnId` absent from the column set — no throw, never forwarded to a query | Accepted recommendation | ✅ Resolved |
| 15 | Naming (tooling) | Project verify command that fills every Verify line | Detected from CLAUDE.md + every prior datagrid plan | `yarn verify` (confirmed — the documented, uniformly-used command) | ✅ Resolved |
| 16 | Integration / Feasibility (**surfaced during authoring**) | RD-05 Must-Have `Ctrl`+click multi-sort can't be detected: the core `MouseEvent` (`events.ts:25`) carries no `ctrl`/`shift`/`alt`; the decoder parses the bit but `buildEvent` (`mouse.ts:111`) discards it for clicks (ui `editor-mouse.ts:9` documents the same gap) | 1: expose mouse modifiers in core; 2: no core change — API-only multi-sort; 3: a modifier-free header gesture | **1** — expose `ctrl`/`alt`/`shift` on core `MouseEvent` (as **optional** fields — see note), populated by the decoder; folded into this plan as **Phase 1** (foundation prerequisite) | ✅ Resolved |
| 17 (runtime) | Testability / Consistency (**surfaced during Phase 1 execution**) | The decoder now always emits `ctrl`/`alt`/`shift` on a `MouseEvent` (the plan assumed only *compilation* compat with the ~109 `type:'mouse'` literals). This broke 8 golden records in the `input-corpus` spec fixture `mouse.json`, which asserts decoder output with `toStrictEqual` and predates mouse modifiers | A: update `mouse.json` to add the flags (mirroring `wheel.json`, which already spells out `shift/alt/ctrl: false`); B: conditionally omit the flags when false so the fixture stays untouched | **A** — update the 8 `mouse.json` records (all plain → all `false`) to match the extended contract and the established `wheel.json` convention; B rejected (diverges from the plan's always-emit code and makes `MouseEvent`'s shape inconsistent with `WheelEvent`) | ✅ Resolved |

### Resolution Notes

**AR-1:** The RD (per PF-011) deliberately left the rendering surface to the plan. Recon confirms the
exposed `GridHeader.draw()`/`onEvent()` are monolithic and single-key with no `super` seam; its
`SortState` is a column **index**, while the datagrid model is `columnId`-keyed `SortKey[]`. Option A
matches the shipped `EditableGridRows.draw` self-contained-override precedent, reuses the shared
`apportionColumns`/`alignCell`/`stringWidth` geometry, inherits no dead `SortState`, and lets a later
frozen-panel split (RD-07) bind multiple headers to the one container signal.
**Confidence: High** — direct code evidence; the only thing that would change it is lifting AR-1 (no ui
source change), which would make C viable. **Challenger: converged (preflight iteration 2).**

**AR-2:** The practical gap between A and B is only the exact-case tiebreak; A honours the written AC-5
and still yields a single comparator (PF-014's goal). Confidence Med — AC text vs. a negligible
real-world difference; chosen to honour the explicit AC.

**AR-3:** Re-anchor by `rowKey` (already on hand in the body). The record under the cursor before a
re-sort stays under the cursor after it; same for the selected row.

**AR-4:** All three Should-Haves ship here — AC-5 (compare override), AC-6 (tri-state), AC-7 (nulls) are
part of "RD-05 done", and all three are cheap under AR-1's owned comparator.

**AR-5:** Recommended machine (v1 Must, before tri-state): plain-click an unsorted/secondary column ⇒
sort becomes `[{col,'asc'}]`; plain-click the *sole* sorted column ⇒ toggle its dir asc↔desc (v1
two-state, per PF-019); Ctrl-click an unsorted column ⇒ append `{col,'asc'}`; Ctrl-click a column
already a key ⇒ toggle that key's dir, keeping its priority. When AR #4=A, tri-state inserts a "none"
step into each cycle (asc → desc → none).

**AR-6 / AR-7:** Both paths sit behind one `applySort(keys)` seam (RD §Push-down). Client path stays a
pure derived `display = sortRowsMulti(materialize(source), keys(), map)`; the push-down effect is
separate and guarded (`if (source.setSort)`), so a source with `setSort` never also sorts client-side.
Cleared sort ⇒ client restores `materialize(source)` order; push-down calls `setSort([])`.

**AR-8:** The reactive derived model re-sorts whenever `version`/`keys` change, so a committed edit to a
sorted-column cell reorders that row immediately (it may jump). Snapshot ("committed order") sorting is
a larger design left as a future refinement.

**AR-9 / AR-10:** Presentation defaults, low semantic stakes. No cap on the number of keys; the priority
digit is the 1-based position (`1`–`9`), ≥10 being display-degenerate while the sort stays correct. A
single-sorted column reserves one header content cell (arrow only, matching the shipped header); a
column participating in a multi-key sort (≥2 keys) reserves two (priority digit + arrow). The title
clips to the remaining width; the indicator is never truncated away.

**AR-11 / AR-12 / AR-13 / AR-14:** Naming, the mandated story, the additive column fields, and the
security rule — all determined-with-recommendation and accepted.

**AR-15:** The verify command is `yarn verify` (CLAUDE.md §Commands; every prior datagrid plan uses it).
Not genuinely ambiguous — recorded per the template's confirm-the-verify-command step.

**AR-16 (surfaced during authoring — blocks resuming Phase 2):** The decoded `MouseEvent`
(`packages/core/src/engine/input/events.ts:25`) is `{ type, kind, button, x, y }` — no modifier flags;
only `WheelEvent` carries `ctrl`/`alt`/`shift`. `mouse.ts:buildEvent` (`mouse.ts:86-111`) *parses* the
button-byte `CTRL_BIT` (used by the wheel branch, `mouse.ts:95`) but drops it for a click. ui's editor
records the same gap (`editor-mouse.ts:9`). No mouse-modifier consumer exists anywhere, and terminals
don't report a bare Ctrl press, so there is no held-modifier state to track. Therefore RD-05's Must-Have
`Ctrl`+click multi-sort is **not achievable** without exposing the modifier on core's `MouseEvent`.

Options:
- **Option 1 — expose mouse modifiers in core.** Add `ctrl`/`alt`/`shift: boolean` to `MouseEvent` and
  populate from the button byte in `buildEvent` (~5 additive, backward-compatible lines; the bits are
  already parsed). Correct home; also fixes the editor's documented Shift-click gap. **Cost:** the first
  datagrid-driven change to the published zero-dep `@jsvision/core` (core tests + lockstep version) —
  best sequenced as a **standalone foundation task** this sorting plan depends on, not baked in. Caveat:
  some terminals intercept Ctrl+click (link-open), so Shift or Alt may be the more reliable modifier.
- **Option 2 — no core change.** Ship single-column sort via plain click + the full `sortBy`/`addSort`/
  `clearSort`/`sort` API (keyboard/programmatic multi-sort works; the header still *renders* multi-key
  indicators whenever the model holds ≥2 keys). Defer only the **`Ctrl`+click gesture** until core grows
  modifiers. Keeps datagrid strictly additive; re-scopes one Must-Have interaction to "API-only for now."
- **Option 3 — a modifier-free header gesture** (e.g. click the priority-digit zone to add a key).
  Avoids the core change but invents an interaction RD-05 didn't specify (discoverability/UX cost).

**Recommendation:** Option 1, sequenced as its own small foundation task (with a spec test) that this
plan depends on — it's the only path that delivers the Must-Have as written and it fixes a real
pre-existing gap; Option 2 is the clean fallback if datagrid must stay additive-only.
**Confidence: High** on the technical facts (code-proven); the decision itself is your product call
(RD-fidelity vs. touching the foundation). **Challenger:** not spawned — the options are code-proven and
the choice is a scope/product judgment, not a technical unknown.

**User decision (2026-07-15): Option 1.** Sub-decision (required vs optional fields) is forced by the
blast radius: **109 sites** construct `type: 'mouse'` literals (≈85 test files across core/ui/files/
examples). **Required** fields would break every one under `strict`, churning immutable spec-test
oracles across packages — so the new fields are **optional** (`ctrl?`/`alt?`/`shift?`): the decoder
always populates them, existing literals keep compiling, and a consumer reading `inner.ctrl` on a
synthetic (unset) event correctly sees a plain click. This is the one reasonable interpretation given
the measurement, so it is recorded here rather than re-gated. The core change (2 files + 1 decoder spec
test) is **Phase 1** of this plan (a general input-layer capability, not sort-specific; warrants a core
CHANGELOG line as a minor additive API addition). It also closes ui's documented Shift-click gap for a
future consumer, though this plan wires only the datagrid's use.
