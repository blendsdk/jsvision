# Preflight Report — canvas-flex-adoption

> ⚠️ **SAME-SESSION REVIEW.** This plan was authored in the same session that reviewed it. Two
> independent `preflight-auditor` dispatches were used precisely because self-review by the author
> is the weakest form — and both found the same structural defect the author had written down and
> mis-read.

**Scope of the scan.** Two clusters, not the full five: ② grounding (Codebase Alignment · Implicit
Assumptions · Dependency Reality) and ① + ③ (Ambiguities · Contradictions · Consistency ·
Completeness · Testability · Ordering · Scope Creep). Security and the remaining risk dimensions
were skipped by an explicit, recorded judgement: both target packages are `private: true` and
nothing in the monorepo depends on them, so the public-receiver class that produced the sibling
plan's CRITICAL cannot exist here.

## Iteration 1 — 14 findings

### 🔴 CRITICAL

**PF-001 — seven of the nine witnesses could not observe the artifact they guarded.**
*Found independently by both auditors.* All five demo `main.ts` files have zero exports and invoke
`main()` at module scope, so a witness could only **reconstruct** the tree inside the test file. A
reconstruction never executes a line of the converted file: if Phase 3 dropped `padding:1` at
`event-demo:128`, the witness stays green — it is asserting the test's own copy. AC-5 was satisfied
by construction and NFR-2's "green-first" was trivially true.

The plan stated the duplication itself (`07:34-37`, "that duplication is deliberate") and drew the
wrong conclusion from it. **Resolution:** per-file seams (AR-13) — frame snapshots where the demo
already prints its composed buffer, the already-exported `drillDownStory`, and a new `buildRoot()`
export only for the two files with neither.

**PF-002 — ST-C9 could not be both green-first and a direction detector.**
*Found independently by both auditors.* Neither panel builder sets `direction` today; it arrives from
`app.ts:288`/`:290`, and the engine default is `'row'` (`ui/src/layout/types.ts:213`). A witness
mounting a panel standalone is therefore **red-first**, violating NFR-2 — while one that supplies the
direction itself keeps supplying it after task 2.4 and detects nothing. Task 2.3's checkpoint was
undecidable: between 2.1 and 2.4 the direction is applied twice.
**Resolution:** drive `createDesignerApp({ caps, viewport, requireTty:false })` (AR-14), the only
seam that is green today and genuinely red if the builders fail to take ownership. Split into
ST-C10a/b/c so tasks 2.3 and 2.6 name distinct legs.

### 🟠 MAJOR

**PF-003 — AC-3 was unsatisfiable, and FR-3 contradicted FR-4 and AR-7.** AC-3 required all 13
extra-property sites to carry their property on a builder, but 3 are preserved wholesale (FR-4) and
`app.ts:303`'s is deliberately dropped (AR-7) — at most 9 could satisfy it. FR-3's "including where
the lost value coincides with an engine default" additionally declared AR-7's drop a defect in the
document that ratifies it. **Fixed:** both restated around the 9 convertible sites, with AR-7 named
as the single recorded exception and why it is one.

**PF-004 — the property table enumerated 12 sites while claiming 13.** `event-demo:119`
(`{ direction:'col', size: fixed 2 }`) was missing from §3 despite appearing in §1 and in 03-01.
`03-01` separately said "six sites" over a seven-row table. **Fixed both.** This is the sibling
plan's recorded root-cause pattern recurring — a conclusion applied to an inventory without
re-checking each row.

**PF-005 — two extra-property sites had no witness that could catch them.** `event-demo:119`'s
column direction was invisible to ST-C2 (whose subject is the root; "the dialog is 2 rows tall"
holds either way), and `drill-down:69` is **structurally** unobservable by rect — a single `fr`
child fills identically under `row` and `col`. **Fixed:** ST-C3 now covers the dialog column, and
ST-C9 asserts the screen's solved `direction` rather than only its child's rect.

**PF-006 — two documents prescribed different conversions for the same sites.** `02` gave
`event-demo:109` as `fixed(row({gap:2}, btnOk, btnOpen), 1)` with the `:107` loop "kept"; `03-01` and
task 3.2 gave `grow(btnOk), grow(btnOpen)` with the loop collapsed. An executor following `02` would
have produced a row whose children carry **no** size — dropping `fr 1` from both buttons. **Fixed:**
`02` now matches `03-01`.

**PF-007 — "the 5 demo e2e tests" — there are 4.** `chrome-bars-demo` has no test file at all, so its
one converted site had zero pre-existing coverage while the plan implied otherwise. **Fixed** in AC-6,
07 and 02 §4, which now names it alongside `preview-panel.ts`.

**PF-008 — three ST-C rows were too loose to satisfy NFR-3.** ST-C3 was a child count plus a pure
relation (`btnOpen.x === btnOk.x + btnOk.width + 2`) — passing with both buttons at width 0. ST-C7's
"below the chrome" named the wrong subject (the body sits inside the `Window`'s 48×9 frame, not below
the app chrome). ST-C8 was relation-only. **Fixed:** the frame-snapshot witnesses assert literal row
strings (position and count are inherent), and the importing witnesses name literal rects.

> This one is worth stating plainly: the relation-only shape is the exact defect the sibling plan
> shipped and had caught in review. It reappeared here in the very document whose NFR-3 bans it.

### 🟡 MINOR

**PF-009** — AR-12 authorised 3 `.background =` folds; the plan performs **6**. Register corrected
(the equivalence claim itself was verified sound: `toLayout` drops it at `flex.ts:61`, `container()`
applies it at `:97` before children are added).
**PF-010** — "all 13 inspector children" is **17**. The conclusion survives (every one goes through
the local `at()` helper, the file's only `add()` path) but the miscount is how a reviewer gauges
whether the verification happened. Corrected in AR-7 and 03-02.
**PF-011** — AR-3's "one witness per converted file (9 witnesses)" never described the actual map.
Reworded and superseded by AR-13.
**PF-012** — task 4.2 permitted "log any locator edit as a deviation" while AC-6 forbade it
unconditionally. **Fixed:** no locator edit is permitted — FR-5 forbids nesting changes, so a broken
locator halts the phase and is fixed in source.

### 🔵 INFO

**PF-013** — the `router-demo` rename removes no shadow (that file never imports the builder) and
`no-shadow` is not enabled in the repo's ESLint config, so neither rename is mechanically forced.
Both are readability calls; now stated as such.
**PF-014** — "four times denser" is nearer 3.8× (the sibling's `application.ts` site makes it 5/51 ≈
10%, not 8%). Corrected.

## What the auditors verified clean

- All 35 site rows are **byte-accurate** — every line number, receiver and literal matches source.
- **No unlisted `.layout =` site** exists in the 9 files.
- Every target expression compiles and is equivalent; `Flex`, `padding`, `gap`, `background` and the
  zero-arg `col(props)` form all check out against `ui/src/view/dsl/flex.ts`.
- The ordering constraint (panels before `app.ts`) is real, and Phase 2's task order honours it.
- AR-7 (vestigial direction), AR-8 (the `at` clobber-vs-merge shadow) and AR-9 (no existing test
  asserts geometry) all hold on the substance.
- NFR-6's dependency claim holds: both packages are `private: true` with no dependents.
- Scope honesty on #110 is accurate — the 9 out-of-scope sites are recorded in the index, the
  register, the close-out task and the roadmap row.

---

**Iteration 1 verdict: ❌ BLOCKED** — 2 CRITICAL + 6 MAJOR. All 14 resolved; iteration 2 followed.

## Iteration 2 — 13 further findings (PF-015…PF-027)

Two dispatches: one verifying each iteration-1 fix actually closed its finding, one attacking angles
iteration 1 never used. **They converged on the same defect again** — and this time it was in the
*fix* for iteration 1's CRITICAL.

### 🔴 CRITICAL

**PF-015 — the `buildRoot()` seam introduced by PF-001's fix was unimplementable.** Both candidate
files invoke their entrypoint at module scope, and `chrome-bars-demo/main.ts:118-124` calls
`process.exit()` there — so a witness importing it would terminate the vitest worker before any
assertion ran. ST-C8 was the only oracle for the one file with no pre-existing coverage at all, so
this leg of the CRITICAL fix closed nothing. **Resolution (AR-16):** a sibling `tree.ts` module that
`main.ts` imports — no entry guard, no exit hazard, `main.ts` stays a pure entrypoint.

### 🟠 MAJOR

**PF-016 — the seam's stated justification was false.** "`editor-demo`, `chrome-bars-demo` — neither
prints a frame." `editor-demo` prints **nine**, via a local helper named `frame()` rather than
`printFrame`, emitting the same `|…|` grid the frame seam relies on; it also has an e2e test. The
fix had been found by grepping for `printFrame`. So the plan was paying a source change for a file
that qualified for the preferred zero-source-change seam. **Resolution:** `editor-demo` moves to the
frame seam; task 1.1 shrinks to one file.

**PF-017 — seven of the ten witnesses would never run at a phase gate.** `yarn verify` →
`turbo run test` → `vitest run --project unit`, and that project *excludes* `test/**/*.e2e.test.ts`
(`vitest.config.ts:14-15`). An executor could finish every phase green while every frame snapshot
sat unrun. **Resolution (AR-17):** the per-phase command gains
`yarn workspace @jsvision/examples test:e2e`, recorded in NFR-4, AC-7 and every verify task.

**PF-018 — the six `background` folds were invisible to every oracle.** `Group.background` fills
style only (`group.ts:76-77`); every frame seam prints `cell.char`. 6 of 32 conversions had no
witness while NFR-1 promised unchanged rendering. **Resolution (AR-15):** narrowed to the 2 an
importing witness can assert; the other 4 stay separate `.background =` lines, which no requirement
asked to fold.

### 🟡 MINOR / 🔵 INFO

**PF-019** NFR-3 was unsatisfiable by the frame witnesses (it demanded a child count + rect); now
states two admissible forms. **PF-020** the ST-C9→ST-C10 renumbering left three stale `ST-C9`
references. **PF-021** AR-9 still said "five demo e2e tests". **PF-022** the roles-panel background
line was `:71` in two docs and `:70` in the register — `:70` is right. **PF-023** the Deviations note
re-permitted the locator edit PF-012 had removed, and mis-cited NFR-1. **PF-024** task 2.3's
checkpoint is undecidable (the direction is applied twice until 2.4) — now labelled a no-op by
design. **PF-025** the `gap:0` halves of two sites equal the engine default, so no witness can see
them; AC-3 now names code review for those. **PF-026** ST-C9's detail leg needs router navigation
the plan didn't budget — now spelled out. **PF-027** an importing witness reading `bounds` before a
flush would capture `{0,0,0,0}` and bake the zeros in as its "literal rect" — the flush rule is now
explicit. Plus: AR-10 marked superseded, and the AR-5 rename extended to `controls-demo:51`, which
has the identical loop.

### Verified clean in iteration 2

`createDesignerApp`'s seam checks out in every particular — exported at `app.ts:141`, options carry
`caps`/`viewport`/`requireTty`, and the predicted pane offsets (0 / 28 / 58 at 90×30) are arithmetically
right. The three original frame demos genuinely print every row after mount. `drillDownStory` is
exported and drivable. AR-12's equivalence, AR-7's "17 children", and the `5 of 51 ≈ 10%` sibling
figure all reconstruct exactly. The site inventory is still 35, byte-accurate. `check-jsdoc` does not
scan `packages/examples` (no `src/` barrel), so no new export can trip `check:docs`. Task counts and
the 9-vs-13 split reconcile across all eight documents.

---

**Iteration 2 verdict: ✅ PASSED** — 27 findings across 2 iterations, all resolved. The recurring
root cause is recorded plainly: *a conclusion drawn correctly, then applied to a list without
re-checking each entry*. It produced the 12-vs-13 table, the "neither prints a frame" claim, and the
"two sites carry a direction" error in the sibling plan. The mitigation that has actually worked is
adversarial re-grounding per entry, not a tighter rule.
