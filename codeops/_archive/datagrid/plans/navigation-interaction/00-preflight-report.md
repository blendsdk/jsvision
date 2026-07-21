# Preflight Report: Navigation & Interaction (datagrid/RD-10)

> **Status**: ✅ PASSED — all 7 findings resolved (0 critical, 4 major, 2 minor, 1 observation); fixes applied to the plan docs 2026-07-17
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/navigation-interaction/`
> **Codebase Grounded**: 12 source files examined, ~55 file:line references verified
> **Last Updated**: 2026-07-17

> ⚠️ **SAME-SESSION / SAME-AGENT REVIEW** — the Ambiguity Register (line 15-16) flags that this plan
> was authored in the same broader session by the same model. Same-agent bias risk is elevated; a
> human review of the four MAJOR findings is recommended before execution. To counter the bias, the
> MAJOR batch was pressure-tested by one independent challenger agent that re-verified each against
> the code (all four confirmed REAL).

## Codebase Context Summary

**Repository:** jsvision (yarn 1.x + Turborepo monorepo; ESM-only; zero runtime deps)
**Tech Stack:** TypeScript (strict, NodeNext), vitest (unit/e2e), `@jsvision/{core,ui,datagrid}`
**Architecture:** `@jsvision/datagrid` builds on `@jsvision/ui`'s `GridRows` engine. The editable body
(`EditableGridRows extends GridRows`) intercepts keys before `super.onEvent`; the container
(`EditableDataGrid extends Group`, no `onEvent`) owns the `focused`/`focusedCol` cursor signals and
threads them into one or more body panels (`grid-panels.ts`). Editing runs through a view-agnostic
`EditController` (`editing.ts`) driven by an `EditHost` seam. The event loop synthesizes
`ev.clickCount` (500 ms, injectable clock) and swallows an unbound `Tab` for focus traversal before
any view (`dispatch.ts`).

**Key Files Examined:** `editable-grid-rows.ts` (771), `grid.ts` (1206), `editing.ts` (319),
`grid-panels.ts` (591), `ui/table/grid-rows.ts` (462), `ui/event/dispatch.ts` (221),
`ui/event/event-loop.ts` (623), `ui/event/default-keymap.ts`, `ui/editor/keymap.ts` (233),
`core/engine/input/keymap.ts`, datagrid `index.ts`, the showcase placeholders + smoke test.

**Reference verification:** The plan's `02-current-state.md` is exceptionally well grounded — **every**
`file:line` claim in it (the four body handlers at :322/:366/:421/:444/:499, the base helpers at
:155/:165/:246/:252/:262/:272-301, `editing.ts` commit at :277/:309/:317, `dispatch.ts` :124/:134,
`event-loop.ts` :32/:123/:187/:190, `clickCount` at `view/types.ts:130`, `SortHeader` at :391,
`grid.ts` :52/:209/:245/:246) resolves **exactly** to the current code. The findings below are not
line-number drift; they are behavioral/architectural gaps that survived the plan's own recon.

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 4 | ✅ all resolved (fixes applied) |
| 🟡 MINOR | 2 | ✅ all resolved (fixes applied) |
| 🔵 OBSERVATION | 1 | ✅ resolved (documented) |

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 4 | Completeness Gaps | PF-001, PF-002, PF-003 | 🟠 |
| 6 | Feasibility | PF-003, PF-004 | 🟠 |
| 8 | Security Blind Spots | PF-002 | 🟠 |
| 9 | Edge Cases | PF-006 | 🟡 |
| 12 | Consistency | PF-005, PF-007 | 🟡 |
| 13 | Codebase Alignment | PF-001, PF-003, PF-004, PF-005 | 🟠 |

---

### PF-001: AC-4 unmet — a single click doesn't focus the clicked **column** in a single-body grid 🟠 MAJOR

**Dimension:** 13 (Stale Assumption) + 4 (Completeness)
**Location:** `01-requirements.md` A4 ("A click focuses that cell + its row … (inherited RD-07/08)"); coverage map (07 §Coverage, `AC-4 → ST-20 (+ inherited)`); `03-04` treats only double-click column-setting.
**Codebase Evidence:** `grid-panels.ts:225` (`frozen = left>0 || right>0`) → false for a single body; `grid-panels.ts:328` passes `mouseColumns: frozen` (the only value ever passed); `editable-grid-rows.ts:348` runs `setColFromClick` **only** `if (this.mouseColumns)`; `setColFromClick` (:429-438) is the sole click-driven `focusedCol.set`; base `grid-rows.ts:252-266` mouse-down does `focusTo(row)+select` only. Challenger-confirmed: **no** path sets `focusedCol` from a plain click in single-body mode.
**The Problem:** RD-10 AC-4 requires clicking a cell to focus *that cell and its row*. In the common single-body grid, a single click moves only the **row** cursor; the **column** cursor stays put. So click column 3 → press F2 edits whatever column the cursor was already on, not column 3. The plan asserts AC-4 is already satisfied ("inherited"), but it is only satisfied for **frozen** grids (where `mouseColumns=true`). The double-click path adds `setColFromClickAlways`, which tacitly acknowledges single-body clicks don't set the column — yet single-click is left unfixed.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Set the column on every single-body click too — pass `mouseColumns: true` for the center/only body (or drop the `if (this.mouseColumns)` guard so `setColFromClick` always runs). Reuse the same geometry the double-click path uses. | Actually satisfies AC-4; makes click→F2 land on the clicked cell; tiny change; the frozen band stays passive (`focusable=false`) | Changes current single-body click behavior (a click now moves the column cursor) — must be in the ST-13 regression matrix as an *intended* change, not "byte-identical" |
| B | Explicitly scope AC-4 as **row-only** for single-body mode; document that the column cursor is unchanged by a plain click; keep double-click-sets-column as the only column-from-click gesture | No behavior change; smallest surface | AC-4 remains literally unmet; surprising UX (click a cell, edit a different column); pushes the gap to a future RD |

**Recommendation:** **Option A.** It is the only option that actually meets AC-4, the fix is a one-line wiring change, and the double-click path already computes the clicked column — leaving single-click inconsistent is a UX footgun. Note in the regression spec (ST-13) that single-body single-click **now** moves the column cursor (an intended delta, so the "byte-identical" invariant is scoped to keyboard gestures + frozen mouse behavior). *Confidence: High. Hardening: challenger-confirmed REAL; no counter-path exists.*

**User Decision:** Resolved — User accepted the recommendation (2026-07-17); fix applied to the plan documents.

---

### PF-002: A malformed caller chord **throws**, violating AC-8 ("never thrown") — and no test guards it 🟠 MAJOR

**Dimension:** 8 (Security) + 4 (Completeness) + 7 (Testability)
**Location:** `03-01-keymap-model.md` (`mergeKeymap` "validates each caller entry against a Set of GridAction literals; unknown → devWarn + skip"; `resolveGridAction` "reuse core's chord canonicalization — createKeymap … do not hand-roll the grammar"); `07 §A` ST-4/ST-5; `01-requirements.md` #6; AR-14.
**Codebase Evidence:** `core/engine/input/keymap.ts`: `createKeymap` (:50) calls `parseChord` (:53) per binding; `parseChord` (:63-87) **throws** on an unknown modifier (:80) or unknown key (:72) — e.g. `'ktrl+e'` or `'ctrl+notarealkey'`. `parseChord`/`canonicalize` are **private** (only `createKeymap` + the `Keymap` interface are exported), so the sole public canonicalizer throws, and there is no exported single-chord validator.
**The Problem:** `mergeKeymap` validates only the **action** (the value). The **chord** (the key) is only ever canonicalized by `createKeymap`, which throws on malformed grammar and aborts the *entire* map on the first bad entry — so one typo'd caller chord (`'ctl+e'`, a stray key name, trailing space) throws at grid construction. AC-8 states unknown/malformed keymap chords are *ignored, never thrown*. ST-4 tests a **valid-but-unmapped** chord (`ctrl+j`); ST-5 tests an **unknown action** — neither exercises a **malformed chord**, so the guarantee is both unimplemented and untested.

**Options:** (single viable path — presented alone)

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | In `mergeKeymap`, validate each caller chord by building it through `createKeymap` inside a per-entry `try/catch`; on throw → `devWarn` + skip that entry (mirroring the unknown-action path). Compile the surviving merged map **once** into a core `Keymap` and have the body hold that compiled lookup (rather than re-`createKeymap` on every keystroke). Add a spec: a malformed chord is ignored, no throw. | Honors "reuse core, don't hand-roll"; makes AC-8 true; fixes the per-keystroke recompile the current `resolveGridAction(ev, Record)` signature implies; closes the test gap | Slightly more validation code in `mergeKeymap` |

*Rejected:* hand-rolling chord canonicalization (the plan explicitly forbids it, and it would duplicate core's grammar). Rejected: leaving it — AC-8 is an explicit acceptance criterion.

**Recommendation:** **Option A** — the only path that satisfies AC-8 without hand-rolling. It also resolves an implicit efficiency wart: `resolveGridAction(ev, keymap: Keymap)` takes the *Record*, implying a `createKeymap` rebuild per keystroke; compiling once is cleaner and gives the natural place to catch malformed chords. Add ST-5b (malformed chord → skipped + `devWarn`, no throw). *Confidence: High. Hardening: challenger-confirmed `parseChord` throws + is private.*

**User Decision:** Resolved — User accepted the recommendation (2026-07-17); fix applied to the plan documents.

---

### PF-003: `Tab`-commit-then-advance **loses keyboard focus** — the command path has no envelope to refocus the body 🟠 MAJOR

**Dimension:** 4 (Completeness) + 6 (Feasibility) + 13
**Location:** `03-03-tab-traversal.md` (`grid.nextCell()` "Commit an open edit first … await commitEdit()"; the `commitEdit` seam "reusing the existing private commit() await-close path"); AR-7.
**Codebase Evidence:** The existing commit refocuses the body **only** via `ev2.focusView?.(host.body)` using the Enter envelope (`editing.ts:310`; cancel at :274). `Tab` is swallowed at `dispatch.ts:124-130` (chord→`emitCommand`, returns before any view). A loop-registered command handler is invoked envelope-free (`event-loop.ts` command-sink path; `register` wraps zero-arg handlers). `grid.ts` holds **no** persistent `loop`/`focusView` handle — every grid refocus goes through a live `ev.focusView?.()` (`grid.ts:969`, :1009). Challenger traced the auto-recovery path and it **fails**: `Group.remove` → `host.healFocus(group)` → `focus.focusInto(overlay)`, but the emptied `EditorOverlay` is `visible=false` → not focusable → `focusInto` is a **no-op**; `getFocused()` then stops at the empty hidden overlay, and `grid.rows` (a sibling of the overlay) is never in the key-routing ancestor chain.
**The Problem:** When `Tab` commits an open editor, the editor overlay is disposed and **nothing refocuses `grid.rows`**. The loop does not auto-recover to the body. Subsequent keystrokes have no valid focused leaf on the grid — the grid goes dead after a Tab-commit-advance. The plan's "reuse the existing commit() path" is exactly what breaks: that path's focus-restore depends on an event envelope that the loop-keymap→command→sink wiring (the AR-2 design) doesn't have.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Give the grid an envelope-independent refocus seam: after `commitEdit` closes the editor, `grid.nextCell()`/`installGridNavigation` explicitly `focusView(this.rows)`. Store the loop's `focusView` (captured at `beginEdit`, or handed to `installGridNavigation`) so the command path can call it. | Directly fixes the dead-grid; localized to the new nav code | Adds a stored focus seam / a `focusView` reference the grid didn't need before |
| B | Route `grid.nextCell`/`prevCell` through the **grid container's `onEvent` command phase** instead of a loop-registered sink handler. During editing the grid container *is* an ancestor of the editor, so the command arrives with `ev2.focusView`, and the grid calls `ev.focusView(this.rows)` after commit. | Reuses the existing envelope mechanism; no stored seam | Requires the grid container to be `focusable`/in the focus chain and to opt into command handling — a bigger design shift than AR-2 assumed; re-opens AR-2 |

**Recommendation:** **Option A** — smallest change consistent with the AR-2 "app opts in via a loop-registered handler" decision. `installGridNavigation` already holds the `loop`, so it can `loop.focusView(grid.rows)` after a `'moved'` result (and the existing `loop.focusNext()` covers `'exit'`). Add a spec: after a Tab-commit-advance, `grid.rows` holds focus and the next arrow key moves the cursor. *Confidence: High. Hardening: challenger disproved the auto-recovery refutation with the `healFocus`→invisible-overlay trace.*

**User Decision:** Resolved — User accepted the recommendation (2026-07-17); fix applied to the plan documents.

---

### PF-004: `grid.ts < 1250` invariant is at high risk — the additions likely breach a **gated** line-count guard 🟠 MAJOR

**Dimension:** 6 (Feasibility) + 13 (Scope vs Reality)
**Location:** `00-index.md` / `02 §6` / AR-8 / `01-requirements.md` invariant / `99-execution-plan.md` success #6 + tasks 3.3.1, 5.3.2 ("grid.ts < 1250").
**Codebase Evidence:** `grid.ts` is **1206** lines. The guard is a **real, gated** assertion in two impl tests (run under `yarn verify`): `grid-footer.impl.test.ts:67-68` and `grid-selection.impl.test.ts:183-184`, both `expect(lineCount).toBeLessThan(1250)` → max passing **1249** → **43** usable lines. Existing thin delegators with `@example` cost ~14-18 lines each (`insertRow` :1155-1172 ≈18, `deleteRows` ≈14, `duplicateRow` ≈17). The plan adds to grid.ts: the `keymap` option (interface + JSDoc + constructor wiring ≈8-15), and **three** public `@example`-bearing methods `nextCell`/`prevCell`/`isBodyFocused` (≈45-55; plan commits to `@example` on each — 03-03 verification hooks + tasks 5.2.1/5.3.1), plus private `totalVisibleCols`/`displayLen` (≈8-16). Realistic total **≈60-85 lines** (lean ≈55) against 43 headroom → **breach LIKELY**.
**The Problem:** The plan states as an invariant that grid.ts stays `< 1250`, but the only place the new public methods can live is the exported `EditableDataGrid` class (they touch the private `focused`/`focusedCol` signals). With `@example` on each — which the plan itself mandates — the additions almost certainly cross 1249, failing `yarn verify`. The plan does **not** list the two guard-test files among its "Modified" files, so a re-base isn't currently planned.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Re-base the guard to a new documented ceiling (e.g. `< 1300`) in **both** `grid-footer.impl.test.ts` and `grid-selection.impl.test.ts`, with the RD-09 precedent rationale ("nav delegators + keymap option are legitimately new surface, never re-inlined logic"). Add both files to the plan's Modified list. | Honest about the real cost; follows the established 1200→1250 re-base precedent; keeps the delegators readable with full `@example`s | Raises the ceiling — must guard against it becoming a dumping ground (the tests already assert "thin delegator, no inlined logic") |
| B | Hold `< 1250` by trimming: make `totalVisibleCols`/`displayLen` private one-liners, share one `@example` across `nextCell`/`prevCell`, and land the `keymap` option's prose in the type doc, not grid.ts. | Preserves the stated invariant | Fragile (needs to claw back ~15-40 lines); risks thin/omitted `@example`s that `check-jsdoc` or the doc standard then flags |

**Recommendation:** **Option A.** The 1200→1250 re-base already happened once for the footer surface with exactly this rationale; RD-10's nav delegators + keymap option are the same kind of genuinely-new public surface. Committing to `< 1250` while adding three `@example` methods invites either a verify failure or under-documented methods. Re-base to `< 1300` in both guard tests (add them to the file list), and keep the "thin delegator / no inlined logic" assertions that already accompany the guard. *Confidence: High. Hardening: challenger confirmed both guards are active and the cost estimate; corrected headroom 44→43.*

**User Decision:** Resolved — User accepted the recommendation (2026-07-17); fix applied to the plan documents.

---

### PF-005: The exported type name `Keymap` collides with `@jsvision/ui`/`@jsvision/core`'s `Keymap` 🟡 MINOR

**Dimension:** 12 (Consistency) + 13 (Convention Violation)
**Location:** `03-01-keymap-model.md` (`export type Keymap = Record<string, GridAction>`); `99-execution-plan.md` task 5.2.1 (barrel-export `Keymap`); `00-index.md` Related Files.
**Codebase Evidence:** `@jsvision/core` exports `interface Keymap` (the compiled lookup, `core/engine/input/keymap.ts:19`) and `@jsvision/ui` re-exports it (`ui/src/index.ts:21`: `export type { … Keymap } from '@jsvision/core'`). The datagrid barrel would export a **different** `Keymap` (a `Record<string, GridAction>`).
**The Problem:** A consumer importing `Keymap` from `@jsvision/datagrid` gets the Record; from `@jsvision/ui` gets the compiled interface — same name, different concepts, in packages routinely used together. Inside datagrid's own `keymap.ts`/`navigation.ts`, code that needs core's `Keymap` (e.g. the compiled lookup, `createKeymap`'s return, the `gridKeymap` fragment) must alias to avoid shadowing the local `Keymap`. RD-10's source used the bare name `Keymap`, but that predates core/ui already publishing `Keymap`.
**Options:** single viable path.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Rename the datagrid type to **`GridKeymap`** (parallels `GridAction`, `gridKeymap`); update `resolveGridAction`/`mergeKeymap` signatures, the `keymap` option's type, the barrel, and the ST/story references. | Removes the collision; self-describing; consistent with `GridAction` | A rename across the new files + the RD's proposed name |

**Recommendation:** **Option A** — rename to `GridKeymap`. The collision is avoidable and `GridKeymap` reads better beside `GridAction`. *Confidence: High.*

**User Decision:** Resolved — User accepted the recommendation (2026-07-17); fix applied to the plan documents.

---

### PF-006: The `runAction` routing table omits the per-panel `localCol() < 0` guard — frozen-panel double-fire risk 🟡 MINOR

**Dimension:** 9 (Edge Cases) + 4 (Completeness)
**Location:** `03-02-body-dispatch.md` (`runAction` routing table + "Frozen-panel note").
**Codebase Evidence:** Today, `handleSelectionKey` short-circuits with `if (this.localCol() < 0) return false` (`editable-grid-rows.ts:370`) and `tryBeginEdit` with `if (c < 0) return false` (:446-447), so a panel that doesn't own the global cursor does **not** act on edit/selection keys. Note `currentCell()` clamps `Math.max(0, this.localCol())` (:472) → without the guard, a non-owning panel's `beginEdit` would edit *its own* column 0.
**The Problem:** The `runAction` table specifies routing per `GridAction` but does not restate the `localCol() < 0` (and `rowFloor`) guards that gate edit/selection actions today. In a **frozen-panel** grid every panel shares one merged keymap and each runs `runAction`; if the refactor drops the guard, `beginEdit`/`valueHelp`/`toggleSelect`/`extendUp/Down` could fire in a non-owning panel — a double-fire (two `onRangeToRow`/`onToggleRow`) or an edit of the wrong panel's column 0.
**Options:** single viable path.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | State explicitly in 03-02 that `runAction` preserves the `localCol() < 0` (and `focused() < rowFloor`) short-circuit for the edit/selection/value-help actions, and add a frozen-panel impl assertion (extend task 2.3.1) that a non-owning panel no-ops on those actions. | Prevents a concrete multi-panel regression; makes the invariant explicit for the implementer | None beyond a doc line + one assertion |

**Recommendation:** **Option A** — make the guard explicit in the routing spec and assert it. The plan already commits to preserving frozen-panel behavior and to a frozen-panel impl test (2.3.1); this just names the specific guard so it isn't dropped in the rewrite. *Confidence: Med-High (grounded in the current guards; the plan's "preserve exact behavior" intent likely covers it, but the design table omits it).*

**User Decision:** Resolved — User accepted the recommendation (2026-07-17); fix applied to the plan documents.

---

### PF-007: `nextCell()` returns `'moved'` on a **vetoed** commit (cursor did not move) — misleading return 🔵 OBSERVATION

**Dimension:** 12 (Consistency) + 1 (Ambiguity)
**Location:** `03-03-tab-traversal.md` (`nextCell()`: "a vetoed commit keeps the editor open and does not advance … return 'moved'").
**The Problem:** The `'moved' | 'exit'` return exists so `installGridNavigation` decides whether to hand off focus, but returning `'moved'` when the cursor did **not** move (a vetoed commit leaves the editor open in place) is misleading for a *programmatic* caller (`grid.nextCell()` is a public, barrel-exported API per the Quick Reference). A caller inspecting the result to learn whether the cursor advanced is misinformed.
**Recommendation:** Keep the internal focus-handoff semantics, but either (a) rename the "stay" result (e.g. `'blocked'`) and treat both `'moved'` and `'blocked'` as "don't hand off focus" in `installGridNavigation`, or (b) keep `'moved'` and make the JSDoc `@example` explicitly call out that a vetoed edit returns `'moved'` without advancing. Low stakes — presentation/documentation choice. *Confidence: Med.*

**User Decision:** Resolved — User accepted the recommendation (2026-07-17); fix applied to the plan documents.

---

## Notes (non-findings)

- **Spec-oracle re-basing (ST-6/ST-7) is legitimate.** The plan re-bases the showcase smoke oracles
  (`datagrid-showcase.smoke.spec.test.ts`: roadmap count `5→4`, add a `Navigation & interaction`
  category count). These are `*.spec.test.ts` oracles, but they encode a *roadmap state* that
  intentionally changes when RD-10 ships — exactly the sanctioned "the requirement changed" update,
  with direct precedent (RD-07/08/09 replaced their placeholders the same way; see the file's own
  comment). Not a spec-immutability violation. The plan is transparent about it (task 5.2.4, ST-27).
- **Divergences from the RD are all AR-covered:** the 400 ms→500 ms double-click threshold (AR-3),
  adding `openFilter` to the union (AR-15), and doing both a kitchen-sink story and a showcase cluster
  (AR-16). All user- or grounded-decided; not re-litigated here.
- **Line-number accuracy of `02-current-state.md` is excellent** — every cited seam verified exactly.
