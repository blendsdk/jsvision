# Preflight Report: DataGrid Showcase App (plan)

> **Status**: ✅ PASSED — all 5 findings resolved (0 critical, 1 major, 2 minor, 2 observation) · fixes applied to the plan docs
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/datagrid-showcase/`
> **Codebase Grounded**: 20+ source/config files examined, ~30 references verified
> **Last Updated**: 2026-07-15 18:12

> ⚠️ **SAME-AGENT BIAS RISK — ELEVATED.** This plan was authored 2026-07-15 (commit `9f506dee`),
> the same day, plausibly by the same model. This scan ran in a fresh (cleared) context, but shared
> training blind spots remain possible. For the one MAJOR finding (a novel headless-shell test
> harness), a fresh-session or human review of the chosen mechanism is advisable.

### Codebase Context Summary

**Tech Stack:** yarn 1.x + Turborepo monorepo, TypeScript ESM-only (NodeNext, strict), vitest, zero runtime deps. Packages: `@jsvision/core` (engine) → `@jsvision/ui` (widgets) → `@jsvision/datagrid` (grid, v0.2.0) + `@jsvision/examples` (dev demos).
**Architecture:** The plan copies `packages/examples/kitchen-sink/` (a Storybook-for-TUI shell) into a new `packages/examples/datagrid-showcase/`, adds ~38 datagrid demos + 8 roadmap placeholders, and two headless test tiers. Demos consume only the datagrid public barrel.
**Key Files Examined:** `kitchen-sink/{shell,main,story,window}.ts`, `theme-designer/src/{main.ts,host/walkthrough.ts}`, `datagrid/src/{index,grid,data-source,cell-editor,format}.ts`, `datagrid/test/kitchen-sink.smoke.spec.test.ts`, `examples/{package.json,tsconfig.json}`, `ui/src/app/{application,run}.ts`, `ui/src/event/event-loop.ts`, `codeops/kitchen-sink-gate.md`, feature `00-roadmap.md`.

**Verified correct (no finding):** datagrid barrel exports every named symbol; `data-source.ts` `setSort?`@31/`setFilter?`@33 vs `fromRows` omission @60-63 (drives the bespoke push-down source); grid client-vs-push-down path @233-234/@245; `zebra?`@47/`quickFilter?`@52; count/filter API public methods @454-503; distinct falls back to `computeDistinct` for in-memory sources (grid.ts:516-521) so the value-list demo works over `fromRows`; `EditableDataGrid extends Group` (placeable); `CellEditorKind` 9 kinds; `fmt` shape; examples `tsconfig` allowlist + `package.json` scripts/deps; smoke API `createRenderRoot({w,h},{caps})`; datagrid v0.2.0; `demo:datagrid` script free.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-005) | 🔵 |
| 2 | Implicit Assumptions | (folded into 13) | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | (PF-001 co-tag) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | (PF-001 co-tag) | 🟠 |
| 7 | Testability | (PF-001 co-tag) | 🟠 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-002, PF-003) | 🟡 |
| 13 | Codebase Alignment | 2 (PF-001, PF-004) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 1 | ✅ resolved (fix applied) |
| 🟡 MINOR | 2 | ✅ resolved (fix applied) |
| 🔵 OBSERVATION | 2 | ✅ resolved (fix applied) |

---

### PF-001: Walkthrough test tier — mechanism is inaccessible-as-written and modelled on the wrong precedent 🟠 MAJOR

**Dimension:** 13 Codebase Alignment (Stale Assumption) · co-tags 4 Completeness, 6 Feasibility, 7 Testability
**Location:** `07-testing-strategy.md` §"Walkthrough oracle" (ST-8…ST-10); `03-01-app-and-shell.md` §shell.ts + §"Verify seam"; `99-execution-plan.md` task 1.1.2; `01-requirements.md` (AC #6). Traces to RD-15 AC #6 / PF-021.
**Codebase Evidence:** `packages/examples/kitchen-sink/shell.ts:169-319` — `createShowcase(caps)` returns **only** `{ app, run }`; `showStory`/`showWelcome`/`step`/`disposePrevious`/`disposeStory` are **private closures**. `shell.ts:319` `run: () => app.run()`; `packages/ui/src/app/run.ts:128` asserts a TTY (`requireTty ?? true`) — the copied shell never opts out, so `run()` cannot execute headlessly. `packages/theme-designer/src/host/walkthrough.ts` — the cited `runWalkthrough` drives a **pure model** and composes **independent** gallery views into fresh render roots; it never builds the app, navigates, or tests swap/dispose. The usable seam DOES exist and is public: `app.loop.emitCommand(story.id)` (`event-loop.ts:314`) routes a `command` event to the post-process `CommandSink` (`window.ts:67-86`, handlers keyed by story id at `shell.ts:298`) → the private `showStory`; `app.loop.renderRoot.buffer().rows()` reads the paint (the shell already does this at `shell.ts:313`).

**The Problem:** The plan's walkthrough tier — a MUST (RD AC #6), and its Phase-1 "green gate" (ST-10) — instructs the executor to "drive `showStory` across every registry entry," "like theme-designer's `runWalkthrough`." Both are wrong against the code: `showStory` is unreachable, `run()` needs a TTY, and `runWalkthrough` is a render precedent that does no navigation at all. No task adds a navigation seam, and no in-repo test currently drives a `createShowcase`-style shell headlessly. Separately, ST-9 asserts "the previous view is disposed" — but a buffer diff can only prove the *view swapped* (no double-mount), not that the previous **reactive owner** was disposed (a leaked effect leaves the buffer green), which is exactly the `dispose-previous lifecycle` PF-021 assigns this tier to guard. An executor following the doc literally is blocked at task 1.1.2 and must design a novel harness ad hoc under the green gate.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify the mechanism, no shell API change: construct the showcase, drive `app.loop.emitCommand(story.id)` per entry, assert on `app.loop.renderRoot.buffer()`; reframe ST-9 as an indirect buffer check (no double-mount) and **downgrade PF-021/ST-9 wording** to swap-cleanliness. Fix the `runWalkthrough` citation. | Zero new shell surface; navigation exercises the **real** production command wiring; lightest divergence from the copy. | ST-9 can't observe reactive disposal — the doc must drop "is disposed" to stay honest; a real leak-a-dispose regression would go uncaught. |
| B (hybrid — recommended) | Option A's `emitCommand` navigation **plus** one minimal **read-only** inspection hook on the dedicated shell (e.g. `disposedCount()` / current-owner-disposed observable) so ST-9 directly proves dispose. | Keeps high-fidelity command-path navigation; makes ST-9 honest and matches PF-021; small, sanctioned divergence (focused copy, example code). | Adds a tiny test-only accessor to shell code. |
| C | Add a full `navigate(story|index)` method to the shell and drive through it. | Simplest test code. | `navigate()` calls `showStory` directly, **bypassing** the CommandSink command wiring — proves less than A/B for AC #2 (navigation). Rejected. |

**Recommendation:** **Option B (hybrid).** Navigate via the production `emitCommand` path (higher-fidelity than a `navigate()` backdoor), and add exactly one read-only disposal hook so ST-9's "previous view disposed" is actually observable — which is the specific job PF-021 gives this tier. The dedicated shell is already a permitted focused copy of example code, so one inspection accessor is proportionate. Pure Option A is fully viable and lighter **if** you accept downgrading ST-9/PF-021 to "no double-mount" (swap-cleanliness) — the one thing to avoid is keeping "is disposed" wording backed only by a buffer diff. Whichever is chosen, the doc must also: (1) replace the `runWalkthrough` citation with the real seam, (2) restate ST-8 from "drive `showStory`" to "`emitCommand(story.id)` for every entry," and (3) fix the `03-01` "Verify seam" line — the walkthrough exercises the shell **factory**, not `main.ts`'s `run()` tail.

> Confidence: High — every seam (`emitCommand`, `CommandSink`, `requireTty`, `runWalkthrough`) verified in code. What would change it: if you decide this tier should NOT hold PF-021's dispose mandate, the pick collapses to pure A + a wording downgrade.
> Hardening: Changed pick — initial lean was a full shell nav+inspection seam (B-style `navigate()`); the challenger showed `navigate()` bypasses the real command wiring, so navigation moved to A's `emitCommand` and only the disposal *observation* keeps a minimal seam.
> Challenger: converged (independent agent reached the same hybrid from its own recon; surfaced the `navigate()`-backdoor argument and the ST-9 honesty point).

**User Decision:** ✅ Resolved — User accepted recommendation (Option B, hybrid). Applied: `07` walkthrough oracle now drives `app.loop.emitCommand(story.id)` + reads the render-root buffer + `disposedCount()` (ST-8/9/10 restated; `runWalkthrough` citation removed); `03-01` shell returns `{ app, run, disposedCount }` with the sanctioned-divergence note + corrected Verify seam; `99` tasks 1.1.2 / 1.2.2 updated.

---

### PF-002: Registry entry count — "47 entries" vs the 46 the inventory sums to 🟡 MINOR

**Dimension:** 12 Consistency
**Location:** `99-execution-plan.md` task 2.3.2 ("Confirm the walkthrough drives all 47 entries"); cf. `07-testing-strategy.md` ST-6 (8 placeholders) + ST-7 (38 shipped) and ST-8 ("every registry entry").
**Codebase Evidence:** N/A (internal document arithmetic). Inventory: Foundation 5 + Editing 5 + Cell editors 9 + Formatting 8 + Sorting 5 + Filtering 6 = 38 shipped; + 8 placeholders = **46** registry entries. The welcome screen is shell-owned, not a `STORIES` entry (`shell.ts:138-166`).
**The Problem:** Task 2.3.2 says "47 entries"; the inventory (and ST-7 + ST-6) sums to 46. Either a miscount, or the welcome screen is being counted as a navigable target (but ST-8 says "every registry entry" = 46). A wrong count in the final green-gate task risks a spurious assertion.

**Options:** Only one viable resolution: correct the number to **46** (and, if the intent was to also visit the welcome catalog in the walkthrough, say "46 registry entries + the welcome screen" explicitly rather than folding it into an ambiguous "47").

**Recommendation:** Change "47 entries" → "46 registry entries" in task 2.3.2 (optionally: "+ the welcome catalog" if the driver visits it). Trivial, unambiguous.

**User Decision:** ✅ Resolved — Applied: `99` task 2.3.2 now reads "all 46 registry entries (38 shipped + 8 placeholders)".

---

### PF-003: Feature roadmap says "24 tasks"; the execution plan has 22 🟡 MINOR

**Dimension:** 12 Consistency
**Location:** `codeops/features/datagrid/00-roadmap.md` RD-15 row ("2-phase big-bang (24 tasks)") vs `99-execution-plan.md` ("Total: 22 tasks across 2 phases"; Phase 1 = 12, Phase 2 = 10; Progress header "0/22").
**Codebase Evidence:** N/A (cross-document drift). Counted task lines in `99`: Phase 1 = 12 (1.1.1–1.1.3, 1.2.1–1.2.6, 1.3.1–1.3.3), Phase 2 = 10 (2.1.1, 2.2.1–2.2.6, 2.3.1–2.3.3) = **22**.
**The Problem:** The roadmap's RD-15 Notes cell records 24 tasks; the authoritative execution plan has 22. Minor, but the roadmap is the cross-session source of truth and will mislead a reader about plan size.

**Options:** Only one viable resolution: update the roadmap Notes cell to "22 tasks." (I will do this as part of the roadmap sync on a pass, if you want.)

**Recommendation:** Fix the roadmap to "22 tasks." Fold into the post-pass roadmap advance (Plan Created → Plan Preflighted).

**User Decision:** ✅ Resolved — Applied: `00-roadmap.md` RD-15 row now says "22 tasks" and advanced to `Plan Preflighted` 🔬.

---

### PF-004: `data-grid.story.ts` path is cited without its `stories/` segment 🔵 OBSERVATION

**Dimension:** 13 Codebase Alignment (path precision)
**Location:** `00-ambiguity-register.md` AR #9; `03-02-demos-and-inventory.md` §Governance; `99-execution-plan.md` task 2.3.1 — all write `kitchen-sink/data-grid.story.ts`.
**Codebase Evidence:** Actual path is `packages/examples/kitchen-sink/stories/data-grid.story.ts` (verified; the file exists there, not at `kitchen-sink/data-grid.story.ts`).
**The Problem:** The gate-reconciliation note (task 2.3.1) points at a path missing the `stories/` segment. Low risk (a doc note about a retained file), but an imprecise reference in shipped governance text.

**Recommendation:** When writing the `kitchen-sink-gate.md` reconciliation, use the correct `kitchen-sink/stories/data-grid.story.ts`. Optional; fixable at execution time.

**User Decision:** ✅ Resolved — Applied: path corrected to `kitchen-sink/stories/data-grid.story.ts` in `00-ambiguity-register.md`, `03-02`, and `99` task 2.3.1.

---

### PF-005: Story-id `<cluster>` segment is unpinned — directory slug vs category label 🔵 OBSERVATION

**Dimension:** 1 Ambiguities
**Location:** `03-02-demos-and-inventory.md` ("Ids are `datagrid/<cluster>/<slug>`") with cluster **directories** `foundation/editing/editors/formatting/sorting/filtering` but **category labels** `Foundation/Editing/Cell editors/Formatting/Sorting/Filtering`.
**Codebase Evidence:** Only ST-3 (id uniqueness) is asserted; nothing pins the `<cluster>` token, and the "Cell editors" category maps to an `editors/` directory, so `datagrid/editors/text` vs `datagrid/cell-editors/text` are both plausible.
**The Problem:** With 38 ids authored across two phases (possibly by different executor passes), an unpinned convention risks inconsistent ids (e.g. some `editors/`, some `cell-editors/`). Only uniqueness is tested, so drift wouldn't fail a test but would read sloppily.
**Recommendation:** Pin the convention in `03-02` — recommend the **directory slug** (`datagrid/editors/text`), matching the file layout. Optional.

**User Decision:** ✅ Resolved — Applied: `03-02` now pins ids to `datagrid/<dir-slug>/<demo-slug>` with the directory list and the `datagrid/editors/text` example.

---

## Adversarial checklist (same-agent-bias safeguard)

- *Assumption I might be confirming:* that copying the kitchen-sink shell "just works" for a headless walkthrough — PF-001 is precisely where that assumption breaks; verified against `run.ts`/`shell.ts`, not memory.
- *External standard risk:* none — this is internal framework API, verified directly in source.
- *What a dissenting expert would flag:* that PF-001 could be waved off as "the executor will figure it out" — rejected, because the testing doc is the plan's single source of truth and currently cites an inaccessible function and a wrong precedent under a green gate.
