# Preflight Report — setlayout-primitive

> **Status**: ✅ COMPLETE — iteration 1 (21 findings) + iteration 2 (14 findings), **all resolved and all fixes applied 2026-07-20**
> **Iteration**: 1 and 2 — see [Iteration 2](#iteration-2--re-scan-after-fixes) at the end
> **Note**: the iteration-1 sections below are a **historical snapshot** of the plan as first written. Figures quoted inside them (e.g. "144 writes", "~22 conversions across 11 files and 21 tasks") were themselves superseded during iteration 2; the plan's live shape is **23 conversions across 11 files, 22 tasks, 82 executable writes / 17 reads**. The snapshot is deliberately not rewritten — it is the audit trail.
> **Artifact**: implementation plan at `codeops/features/layout-dsl-adoption/plans/setlayout-primitive/` (8 docs)
> **Codebase Grounded**: 40+ source files examined, ~60 references verified
> **Method**: 5-cluster preflight-auditor fan-out (exact 13-dimension partition) + 1 design-challenger pass over the MAJOR batch
> **Last Updated**: 2026-07-20

The plan is **strong**. Its line numbers are accurate (every one of the 20 cited sites verified
exact), its `dialog.ts:109` replace-vs-merge trace survived four independent attempts to break it,
its re-entrancy story is correct for a reason it does not state, and its P4 deferral is honest. What
follows are the defects that survived refutation — concentrated in three places: the **factual
premise under the one behaviour change**, the **oracles** (several name things that do not exist or
cannot observe what they claim), and a family of **stale counts**.

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest
(`unit` / `e2e` projects), zero runtime dependencies.
**Architecture:** `@jsvision/core` (foundation engine) → `@jsvision/ui` (widget framework: reactive
core · layout engine · view/group spine · event loop · widgets) → `@jsvision/{forms,datagrid,files,web}`.
`View.layout` is a plain public field on the base class every view inherits; the layout DSL
(`packages/ui/src/view/dsl/`) is its heaviest writer.

**Key files examined:** `packages/ui/src/view/view.ts` · `view/render-root.ts` ·
`view/dsl/{absolute,flex,stack}.ts` · `layout/types.ts` · `dialog/dialog.ts` · `window/window.ts` ·
`split/split-view.ts` · `status/statusline.ts` · `color/color-picker.ts` · `editor/edit-window.ts` ·
`app/application.ts` · `packages/forms/src/form-dialog.ts` · `packages/datagrid/src/{filter-popup,grid,grid-panels}.ts` ·
`packages/ui/test/{app-shell.fixtures,dsl-absolute.spec,dsl-hardening.impl,dialog.dsl-shape.impl,dialog.centering.impl,accelerator-reveal.impl}.test.ts` ·
`turbo.json` · `package.json` · `scripts/{check-jsdoc,api-extract}.mjs` · `codeops/kitchen-sink-gate.md` ·
the sibling plans under `plans/widget-flex-adoption/`.

**Verified as claimed:** `view.ts:69` layout field · `view.ts:211` `invalidateLayout` ·
`render-root.ts:321-327` coalescing `markRelayout`/`scheduleFlush` · `LayoutProps` + the `Size`
discriminated union · all 13 DSL line numbers · all 7 self-layout line numbers · `window.ts:81`'s
field initializer · the `dialog.ts:109` trace · root `verify` including `check-plugin` ·
`plugin:sync` · the examples `test:e2e` script.

**Refuted as claims, kept as facts:** the `filter-popup.ts:285` bug premise (PF-001) · the
`app-shell.fixtures.ts` host double (PF-003) · the "138 writes / 11 initializers / 8+5 split" counts
(PF-009) · the canvas-plan frame snapshots (PF-008).

**Explicitly cleared** (attempts to break them failed — recorded so a later reader does not re-open):

- **`stack.ts:149` re-entrancy is safe.** `flush()` clears `scheduled` (`render-root.ts:333`) and
  snapshots-then-clears `needsReflow` (`:342-343`) *before* composing, so a `markRelayout` raised
  during a draw lands in the next frame — never a synchronous re-entry. Settle termination is
  guaranteed by the rect comparison at `stack.ts:142-148`, not by the trailing invalidate, and the
  write is inside the guarded branch. N layers cost N flag writes and one frame, exactly as today.
  The plan's "leave `:153` alone" ruling is right — and right for an unstated extra reason:
  `setLayout` invalidates through the *layer's* host (null if that layer is unmounted), `:153`
  through the *Stack's*.
- **The `dialog.ts:109` trace holds.** No `Dialog`/`Window` subclass carries an `override layout`
  initializer; subclass field initializers run after `super()` returns; `:109` and its tagger are
  adjacent statements inside the same `width && height` guard, so nothing can interleave. End state
  identical.
- **Cross-package build ordering is sound.** `turbo.json` has `test: dependsOn ["build","^build"]`
  and `typecheck: dependsOn ["^build"]`, so the `forms`/`datagrid` conversions in task 2.6 test
  against a freshly built `ui` dist under `yarn verify`.
- **Rollback is clean per-site.** The API-snapshot coupling attaches to the primitive's member
  signature, not to the call sites.
- **Phase ordering is correct.** P3-before-P2 is argued and right; the 2.1→2.8 sequence is
  spec-first-clean.

## Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 2 | 🟡 |
| 2 | Implicit Assumptions | 3 | 🟠 |
| 3 | Logical Contradictions | 3 | 🟠 |
| 4 | Completeness Gaps | 5 | 🟡 |
| 5 | Dependency Issues | 2 | 🟡 |
| 6 | Feasibility Concerns | 2 | 🟠 |
| 7 | Testability | 6 | 🟠 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 2 | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 3 | 🟡 |
| 13 | Codebase Alignment | 8 | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 4 | all resolved |
| 🟡 MINOR | 14 | all resolved |
| 🔵 OBSERVATION | 3 | all accepted |

Every finding was ruled **accepted as recommended** on 2026-07-20. The decisions carrying the most
weight, restated so the executor does not have to reconstruct them:

- **PF-001 → A** — no site observes the tagger auto-invalidation today; it is a correctness default,
  not a bug fix. ST-S5 stays, re-labelled. NFR-3's cost argument moves to `split-view.ts:188`.
- **PF-004 → A** — the audit table gains one row per site with a **"mounted at call time?"** column,
  verdicts blank until task 2.1 runs.
- **PF-007 → A** — `application.ts:343`/`:347` are taken into scope (AR-2 amended "+2 handed back by
  #109"); `:333` is explicitly *not* swept.
- **PF-010 → fix the root cause** — `"globalPassThroughEnv": ["TUI_SKIP_PERF", "CI"]` lands in
  `turbo.json` as an explicit Phase-1 task, retiring the trap repo-wide.
- **PF-013 → A** — a new impl-test task after 1.6, and an explicit `undefined` value is documented as
  a **supported reset** to the layout default.
- **PF-017 → A** — spec/impl split: `view-setlayout.spec.test.ts` keeps ST-S1…S5; migration
  witnesses go to impl suites, with exact filenames named.

---

# 🟠 MAJOR findings

### PF-001: AR-5's behaviour change rests on a defect that does not exist, and its blast radius is mis-bounded 🟠 MAJOR

**Dimension:** Implicit Assumptions · Codebase Alignment (Stale Assumptions / Impact Blindness) · Logical Contradictions
**Location:** `00-ambiguity-register.md` AR-5 · `01-requirements.md` FR-4 · `02-current-state.md` §3 (`:75-76`) · `03-02-migration.md` §"The behaviour change" (`:52-63`)
**Codebase Evidence:**

- `packages/datagrid/src/filter-popup.ts:281-287` — the write sits **inside**
  `this.bind(() => this.contentHeight(), (h) => {…}, { relayout: true })`, and `View.bind`
  (`packages/ui/src/view/view.ts:243-245`) calls `this.invalidateLayout()` after every apply when
  `relayout` is set. **The site already reflows today.** It is also not a tagger call at all.
- `packages/ui/src/split/split-view.ts:186-190` — `applyWeights()` calls `grow(pane, …)` on
  **mounted** panes, driven by the `bind({ relayout: true })` at `:164-172` on every splitter drag,
  keyboard step, and restore. A real tagger-on-mounted-view site, unlisted.
- `packages/datagrid/src/grid-panels.ts:563-564` — `fixed(deps.vbar, 1)` / `grow(deps.hbar)` on
  scroll bars retained across `rebuildBody()` (`grid.ts:740-741`, from a reactive effect at
  `:688-696`; the re-tag precedes `this.remove(old)` at `:747`, so they are still mounted). A second.

**The Problem:** three separate defects in one claim. (a) The named site does not have the bug — its
silence is not silence. (b) The site is filed simultaneously in the 13-site DSL set (FR-4) and the
7-site self-layout set (FR-5), which the plan's own §2/§3 partition makes disjoint. (c) The real
mounted-tagger sites exist, are two in number, and were never impact-assessed — and both of *them*
already invalidate through their surrounding bind too. Net: **no site in the codebase observes this
behaviour change today.** AR-5 is a gate-passed register entry whose entire job is bounding blast
radius, and it bounds it to the wrong site. An executor following the plan will implement ST-S5
believing it repairs `filter-popup`, and may "confirm" the fix by observing behaviour that is
already correct.

**What is *not* wrong:** the decision itself. Unconditional invalidation in `setLayout` is still
right, and **ST-S5 remains valid and genuinely red-first** — `fixed(v, 2)` on a mounted view really
does not invalidate today. Only the justification dies.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Rewrite AR-5 / FR-4 / 02 §3 / 03-02 to state that **no site observes the change today**; the unconditional invalidate is a correctness default for future callers, redundant-but-harmless at the three runtime sites. Name `split-view.ts:188` + `grid-panels.ts:563-564` as the actual runtime surface. Re-label ST-S5 "specifies new behaviour". | Honest; keeps the (correct) decision and the (valid) test; four localized paragraph edits, zero task churn | Loses the rhetorically satisfying "latent bug fix" framing |
| B | Keep the bug-fix framing, but cite all three sites | Smaller edit | The framing is simply false at all three sites — this preserves a claim the code refutes |
| C | Drop the auto-invalidate from the taggers | Removes the behaviour change entirely | Re-opens the exact footgun FR-1 exists to close, and guts ST-S3. Not viable |

**Recommendation: Option A.** It is the only option that leaves the plan's *decision* intact while
making its *record* true. The challenger independently reached A and added a refinement worth
taking: `split-view.ts:188` is a per-drag-frame path, so NFR-3's "invalidation is free" argument
should be made from **that** site rather than from `stack.ts`'s loop — the conclusion still holds
(`render-root.ts:326-327` early-returns), but it should be argued from the real hot path.
**Confidence: High. Hardening: challenger concurred (A), severity confirmed MAJOR.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-002: the close-out grep oracle is blind to 8 of 14 DSL sites and to all 7 self-layout sites 🟠 MAJOR

**Dimension:** Testability · Codebase Alignment
**Location:** `01-requirements.md` AC-2 / AC-4 (oracle = "grep audit") · `07-testing-strategy.md:70-71` · `99-execution-plan.md:42` (task 3.1)
**Codebase Evidence:** the stated patterns are `{ ...view.layout` and `{ ...this.layout`. Of the DSL
sites, only `absolute.ts:44,70,94`, `flex.ts:172,191` and `stack.ts:149` use a `view.layout`
receiver. `stack.ts:208,216,225` spread **`...layer.layout`**; `flex.ts:96,100`, `stack.ts:192,196`
and `flex.ts:217` are fresh-object writes matching no spread pattern at all. AC-4's seven
self-layout sites live in `status/`, `color/`, `dialog/`, `window/`, `editor/`, `forms/src/`,
`datagrid/src/` — wholly outside the grep's stated `packages/ui/src/view/dsl/` scope, with no
pattern given for them.

**The Problem:** the grep can report clean with 8 of 14 DSL sites and 7 of 7 self-layout sites
unconverted. AC-2 ("All 13 DSL sites write through `setLayout`") and AC-4 ("All 7 self-layout sites
converted") are the two acceptance criteria that certify the migration actually happened, and
neither's oracle can see most of what it certifies.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Replace with receiver-agnostic **zero-count** greps written verbatim into task 3.1 | A count is a mechanical oracle; catches every receiver and the fresh-object shape | Brittle to formatting — the regex must be written exactly, not paraphrased |
| B | Keep the greps as a human-read audit, add an expected-residual list to compare against | No regex fragility | Same class of oracle that let 8 of 14 sites hide in the first place |

**Recommendation: Option A, with the challenger's corrected regexes** — my first draft was wrong in
two ways it caught:

```bash
# DSL: must return 0.  (statement-anchored: excludes the three JSDoc prose hits at
#  absolute.ts:18, flex.ts:5, dsl/index.ts:4, and catches flex.ts:217 whose assignment wraps)
grep -rnE "^\s*[A-Za-z_.]+\.layout\s*=[^=]" packages/ui/src/view/dsl/

# self-layout: currently exactly 7, must return 0.
#  (no false positives — field initializers are `override layout: …`, which never matches `this.layout`)
grep -rnE "this\.layout\s*=" packages/{ui,forms,datagrid}/src
```

**Confidence: High. Hardening: challenger concurred (A) and corrected the patterns — a plain
`\.layout = ` grep misses `flex.ts:217` (the assignment wraps, the line ends at `=`) and returns
three JSDoc hits, so "must return 0" would have been unachievable as I first wrote it.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-003: ST-S3 / ST-S5's named test seam does not exist 🟠 MAJOR

**Dimension:** Testability · Codebase Alignment (Phantom Reference) · Feasibility
**Location:** `07-testing-strategy.md:32-33` ("`app-shell.fixtures.ts` already holds local host doubles for this package — reuse it rather than adding a second seam") · `99-execution-plan.md:19` (task 1.1)
**Codebase Evidence:** `packages/ui/test/app-shell.fixtures.ts` exports `ProcessExitError` (`:19`),
`expectExit` (`:27`), `FakeRuntimeAdapter` (`:46`), `CaptureStream` (`:184`), `FakeInput` (`:221`) —
terminal/`RuntimeAdapter` doubles. The similarly-named `app-shell-host-doubles.ts` is also a
`RuntimeAdapter` double (`:34 FakeRuntime implements RuntimeAdapter`). **No `ViewHost` double and no
`markRelayout` exists in any `packages/*/test`** (one comment hit, `accelerator-reveal.impl.test.ts:41`).
The word "host" is doing double duty — the terminal host and the `ViewHost` render seam are
unrelated. `ViewHost` (`view.ts:25-38`) has two required members; `View.host` (`:159`) is a plain
public settable field.

**The Problem:** the two tests carrying AC-1's and AC-3's whole weight point at a seam that is not
there, and the doc actively instructs the implementer *not* to add one. Task 1.1 is not executable
as written; a spec-first plan stalls at its first task.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Inline `ViewHost` literal on the public `host` field: `v.host = { markRepaint() {}, markRelayout() { n += 1 } }` | Two lines; observes `markRelayout` **specifically** | Couples the test to the `ViewHost` shape — breaks loudly if a third required member is added |
| B | The established counting-scheduler convention — `createRenderRoot(size, { caps, schedule })`, as in `accelerator-reveal.impl.test.ts:43-56` and `view.scheduler.spec.test.ts:29-44` (~13 files use it) | Matches an existing repo convention | **Fails the test it exists to write:** it counts *scheduled frames*, and `markRepaint` schedules too (`render-root.ts:296-300`) — so a `setLayout` that mistakenly called `invalidate()` instead of `invalidateLayout()` would pass ST-S3 and ST-S5 green. FR-4/AC-3 say "reflow", not "frame" |

**Recommendation: Option A.** The convention argument for B is real but loses to correctness: B
cannot distinguish the exact defect these oracles exist to catch. Also fix `07:32-33`, whose "rather
than adding a second seam" instruction is what would push an executor toward B.
**Confidence: High. Hardening: challenger concurred (A) and supplied the decisive argument against B
(repaint/relayout conflation), which I had not weighed.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-004: the P3 audit table pre-stamps ✅ verdicts on 17 of 20 sites, failing the criterion it *is* 🟠 MAJOR

**Dimension:** Logical Contradictions · Testability
**Location:** `03-02-migration.md:20-33` (the table) · `01-requirements.md` AC-5 (oracle: "03-02 §audit — one row per site, no blanks") · `99-execution-plan.md:31` (task 2.1)
**Evidence (artifact-internal):** AC-5 and task 2.1 both demand "one row per site, no blanks". The
table has 3 individually-traced rows plus **2 collapsed rows** covering the remaining 17 sites (one
row = four self-layout sites, one row = all 13 DSL sites), each carrying `—` in the "Starting
object" / "Replace clears" columns **and a pre-stamped ✅ convert verdict**. `03-02:8-12` argues that
an audit run after the migration "can only ratify" it — but a table whose verdicts are pre-filled
ratifies just as thoroughly, before the fact.

**The Problem:** the artifact that must satisfy AC-5 already fails it, and task 2.1 — the plan's
signature inversion, the thing it is proudest of — is reduced to a formality on 17 of 20 sites. The
decisive evidence that this matters is PF-001: **the `filter-popup.ts:285` misclassification hid
inside exactly one of these collapsed rows.** A per-site row with a "mounted at call time?" column
would have caught it.

**One sub-claim I am dropping.** An auditor argued that `edit-window.ts:77` and `form-dialog.ts:82`
inherit `Window`'s non-empty `{position:'absolute', padding:1}` (`window.ts:81`) and so are not
self-evidently "mechanical". The challenger refuted this and is right: both are *already spreads*
(`this.layout = { ...this.layout, padding: 0 }`), so replace-vs-merge is moot there. Recorded so it
is not re-raised.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Expand the two collapsed rows to one row per site with the **verdict column blank** before task 2.1 runs; keep the three traced rows with their verdicts (they are traced, not assumed); add a **"mounted at call time?"** column | Satisfies AC-5 as written; the new column is the one that catches the PF-001 class; makes the three runtime sites visible instead of buried under "mechanical" | ~17 rows of doc churn for sites whose verdict is genuinely foregone |
| B | Keep the collapsed rows; restate AC-5 to match what the table actually is | No churn | Deletes the plan's own safeguard by lowering the bar to meet the artifact — and PF-001 is the proof the safeguard was needed |

**Recommendation: Option A, scoped as described.** Accept the transcription cost: AC-5 is the
criterion, not the table. The "mounted at call time?" column is the highest-value single edit in
this whole report — the challenger's cross-cutting note is that PF-001, PF-002 and PF-004 are one
defect wearing three hats: **the inventory is organised by idiom (spread vs fresh, DSL vs self) when
the property that actually matters is *mounted at call time*.** Adding that column fixes PF-001's
premise and tells PF-002's grep what to look for.
**Confidence: High. Hardening: challenger concurred (A), refuted one sub-claim (dropped above), and
rated the finding MODERATE standalone — promoted to MAJOR by its coupling to PF-001.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

# 🟡 MINOR findings

### PF-005: the DSL inventory is 13 of 14 — `spacer()` is missing 🟡 MINOR

**Location:** `02-current-state.md` §2 table · `01-requirements.md` FR-4 / AC-2 · `99-execution-plan.md` task 2.4
**Codebase Evidence:** `packages/ui/src/view/dsl/flex.ts:215-219` —
`view.layout = typeof arg === 'number' ? { size:{kind:'fr',weight:arg} } : { size:{kind:'fixed',cells:arg.fixed} }`
inside `spacer()`. A freshly-constructed `Empty`, so replace ≡ merge and nothing moves — but the plan
converts four other fresh-object writes for exactly the stated consistency reason ("a reader should
not have to work out which of two idioms a builder uses").

The plan's own arithmetic already assumes 14: `02 §2:52` says "Eight of the thirteen … Five write a
freshly constructed Group/Stack", while its table lists **nine** merges and **four** fresh writes.
**9 + 5 = 14 closes; 8 + 5 = 13 does not.** `flex.ts:217` is the missing fifth fresh write.

**Recommendation:** add it as a 14th row, update FR-4/AC-2 to 14, add to task 2.4. It is also
self-correcting once PF-002's zero-count grep lands — which would otherwise surface `:217` as an
unexplained residual at close-out.
**Hardening: challenger rated MINOR (behaviourally moot), not MAJOR — adopted.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-006: ST-S6 and ST-S7 already exist verbatim, with stronger assertions 🟡 MINOR

**Location:** `07-testing-strategy.md:17-19` (the rule) vs `:40-41` (the tests) · `99-execution-plan.md:32` (task 2.2)
**Codebase Evidence:**

- **ST-S6** ≡ `packages/ui/test/dsl-absolute.spec.test.ts:20-25`:
  `v.layout = { direction:'col' }; at(v,3,4,20,2); expect(v.layout).toEqual({direction:'col', position:'absolute', rect:{…}})`
  — plus a rect-overload twin at `:28-33` and `dsl-hardening.impl.test.ts:120-128`.
- **ST-S7** ≡ `packages/ui/test/dialog.dsl-shape.impl.test.ts:14-17`:
  `expect(dlg.layout).toEqual({position:'absolute', padding:1, rect:{x:0,y:0,width:30,height:10}})`
  — across all four constructor branches — plus `dialog.centering.impl.test.ts:74-91` for the solved
  bounds.

Both existing assertions are **stronger** (whole-object `toEqual`, so they also catch a residual
prop). The plan's own rule at `07:17-19` forbids writing duplicates; only task 2.2 mandates them
unconditionally. **ST-S8 is genuinely new** — nothing asserts `StatusLine`/`ColorPicker`
`direction:'row'`, and the existing ColorPicker tests clobber layout wholesale
(`color-picker.spec.test.ts:74`, `color-picker.impl.test.ts:54,144`), so `color-picker.ts:220`'s
effect is currently unwatched.

**Recommendation:** delete ST-S6/ST-S7; name the four existing files as the oracles; extend task
2.5's "green **and unedited**" clause to 2.8. The cost of keeping them is not the writing — it is
creating a *second* oracle for the same invariant next to an immutable spec file, which is the thing
that later diverges silently. Make task 2.2 *run* the four named suites and record them green
pre-migration; that is the witness, at zero writing cost.
**Hardening: challenger rated MINOR, not MAJOR — adopted; recommendation concurred.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-007: two merge-spread sites were handed to #117 by name and nobody now owns them 🟡 MINOR

**Location:** `00-ambiguity-register.md` AR-2 ("the remaining ~118 composition writes belong to the open adoption issues that already own them")
**Codebase Evidence:** `packages/ui/src/app/application.ts:343` and `:347` —
`opts.menuBar.layout = { ...opts.menuBar.layout, size: {kind:'fixed',cells:CHROME_ROW_HEIGHT} }` and
the `statusLine` twin: the exact idiom `setLayout` absorbs. The completed sibling plan disowned them
**to #117 by name** — `plans/widget-flex-adoption/01-requirements.md:88` ("excluded — #117 owns the
merge pattern"), `03-01-ui-widgets.md:69-70` ("That is the boundary with #117"), repeated in
`codeops/features/layout-dsl-adoption/00-roadmap.md`. **GH #109 is CLOSED**; #110 is examples-only,
#112 docs, #114 local shadows — none touches `packages/ui/src/app/`.

**Recommendation:** add `:343`/`:347` to the FR-5 inventory and task 2.6 — two mechanical
`Group`-receiver conversions whose surrounding "Merge, not replace…" comments stay true verbatim,
and whose receivers are unmounted at that point (`root` is built at `:357` and mounted after), so
PF-001's invalidation change does not reach them. Amend AR-2 with one sentence: "+ 2 handed back by
#109". **Do NOT sweep the neighbouring `application.ts:333`** (`body.layout = {…}`) — the sibling
plan preserved it deliberately as an intentional wholesale replace ("a caller's own layout on the
content view is intentionally discarded", `application.ts:331-332`).
**Hardening: challenger rated MODERATE (→ MINOR on our scale), recommended conversion over
paper-trail, and supplied the `:333` carve-out I would have missed.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-008: the stated integration oracle is on an unmerged branch, and AC-6 over-claims 🟡 MINOR

**Location:** `07-testing-strategy.md:64-67` ("the frame snapshots added by the canvas plan are, in effect, this plan's integration oracle") · `02-current-state.md:3` ("measured … after the canvas and widget adoption plans landed") · `01-requirements.md` AC-6
**Evidence:** the canvas work is **PR #127 `feat/canvas-flex-adoption` → base `feat/dsl-adoptation`,
still OPEN** (`gh pr list`); it is not an ancestor of HEAD, and the frame-snapshot machinery
(`packages/examples/test/spawn-demo.ts`, the expanded e2e files) exists only there. No
`plans/canvas-flex-adoption/` directory exists on this branch. What the examples e2e actually
asserts today is **glyph containment** — `containers-demo.e2e.test.ts:44-60`: `expect(stdout).toContain('╔')`,
`toContain('Line 09')` — which a five-column dialog shift passes. AC-6's oracle list is "ST-S7,
ST-S8 + the adoption plans' existing suites", and neither ST reads a rendered cell.

**Recommendation:** restate AC-6 to what is provable — "every existing ui/forms/datagrid suite and
the examples e2e stay green **and unedited**" (the *unedited* is the load-bearing half: it is what
makes a green suite evidence) — delete the frame-snapshot sentence from 07 §Verification, and fix
`02:3` to say "after the widget adoption plan landed". Add one line to task 3.5 noting #127 targets
the same base and also edits the roadmap file task 3.4 touches, so whichever lands second rebases it.
**Do not** hard-gate this PR on #127: the real geometry oracles (`dialog.dsl-shape.impl.test.ts`,
`dialog.centering.impl.test.ts`, the DSL spec suites) are all present on this branch and all assert
literal rects. Cheap upgrade if a rendered-geometry witness is wanted: ST-S8 already promises the
two widgets "solve to their current literal geometry" — make that a literal-`bounds` assertion after
a forced flush and it becomes the witness AC-6 lacks, with no new machinery.
**Hardening: challenger rated MODERATE (→ MINOR), rejected the hard-sequencing option as
over-constraint, and proposed the ST-S8 upgrade.**

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-009: stale counts and labels, repeated across every document 🟡 MINOR

**Dimension:** Consistency · Codebase Alignment (Stale Assumptions)

| Claim | Where | Reality |
|---|---|---|
| "11 field initializers" (12 occurrences, incl. **AC-8** and task 3.4) | `00-index:14,42-44` · AR-1/AR-3/AR-7 · `01:78,86,89` · `02:110-115` · `03-01:19` · `99:12,42,45` | **10.** `grep -rn "override layout" packages/*/src` → 10, and `02 §5.3` itself enumerates exactly those 10 |
| "138 writes / 24 reads"; "ui 98 · theme-designer 4" | `00-index:14,39` · `02 §5.1` | **144 writes**; ui **97**, theme-designer **11** (`preview-panel` ×2, `gallery`, `inspector-panel`, `app.ts` ×4, `roles-panel` ×2, `walkthrough`) |
| "Eight of the thirteen … Five write a freshly constructed Group/Stack" | `02:52-53` · `03-02:29,37,40` | **Nine spreads, four fresh** — and `03-02:40` says "the five" while naming four (see PF-005: the true fifth is `flex.ts:217`) |
| "0/17 tasks" · "3 phases, 17 tasks" | `99:5` · `00-index:34` | **19** (6 + 8 + 5). exec_plan's progress arithmetic reads this line |
| "20 conversions across 6 files" | `00-index:50` | **10 files** (3 DSL + 7 self-layout), plus `view.ts` for the primitive |
| "The one intentional red in this plan" | `99:33` · `07:44-45` | Phase 1 has four deliberate reds (`99:17,20`). `07:39`'s scoped wording ("the only ST *here*") is fine; the two unscoped restatements are not |
| "P2" | AR-2 (= 20 sites, "exactly the issue's P2 wording") vs `02 §3` heading + `02 §5.4` (= 7 sites) | Two incompatible definitions; §5.4 is presented as a *correction to the issue* premised on P2 = 7 |

**Recommendation:** re-measure and restate all of it, keeping `02 §5` as the single source of truth
and having the other documents cite it rather than restate. Record the measurement commands beside
the numbers so the next re-measure is mechanical. AC-8's wording ("the 11 field initializers still
compile") and task 3.4 (which propagates the count onto the issue and roadmap) are the two places
where a wrong number does downstream damage.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-010: `TUI_SKIP_PERF=1` does not survive turbo — the phase gate is not the command it says 🟡 MINOR

**Location:** AR-4 · `01:56-57` (NFR-4) · `01:77` (AC-7) · `07:62` · `99:8,48`
**Codebase Evidence:** `verify` fans out through turbo (`package.json:23`), and `turbo.json` declares
**no** `env`, `globalEnv`, or `passThroughEnv` (verified: zero matches). Turborepo 2.x
(`"turbo": "^2.10.5"`) defaults to Strict Environment Mode, so the variable never reaches the task
processes that read it. This is a **recurring trap in this repo** — the same finding is recorded in
the sibling `widget-flex-adoption` plan's close-out notes.

**The Problem:** the prefix is inert, so the perf assertions run at every phase gate regardless. That
makes the gate *stricter* than intended, not weaker — so it is a false-failure risk on a loaded
machine, not a correctness hole. But AR-4 is a user-ruled decision whose stated mechanism does not
work.

**Recommendation:** either add `"globalPassThroughEnv": ["TUI_SKIP_PERF", "CI"]` to `turbo.json` as
an explicit Phase-1 task (fixes it repo-wide and retires the trap), or drop the prefix from the gate
command and accept that perf tests run. The first is the better use of the opportunity — this is at
least the second plan to trip over it.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-011: NFR-3's `yarn bench` oracle measures a different package 🟡 MINOR

**Location:** `01:51-54` (NFR-3) · `07:74-75` · `99:44` (task 3.3)
**Codebase Evidence:** `package.json:34` → `"bench": "yarn workspace @jsvision/core bench"` →
`packages/core/bench/frame-bench.mjs`, which imports only `ScreenBuffer`, `serialize`,
`resolveCapabilities` and measures compose+diff / single-cell / full serialize. It never imports
`@jsvision/ui`, never runs a layout pass, and cannot reach `View.setLayout`. `packages/ui/` has no
`bench/` directory.

**The Problem:** "a visible regression in the layout pass stops the phase" is unfalsifiable twice
over — the instrument measures a different package, and "visible" names no threshold or baseline. An
executor at task 3.3 has no defined pass/fail rule. This matters more than usual because the repo's
quality profile sets `perf_critical: true`.

**Recommendation:** drop the bench from NFR-3 / 07 / task 3.3 and rest on the analytical argument
already made in `03-01:33-37` (one object allocation + a coalesced flag write) — which is sound and
sufficient for a two-line method. State plainly that no oracle in this repo measures the ui layout
pass. Do not leave a `perf_critical` change resting on a gate that measures somewhere else.
Secondary: NFR-3's "allocates one object per call, exactly as the spread it replaces did" is
inexact for the five fresh-object sites, where a plain reference assignment becomes a spread — the
cost is genuinely negligible, but the sentence should say "negligible and unmeasured".

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-012: NFR-5's `check:docs` oracle does not gate `setLayout`'s `@example`, and the snapshot-drift cause is misstated 🟡 MINOR

**Location:** `01:59-62` (NFR-5) · `03-01:50-54` (§The API-reference snapshot)
**Codebase Evidence:**

- `scripts/check-jsdoc.mjs` Check B (`:15-17,161-187`) inspects only **values re-exported from a
  package's `src/index.ts` that are a class or a function** — never class *members*. `setLayout` is a
  method on `View`, so `yarn check:docs` will pass whether or not it carries an `@example`. NFR-5's
  "passes `yarn check:docs`" is vacuously true. (Check A — banned CodeOps/TV references — does still
  apply to the file.)
- `scripts/api-extract.mjs` emits member **signatures without JSDoc** (`classMemberSig`, `:86-101`),
  and the committed `View` entry (`tools/claude-plugin/…/references/api/layout-views.md:486-501`)
  carries no per-member prose. So editing the `layout` field's JSDoc alone would **not** drift the
  snapshot — **adding the `setLayout` member will** (it passes `isPublicMember`, `:75-83`).

**The Problem:** task 1.5 is still required, but for the opposite reason to the one stated — which
risks a future reader skipping `plugin:sync` after a JSDoc-only edit, or expecting drift where there
is none. And the `@example` requirement (a NON-NEGOTIABLE in CLAUDE.md) has no mechanical gate here.

**Recommendation:** restate the drift cause as "adding a public member to `View`", and back NFR-5's
`@example` requirement on the CLAUDE.md documentation directive plus review, not on a gate that does
not check it.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-013: no impl-test tier, and `setLayout({ prop: undefined })` is unspecified 🟡 MINOR

**Location:** `07-testing-strategy.md` (ST-S1…S8 are all `*.spec.test.ts`) · `99` tasks 1.1/2.2/2.3 · `01:9-12` (FR-1) · `03-01:9-12`
**Evidence:** CLAUDE.md §Special rules orders "spec tests → red → implement → green → **impl tests** →
verify", and the repo runs a four-tier strategy; every sibling plan carries impl work. This plan has
none — a new public primitive on the class every view inherits ships with zero internals/edge
coverage. The uncovered edges are concrete:

- `setLayout({})` — harmless clone + one flag write, but unasserted.
- **An explicit `undefined` value.** `tsconfig.base.json` sets `strict` but **not**
  `exactOptionalPropertyTypes`, so `setLayout({ size: undefined })` typechecks and — by spread
  semantics — **clears** an existing `size`. The engine tolerates this coherently
  (`normalizeProps`, `packages/ui/src/layout/types.ts:206-221`, uses `??` / `=== undefined`
  throughout and never `in`/`hasOwnProperty`; `normalizeSize(undefined) → {kind:'auto'}`), so
  "undefined = reset to default" is a defensible contract — it is simply not stated anywhere.
- Invalidation coalescing across a loop — the NFR-3 claim, currently unasserted.
- **Replace-not-mutate identity.** `setLayout` assigns a *new* object; several call sites hold and
  mutate a `layout` reference in place (see PF-016).
- Related: GH #117's body documents the un-set path (`setLayout({ position:'flow' })` drops back to
  flow and the stale `rect` is ignored — confirmed at `layout/types.ts:211-221`). The plan drops that
  guidance, leaving task 1.4's `@example` without it.

**Recommendation:** add one task after 1.6 — `packages/ui/test/view-setlayout.impl.test.ts` covering
the four edges above — and rule explicitly in the JSDoc whether an explicit `undefined` is a
supported clear.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-014: a `setLayout` call in a base constructor is silently erased by a subclass field initializer 🟡 MINOR

**Location:** `00-ambiguity-register.md` AR-3 ("they cannot exhibit the footgun — a freshly-constructed object has no sibling props to drop") · `03-01:39-45` (the JSDoc task)
**Evidence:** JS class-field ordering runs a base constructor body **before** a subclass's field
initializers, so a `super()` that calls `this.setLayout({…})` is wholesale overwritten by
`override layout: LayoutProps = {…}`. Ten such initializers exist (`window.ts:81`, `tab-view.ts:138`,
`tree.ts:96`, `list-view.ts:84`, `menu/popup.ts:56`, `dropdown/popup.ts:125`, `combo-box.ts:64`,
`date-picker.ts:33`, `color-picker.ts:112,136`).

**There is no live instance** — `dialog.ts:109` runs in `Dialog`'s own constructor, after `Window`'s
initializer has applied, and no class calls a tagger on `this` from a constructor that a
field-initializing subclass extends. Hence MINOR. But `setLayout` is about to be documented as *the
preferred write path* with a copy-pasteable `@example`, and a widget author following that advice
from a subclassable base hits this silently. AR-3 is right in the direction it considers and blind
in this one.

**Recommendation:** add the constraint to task 1.4's JSDoc ("a `setLayout` call in a constructor is
overwritten by any subclass declaring `override layout = {…}`; prefer `setLayout` after construction
or in `onMount`"), and record it in AR-3 as a second facet of the field-initializer problem P4 must
solve.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-015: NFR-6's containment statement is falsified by the plan's own tasks 🟡 MINOR

**Location:** `01:64` (NFR-6: "No file outside `packages/{ui,forms,datagrid}/src` is touched")
**Evidence:** task 1.5 (`99:23`) runs `yarn plugin:sync --fix`, which rewrites the committed snapshot
under `tools/claude-plugin/skills/jsvision/references/api/`; tasks 1.1/2.2 add files under
`packages/ui/test/`, not `src/`. AC-9 (`01:79`) states the intended, looser rule correctly and is
unaffected — NFR-6 is simply stricter than the plan intends and unachievable as written. Minor
ambiguity alongside it: AC-9's "another package's `src/`" has no stated referent.

**Recommendation:** align NFR-6's wording with AC-9's, explicitly allowing `packages/ui/test/**` and
`tools/claude-plugin/**`; name the packages in AC-9.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-016: in-place `.layout.<prop> =` mutation is a third write shape, absent from the inventory and from P4's preconditions 🟡 MINOR

**Location:** `02 §5` (inventory) · `01:84-87` + AR-1 (P4's blockers) · `99:45` (task 3.4)
**Codebase Evidence:** `grep -rnE "\.layout\.[a-zA-Z]+ = " packages/*/src` → 13 hits (3 are JSDoc
examples): `packages/ui/src/desktop/gestures.ts:42,57,75` · `desktop/arrange.ts:18` ·
`window/window.ts:188,190,205` · `editor/edit-window.ts:78` · `packages/docs-site/src/demo-shell.ts:216`.
Several are the exact runtime drag/resize/maximize "set and forget" paths the issue opens with, and
each hand-calls `invalidateLayout()` afterwards (`gestures.ts:43,59`) — i.e. they are the strongest
`setLayout` candidates in the codebase. One of them, `edit-window.ts:78`, sits **directly under** a
site this plan converts.

Not a defect today (they invalidate manually), and not a live bug under this plan (`setLayout`
produces a fresh object which `:78` then mutates; `Window`'s initializer object is per-instance).
But it is invisible to P4: a read-only `layout` getter would not stop `view.layout.rect = …`, so
P4's precondition list is incomplete — which defeats the stated purpose of task 3.4 ("the next
planner does not rediscover them"). The same applies to the ~700 `.layout =` writes in
`packages/*/test` and `packages/examples`, all inside the typecheck graph.

**Recommendation:** add a paragraph to `02 §5` recording the shape and its sites, and extend task
3.4's P4 precondition list with (a) the in-place-mutation class — closing it needs a frozen or cloned
`LayoutProps`, not just a getter — and (b) the test/example write population, or an explicit
statement that P4's scope was measured over `packages/*/src` field assignments only.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-017: ST-S8's tier, target file, and strength are all unsettled 🟡 MINOR

**Location:** `07:41-42` · `99:32` (task 2.2)
**Evidence:**

- **Tier.** ST-S7/ST-S8 are derived from *current implementation output* (a literal `Dialog` rect;
  `StatusLine`'s constructor-set direction), not from a requirement — yet they land in
  `*.spec.test.ts`, which CLAUDE.md defines as an **immutable oracle** derived from requirements
  only. Repo precedent is unambiguous: every existing literal-geometry witness of this kind is an
  impl test (`dialog.dsl-shape.impl.test.ts`, `dialog.centering.impl.test.ts`,
  `dsl-hardening.impl.test.ts`). Freezing implementation geometry as immutable also collides with
  this epic's direction — `codeops/features/layout-dsl-adoption/00-roadmap.md` records a *maximal
  flex-elimination*, and CLAUDE.md §"Deliberately non-faithful components" reserves the right to move
  dialog child positions. ST-S1…S5 are correctly spec (they derive from FR-1/FR-2/FR-4).
- **File.** ST-S7 says "`packages/ui/test/` dialog suite" and ST-S8 says "`packages/ui/test/`" —
  neither names a file. Six plausible dialog suites exist. Landing either inside an existing
  `*.spec.test.ts` edits an immutable oracle.
- **Strength.** ST-S8's two subjects both extend `Group` (which does not initialize `layout`) and
  both write in a constructor where `host` is null — so replace, merge, and merge+invalidate are
  provably indistinguishable, as `02:72-73` itself says. It cannot go red for any reachable reason.

**Recommendation:** put the surviving migration witnesses in `view-setlayout.impl.test.ts` (or fold
them into the existing impl suites per PF-006), keep `view-setlayout.spec.test.ts` for ST-S1…S5, and
name exact files. Keep ST-S8's ColorPicker half — it covers a genuinely unwatched constructor line —
and upgrade it to a literal-`bounds` assertion after a forced flush (per PF-008) so it earns its
place.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

### PF-018: Phase 3 omits the roadmap / issue reconciliation the sibling plans all carry 🟡 MINOR

**Location:** `99` tasks 3.4-3.5
**Evidence:** sibling precedent — `plans/widget-flex-adoption/99-execution-plan.md:64` ("Reconcile the
#109 and #116 issue bodies **and the roadmap tracker rows** with the executed scope, before closing
either issue"); `plans/focus-traversal-primitive/99-execution-plan.md:100`. The target exists at
`codeops/features/layout-dsl-adoption/00-roadmap.md` (the `#117` row reads 📋 Plan created; the header
reads "6 / 12 issues done"), and **#117 is OPEN and the right target** — so task 3.4's file half is
sound. What is missing: nothing updates the `#117` tracker row's stage, the header progress line, or
#117's own P1/P2/P3 checkboxes — and #117's body still carries the stale `225 writes / 29 reads` and
the "P1 + the getter" design that `02 §5` refutes.

**Recommendation:** extend 3.4 to reconcile the #117 issue body (counts + the P1-getter correction)
and tick P1–P3, and to update the roadmap tracker row and progress header, before 3.5's PR.

**User Decision:** ✅ Accepted as recommended (2026-07-20)

---

# 🔵 OBSERVATIONS

### PF-019: task 1.2's "verify red" does not name the command 🔵

`99:20` says "Verify **red** — all four fail because the method does not exist". Before task 1.3,
`view.setLayout(...)` is a *TypeScript* error, so the phase verify (which runs `typecheck` before
`test`) fails at typecheck and never reaches the assertions; vitest itself will run (esbuild strips
types) and fail with "setLayout is not a function". Two different reds, only one of which is the
intended evidence. Suggest: "observe red via `yarn workspace @jsvision/ui test view-setlayout`;
`yarn typecheck` is expected to fail at this task and is not run until 1.6."

### PF-020: the kitchen-sink ruling is absent rather than recorded 🔵

`codeops/kitchen-sink-gate.md` §Scope puts non-visual capabilities (explicitly including layout math)
in the "story when it is meaningful to show" bucket, so **no story is required** — but CLAUDE.md
frames the rule as NON-NEGOTIABLE at make_plan time, and the closest analogue records the ruling
explicitly (`plans/focus-traversal-primitive/99-execution-plan.md:85`: "no new visual widget, so per
the CLAUDE.md kitchen-sink scope no story is required"). Silence is indistinguishable from an
oversight. Suggest one line in Phase 3, plus "confirm the kitchen-sink and layout-dsl-playground
smoke suites pass unedited" — FR-4 changes the runtime behaviour of the taggers those suites
exercise.

### PF-021: two stale-guidance / inner-loop notes 🔵

1. The plugin skill's hand-written `tools/claude-plugin/skills/jsvision/references/widget-authoring.md:30`
   still tells widget authors to call `this.invalidateLayout()` after a layout change. Once
   `setLayout` is "the preferred write path" that guidance is stale, and task 1.5 covers only the
   *generated* `references/api/` snapshot, not this hand-written guide.
2. A scoped inner-loop run (`yarn workspace @jsvision/datagrid test`) bypasses turbo's `^build` and
   asserts against a stale `ui` dist — the repo's known trap. Worth one line on task 2.6.

---

## Same-session review note

This report was produced in a **different session** from the one that authored the plan, and the
13-dimension scan was fanned out to five independent auditors plus one challenger that received the
MAJOR findings *without* the lead's preferred resolutions. Where the challenger disagreed, the
disagreement is recorded in the finding (PF-002's regex correction, PF-003's argument against the
scheduler seam, PF-004's dropped sub-claim, PF-005/006/007/008's severity downgrades). Independence
risk is therefore low, but not zero: every auditor shares this model's priors.

## Verdict

**✅ PREFLIGHT PASSED — all 21 findings resolved** (0 critical; 4 major and 14 minor decided, 3
observations accepted). No design change was required: the plan's core technical decisions — shallow
merge, unconditional invalidation, P4 deferral, phase ordering, and leaving `stack.ts:153` alone —
all survived adversarial review intact. Every finding resolves to a document edit or an added task.

**The plan is not execution-ready until those edits are applied.** A false premise (PF-001) and three
defective oracles (PF-002, PF-003, PF-004) are still sitting in the documents an executor would read.
Scope also grew by ruling: +2 conversion sites (PF-007), +1 DSL site (PF-005), a `turbo.json` task
(PF-010), and an impl-test task (PF-013) — so the plan is now **~22 conversions across 11 files and
21 tasks**, and 99-execution-plan's headers must be re-derived rather than patched.

The roadmap row for #117 is deliberately **not** advanced to 🔬 Plan Preflighted until the edits land.

---

# Iteration 2 — re-scan after fixes

> **Scanned**: 2026-07-20, after all 21 iteration-1 fixes were applied and all 8 documents rewritten.
> **Method**: 2 independent preflight-auditors (document soundness · grounding + delivery), dispatched
> specifically because the rewrite was done by the same model that would otherwise be reviewing it.
> **Result**: **14 findings — 3 major, 9 minor, 2 observation — all resolved and applied.**

**Fix verification.** Both auditors independently re-measured the load-bearing figures and confirmed
18 of 21 iteration-1 fixes landed fully and correctly, including every code line number, the
per-package write census, the two audit greps (14 and 7 today; the `[^=]`-only form returns 13,
missing `flex.ts:217` exactly as documented), the task count (8+9+5 = 22), and every renumbered
`[02 §N]` cross-reference. Three landed only in the document the finding named, not in its siblings
(PF-025, PF-026, PF-028 below).

**The rewrite's own defect — and it is the same class the first scan caught.**

### PF-022: `window.ts:161` is a second behaviour-changing site 🟠 MAJOR → resolved

**Found independently by both auditors.** `packages/ui/src/window/window.ts:159-163`
(`commitPlacement()`) writes `this.layout` and does **not** call `invalidateLayout()`; its only
callers are `desktop.ts:213,222,235`, on a live mounted window at gesture start. So converting it
genuinely **adds** a reflow — unlike `filter-popup.ts:285` and the two tagger paths, which already
reflow. The revised plan nonetheless still claimed "no site in the codebase observes it", and its own
audit table marked row 18 "mounted: yes" with a blank verdict.

This is precisely the miss PF-001 caught, on the one remaining mounted site — and it survived because
FR-6's audit asked only about *replace*-dependence, so task 2.1 would never have surfaced it. **Fix:**
new **FR-4a**, a new [02 §3a](02-current-state.md) invalidation-delta table covering all four mounted
sites, an explicit **second audit question** in FR-6 (mounted + does the path already reflow), row 18
carrying the delta, and task 2.6 flagging it. Risk is low — `commitPlacement` writes `bounds` back
into `layout.rect`, so the extra reflow recomputes identical geometry — but the *claim* was false.

### PF-023: ST-S8 was specified in three documents and written by no task 🟠 MAJOR → resolved

The rewrite deleted ST-S6/ST-S7 (already covered) and moved ST-S8 to the impl tier, but task 1.6
covered only ST-I1…I4 and task 2.2 said "no new tests here" — so the plan's single genuinely new
witness had no owner. **Fix:** renamed **ST-I5** (the prefix now always means tier) and assigned to
task 2.2, written green-first before the task-2.6 conversion it witnesses.

### PF-024: the `grid-panels` rationale was false as stated 🟠 MAJOR → resolved

The rewrite asserted, in four documents, that both mounted tagger paths "already invalidate through
their surrounding `bind(…, {relayout:true})`". True for `split-view.ts:170-171`; **false for
grid-panels** — `grid.ts:689` passes no options object at all, so that bind is repaint-only. The
conclusion survives by a different mechanism (`rebuildBody()` reflows via `Group.add`/`Group.remove`,
`group.ts:93,115`), but a wrong rationale can leak into a shipped code comment under AR-8. **Fix:**
the accurate two-mechanism split now appears in FR-4, AR-5, 03-02 and 02 §3a.

### Minor findings, all resolved

| # | Finding | Fix |
|---|---|---|
| PF-025 | AR-2 still called the scope "the issue's P2 scope"; #117 actually puts the DSL half in P1 | AR-2 restated; 02 §5.4's definition is now the only one |
| PF-026 | AR-5 still said "the plan's one deliberate red" unscoped, contradicting Phase 1's four | Scoped to Phase 2 |
| PF-027 | "Only `dialog.ts:109` has a non-empty starting object" — false; `edit-window.ts:77` and `form-dialog.ts:82` inherit `Window`'s too (they are already spreads, so the *risk* claim was right) | Rewritten to distinguish non-empty *starting object* from non-empty *replace* |
| PF-028 | The feature roadmap's #117 row still carried all four corrected figures, and the portfolio roadmap was untouched; task 3.4 only updated the stage | Task 3.4 now rewrites the figures in both roadmaps and fixes the #109 row's stale `:347`/`:353` line numbers |
| PF-029 | The report header contradicted the revised docs it audited | This header now marks iteration 1 as a historical snapshot |
| PF-030 | `app-shell.composition.spec.test.ts` was missing from the oracle list, though **ST-W4** (`:151-160`) is a mechanical immutable guard that goes red if `application.ts:333` is wrongly converted | Added to 02 §7, task 2.2, and cited in AC-4 |
| PF-031 | ST-S8's solved-bounds half was **vacuous** — `direction:'row'` is the engine default (`types.ts:213`) and nothing reads `layout.direction`, so replace/merge/deletion all solve identically | Reduced to an object-shape witness; the false "gives AC-6 its rendered-geometry witness" claim deleted |
| PF-032 | `"CI"` in `globalPassThroughEnv` is inert (turbo already passes it in strict mode), and editing `turbo.json` invalidates every cached task | Task 1.0 drops `"CI"` and warns about the one-time monorepo-wide cache miss |
| PF-033 | "18 reads" had no reproducible command; the reconstruction gives **17** | Corrected to 17 and the command added to 02's measurement box |
| PF-034 | ST-I2 was the sole oracle for AC-1a, an FR-derived *contract*, but sat in the impl tier | Promoted to **ST-S9** in the spec file |
| PF-035 (🔵) | "10 subclasses" — there are 10 initializers across **9** classes (`color-picker.ts` has two) | Reworded |
| PF-036 (🔵) | ST-S8's `S` prefix meant "spec" everywhere else, risking landing it in the wrong file | Renamed ST-I5; an identifier note records that S6/S7 are retired and not reused |

## Final verdict

**✅ PREFLIGHT PASSED — 35 findings across 2 iterations, all resolved, all fixes applied.**

Iteration 2 was worth running: it caught a MAJOR of the same class as iteration 1's headline finding
(`window.ts:161`), a specified-but-unowned test, and a false codebase claim the rewrite itself
introduced — none of which the first scan could have seen, because none of them existed yet.

**Convergence.** Iteration 2's findings are markedly less severe than iteration 1's: no false
premises about the plan's purpose, no phantom fixtures, no defective oracles. The remaining risk is
ordinary execution risk. A third iteration is not warranted.

The #117 roadmap row can now advance to 🔬 **Plan Preflighted**.
