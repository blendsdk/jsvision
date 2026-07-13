# Preflight Report: multiclick-convergence (Task T-04)

> **Status**: ✅ PASSED — all 3 findings resolved (0 critical, 0 major, 2 minor, 1 observation)
> **Iteration**: 2 (fixes applied + re-scanned clean)
> **Artifact**: Implementation plan (lightweight task) at `codeops/features/jsvision-ui/plans/multiclick-convergence/99-execution-plan.md`
> **Codebase Grounded**: 9 source files + 6 test/consumer files examined; all plan references verified
> **Last Updated**: 2026-07-07

> **Review independence**: This scan ran in a **fresh session** (not the authoring session) — good for
> independence — but likely the same model family. Adversarial checklist applied; no standard-conformance
> claims are involved (pure internal DRY refactor).

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/ui` widget framework over `@jsvision/core`. The RD-04 event loop
(`src/event/event-loop.ts`) owns a framework-wide multi-click primitive: on each mouse-`down` it stamps a
consecutive same-**screen-cell** count (within `MULTI_CLICK_MS = 500`) onto the dispatched envelope as
`DispatchEvent.clickCount`. Leaf widgets already consume it (`grid-rows.ts:261`, `list-rows.ts:287`,
`tree-rows.ts:266`). The editor (`src/editor/`) still runs a **private, duplicate** detector over an
injectable clock. This task deletes the duplicate and reads the loop primitive.

**Key Files Examined:** `src/editor/editor-mouse.ts`, `src/editor/editor.ts`, `src/editor/editor-types.ts`,
`src/event/event-loop.ts`, `src/event/types.ts`, `src/controls/input.ts`, `test/editor.spec.test.ts`,
`test/editor.impl.test.ts`, `packages/examples/editor-demo/main.ts`, `packages/files/src/editor/file-editor.ts`.

**Reference Verification:** All plan line-references verified accurate against HEAD:
- `editor-mouse.ts:22` `MULTI_CLICK_MS`, `:48-58` down block, `:52` `(clickCount % 3)+1` — ✅
- `editor.ts:115-120` clock/state, `:149` `this.clock = options.now ?? Date.now` — ✅
- `editor-types.ts:34-35` `now` field — ✅
- `event-loop.ts` `dispatch()` stamps `clickCount` only on `down` (`:147-153`), `this.clickCount + 1`
  unbounded, resets on different cell or `>500 ms` — ✅ (matches D2's equivalence premise)
- `EventLoopOptions.now` seam exists (`types.ts:57`, used `event-loop.ts:108`) — ✅ (T-04.4 feasible)
- Input D1 refs: `input.ts:448` (`lastDownX === local.x`), `:286/:306` HR-54 disarm — ✅
- `now` consumers = `editor-demo/main.ts:62` + `editor.spec:81` + `editor.impl:45,57,72` — ✅ complete
- **D2 wrap math independently re-derived:** old `(n%3)+1` over `n=1,2,3,1,2,3,1` and new
  `((cc-1)%3)+1` over `cc=1..7` both yield `1,2,3,1,2,3,1` — **exact**. ✅

**Overall:** A strong, well-grounded plan. Behavior-preservation logic is sound; the loop primitive is a
proven pattern already shipped for three other row widgets; `yarn verify` (turbo over `packages/*`) is a
real safety net. The three findings below are hygiene/completeness, not correctness blockers.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 4 | Completeness Gaps | 1 (PF-002) | 🟡 |
| 9 | Edge Cases | 1 (PF-003) | 🔵 |
| 13 | Codebase Alignment (Impact Blindness) | 1 (PF-001) | 🟡 |
| (all others) | — | 0 | — |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | ✅ resolved |
| OBSERVATION | 1 | ✅ resolved |

---

### PF-001: Impact analysis omits the `@jsvision/files` cross-package extension 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Impact Blindness) / 4 — Completeness
**Location:** 99-execution-plan.md — "Current state → Consumers of `EditorOptions.now`" + Decision **D3**.
**Codebase Evidence:** `packages/files/src/editor/file-editor.ts:32` — `export interface FileEditorOptions
extends EditorOptions`; `:52` `constructor(options: FileEditorOptions) { super(options); … }` (`FileEditor
extends Editor`). `packages/files/src/editor/open-file.ts:19` — `OpenFileInEditorOptions extends
FileEditorOptions`. `EditorOptions` is publicly re-exported at `packages/ui/src/index.ts:197`.

**The Problem:** D3 justifies removing `EditorOptions.now` as trimming an "unused public field … clean
because `@jsvision/ui` is private pre-release," and the consumer list enumerates only `@jsvision/ui`/examples
sites. It never acknowledges that a **separate package**, `@jsvision/files`, extends `EditorOptions` twice
over. Removing `now` narrows that inherited interface.

Verified **safe**: no `@jsvision/files` source or test passes `now` (repo-wide `now:` sweep), `super(options)`
stays assignable, and `yarn verify` fans out over `packages/*` so the files package **is** typechecked/tested
by T-04.5. So there is no break — but the plan's grounding *claim* (a closed, verified consumer set) is
materially incomplete, and an executor trusting the list wouldn't know the files interface is in the blast
radius.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add one line to D3/Current-state noting `@jsvision/files.FileEditorOptions extends EditorOptions` is in scope, verified no `now` caller, and covered by the `packages/*` verify | Closes the grounding gap; ~1 sentence; makes the safety net explicit | None |
| B | Leave as-is (verify catches any break regardless) | Zero effort | Overstated "closed consumer set" persists; future readers re-discover the same gap |

**Recommendation:** Option A — the fix is a one-sentence grounding correction and it's exactly the
cross-package impact this task's DRY intent should track. Purely a doc edit; no task/behavior change.
**Confidence:** High — the extension chain and the empty `now`-caller set are both directly verified.

**User Decision:** Resolved — Option A applied (D3 + consumer list now cite the `@jsvision/files` extension,
verified safe + verify-covered).

---

### PF-002: Two event-package JSDoc cross-references go stale but no task updates them 🟡 MINOR

**Dimension:** 4 — Completeness Gaps / 13 — Stale references
**Location:** 99-execution-plan.md — Tasks T-04.2/T-04.3 (JSDoc-fix scope) and T-04.5 (grep gate).
**Codebase Evidence:**
- `packages/ui/src/event/event-loop.ts:33-37` (JSDoc on the loop's `MULTI_CLICK_MS`): *"the editor keeps its
  own equal `MULTI_CLICK_MS` (`editor-mouse.ts:22`) **pending a later convergence (AR-6)**. Both are 500."* —
  After T-04.2 deletes `editor-mouse.ts:22` and this task *discharges* AR-6's editor half, this note is stale
  (the editor no longer keeps its own; the convergence is no longer "pending") **and** it points at a
  deleted line.
- `packages/ui/src/event/types.ts:53-56` (JSDoc on `EventLoopOptions.now`): *"mirrors `EditorOptions.now`"* —
  T-04.3 removes `EditorOptions.now`, so this reference dangles.

**The Problem:** T-04.3 scopes JSDoc fixes to `editor.ts`/`editor-types.ts` only; neither stale ref lives
there. T-04.5's success gate is `grep` for **`EditorOptions.now`** — that pattern *does* hit `types.ts:54`,
so satisfying the gate silently forces an edit to `event/types.ts`, a file **no task lists** (an implicit,
unstated task). And the `event-loop.ts:36` `MULTI_CLICK_MS`/AR-6 note isn't matched by that grep at all, so
it can survive the whole task. This is precisely the "one source of truth" hygiene the task exists to
establish.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a T-04.2/T-04.3 bullet: "update `event/event-loop.ts` + `event/types.ts` JSDoc — drop the 'editor keeps its own `MULTI_CLICK_MS`/pending AR-6' + 'mirrors `EditorOptions.now`' notes; state convergence is done" | Both stale refs actioned; makes the implicit `event/types.ts` edit explicit; matches DRY intent | None |
| B | Broaden T-04.5's grep to also flag `MULTI_CLICK_MS` occurrences outside the loop + rely on it | Catches drift mechanically | Grep-after-the-fact isn't a task; still leaves the wording change undirected |

**Recommendation:** Option A — name the two files/edits directly rather than relying on a grep side effect.
Trivial and keeps the plan's task ledger honest about every file it touches.
**Confidence:** High — both JSDoc strings quoted verbatim from HEAD.

**User Decision:** Resolved — Option A applied (T-04.3 + its ledger row now name the
`event/event-loop.ts:33-37` and `event/types.ts:53-56` JSDoc edits explicitly).

---

### PF-003: Edge-case note is asymmetric — the interleaved false-*negative* isn't covered 🔵 OBSERVATION

**Dimension:** 9 — Edge Cases
**Location:** 99-execution-plan.md — "Accepted equivalences → Global vs per-editor counter".
**Codebase Evidence:** `event-loop.ts:150` — **any** different-cell `down` resets the global counter to 1;
`editor-mouse.ts:52` — the old per-editor state (`lastClickCell`/`lastClickTime`) is updated **only** on
editor downs.

**The Problem:** The plan's note covers the false-**positive** direction (a view *moved* onto a prior click's
cell → spurious double-click; "accepted"). It does not mention the false-**negative**: if a `down` on a
*different* screen cell (another widget/window) lands **between** two same-cell editor clicks within 500 ms,
the loop's global counter resets, so the 2nd editor click reads `clickCount=1` (single caret) — whereas
today's per-editor detector, untouched by the intervening click, would read a double-click (word select). So
the "byte-for-byte identical" claim has one contrived interleave where it diverges.

Practically negligible: a genuine double-click gesture is two rapid presses on the same spot with nothing
between them; deliberately clicking elsewhere mid-gesture isn't a double-click. Worth recording only for
completeness, since the plan leads with a strong "no behavior change" claim.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add one sentence to the "Global vs per-editor counter" note acknowledging the intervening-different-cell-down false-negative as accepted | Makes the equivalence claim honest/symmetric | None |
| B | Omit (residual risk is negligible and gesture-incompatible) | Less text | "byte-for-byte identical" slightly overclaims |

**Recommendation:** Option A — one accepted-equivalence sentence; no code change. It rounds out an otherwise
excellent edge-case section.
**Confidence:** High — divergence derived directly from the two cited reset conditions.

**User Decision:** Resolved — Option A applied (the "Global vs per-editor counter" note now documents the
symmetric false-negative as accepted).

---

## Adversarial checklist (same-model-bias safeguard)

- **Feasibility re-checked, not assumed:** confirmed `EventLoopOptions.now` already exists (so T-04.4's
  "move the clock to the loop" is real, not aspirational) and that a hit-test-routed leaf already receives a
  populated `ev.clickCount` in shipped code (grid/list/tree rows) — the editor's `down` (never captured at
  first press) will read it identically.
- **The D2 equivalence was re-derived independently**, not trusted from the prose — it is exact.
- **No CRITICAL/MAJOR findings** → the hardening challenger is not triggered (reserved for high-stakes
  findings per the report-format budget).

## Iteration 2 — fixes applied + re-scan

All three fixes applied to `99-execution-plan.md` (PF-001 → D3 + consumer list; PF-002 → T-04.3 + ledger;
PF-003 → edge-case note). Re-scan of all 13 dimensions on the amended plan:

- **Fix verification:** each edit lands as intended; every newly-cited reference re-confirmed exact against
  HEAD — `file-editor.ts:32` (`FileEditorOptions extends EditorOptions`), `event-loop.ts:33-37` (the
  `MULTI_CLICK_MS`/AR-6 JSDoc), `event/types.ts:52-57` (the `now?` JSDoc with "mirrors `EditorOptions.now`").
- **Regression check:** the added prose is verified/grounded only; D3 ↔ consumer list are now consistent, and
  the edge-case note is symmetric. No new contradiction, ambiguity, or over-claim introduced.
- **Fresh scan:** 0 new findings across all 13 dimensions.

## Verdict

**✅ PREFLIGHT PASSED — all 3 findings resolved.** 0 critical, 0 major; 2 minor + 1 observation, all doc/
hygiene, all applied. Iteration 2 re-scan is clean. The plan is safe to execute; verify (`packages/*`)
backstops the (verified-safe) `@jsvision/files` consumer.
