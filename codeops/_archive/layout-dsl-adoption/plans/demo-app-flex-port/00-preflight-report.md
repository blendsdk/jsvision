# Preflight Report: demo-app-flex-port

> **Artifact**: `codeops/features/layout-dsl-adoption/plans/demo-app-flex-port/` (9 documents)
> **Type**: Implementation plan
> **Iteration**: 1
> **Date**: 2026-07-20
> **Scanned on**: `feat/setlayout-primitive` @ `135325e8` (clean tree apart from the plan itself)
> **Verify command**: `yarn verify` (AR-8)
> **Status**: ✅ **PASSED** — all 15 findings resolved (fixes applied 2026-07-20)

⚠️ **SAME-SESSION REVIEW RISK**: the plan was authored 2026-07-20 12:31–12:40; this scan ran the same
day. Findings were grounded against the real code and against two remote branches rather than against
the plan's own reasoning; consider a fresh session for any re-scan.

## Codebase Context Summary

**What was read.** `packages/ui/src/view/view.ts` (`setLayout` :251, `layout: LayoutProps = {}` :73,
`host: ViewHost | null` :163, `invalidateLayout` :215), `packages/ui/src/view/dsl/absolute.ts` (`at`
:42–50), `packages/ui/src/view/dsl/flex.ts` (`Flex` props, `background` :97), the two shadow
`story.ts` files, all 8 example demos and 2 stories named in the plan, the three theme-designer view
modules + `app.ts`, `packages/examples/tsconfig.json`, `packages/examples/test/`,
`packages/theme-designer/test/`, and the remote branches `origin/feat/dsl-adoptation` and
`origin/feat/canvas-flex-adoption` (PR #127).

**Confirmed accurate in the plan.** Every `file:line` reference in `02-current-state.md` and `03-0x`
resolves to the stated construct (roles-panel :72/:73, preview-panel :24/:26, app.ts :288/:290/:303/:308,
editor-demo :67–69, event-demo all 8, router-demo all 7, drill-down all 6, controls-demo :95/:107,
chrome-bars :99, tabs-demo :43, wizard-demo :52/:178, wizard.story :113). The 411/84 total matches a
measured 300 + 111 = 411. `setLayout` is a shallow merge + one `invalidateLayout()`, so AR-9's
"the caveat dissolves" reasoning is technically correct. AR-12 verified: no `place()` survives in
`packages/forms/src/form-dialog.ts`. `col()` does set `group.background`. The `@jsvision/ui` barrel
exports `at`/`col`/`row`/`grow`/`fixed`/`spacer`. `origin/feat/dsl-adoptation` genuinely lacks
`setLayout`, so the PR #128 dependency is stated correctly.

**The reality the plan missed.** PR **#127** (`feat/canvas-flex-adoption`, OPEN against the same base)
already implements this plan's Phases 2 and 3, under its own CodeOps plan set
(`plans/canvas-flex-adoption/`, 10 docs including a passed preflight report). See PF-001.

---

## Findings

### 🔴 CRITICAL

#### PF-001 — Phases 2 and 3 duplicate work already implemented in open PR #127

**Dimension:** 13 Codebase Alignment (Redundancy / Scope vs. Reality) · **Dimension 5** Dependency Issues

**Evidence.**
- `gh pr list`: **#127 `feat/canvas-flex-adoption` → base `feat/dsl-adoptation`, OPEN**, titled
  *"refactor(examples,designer): adopt the layout DSL across the didactic canvases (#110 + #111)"*.
- `git diff --stat origin/feat/dsl-adoptation...origin/feat/canvas-flex-adoption` touches exactly this
  plan's Phase-2/3 file set: `chrome-bars/controls/editor/event/router-demo/main.ts`,
  `kitchen-sink/stories/drill-down.story.ts`, `theme-designer/src/{app.ts,view/preview-panel.ts,view/roles-panel.ts}`.
- The conversions are the same ones: `git show origin/feat/canvas-flex-adoption:packages/examples/editor-demo/main.ts`
  is already `const root = col(grow(ed), fixed(ind, 1));` — byte-for-byte the target in
  `03-03-examples-composition.md:19,80`.
- `02-current-state.md:110` is the plan's only mention of #127, and rates it merely a **Low**-impact
  *roadmap-file* merge conflict.
- `codeops/features/layout-dsl-adoption/00-roadmap.md:51-52` assigns #110/#111 to *this* plan and has
  **no row at all** for `canvas-flex-adoption` — the roadmap is blind to #127, which is plausibly why
  the plan was authored.

**Three consequences beyond duplication:**
1. **AC-7 is violated by #127's design.** #127 edits `controls/editor/event/router-demo.e2e.test.ts`
   and adds `test/demo-composition.impl.test.ts`, `test/spawn-demo.ts`,
   `theme-designer/test/panel-composition.impl.test.ts`. This plan's contract
   (`07-testing-strategy.md:78`, AC-7) is "none of these files may appear in `git diff --name-only`".
2. **AR-9 is contradicted by shipped code under review.** #127's `app.ts` deliberately **keeps** the
   wholesale field write with an explaining comment (*"Re-assigned wholesale on every resize rather
   than merged … restating the row direction here keeps the workspace independent of how its children
   were composed"*), while AR-9 resolves to dissolve it via `setLayout`. Two open PRs against one base
   encode opposite decisions on the same line.
3. #127 already solved two testability problems this plan leaves open (PF-004, PF-005) by extracting
   `chrome-bars-demo/tree.ts` and adding `test/spawn-demo.ts`.

**Options.**
- **(a) — recommended.** Re-scope this plan to **Phase 1 only** (the shadow `at()` retirement + the
  four local placers), which #127 does not touch at all. Record #110/#111 as owned by #127, add a
  roadmap row for `canvas-flex-adoption`, and drop Phases 2–3, AC-4, AC-5, and the AR-9/AR-10/AR-14
  scope. Cost: an afternoon of plan surgery. Benefit: the plan becomes a clean, independently
  shippable, genuinely non-duplicated unit — and PF-002/-003/-004/-005 all evaporate with Phases 2–3.
- (b) Land #127 first, re-run the `02` sweep, and rewrite Phases 2–3 as a delta (likely near-empty)
  plus an explicit AR-9 reconciliation. Slower, and the delta is probably not worth a phase.
- (c) Supersede #127 (close it) and absorb its machinery into this plan. Rejected: it throws away a
  preflighted, complete plan set and directly contradicts AC-7 as written.

**Confidence:** High — verified by direct `git show` against the remote branch, not by inference.
**Hardening:** in-context layers + independent auditor dispatch (surfaced the same finding independently).

---

### 🟠 MAJOR

#### PF-002 — `03-03`'s event-demo target shape silently drops five child size props

**Dimension:** 13 Architecture Mismatch · **3** Logical Contradictions

`03-03-examples-composition.md:17` proposes `row({ fixed: 1, gap: 2 }, btnOk, btnOpen)` ·
`col({ fixed: 2, background: 'dialog' }, dialogLabel, btnClose)` ·
`col({ padding: 1, background: 'desktop' }, header, body, dialog, status)`.

But the current code sets sizes on those children too: `event-demo/main.ts:107`
(`btnOk`/`btnOpen` → `fr weight 1`), `:103` (`header` → `fixed 1`), `:114` (`dialogLabel` → `fixed 1`),
`:116` (`btnClose` → `fixed 1`), `:124` (`status` → `fixed 1`). The proposed shape converts 3 of the 8
listed sites and **discards** the other 5, leaving those children `auto`. `Label` has no `measure()`
(a known repo trap), so this is both a guaranteed non-zero buffer diff and a probable collapse to
`{0,0}` — which contradicts `03-03`'s own Error Handling row *"Every child in this map is explicitly
`fixed(…)` or `grow(…)`; no child is left `auto`"*.

**Independent corroboration:** PR #127's version of the same file gets it right —
`fixed(row({gap:2}, grow(btnOk), grow(btnOpen)), 1)`, `col(fixed(dialogLabel,1), fixed(btnClose,1))`,
`col({padding:1}, fixed(header,1), body, dialog, fixed(status,1))`.

**Recommendation:** if Phase 3 survives PF-001, replace the target shape with #127's (it is the
correct one). Otherwise the finding is moot with the phase.

#### PF-003 — `03-02`'s roles-panel code example changes the function's public return shape

**Dimension:** 13 Phantom References · **12** Consistency

`03-02-theme-designer.md:63` states *"`roles-panel.ts` returns `{ view, list, … }`; `list` must remain
reachable as a local because callers read `list.rows`"*, and its Code Example ends `return { view, list };`.

The actual function (`packages/theme-designer/src/view/roles-panel.ts:78`) returns
`{ view, focused, targets, rows: list.rows }` — there is **no `list` key**, and `focused`/`targets` are
part of the contract `app.ts` consumes. Following the example verbatim breaks `app.ts` and
`packages/theme-designer/test/roles-panel.spec.test.ts`, which AC-7 forbids editing.

**Recommendation:** correct the example to keep the existing return object untouched and only replace
the two field writes with the `col(…)` call. (Moot if PF-001(a) is taken.)

#### PF-004 — The `chrome-bars-demo` buffer diff (AR-14) is not achievable

**Dimension:** 7 Testability · **6** Feasibility

AR-14 makes the buffer diff `chrome-bars-demo`'s **only** proof. But
`packages/examples/chrome-bars-demo/main.ts:53-59` returns early with a *"needs a real interactive
terminal (TTY)"* message when `process.stdout.isTTY !== true` — the view tree at `:85-100` is never
built off a TTY — and `main()` is not exported (`:124` self-invokes). There is no headless mount path,
and a live run adds a 1 s clock timer that makes output non-deterministic.

PR #127 hit the same wall and solved it by extracting `chrome-bars-demo/tree.ts` (+38 lines).

**Recommendation:** adopt #127's `tree.ts` extraction, or amend AR-14 to accept manual TTY inspection
as the recorded proof, or drop the file. (Moot if PF-001(a) is taken.)

#### PF-005 — The named Phase-2 proof vehicle never renders the code being converted

**Dimension:** 7 Testability · **2** Implicit Assumptions

`03-02:104` and tasks 2.1.1/2.1.6 make "the headless walkthrough, including at least one resize step"
the zero-diff witness. `packages/theme-designer/src/host/walkthrough.ts:38-47` builds **only**
`buildGallery()` at a fixed absolute rect; `runWalkthrough()` (`:56-89`) never calls
`createDesignerApp`, never builds the roles/preview panels or the workspace, and has no resize.
Its output is therefore **invariant under every Phase-2 edit** — a guaranteed zero diff that proves
nothing, and it cannot exercise `sizeWorkspace()` at all. `walkthrough.e2e.test.ts:20-40` merely spawns
`src/main.ts` piped and asserts stdout.

**Recommendation:** if Phase 2 survives, swap the vehicle for a scratch script calling
`createDesignerApp({ caps, viewport, requireTty: false })` (proven headless by `app.spec.test.ts:38`),
serializing `app.loop.renderRoot.buffer().rows()`, then invoking the resize handler
(`app.ts:326-330`) with a second viewport.

#### PF-006 — The plan leans on `tsc` as a control over files `tsc` never loads

**Dimension:** 7 Testability · **2** Implicit Assumptions

AC-1 requires "all 411 call sites **compile** unchanged", and `03-01:129` designates a compile error as
the safety net for the `themes-demo` void-return change. But `packages/examples/tsconfig.json` includes
only `capability-probe`, `resize-demo`, `keyboard-mouse-playground`, `chrome-bars-demo`, `recipes`,
`datagrid-showcase`. Verified: `npx tsc --noEmit --listFiles | grep -c packages/examples/kitchen-sink`
→ **0**; likewise 0 for `themes-demo|editor-demo|router-demo|test/`. Only `datagrid-showcase/story.ts`
(~111 sites) is typechecked; `kitchen-sink/story.ts` + its ~300 sites, the four local-placer demos, and
the new `test/story-at.spec.test.ts` are not. Demos run through `tsx`, which strips types without
checking.

**Recommendation:** name the real controls (the kitchen-sink smoke suite + per-demo e2e spawns), and add
a one-shot task running `npx tsc --noEmit` with a temporary include over `kitchen-sink` + `test` as the
actual evidence for AC-1.

#### PF-007 — Step 1.4 demands a zero diff against baselines no task captures

**Dimension:** 11 Ordering & Sequencing

`99:78` (task 1.3.1) captures baselines for exactly two artifacts (the kitchen-sink shell, the
datagrid-showcase walkthrough). Tasks 1.4.1–1.4.4 then edit `wizard-demo`, `themes-demo`, `tabs-demo`
and `wizard.story.ts`, and 1.4.5 requires "zero-diff the four affected demos" — with no pre-edit
capture for any of them. Phases 2 and 3 each have an explicit baseline-first task (2.1.1, 3.1.1), so
this is a Phase-1 slip, not a stated design.

**Recommendation:** insert a baseline-capture task before 1.4.1, or fold the three demos into 1.3.1.

---

### 🟡 MINOR

#### PF-008 — "One `at()` in the repo" is false after this plan

`02-current-state.md` Gap 1 states the required behavior as *"One `at()` in the repo, with merge
semantics"*, and Step 1.4's objective is *"No hand-rolled absolute placer or DSL-name-shadowing helper
survives in a touched file"*. Three local `at` shadows survive:
`packages/theme-designer/src/view/gallery.ts:32`, `.../view/inspector-panel.ts:55` (both
`function at<T>(g, view, x, y, w, h)` doing a replace-write), and
`packages/examples/amiga-clock/analog-clock.ts:70` (`const at = …`).

The plan lists gallery `:33` and inspector-panel `:56` as "FR-4 keep-absolute, untouched" — but FR-4
keeps the *placement* absolute, which the blessed `at()` also does. Keeping absolute geometry does not
require keeping a name-shadowing helper. AC-3's grep (`function place|const place|function placed|const row = `)
would not catch these either.

**Recommendation:** either widen Phase 1 to convert the two theme-designer helpers (they are two files,
mechanical), or restate the goal honestly as "no shadow `at()` in `@jsvision/examples`" and add the
survivors to the deferred list.

#### PF-009 — ST-3 is internally inconsistent about its RED/GREEN status

`07:42` says ST-3 is "identical behaviour to **ST-1 and ST-2**"; `07:46-48` says "ST-1 and ST-3 pass
both before and after". Since `datagrid-showcase/story.ts:68` has the byte-identical replace body, an
ST-3 that mirrors ST-2 **must** be RED before. Task 1.1.2 would record a result contradicting the plan.

**Recommendation:** split into ST-3a (ST-1 mirror, green throughout) and ST-3b (ST-2 mirror, red before).

#### PF-010 — AC-6's "zero diff per touched demo" cannot evidence the 411-site change

The Phase-1 evidence is two serialized screens, but the semantic delta lands across 84 story files and a
shell screen shows one story at a time. The standing net for the rest,
`kitchen-sink.smoke.spec.test.ts:42-46`, asserts only metadata + `paintedCells(...) > 0` — precisely the
"wrong-but-nonempty" failure mode AR-7 says smoke-only cannot detect.

**Recommendation:** restate AC-6 for Phase 1 as "the audit table is complete and every row ruled; the two
showcase screens are zero-diff; the smoke suite green and unedited", or add a cheap one-shot sweep that
mounts every story and hashes the buffer before/after (the smoke test already has the mount harness).

#### PF-011 — Task 4.1.4 closes issues whose scope the plan defers, with no successor tracker

`99:174` closes #110, #111, #114, but AR-1 defers the FR-6 maximal to "a separate follow-up plan" and
`01:17-18` scopes #114 to "the reachable slice". No follow-up issue exists. A `row` name-shadow also
survives at `packages/examples/keyboard-mouse-playground/main.ts:126` — #114's own subject.

**Recommendation:** file the follow-up issue before 4.1.4 and close #110/#114 referencing it (or leave
them open with a scope-updated comment). Note PF-001 also moves #110/#111 ownership.

#### PF-012 — The regression-suite lists are inconsistent with the plan's own scope

`07:74` lists `containers-demo.e2e.test.ts` and `dropdowns-demo.e2e.test.ts` under "each converted
demo", but AR-2 puts both demos out of scope and neither imports `story.ts`. `03-03` names 8 e2e
suites while the Phase-3 deliverable (`99:151`) says "**Nine** e2e suites".

**Recommendation:** trim the two out-of-scope suites and reconcile the count to 8.

---

### 🔵 OBSERVATIONS

- **PF-013** — `03-03` notes chrome-bars-demo "already imports `spacer`/`fixed`" (true,
  `main.ts:21-36`), but the target `win.add(grow(body))` needs `grow`, which is **not** in that import
  list. One added specifier; worth stating so it is not read as "no import work".
- **PF-014** — Task 2.1.5 converts `app.ts:308` to `setLayout` but says nothing about the
  `workspace.invalidate()` at `:313`. `setLayout` requests a *relayout*, not a repaint; the existing
  `invalidate()` should stay. Worth one explicit word.
- **PF-015** — `02` splits the 411 sites as ~292 / ~119; measured today they are **300 / 111**. The
  total is right; the split is not.

---

## Verdict

✅ **PREFLIGHT PASSED — all 15 findings resolved.**

(Initial scan: ❌ BLOCKED, 1 critical + 6 major. The user ruled PF-001 option (a) — re-scope to
Phase 1 only — and authorised the fixes, which were applied the same day.)

PF-001 dominates: two thirds of this plan is already implemented in an open PR the plan does not know
about. Resolve it first — the recommended re-scope to Phase 1 also retires PF-002, PF-003, PF-004 and
PF-005 as moot, leaving a genuinely valuable, high-leverage, non-duplicated plan (the 411-call-site
shadow retirement) plus PF-006/-007 and the minors to fix.

## Decisions

| PF | Severity | Decision | Date |
|----|----------|----------|------|
| PF-001 | 🔴 | **(a)** re-scope to Phase 1 only — Phases 2–3 dropped, #110/#111 recorded as owned by PR #127 (AR-15) | 2026-07-20 |
| PF-002 | 🟠 | Moot — Phase 3 dropped with PF-001(a) | 2026-07-20 |
| PF-003 | 🟠 | Moot — Phase 2 dropped with PF-001(a) | 2026-07-20 |
| PF-004 | 🟠 | Moot — Phase 3 dropped with PF-001(a) | 2026-07-20 |
| PF-005 | 🟠 | Moot — Phase 2 dropped with PF-001(a) | 2026-07-20 |
| PF-006 | 🟠 | Fixed — 02 §Gap 2 + 07 state the real coverage; new task 1.5.1 runs a one-shot `tsc --noEmit` sweep; AC-1 rewritten | 2026-07-20 |
| PF-007 | 🟠 | Fixed — new task 1.4.0 captures baselines before 1.4.1–1.4.4 | 2026-07-20 |
| PF-008 | 🟡 | Fixed — goal restated as "no shadow in a file this plan touches"; the three survivors named in 01/02/03-01 and on the follow-up issue (AR-16) | 2026-07-20 |
| PF-009 | 🟡 | Fixed — ST-3 split into ST-3a (green) and ST-3b (red before); authoring rule corrected | 2026-07-20 |
| PF-010 | 🟡 | Fixed — AC-5 restates the Phase-1 evidence chain; 07 adds "what the smoke suite cannot prove" + the optional per-story sweep | 2026-07-20 |
| PF-011 | 🟡 | Fixed — new task 2.1.2 files the follow-up issue; 2.1.4 closes #114 only and adds a `canvas-flex-adoption` roadmap row | 2026-07-20 |
| PF-012 | 🟡 | Fixed — `containers`/`dropdowns` removed; suite list now the three demos actually touched | 2026-07-20 |
| PF-013 | 🔵 | Moot — Phase 3 dropped with PF-001(a) | 2026-07-20 |
| PF-014 | 🔵 | Moot — Phase 2 dropped with PF-001(a) | 2026-07-20 |
| PF-015 | 🔵 | Fixed — split corrected to 300 / 111 in 02 and 03-01 | 2026-07-20 |
