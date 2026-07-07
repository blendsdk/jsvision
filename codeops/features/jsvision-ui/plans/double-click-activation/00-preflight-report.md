# Preflight Report: double-click-activation

> **Status**: ✅ PASSED — all 5 findings resolved & applied; Iteration 2 clean re-scan
> **Iteration**: 2 (re-scan after fixes — all applied 2026-07-07)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/double-click-activation/`
> **Codebase Grounded**: 11 source files examined, ~30 references verified
> **Last Updated**: 2026-07-07
> **Review independence**: not same-session, but same model family — the one TV-fidelity finding
> (PF-002) was cross-checked by an independent challenger reading `toutline.cpp` directly (standard-first).

### Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (`@jsvision/core`, `@jsvision/ui`, `@jsvision/files`, examples); yarn 1.x + Turborepo; vitest. Zero runtime deps.
**Architecture:** Turbo Vision-style retained widget tree + fine-grained signals over `@jsvision/core`. A single host-agnostic `EventLoop` owns a `RenderRoot`, coalescing one frame per `runTick`. Mouse/key input arrives via `host.onInput → loop.dispatch(event)`; a 3-phase `route()` enriches one envelope (`ev2`) and branches mouse/wheel to `hitTestRoute`.
**Key Files Examined:** `event-loop.ts`, `dispatch.ts`, `hit-test.ts`, `view/types.ts`, `input/events.ts` (core), `list-rows.ts`, `grid-rows.ts`, `tree-rows.ts`, `combo-box.ts`, `history.ts`, `file-list.ts`/`file-dialog.ts` (files), `editor-mouse.ts`, `input.ts`; TV `toutline.cpp`.

**Reference verification:** All cited `file:line` refs resolve. The envelope-spread propagation chain (dispatch.ts:183 `{...ev}` → hit-test.ts:157/192/208 `{...ev, local}`) is real and carries an upstream-stamped `clickCount` for free — the plan's central mechanism is sound. `packages/files` exists (merely absent from the stale CLAUDE.md structure list — not a plan defect). All consumers accounted for: `ListRows` is instantiated only by `ListView` (→ `ListBox`/`FileList`/`DirList` + combo/history popups); `GridRows` only by `DataGrid`; `TreeRows` by `Tree`. No hidden impact-blind consumer.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-001) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-002) | 🟠 |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-002) | 🟠 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-003) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001/002/004/005) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | ✅ resolved (PF-002 — Option A applied) |
| MINOR | 3 | ✅ resolved (PF-001/003/004 applied) |
| OBSERVATION | 1 | ✅ resolved (PF-005 applied) |

---

### PF-001: Integration snippet misdescribes `dispatch()` (queue vs direct route) 🟡 MINOR

**Dimension:** 13 (Stale Assumption) / 2
**Location:** `03-01-multiclick-primitive.md` §"Loop-owned state + computation" (the `this.route(envelope)` snippet) + `99-execution-plan.md` Notes ("the `dispatch(event)` … calls `this.route(...)` inside `runTick`").
**Codebase Evidence:** `event-loop.ts:121-125` — `dispatch()` computes nothing and `this.queue.push({ event, handled: false })`es a single envelope; `route()` runs later in the drain loop (`:264-267`). Line 123 wraps *every* `AppEvent` (keys/commands/mouse) identically — there is no per-type mouse wrap site. `DispatchEvent` fields are `readonly` (`view/types.ts`), so `clickCount` must be set at construction.
**The Problem:** The snippet models `this.route(envelope)` and the Notes assert `dispatch()` "calls `this.route()`". It does not — it enqueues. Functionally the two are equivalent here (queue empty at the host→loop entry, never re-entrant for input), so this is a **documentation-accuracy** defect at the load-bearing seam, not a runtime obstacle. Downgraded from MAJOR after an independent challenger confirmed equivalence.

**Recommendation:** Reword the 03-01 snippet + 99 Notes to stamp at the real enqueue site — narrow `event` to `type==='mouse' && kind==='down'`, compute `clickCount`, then `this.queue.push({ event, handled: false, clickCount })` — and drop the "calls this.route" phrasing. Only viable resolution; a code change is not implied.

**User Decision:** Resolved — recommendation applied. 03-01 snippet/prose + 99 wrap-site Notes now stamp at the `dispatch()` `this.queue.push` site; the `{ ...ev, local }` param note added.

---

### PF-002: Tree graph-zone double-click — false GATE-2 "✅ matches" certification 🟠 MAJOR

**Dimension:** 3 (Contradiction) / 7 (Testability) / 13 — touches the NON-NEGOTIABLE TV-fidelity directive
**Location:** `03-02-row-consumers.md` §"TreeRows" ("After" code) + §"GATE-2 AFTER-diff" (the `toutline.cpp:465-472 … Our after-shape matches ✅` claim); `07-testing-strategy.md` ST-7.
**Codebase Evidence:** TV `toutline.cpp:465-480` checks `meDoubleClick` **first, outside the zone test** — `if (eventFlags & meDoubleClick) selected(foc); else { if (mouse.x < strwidth(graph)) adjust(...) }`. A double-click in the **graph zone** therefore *activates* in TV and does **not** toggle. The plan's "After" is **zone-first**: `if (graph) toggle; else if (cc===2) activate;` — so a graph-zone double-click toggles twice (no `select`/emit) and never activates. The GATE-2 section nonetheless certifies a full match.
**The Problem:** Under the fidelity directive, a GATE-2 stamp that certifies a mis-decode is itself the defect. Two mitigations bound real-world impact: (1) the divergence is confined to graph-zone *double*-clicks (a rare gesture); (2) it is **pre-existing** — today's code already toggles-twice there. Crucially, the **two-event nuance forbids the naive fix**: our port receives two independent downs (cc1 then cc2), so the cc1 down already toggled before cc2 is known — a "double-first" reorder would produce *toggle-then-activate*, still unlike TV's *activate-with-no-toggle*. Reordering is wrong; honesty is the fix. ST-7 also never exercises graph-zone double-click, so no oracle guards the claim.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (recommended) | Keep the zone-first structure; **correct the GATE-2 record** to stop claiming "✅ matches" — document the graph-zone double-click as an explicit *accepted deviation* forced by the two-event decomposition (a single `meDoubleClick` cannot be reconstructed from two independent downs). Record it as a new AR-15 and, optionally, add an ST pinning the accepted behavior. | Honest decode; net fidelity still improves (text-zone non-TV emit removed); no wrong reorder | Graph-zone double ≠ TV activate (documented, accepted) |
| B | Reorder to `if (cc===2) activate; else if (graph) toggle;` | Text intuition of "double-first" | Produces toggle-then-activate (cc1 already toggled) — still not TV; adds a wrong-headed change |
| C | Leave the plan as-is | No edits | Ships a false GATE-2 certification against a non-negotiable directive |

**Recommendation:** Option A — the code change (dropping the non-TV text-zone single-click emit) is a genuine fidelity improvement and can stand; only the **certification and the record** must be corrected, with the graph-zone-double deviation named as an accepted AR rather than silently mis-stated. Confidence: High. Hardening: independent challenger read `toutline.cpp` directly and reversed the initial recommendation (A over the reorder B).

**User Decision:** Resolved — Option A applied. Added **AR-15** (register + 00-index Key decisions); corrected the 03-02 GATE-2 diff from "matches ✅" to a documented deviation + code comment; added the graph-zone-double ST-7 oracle; propagated to FR-5, the success criterion, and task 2.4.

---

### PF-003: TreeRows "Before" snippets omit `focusTo` and mislabel `select()` 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** `02-current-state.md` §"TreeRows.handleMouseDown" + `03-02-row-consumers.md` §"TreeRows Before"; the note "`this.select(index, ev)` is the activate path (focus + select + `ev.emit`)".
**Codebase Evidence:** `tree-rows.ts:251-264` — the real handler calls `this.focusTo(index)` *before* the `if/else`; the snippets drop it. And `select(index, ev)` (`:366-371`) sets `selected` + `onSelect` + emit only — it does **not** focus (that's the separate `focusTo`).
**The Problem:** Cosmetic imprecision. The plan hedges ("adjust names to the actual methods when implementing"), so it won't misdirect a careful implementer, but the "focus + select + emit" label for `select()` is inaccurate.

**Recommendation:** Tighten the snippets to include the pre-existing `focusTo(index)` and describe `select()` as "select + onSelect + emit" (focus handled by `focusTo`). Only viable fix.

**User Decision:** Resolved — applied to both the 02-current-state and 03-02 TreeRows snippets.

---

### PF-004: Kitchen-sink "containers" story named loosely 🟡 MINOR

**Dimension:** 13 (Convention — naming)
**Location:** `00-ambiguity-register.md` AR-11, `07-testing-strategy.md`, `99-execution-plan.md` task 3.1 — "the `containers` / `data-grid` / `tree` / file-dialog story blurbs".
**Codebase Evidence:** The concrete files are `stories/listview.story.ts` (id `containers/listview`), `data-grid.story.ts`, `tree.story.ts`, `file-dialog.story.ts`. There is no story literally named "containers".
**The Problem:** Minor executor friction — "containers" is the *category*, not a file. Naming the concrete files avoids a hunt.

**Recommendation:** Replace "containers" with `listview.story.ts` (and, if the ListBox blurb is also intended, name that story explicitly). Only viable fix.

**User Decision:** Resolved — concrete story filenames now named in AR-11, 07, and task 3.1.

---

### PF-005: hit-test spread citation uses `{...ev2}` where source reads `{...ev}` 🔵 OBSERVATION

**Dimension:** 13 (citation precision)
**Location:** `02-current-state.md` §"The universal seam" — "hit-test.ts then spreads … `{ ...ev2, local }` (the down-bubble `:192`…)".
**Codebase Evidence:** `hit-test.ts` uses the local param name `ev` throughout (`:157`, `:192`, `:208` all read `{ ...ev, local }`). The field still propagates because `route()` passes `ev2` *as* that `ev` argument (`dispatch.ts:197`).
**The Problem:** Purely a citation nit; the mechanism is correct.

**Recommendation:** Optional — note that `hit-test.ts`'s parameter is named `ev` (bound to the caller's `ev2`). No behavior impact.

**User Decision:** Resolved — corrected in 02-current-state, and the same `{ ...ev2, local }` nit tidied in AR-13 + the 99 Propagation note for consistency.

---

## Iteration 2 — re-scan verdict

All five findings applied and verified. Residual-string sweep clean: no `this.route(envelope)`, no `inner.x`, no "no mismatch expected"/"after-shape matches", no loose `containers` story ref, no `{ ...ev2, local }` outside this report. AR-15 threaded through the register, 00-index, 01-requirements, 03-02, 07, and 99. No regressions introduced (edits are documentation-only; the 14-task execution flow is unchanged — ST-7 gained one assertion, no new task). Fresh 13-dimension pass surfaced no new findings.

**✅ PREFLIGHT PASSED — all 5 findings resolved.** The plan is ready for `exec_plan`.

---

## Adversarial checklist (same-model-bias safeguard)

- **Central mechanism** (envelope field + spread propagation) independently traced through `dispatch.ts:183` and `hit-test.ts:157/192/208` — verified, not assumed.
- **TV fidelity claim** (the only external-standard finding) verified by an independent challenger reading `toutline.cpp:465-480` directly, not from memory — it reversed the draft recommendation, evidence the safeguard worked.
- **No invented findings** — the plan is strong (clean on 8 of 13 dimensions); the one MAJOR is a certification-accuracy defect, not a design flaw.
