# Preflight Report: layout-field-lockdown

> **Artifact**: `codeops/features/layout-dsl-adoption/plans/layout-field-lockdown/` (9 documents, 814 lines)
> **Scanned against**: `feat/dsl-adoptation` @ `e134d108` (clean tree)
> **Date**: 2026-07-20 · **Iteration**: 1
> **CodeOps Skills Version**: 3.11.0
> **Method**: codebase-grounded 13-dimension scan; two parallel auditor clusters (delivery ·
> grounding+fit) merged into one PF sequence by the lead, every finding re-verified against the code.

> ⚠️ **Independence note** — the plan was authored in a prior session by the same model family.
> Findings that depend on TypeScript semantics were checked against the compiler or against
> committed precedent in this repo rather than from memory.

## Verdict

✅ **PREFLIGHT PASSED — all 25 findings resolved**

*(Scan outcome was ❌ BLOCKED — 4 critical / 10 major. The maintainer accepted every recommendation
on 2026-07-20 and the fixes were applied to the plan documents in the same session; see the decision
ledger at the foot of this report.)*

| Severity | Count |
|---|---|
| 🔴 CRITICAL | 4 |
| 🟠 MAJOR | 10 |
| 🟡 MINOR | 10 |
| 🔵 OBSERVATION | 1 |
| **Total** | **25** |

The plan's *analysis* is unusually strong — the measured-spike method, the escape-hatch discovery and
the AR-13 test-surface correction are all real and all verified. What it is missing is the **blast
radius of the flip beyond the write sites**: five committed oracles, a ratcheted `@example` guard, a
generated plugin snapshot, 16 documentation snippets, three deliberate-erasure call sites, and one
whole package's `test/` directory. Every one of those is inside `yarn verify`, which AC-9 requires
green at each phase boundary.

## Codebase context summary

Verified accurate: `view.ts:73`/`:251-256`; exactly 10 `override layout` hatches at the stated lines;
`view/reflow.ts:78` and `view/dsl/stack.ts:139`; `examples/tsconfig.json` (6 dirs, 255 `.ts`,
`rootDir` already `"."`); `datagrid/tsconfig.typecheck.json`; the 8 `.mjs` imports from
`packages/examples`; all 5 name shadows; 18 canvas sites across 8 files with `tabs-demo` at 0;
`spike-data-studio` 13 sites and no typecheck script; the DSL builders already route through
`setLayout`; `Object.assign` against `Readonly<LayoutProps>` needs no cast, and `props: view.layout`
still assigns to `LayoutBox.props`.

Verified inaccurate: `theme-designer` has a `test/`; `ui/src` is ~30 not 31; `examples/**` non-test is
~55/27 not 61/30; the invalidate-pairing claim; the layout-object holder survey.

---

## 🔴 CRITICAL

### PF-001 — AC-6 forbids the edits Phase 2.3 and Phase 1.3 are made of

**Dimension**: Logical Contradictions · Testability

AC-6 (`01-requirements.md:67-68`): *"No `*.spec.test.*` file that predates this plan is modified,
except where the latent-defect policy explicitly rules a fixture wrong."*

Measured: **152** pre-existing `*.spec.test.ts` files contain `.layout` write sites, out of 395 spec
oracles. Task 2.3.1–2.3.4 (`99-execution-plan.md:73-76`) converts 703 test sites; task 1.3.3/1.3.4
clears 145 type errors in `ui/test` + `core/test`, which are majority spec files. AC-6 as written
makes the plan unacceptable on completion, and an executor grepping it will stop.

The tension is real, not clerical: the coding standards make a `*.spec.test.*` an immutable oracle.
AR-13 chose to convert all 703 sites without reconciling that against AC-6.

**Options**
- **(a) — recommended.** Restate AC-6 as an *assertion*-immutability rule: "no spec test's assertions,
  expectations or fixtures change meaning; a mechanical `x.layout = {…}` → `x.setLayout({…})`
  rewrite of test *setup* is explicitly permitted and is not an oracle change." Add: every
  non-mechanical spec edit gets a recorded verdict. This is what the standards actually protect —
  the oracle, not the seed statements — and it is the only reading under which AR-13(b) is coherent.
- **(b)** Keep AC-6 and exempt spec-test setup from the lockdown, converting only impl/e2e tests.
  Rejected: it re-creates AR-13's half-measure in 152 files, and the flip would not compile with
  them unconverted once their `test/` is typechecked.
- **(c)** Widen the latent-defect policy to cover all 703. Rejected: it dilutes a policy whose value
  is that it names a small, individually-reasoned set.

*Confidence: high. Hardening: counts measured directly; both auditor clusters raised it independently.*

---

### PF-002 — The flip turns `jsdoc-examples.spec.test.ts` red, and the fix is inside AR-11's out-of-scope boundary

**Dimension**: Codebase Alignment (impact blindness) · Dependency Issues

`packages/docs-site/test/jsdoc-examples.spec.test.ts` compiles **every** `@example` block under
`SHIPPED_ROOTS` (`jsdoc-examples.mjs:29-36`, includes `packages/ui/src`) and ratchets the result
against `jsdoc-examples.allowlist.json` (161 entries). Its pinned contract:
a block **absent** from the allowlist passes only if it compiles; an **allowlisted** block passes
only if it still fails with *exactly* the recorded codes; an allowlisted block that starts compiling
is **STALE and fails**.

Three shipped `@example` blocks assign `layout.rect`:

| Block | Allowlist status | After the flip |
|---|---|---|
| `ui/src/window/window.ts::Window` (`:73`) | **absent** (0 entries for that file) | gains `TS2540` → **fails** |
| `ui/src/app/application.ts::createApplication` (`:316`) | absent | gains `TS2540` → **fails** |
| `ui/src/desktop/desktop.ts::Desktop` (`:58`, `:63`) | present, `codes:[2322]` | codes no longer match → **fails** |

So Phase 2.4 guarantees a red `yarn verify`, breaching AC-9 — and repairing the `Desktop` row means
editing the very allowlist AR-11 (`00-ambiguity-register.md:30`) declared out of scope on the grounds
of *"zero coupling"*. The coupling is direct.

**Options**
- **(a) — recommended.** Add a Phase 2.4 task: rewrite the three `@example` blocks to `setLayout({ rect })`,
  and re-verify the `Desktop` allowlist entry (its `TS2322` may survive alone, or the entry may become
  stale and need deleting). Amend AR-11 to say #131's *allowlist file* is touched by this plan even
  though #131's 161-entry drain is not.
- **(b)** Allowlist the three new `TS2540` failures. Rejected outright: it ships public documentation
  that teaches an idiom the release forbids, which the project's documentation directive treats as a
  contract violation, and the ratchet exists to prevent exactly this.

*Confidence: high — the allowlist and the guard were read directly.*

---

### PF-003 — Two committed tests assert the opposite of ST-6, falsifying AR-2's central safety claim

**Dimension**: Codebase Alignment (stale assumption) · Logical Contradictions

AR-2 (`00-ambiguity-register.md:21`): *"**Identity risk checked and cleared**: the only holder of the
layout object is `reflow.ts:78` … No long-lived reference exists, so in-place mutation is
**unobservable today**."* `03-02:109` repeats it.

`packages/ui/test/view-setlayout.impl.test.ts` observes it, deliberately:

- `:42` — test titled *"setLayout({}) preserves the props, **replaces the object**, and invalidates"*,
  asserting `expect(v.layout).not.toBe(before)` at `:52`.
- `:106-115` — *"ST-I4 — setLayout replaces the layout object rather than mutating it in place.
  **Sites that write `view.layout.rect = …` rely on the previous object staying untouched by a later
  patch.**"* → `expect(v.layout).not.toBe(before); expect(before).toEqual({ direction: 'col' });`

Both fail under `Object.assign`. The plan never mentions them. The survey behind AR-2 covered
`packages/*/src` only, and its conclusion was stated repo-wide.

Compounding: `07-testing-strategy.md:47` names `packages/ui/test/view.set-layout.impl.test.ts` **to
extend** — that file does not exist. The real files are `view-setlayout.impl.test.ts` and
`view-setlayout.spec.test.ts`, the latter never referenced by the plan at all.

**Options**
- **(a) — recommended.** Add a Step 2.4 task: invert ST-I1's identity assertion and delete ST-I4,
  recording that the replace contract was deliberately superseded by ST-6. Correct the filename at
  `07-testing-strategy.md:47`. Amend AR-2 to state the identity contract **was** observed (by one
  impl test) and is being knowingly inverted — an inverted contract is fine, an undiscovered one is not.
  Both files are `.impl.`, so AC-6 does not block the edit.
- **(b)** Keep replace semantics and drop ST-6. Rejected: it reopens AR-2's real problem — a class
  field cannot override an accessor, and replace + `readonly` cannot coexist without a cast (FR-6).

*Confidence: high. Both auditor clusters found this independently; assertions read directly.*

---

### PF-004 — ST-7/ST-8 are authored nine tasks before the flip, leaving the 816 conversions with no verify signal

**Dimension**: Ordering & Sequencing

`99-execution-plan.md:61` schedules the `@ts-expect-error` type-level ratchet at task **2.1.2**; the
flip that makes those directives valid is **2.4.1/2.4.2** (`:80-81`). The plan concedes it at `:82`
(*"confirm they were red against the pre-flip field"*).

An **unused** `@ts-expect-error` is `TS2578` — a hard compile error, not a failing assertion. Repo
precedent confirms the mechanism: `packages/datagrid/test/types.spec.test.ts:3-5`. Root verify runs
`turbo run typecheck build test check:docs`, and `turbo.json` has `test.dependsOn: ["build","^build"]`,
so a red `ui` typecheck aborts the run. Tasks 2.2.1 → 2.3.4 — **nine tasks, 816 edits** — would land
with `yarn verify` dark.

This nullifies AR-7's own rationale for convert-first (`00-ambiguity-register.md:26`: *"(b) leaves the
repo red for the entire phase — no task could verify"*). The plan re-creates the condition it
rejected, through its own spec task. ST-6 has the same shape at runtime (2.1.1), though it reddens
only `test`.

**Options**
- **(a) — recommended.** Move 2.1.2 (and ST-6 out of 2.1.1) to sit immediately *before* 2.4.1, as one
  task: author → observe red → flip → green. Spec-first is preserved; the red window shrinks from
  nine tasks to one.
- **(b)** Author them in a file excluded from `include` until 2.4.1. Rejected: config churn plus a
  real risk the exclusion is forgotten, silently disarming the ratchet.
- **(c)** Waive rule 2 for 2.2.x/2.3.x. Rejected: it removes the compiler from the phase whose stated
  design is *"the compiler is the primary oracle"* (`07-testing-strategy.md:18`).

*Confidence: high.*

---

## 🟠 MAJOR

### PF-005 — "Every one of these 32 sites already calls `invalidateLayout()` on the next line" is false for ~21 of them

FR-7 (`01-requirements.md:31-33`) and `03-02:60-62` generalize from three checked sites
(`gestures.ts:42-43`, `window.ts:188-193`, `arrange.ts:18`). Verified counterexamples:
`editor/edit-window.ts:78` (constructor → `this.editor = editor;`), `kitchen-sink/shell.ts:192,230`,
`amiga-clock/main.ts:105,111,117,133`, `tvision-demo/main.ts:145,151,157`, `demo-shell.ts:216`,
`shell-demo/main.ts:95`, `matrix-rain/main.ts:111`, `playground/main.ts:52`,
`live-dashboard.ts:87`, `chrome-bars-demo/tree.ts:35`, `web-xterm/app.ts:146,152`,
`datagrid-showcase/shell.ts:224,262`, `docs-site/examples/apps/desktop.ts:69,75` — all pre-mount
construction with no invalidate. Only ~6 carry the pair.

Behaviourally safe (`invalidateLayout` is a documented no-op while `host === null`, `view.ts:240`),
but task 2.2.2/2.2.5 sends an executor to remove a call that is not there at 20+ sites.
**Recommended**: split Rule 2 into *"6 mounted-path sites: collapse the pair"* and *"~21 pre-mount
sites: plain rewrite; the added invalidate is a no-op"*, and say so in the tasks.

### PF-006 — Three sites document wholesale replacement as *deliberate*; `setLayout` cannot express it

`packages/ui/src/app/application.ts:332-334` — *"Assigned wholesale rather than tagged: a caller's own
layout on the content view is **intentionally discarded**, so the shell governs the body's sizing no
matter what the caller set."*
`packages/datagrid/src/overlay.ts:125-129` — *"…so an overlay can never be dragged off its cell by the
view it hosts."*
`packages/datagrid/src/editing.ts:230-233` — *"…so an editor always fills its cell no matter what the
factory set."*

The last two sit on **customization seams** (`filterPopup`, `createCellEditor`) — precisely where a
third-party layout is expected — and `padding` is the load-bearing prop in a replace→merge swap, the
same class as the `demo-shell` defect the plan cites at `03-03:62`. The plan's only coverage is the
generic *"flag it"* at `03-02:49-50`; task 2.2.3 gives the executor no signal that 2 of datagrid's 4
non-`grid-panels` sites are semantic.

**Recommended**: name these three as a decided sub-batch in `03-02`, converting each with an explicit
reset of the discarded props — `setLayout({ position: 'fill', padding: undefined, direction: undefined,
size: undefined, … })` — leaning on the documented explicit-`undefined` reset (`view.ts:232-234`).
Alternative: accept the merge and rewrite the three comments plus the seam docs to the new contract.

### PF-007 — The committed plugin API-ref snapshot records `layout: LayoutProps` and will drift

`tools/claude-plugin/skills/jsvision/references/api/{app-shell,containers,data-views,layout-views}.md`
record `layout: LayoutProps` at five points. Changing the field's declared type — and its JSDoc,
which PF-018 also requires — drifts the snapshot, and `check-plugin` fails `yarn verify` with
`[api] out of date`. No task, no mention.
**Recommended**: add `yarn plugin:sync --fix` + commit as an explicit step in Step 2.4, and note in
`03-02` that the fix is deterministic (no `ANTHROPIC_API_KEY` needed). `--detect` does not catch this.

### PF-008 — `theme-designer` has a `test/`; `docs-site` and `theme-designer` have no error budget and no clearing task; the `.mjs` seam is 11 files, not 8

`packages/theme-designer/test/` exists and holds `inspector-panel.spec.test.ts:40`
(`view.layout = { position: 'absolute', rect: … }`). Task 1.2.4 (`99-execution-plan.md:31`) says
*"confirm it has no `test/`; no change expected"*; `03-01:42` records *"0 (no `test/`)"*; the
`02-current-state.md` write-surface table omits it, so the 816 total is short.

Task 1.2.3 turns on `docs-site` test typechecking with **no** error row (`02-current-state.md:71-80`
totals 206 without it) and **no** clearing task in Step 1.3. Measured: **18** errors in `docs-site`
(9× `TS7006`, 5× `TS7016`, 2× `TS18048`, `TS2322`, `TS2345`) and **5** in `theme-designer`.

Two consequences: the Phase 1 baseline is **229**, not 206; and FR-3's `.mjs` seam misses three
docs-site scripts — `src/api/inject-back-links.mjs`, `src/api/validate-api-map.mjs`,
`src/api/jsdoc-examples.mjs` — making it **11** declarations. Two further latent defects in passing
spec oracles are also unlisted: `docs-site/test/demo-shell.spec.test.ts:82` (`TS2345`) and
`test/example-at.spec.test.ts:84` (`TS2322`).
**Recommended**: re-baseline to 229, add `1.3.x docs-site` and `1.3.x theme-designer` clearing tasks,
extend the `.mjs` table to 11, add the two defects to task 1.3.6, and give `theme-designer` a
`tsconfig.typecheck.json` like every other package.

### PF-009 — 16 documentation snippets teach the idiom the flip forbids

`grep -rn "\.layout = " packages/docs-site --include=*.md` → 17 hits in 15 files, e.g.
`components/containers/tabs.md:41`, `containers/scroller.md:22,28`, `containers/tree.md:32`,
`editor/memo.md:22`, `terminal/terminal.md:21`, `date/{calendar,date-picker}.md`,
`color/{color-swatch,color-picker}.md`, `dropdown/{combo-box,history}.md`,
`feedback/{progress-bar,spinner}.md`, `surface/surface-view.md:29`, plus prose at
`controls/button.md:87`. Markdown appears in no table, no task, and no acceptance grep.

There is **no** mechanical guard — `snippet-drift.spec.test.ts:45-56` only forbids pasted
`defineExample(` bodies — which is what makes this a silent miss in a repo whose CLAUDE.md states
*"The doc a consumer (or an AI agent) reads on hover **is** the API contract."*
**Recommended**: add a Phase 2 task converting the 16 snippets, and a guard asserting no fenced `ts`
block contains `.layout =`.

### PF-010 — AC-3 cannot observe 697 of the 816 sites, and can never literally return 0

AC-3 (`01-requirements.md:60-62`) greps `packages/*/src packages/examples packages/docs-site/examples`.
`packages/*/src` does not match `packages/*/test`, so `ui/test` (474), `datagrid/test` (167),
`forms/test` (31), `files/test` (18), `docs-site/test` (4), `web/test` (3) — **697 sites** — are
invisible. That is precisely the blind spot AR-13 was raised to close; AC-3 was never widened to
match. `03-02:108` compounds it: *"AC-3's grep runs over all packages, not just `ui`"* — true across
packages, false across directories. `theme-designer/test:40` has no detector at all (outside AC-3's
paths *and* outside typecheck).

Separately the grep matches prose: `view.ts:222`, `dsl/absolute.ts:21`, `dsl/flex.ts:5`,
`dsl/index.ts:4`, `split-view.ts:144,186`, `demo-shell.ts:233` all contain `view.layout = {…}` inside
comments, so a raw count can never be 0.
**Recommended**: widen the path list to `packages/*/src packages/*/test packages/examples
packages/docs-site/examples packages/docs-site/components`, and restate the criterion as "0 hits
outside comments", with the named prose allowlist.

### PF-011 — Task 1.2.2 reddens five packages at once, leaving six consecutive tasks unable to verify

`99-execution-plan.md:29` adds `tsconfig.typecheck.json` to `ui`, `core`, `web`, `files`, `forms` in
one task, surfacing 153 errors cleared four tasks later (`:37-39`); 1.2.1 is explicit that its ~53
are *"not to be fixed yet"*. Tasks 1.2.1 → 1.3.5 cannot satisfy rule 2, and because turbo halts at
the first failing package the interim counts are not even readable without per-package `tsc`.
Unlike PF-004 this has a zero-cost fix — the packages are independent.
**Recommended**: one task per package that both adds the config and clears that package's errors
(`ui` 80 · `core` 65 · `examples` 53 · `docs-site` 18 · `theme-designer` 5 · `forms` 5 · `files` 3 ·
`web` 0). Each then verifies and commits standalone.

### PF-012 — The render baseline is captured *after* Phase 2 has already applied replace→merge to all 8 canvases

Task 2.2.5 (`99-execution-plan.md:69`) converts all 61 `examples/**` non-test sites, which include
every one of the 18 canvas sites. `03-02:50` states this is a real semantic change whose only
mitigation is human flagging. The baseline capture is task 3.1.1 (`:101`) — **after** Phase 2 — so
any replace→merge regression is baked into the "before" snapshot and can never surface in a Phase 3
diff. The plan itself argues why this matters at `03-03:62-66`: the control caught the `demo-shell`
replace-semantics defect while `paint-smoke` stayed green — and `paint-smoke` is Phase 2's only
backstop for these files.
**Recommended**: move the capture to the head of Phase 2 (a task 2.1.3), baseline against
pre-conversion `master`, then diff after 2.2.5 and again after 3.2.x.

### PF-013 — Two of the eight canvases have no headless render path, so ST-10/FR-11/AC-8 are not executable for them

`packages/examples/playground/main.ts:29-34` and `packages/examples/controls-live/main.ts:68-75` both
print a TTY notice and `return 0` when `process.stdout.isTTY !== true`. Nothing else imports
`playground/main`; `controls-live/form.ts`'s `buildDialog` is imported only by that gated `main.ts:44`
(the suggested `demo:controls` is a different demo that never renders `form.ts`). Task 3.1.1 demands
cell-exact renders for *all 8*, and AC-8 demands a verdict per canvas. The plan caught this gap for
`inspector-panel` (`03-03:39`) and missed it here.
**Recommended**: either add a small headless harness importing the composition function directly and
mounting into `createRenderRoot({width:80,height:24})` (mirroring `themes-demo/main.ts:63-67`), or
record these two as review-only and narrow AC-8. Note `playground/main.ts:52` is a `win.layout.rect`
window placement that RD-01 keeps absolute anyway — option (c) is to skip its conversion entirely.

### PF-014 — AR-2's holder survey missed a module-level shared `LayoutProps` singleton and two aliases

`packages/datagrid/src/grid-panels.ts:201` — `const fr: LayoutProps = { size: { kind:'fr', weight:1 } };`
is module-level, returned by `segLayout()` (`:474`) and assigned as `.layout` to up to three views per
segment (`:546`, `:550`, `:554`) plus the footer band (`:634`), for **every grid instance in the
process**. Inert under replace; under `Object.assign` any later `setLayout()` on a view still holding
`fr` would mutate the shared object for every other grid. Also `overlay.ts:106` (`const pre = view.layout;`)
and `datagrid/test/kitchen-sink/story.ts:56` (`view.layout = layout;`).

The conversion itself closes the hazard (once `header.setLayout(layout)` copies into each view's own
object nothing aliases `fr`) — but that is a fortunate consequence, not the plan's analysis, and it
stops holding for any `.layout = <shared object>` write that escapes conversion. The risk row
*"Verified against the only two readers"* (`03-02:109`) is therefore unsupported.
**Recommended**: re-run the holder search as a Phase 2 task (`= [A-Za-z.]*\.layout;` and
`\.layout = <identifier>;` across all packages **and** test dirs), record the real inventory in AR-2,
and add a conversion note for `grid-panels.ts:544-554,634` stating that `setLayout` de-aliases `fr`.

---

## 🟡 MINOR

| ID | Finding | Recommendation |
|---|---|---|
| **PF-015** | **ST-9 is never authored.** Specified at `07-testing-strategy.md:33` and load-bearing at `:14`, but `grep -c "ST-9" 99-execution-plan.md` → **0**. It is the only oracle for Rule 2's drop-the-invalidate half. | Add it to Step 2.1, and pin its second clause — *"no separate `invalidateLayout()` in the source"* is a source assertion, not a runtime one. |
| **PF-016** | **ST-4 and ST-5 already ship as immutable oracles.** ST-4 ≡ `view-setlayout.spec.test.ts:42` (ST-S1); ST-5 ≡ `:59` (ST-S3), `countingHost()` double included at `:26-39`. Task 2.1.1 asks a spec-author to re-author them — duplicate oracles in the phase's most sensitive step. | Rewrite 2.1.1 as "ST-6 only (new); record ST-4 ≡ ST-S1 and ST-5 ≡ ST-S3". |
| **PF-017** | **Rule 2's two-line collapse inverts a load-bearing ordering at four sites.** `gestures.ts:57-59` and `:74-76`, `arrange.ts:18-20`, `window.ts:205-208` have `onResized()` *between* the rect write and the invalidate (*"re-pin children to the new size before the repaint reads them"*). Collapsing moves the invalidate ahead of `onResized()`. Safe under the default `queueMicrotask` scheduler (`render-root.ts:260`) but **not** under the synchronous scheduler used in the suite (`view.occlusion.impl.test.ts:54,80`, `layout-dsl.spec.test.ts:94`). | Name the four sites in task 2.2.2 and specify `onResized()` **first**, then `setLayout({ rect })`. |
| **PF-018** | **Shipped JSDoc and comments document the wholesale-assign idiom as live.** `view.ts:68-73` (the field's own doc), `view.ts:222`, `split-view.ts:144-145` + `:185-186` (an entire structural decision motivated by a hazard the lockdown removes), `dsl/absolute.ts:21`, `dsl/flex.ts:5`, `dsl/index.ts:4`, `ui/src/index.ts:52`, `demo-shell.ts:233`. | Add a Phase 2 close-out task. Note this touches public JSDoc → see PF-007. |
| **PF-019** | **AC-4 forbids `ts-expect-error` "anywhere in the lockdown"; ST-7 requires one** (`01-requirements.md:63-64` vs `07-testing-strategy.md:31`). | Scope AC-4 to `packages/*/src` and except the ST-7/ST-8 fixtures explicitly. |
| **PF-020** | **AC-7/ST-11 can never return zero as specified.** The DSL exports 15 names; local bindings are everywhere and mostly harmless: `core/src/engine/render/buffer.ts:187,188,278,299,307`, `datagrid/src/row-mutations.ts:113,120`, `grid-panels.ts:476,614`, `tree/tree.ts:203`, `desktop/arrange.ts:16`, `dialog/dialog.ts:104`. The five-shadow *worklist* is correct; the *criterion* is not. | Restate as "no local binding shadows a DSL builder **that is imported in the same file**", and specify the two-step grep. |
| **PF-021** | **AC-5 is tautological.** After 2.4.1 the flip is in the tree, so "re-run the spike (flip + per-package `tsc`)" reduces to `tsc` — already run by 2.4.3 and 2.5.3. It cannot report anything but 0. It is also blind where it matters: `theme-designer/test` is never typechecked and `spike-data-studio` has no typecheck script. | Restate as what it can prove: "`turbo run typecheck` green with the flip in place **and** every package's config includes `test/`", plus the named uncoverable surfaces. |
| **PF-022** | **ST-3 is not literally satisfiable.** `examples` gets `include: ["**/*.ts"]` — reaches `test/` but does not *contain* `"test"`; `theme-designer` is unchanged at `include: ["src"]`; `spike-data-studio` has no typecheck script. | Restate behaviourally: "for every package with a `typecheck` script and a `test/`, `tsc --listFiles` includes ≥1 file under `test/`", with AR-6's exemption named. |
| **PF-023** | **`datagrid` is not quite "already covered".** Its three exclusions are justified in-file by *"mirrors core's own posture (core never typechecks its `test/`)"* — a precedent Phase 1 destroys, while the underlying `TS6059`/`TS7016` cause persists and the `.d.mts` seam (AR-5) is not offered to them. (Those three files hold 0 write sites, so there is no lockdown hole.) | Add a Phase 1 task to re-evaluate the exclusions once `core/test` is typechecked, and update the comment either way. |
| **PF-024** | **Site counts drift from the actual greps**: `ui/src` 31 → ~30, `examples/**` non-test 61/30 → ~55/27, total 816 → ~812 + the unlisted `theme-designer/test`. `docs-site` 5 and `datagrid/src` 12 are exact. | Re-derive with a comment-excluding grep before execution, so a delta during Phase 2 reads as a finding rather than noise. |

## 🔵 OBSERVATION

**PF-025** — AR-1 and `00-index.md` call `Readonly<LayoutProps>` a **deep** lockdown. It is exactly two
levels: `layout.rect = r` becomes an error, `layout.rect.x = 5` does not. Verified harmless — a repo-wide
grep for `\.layout\.[a-z]+\.[a-z]+\s*=` returns zero hits — but the wording overstates the guarantee for
a future reader. Suggest "one level deeper than `readonly` alone".

---

## Adversarial checklist run before concluding

- *Is the plan's core thesis wrong?* No — the dependency chain (#132 → #117-P4 → #129), the shallow-
  `readonly` trap, the 10 silent escape hatches, and the AR-13 test-surface correction were all
  verified true and are genuinely good work.
- *Are any findings padded?* PF-024 and PF-025 are near the noise floor and are marked as such.
- *Did I confirm rather than refute?* Both auditors were told to refute first; the grounding cluster
  returned six explicitly refuted candidates (recorded below) rather than reporting them.

**Refuted and recorded so they are not re-audited**: `examples/tsconfig.json` and
`docs-site/tsconfig.json` already set `rootDir: "."` (Part B1 is a pure `include` swap, no trap); the
DSL builders already route through `setLayout` and are not double-counted; all 10 escape hatches are
plain literals with no shared-constant initializer; no `structuredClone`/JSON round-trip of a
`View.layout` exists; no test outside `view-setlayout.impl.test.ts` compares `view.layout` by
identity (the ~10 rect snapshots all spread into value copies); and `Object.assign` against
`Readonly<LayoutProps>` plus `props: view.layout` at `reflow.ts:78` both typecheck without a cast, so
FR-6's "no cast" claim holds.

## Decisions

**All 25 findings: recommendation accepted as written (2026-07-20).** Applied the same session.

| Finding | Applied to |
|---|---|
| PF-001 | AC-6 restated as assertion-immutability (`01-requirements.md`); new **AR-15** records the decision; Step 2.3 carries the note |
| PF-002 | New **FR-13**; AR-11 corrected ("zero coupling" was false); task **2.4.5**; AC-9 names the guard |
| PF-003 | AR-2 corrected with the full holder inventory; task **2.4.4**; `03-02` "what the flip breaks" table; `07` filename fixed to `view-setlayout.impl.test.ts` |
| PF-004 | ST-6/7/8 moved to Step **2.4.1**, immediately before the flip; rationale in `07` and in the Step 2.4 preamble |
| PF-005 | FR-7 split three ways; AR-4 corrected; `03-02` Rule 2a/2b/2c; task **2.2.2** |
| PF-006 | New **FR-12** + **AR-16**; `03-02` Rule 1a; task **2.2.4** |
| PF-007 | FR-13; task **2.4.7** (`yarn plugin:sync --fix`); AC-9 |
| PF-008 | Baseline re-derived to **229**; `theme-designer` given a config + budget; `.mjs` seam → **11**; tasks **1.3.4**, **1.3.5**, **1.2.1**; 2 latent defects added to **1.4.1** |
| PF-009 | FR-13; task **2.2.7**; AC-3 path list extended to `docs-site/components` |
| PF-010 | AC-3 widened to `packages/*/test` + comment carve-out with named allowlist; task **2.5.1** |
| PF-011 | Phase 1 restructured — Step 1.3 is now one task per package that turns it on **and** clears it |
| PF-012 | Baseline capture moved to task **2.1.3** (head of Phase 2); `03-03` states why |
| PF-013 | `03-03` names the two witness-less canvases with three options; AC-8 amended; task **3.1.2** |
| PF-014 | AR-2 holder inventory incl. `grid-panels.ts:201`; task **2.1.2** (re-run the search); task 2.2.3 note |
| PF-015 | ST-9 authored at task **2.1.4**; its source-assertion half clarified in `07` |
| PF-016 | ST-4/ST-5 recorded as ≡ ST-S1/ST-S3; Step 2.1 preamble forbids re-authoring |
| PF-017 | `03-02` Rule 2b names the four `onResized()` sites; FR-7; task **2.2.2** |
| PF-018 | FR-13; task **2.4.6** |
| PF-019 | AC-4 scoped to `packages/*/src` with the ST-7/ST-8 exception |
| PF-020 | AC-7 + ST-11 restated as "imported in the same file"; tasks **3.1.3**, **3.3.2** |
| PF-021 | AC-5 restated as `turbo run typecheck` + `--listFiles` proof, with uncoverable surfaces named; task **2.5.2** |
| PF-022 | ST-3 restated behaviourally with `spike-data-studio` exempted; task **1.1.1** |
| PF-023 | `02-current-state` qualification; `03-01` risk row; task **1.3.7** |
| PF-024 | All counts re-derived (≈); task **2.1.1** re-derives before Phase 2 |
| PF-025 | Noted; wording left as-is (no two-level writes exist) |
