# Preflight Report: reactive-owned-computeds (Task T-01, fix #37)

> **Status**: ✅ PASSED — 2 findings resolved (0 critical, 1 major, 1 minor, 0 observation)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan (lightweight task) at `codeops/features/jsvision-ui/plans/reactive-owned-computeds/99-execution-plan.md`
> **Codebase Grounded**: 11 source files examined, all 5 affected sites + revert target + reactive core verified
> **Last Updated**: 2026-07-07

> ⚠️ **Cross-session, same-agent review.** The plan was authored by the same model family in a prior
> session (not the current one). Same-agent bias risk is present but not same-session. Findings below
> were pressure-tested with one independent adversarial challenger (recommendation-hardening).

### Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (yarn 1.x + Turborepo); `@jsvision/core`, `@jsvision/ui`
(reactive TUI framework), `@jsvision/files` (file dialogs — **not yet documented in CLAUDE.md**),
`@jsvision/examples`. Zero runtime deps. vitest (spec/impl/e2e).
**Architecture:** Solid-style fine-grained reactivity (`signal`/`computed`/`effect` under owner
scopes). Views create their owner scope at `mount()` (`view.ts` `createRoot` → `this.scope`);
`bind()`/`onCleanup()` are owner-scope methods that throw pre-mount. A computed is disposed with its
owner scope (`attachComputation`, `computed.ts` / `owner.ts`).
**Key Files Examined:** `packages/ui/src/view/view.ts` (mount/scope/bind/onCleanup),
`packages/ui/src/reactive/{computed,owner,scheduler}.ts`, the 5 affected sites
(`list/list-rows.ts:125`, `tree/tree.ts:88`, `table/data-grid.ts:94-95`, `dropdown/combo-box.ts:131`),
`packages/files/src/openers.ts` + `packages/files/src/list/{file-list,dir-list}.ts` +
`packages/files/test/openers.impl.test.ts`, commit `fd45c7d`.

**Reference Verification:** All 5 affected `file:line` sites verified exact. `openers.ts`
`createRoot` mitigation + commit `fd45c7d` verified. `view.ts` scope/`bind`/`onCleanup`/`runWithOwner`
machinery verified. Completeness sweep: the 5 sites are the **entire** universe of constructor-time
`computed(` in `packages/ui/src` + `packages/files/src` (plus `show.ts`, a framework primitive, out
of scope); no constructor-time unowned `effect(` exists. Two claims did **not** verify — see PF-002.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-001) | 🟠 |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 1 (PF-001) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-001) | 🟠 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-001) | 🟠 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-002) | 🟡 |
| 13 | Codebase Alignment | 1 (PF-002) | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | resolved (Option A) |
| MINOR | 1 | resolved (Option A) |
| OBSERVATION | 0 | — |

---

### PF-001: `derived()` remount lifecycle is under-specified; T-01.2 won't catch the staleness bug 🟠 MAJOR

**Dimension:** Implicit Assumptions / Completeness Gaps / Testability / Edge Cases
**Location:** `99-execution-plan.md` — Objective, D2, tasks T-01.4 and T-01.2
**Codebase Evidence:** `packages/ui/src/reactive/owner.ts:144-147` (dispose sets `disposed=true`,
deletes source edges), `packages/ui/src/reactive/scheduler.ts:185` (`updateIfNecessary` early-returns
when `disposed`), `packages/ui/src/view/view.ts:236-247` (unmount nulls `this.scope`; a second
`mount()` runs `createRoot` again → a brand-new owner), `packages/ui/src/view/group.ts:64-65,140-146`
(structural re-add + `Show`/`For` toggling the same instance both remount).

**The Problem:** T-01.4 specifies that `derived()` "memoizes a `computed(fn)` built under
`runWithOwner(this.scope,…)` on **first post-mount read**" — a one-time memo held in the accessor's
closure. It never specifies **re-keying/resetting that memo when the scope disposes at unmount**. The
reactive core disposes the computed with its owner scope. On **remount** the widget gets a *new*
scope, but the closure still returns the *disposed* computed from the previous mount — which
`updateIfNecessary` skips (frozen at its old value) and whose source edges are already deleted (signal
writes never reach it). Result: **a base-class primitive that silently breaks reactivity after
remount** — for a supported first-class pattern (a `ListBox`/`Tree`/`DataGrid` inside a toggling
`Show`/`For`, or re-added to a `Group`). `derived()` is modeled on `bind()`/`onCleanup()`, which *are*
remount-safe; this helper as specified is not.

Compounding it, the guard test is toothless: **T-01.2 asserts "disposed each cycle (no
accumulation)"** — the broken one-time-memo impl creates exactly one computed *ever*, so "no
accumulation" trivially passes while the staleness bug ships green. No task asserts *the derived value
is still reactive after remount*.

**Note (challenger):** No *current* in-repo caller remounts any of the 5 widgets (dialogs construct
fresh instances per open; ComboBox stays mounted while its popup toggles), so the defect is **latent
today** — it bites external library consumers and any future `Show`/`For`-wrapped use. This is the
argument for treating it as MINOR/accepted-risk; the argument for MAJOR is that it's a *foundational
View primitive* shipping with a green test that gives false confidence.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Spec a **scope-keyed memo** in T-01.4 (rebuild the computed when `memoScope !== this.scope`, e.g. capture `this.scope` alongside the computed and re-derive on mismatch) **and** add a task/assertion that the derived value is still reactive after an unmount→remount (a signal write post-remount updates the read). | Closes the real gap; makes the primitive remount-safe like `bind()`; test actually guards it | A few more lines in T-01.4 + one test |
| B | Keep the one-time memo but **document the limitation** ("`derived()` is single-mount; not for remounted widgets") and accept as a known risk. | Minimal change | Ships a footgun on a base-class method inherited by every widget; contradicts the owner-scope-per-mount design intent |
| C | Accept as-is (MINOR, no current trigger). | No plan change | Latent framework bug with a false-green test |

**Recommendation:** **Option A.** The fix targets a *reusable View primitive* whose entire premise is
scope-per-mount lifecycle correctness; a scope-keyed memo is small and makes it behave like its
siblings, and the reactivity-after-remount assertion converts T-01.2 from toothless to a real guard.
If the user prefers to ship now, Option B (documented single-mount limitation) is the acceptable
fallback — but Option C (silent + false-green test) is not recommended.

**Confidence:** Medium. **Hardening:** One adversarial challenger confirmed the mechanism and the
disposed-read semantics from source, and confirmed T-01.2 as worded won't catch it, but argued for
MINOR on "no live trigger today." Severity is genuinely debatable — recorded MAJOR because the defect
is in a base-class primitive shipping with a passing test; user may downgrade to accepted-risk.

**User Decision:** Resolved — User accepted recommendation: Option A (2026-07-07)

---

### PF-002: "Affected sites (verified)" row 2 + D3 misattribute the ChDirDialog leak to `Tree.flattened` 🟡 MINOR

**Dimension:** Codebase Alignment (Stale Assumption) / Consistency
**Location:** `99-execution-plan.md` — "Affected sites (verified)" table row 2; Decision D3
**Codebase Evidence:** `packages/files/src/list/dir-list.ts:39` (`class DirList extends
ListView<DirNode>` — **not** `Tree`), `:64-65` (`this.focusedNode = () => …` with comment "*not a
`computed` — no owner-less computation*" — DirList creates **no** computed of its own),
`packages/files/src/dialog/chdir-dialog.ts` (composes `new DirList(...)`),
`packages/ui/src/list/list-view.ts` → `new ListRows` → `list-rows.ts:125` (`displayItems`, **site
#1**). Same wrong attribution is echoed in `packages/files/src/openers.ts:92` and the
`openers.impl.test.ts` regression-test comment.

**The Problem:** Row 2 labels the DirList leak as "`flattened` (DirList inherits; passed to
`TreeRows`)" via `tree.ts:88` (site #2), and D3's revert-safety argument leans on it. But DirList
`extends ListView<DirNode>`, uses `Tree`/`flattened`/`TreeRows` nowhere, and defines no computed
itself. The ChDirDialog's constructor-time leak is the **inherited `displayItems`** (site #1,
`list-rows.ts:125`) — the *same* site that covers FileList. The revert of the `changeDir` `createRoot`
wrapper (T-01.7) **remains safe** — site #1 owns the very computed DirList inherits — so there is **no
functional consequence**. This is a wrong-evidence-in-a-"(verified)"-table defect: it misstates which
task guards the irreversible revert, and would mislead anyone who later reasoned about dropping site
#1 or #2. Site #2 (`Tree.flattened`) is still legitimately fixed — for the actual `Tree` (tree
demo / kitchen-sink), not for DirList.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Correct row 2's annotation to "DirList (ChDirDialog) inherits `displayItems` from the `ListView`→`ListRows` spine — site #1", strike the "passed to `TreeRows`" note, restate D3's safety as resting on **site #1**, and fix the stale comment in `openers.ts:92` + the regression-test comment during T-01.7. | Table + D3 become truthful; the revert's real guard is named; no dangling wrong comments | A few doc edits (one touches code comments in T-01.7) |
| B | Leave as-is (outcome is unaffected). | Zero effort | A "(verified)" table stays factually wrong on a load-bearing revert justification |

**Recommendation:** **Option A.** The revert is safe either way, but a "verified" affected-sites table
and the revert's own safety argument must name the *correct* covering task, and the two stale code
comments should be corrected while T-01.7 is already editing `openers.ts`.

**User Decision:** Resolved — User accepted recommendation: Option A (2026-07-07)

---

### Assessment

The plan is small, well-scoped, and largely accurate: all five `file:line` sites verify exactly, the
`computed()` universe is complete (no missed site, no constructor `effect`), the spec→red→green→impl
ordering is correct, the D3 "flagged deviation" (keeping the openers regression test as the
end-to-end #37 guard) is sound reasoning, and `super()`-before-`this.derived()` is feasible at every
site. Two findings: one MAJOR design/test gap in the new `derived()` primitive's remount behavior
(PF-001), and one MINOR factual misattribution in the affected-sites table (PF-002, outcome-safe).

**✅ PREFLIGHT PASSED — all 2 findings resolved (Option A each).** Fixes applied to
`99-execution-plan.md`: T-01.4 + new D2b now spec the scope-keyed (remount-safe) memo; T-01.2 gains
a remount-reactivity assertion and T-01.8 a remount re-key assertion (PF-001); the affected-sites
table row 2, D3's safety rationale, and T-01.7's comment-fix scope now correctly attribute the
ChDirDialog leak to the inherited `displayItems` (site #1), not `Tree.flattened` (PF-002).
