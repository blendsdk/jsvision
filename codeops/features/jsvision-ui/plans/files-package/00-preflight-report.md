# Preflight Report: Files package (`@jsvision/files`) plan

> **Status**: ✅ PASSED — 8 findings across 2 iterations, all resolved and applied (0 critical, 2 major, 6 minor, 0 observation)
> **Iteration**: 2 (re-scan complete — see the Re-scan section at the end; iteration-1 findings PF-001…006, iteration-2 findings PF-007…008)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/files-package/`
> **Codebase Grounded**: 15+ source files examined, ~20 references verified (incl. TV C++ source)
> **Last Updated**: 2026-07-05
> **Review independence**: Fresh session (artifact authored in a prior session) — same-agent bias risk reduced.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict); yarn 1.x + Turborepo monorepo; vitest; zero runtime deps.
**Architecture:** `@jsvision/core` engine → `@jsvision/ui` (Turbo Vision widget framework, retained tree + Solid-style signals) → proposed new `@jsvision/files`. TV-fidelity is NON-NEGOTIABLE (decode from `magiblot/tvision` at `/home/gevik/workdir/github/tvision`).
**Key Files Examined:** `packages/ui/src/list/{list-view,list-rows,list-box}.ts`, `packages/ui/src/dialog/dialog.ts`, `packages/ui/src/event/types.ts` + `event-loop.ts`, `packages/ui/src/dropdown/history.ts`, `packages/ui/src/scroll/scroll-bar.ts`, `scripts/sync-versions.mjs`, `packages/ui/package.json`, `packages/examples/kitchen-sink/{story,shell}.ts` + `test/kitchen-sink.smoke.spec.test.ts`; TV `tfildlg.cpp`, `tchdrdlg.cpp`, `tfillist.cpp`, `tfilecol.cpp`.
**Verified TRUE:** `sync-versions.mjs:71` skips `pkg.private===true` (PA-5 ✓); `ui/package.json` scaffold template (PA-4 ✓); `Dialog`/`ModalHostAware`/`valid()`/`endModal` (✓); `History` exported (✓); `sanitize`/`ScreenBuffer`/absolute layout placement (✓); TV sort comparator `tfilecol.cpp:40-56` + `getText` trailing-sep `tfillist.cpp:113-121` (✓); ChDirDialog geometry `tchdrdlg.cpp:42-79` (✓).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-002) | 🟠 |
| 3 | Logical Contradictions | 1 (PF-001) | 🟠 |
| 4 | Completeness Gaps | 1 (PF-005) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 1 (PF-001) | 🟠 |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 1 (PF-003) | 🟡 |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-004, PF-006) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-003) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 2 | ✅ resolved (fixes applied) |
| MINOR | 4 | ✅ resolved (fixes applied) |
| OBSERVATION | 0 | — |

---

### PF-001: `FileList` scrollbar orientation & 2-column scroll-model conflict with `ListView` 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment / Architecture Mismatch) + 3 (Contradiction) + 6 (Feasibility)
**Location:** `03-02-list-input-infopane.md` (FileList §, "extends ListView<DirEntry>, numCols:2"); `03-03-file-dialog.md` (composition table rows "FileList (3,6,34,14)" + "list ScrollBar (3,14,34,15) horizontal-at-bottom"); `00-ambiguity-register.md` PA-14; `03-05` `numCols` §.
**Codebase Evidence:** `packages/ui/src/list/list-view.ts:44` (`layout = { direction:'row' }` → `[rows fr | bar 1]`), `:75` (`new ScrollBar({ orientation:'vertical' })` — hardcoded), `:80` (`this.add(this.bar)` — always). No seam to inject/orient/suppress the bar. TV: `source/tvision/tfildlg.cpp:77-79` — `TScrollBar(TRect(3,14,34,15))` (31×1 **horizontal**, below the list) passed to `TFileList(TRect(3,6,34,14), sb)`; a 2-column `TListViewer` pages by column (whole-column step, `tlstview.cpp` ctor). Contrast `tchdrdlg.cpp:55` — `TScrollBar(TRect(32,6,33,16))` (1×10 **vertical**, right edge) → matches `ListBox`'s owned vertical bar, so `DirList`/`ChDirDialog` are fine; only `FileList` conflicts.
**The Problem:** `FileList extends ListView` inherits a hardcoded **vertical** bar on the right in a `[rows fr | bar 1]` layout with a **vertical** scroll model (`topItem += rows`). But the decoded `TFileDialog` places a **horizontal** bar *below* the list and a 2-column viewer that pages **horizontally**. Two concrete breaks: (1) the plan's 03-03 table composes a *separate* horizontal `ScrollBar(3,14,34,15)` **in addition to** the vertical bar `ListView` already owns → two bars, neither faithful; (2) PA-14 only adds `numCols` (column-major flow + `│` divider) — it does **not** add horizontal scrollbar support, bar injection/orientation, or the horizontal column-paging scroll model the faithful 2-column list requires. Confirmed by an independent challenger against primary source.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Widen the PA-14 `ui` seam: also let `ListView`/`ListRows` accept an injected/oriented bar (or suppress the owned one) + support horizontal column-paging, matching TV's 2-col `TListViewer`. Update 03-02/03-03/PA-14 + the ST-21 oracle. | Faithful; keeps `FileList extends ListView`; one coherent `ui` generalization | Larger `ui` change than PA-14 admits; more RD-11 regression surface |
| B | Don't extend `ListView` for `FileList`; compose `ListRows` (with `numCols`) directly + a separately-wired horizontal `ScrollBar` at the decoded rect, matching TV's manual composition. | Matches TV's own construction (list + external bar); avoids fighting `ListView`'s owned bar | `FileList` loses the `ListView` convenience; diverges from RD's "extends ListView" wording (AR-238) |
| C | Deviate from the decode: keep `ListView`'s vertical right-edge bar for `FileList`, drop the horizontal-bottom bar, document the deviation. | Smallest code change | Violates the NON-NEGOTIABLE TV-fidelity directive; the horizontal 2-col paging is a visible TV behavior |

**Recommendation:** Option **A** if strict fidelity is required (it is, per the directive) — but scope it explicitly: PA-14 must be rewritten to cover *bar orientation/placement + column-paging*, not just `numCols`, and the 03-03 composition table must stop double-listing a bar. If the horizontal-paging model is judged too costly for v1, Option **B** is the faithful fallback (it mirrors how TV itself builds the dialog — list + externally-supplied bar). Option C only with an explicit, user-approved fidelity deviation. **Confidence:** High (both the `ui` limitation and the TV geometry are directly code-verified and challenger-confirmed). **Hardening:** independent challenger CONFIRMED.

> **⚠️ Source-correction (post-report, during fix):** re-reading `source/tvision/tlstview.cpp` (`TListViewer::draw` + ctor) and `tlistbox.cpp:30` showed the "horizontal-paging scroll model" framing above was **wrong**. `TListBox(bounds, numCols, sb)` → `TListViewer(bounds, numCols, 0, sb)`: the passed bar is the **vScrollBar** (drives `topItem`/`focused`); the scroll model is **vertical** — identical to jsvision's `ListView`. `numCols` only changes the *draw layout* (column-major + `│` divider) and the bar's *step* (`pgStep=size.y*numCols`, `arStep=size.y`). The real gap is therefore narrower: the scrollbar's **rendered orientation + placement** (jsvision hard-owns a vertical-right bar; TV draws a horizontal-bottom bar) + the doc's double-bar contradiction — **not** a new scroll model. The resolution (below) reflects the corrected understanding.

**User Decision:** **Resolved — Option A′ (source-corrected).** User confirmed the **faithful bottom-bar** path (2026-07-05). Fix applied: PA-14 rewritten to add **two** additive seams to `ListRows`/`ListView` — `numCols` (column-major + `│` divider) **and** an injectable/orientable-`ScrollBar` seam (default = today's owned vertical bar), so `FileList` takes the decoded horizontal-bottom bar as its vScrollBar; scroll model stays vertical. 03-03 composition table de-contradicted (the bottom bar is FileList's injected bar, not a second standalone one); 02/03-02/03-05/00-index/99 updated; Phase-1 task 1.9 added to update the stale "single column only" JSDoc.

---

### PF-002: Convenience openers type `host: ModalHost`, which cannot call `execView`; the execView-in-tree mechanic is unspecified 🟠 MAJOR

**Dimension:** 13 (Stale API) + 2 (Implicit Assumptions) + 4 (Completeness)
**Location:** `03-05-history-openers-packaging.md` (Convenience openers §: `openFile(opts: { host: ModalHost; ... })`, `changeDir(opts: { host: ModalHost; ... })`); `00-ambiguity-register.md` PA-8; `00-index.md` Quick Reference (`openFile({ host: app, ... })`).
**Codebase Evidence:** `packages/ui/src/event/types.ts:90` — `execView<R>(view): Promise<R>` is on **`EventLoop`**. `types.ts:21-26` — `ModalHost` exposes **only** `endModal(result)` + `isCommandEnabled(command)` (no `execView`); it is the seam *injected into* a self-closing modal (`event-loop.ts:199-204`), not the handle you *open* one with. `event-loop.ts:193` — `execView` assumes "the caller has added `view` to the tree"; it does not mount. `packages/examples/kitchen-sink/shell.ts:195-205` shows the required dance: `addWindow(modal)` → `loop.execView(modal)` → `finally { removeWindow }`.
**The Problem:** As typed, `openFile`/`changeDir` **cannot compile against their own contract** — `host: ModalHost` has no `execView`. The Quick Reference passing `host: app` reveals the real intended type is the application/loop (or an `execView`-capable seam like the story `execView?: (modal:View)=>Promise<unknown>`), not `ModalHost`. Separately, the openers are described only as "a Promise over `execView`" with no mention of the mandatory **add-to-tree-before-execView / remove-after** step, without which `execView` won't display the dialog. Both confirmed by an independent challenger.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Retype `host` to an `execView`-capable handle (the `EventLoop`, or a minimal `{ execView(view): Promise<unknown> }` seam mirroring the story `execView`), and specify the add-to-desktop→execView→remove lifecycle in 03-05 + PA-8 + a spec-oracle note in ST-20. | Correct + testable; matches the shipped shell pattern | Slightly larger opener surface (needs a desktop/host to mount into) |
| B | Keep `ModalHost` but extend it with `execView` + a mount seam. | Single "host" concept | Reshapes a shipped `@jsvision/ui` interface — no longer "additive-only / no existing export changes" (violates AC-16/PA-3 spirit) |

**Recommendation:** Option **A** — the shipped, tested pattern is exactly `desktop.addWindow(modal) → loop.execView(modal) → removeWindow` (`shell.ts:195-205`); the openers should take an `execView`-capable host (or an app/desktop handle) and encapsulate that lifecycle. Option B is rejected because reshaping `ModalHost` breaks the plan's own additive-only guarantee. Fix the type in 03-05 + PA-8, and add the mount/unmount lifecycle to the opener spec + ST-20 oracle. **Confidence:** High (interface shapes + the mount requirement are directly code-verified and challenger-confirmed). **Hardening:** independent challenger CONFIRMED.

**User Decision:** **Resolved — User accepted Option A.** Fix applied: PA-8 + 03-05 retype `host` to an `execView`-capable app handle (`createApplication` result / `EventLoop` / a `{ execView }` seam), **not** `ModalHost`; the openers run the shipped **add-to-desktop → `execView` → remove-in-`finally`** lifecycle; ST-20 + Phase-6 task 6.3 updated.

---

### PF-003: `numCols` pulls forward the `ListViewer` multi-column work RD-11 explicitly reserved for "RD-07 (AR-104)"; stale "single column only" JSDoc not in the edit list 🟡 MINOR

**Dimension:** 13 (Impact Blindness / Convention) + 10 (Scope)
**Location:** `00-ambiguity-register.md` PA-14; `03-05` `numCols` §; `02-current-state.md` "The gap PA-14 closes".
**Codebase Evidence:** `codeops/features/jsvision-ui/plans/containers-scrolling-lists/01-requirements.md:29` — "Multi-column `ListViewer` (`numCols`) / `Table`/`DataGrid` → **RD-07** (AR-104)." `packages/ui/src/list/list-view.ts:42` ("A single-column virtual-scroll list") + `list-rows.ts:5-10` ("Faithful transcription … for the **single-column** case … no divider is drawn"). RD-16 already built its *own* multi-column renderer (`packages/ui/src/table/grid-rows.ts`) rather than add `numCols` to `ListRows`.
**The Problem:** RD-11 explicitly deferred `numCols` to a future RD-07/AR-104. PA-14 implements it now. This is defensible (RD-09 pre-authorized "any needed additive `ui` seam, pinned at GATE-1"), but the plan never acknowledges it *supersedes/partially fulfills* that reservation, and (a) the "single column only" / "no divider is drawn" JSDoc in `list-view.ts` + `list-rows.ts` will become false yet is **not** in the plan's edit list, and (b) the relationship to RD-16's separate `GridRows` multi-column renderer is unstated (why generalize `ListRows` now vs. the DataGrid precedent of a dedicated renderer).
**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a note in PA-14 + 02 that `numCols` fulfills the RD-11/AR-104 "→ RD-07" reservation; add the `list-view.ts`/`list-rows.ts` JSDoc updates to the Phase-1 edit list; one line on the `GridRows` relationship. | Keeps docs truthful; no stale comments; traceable | A little more doc churn |
| B | Leave as-is (rely on GATE-1 authorization). | No extra work | Stale JSDoc ships; reservation contradiction unrecorded |

**Recommendation:** Option **A** — cheap, and it prevents two shipped JSDoc blocks from silently becoming false. **Confidence:** High.

**User Decision:** **Resolved — User accepted Option A.** Fix applied: PA-14 + 02 + 03-05 now record that `numCols` fulfils the RD-11/AR-104 "→ RD-07" reservation; Phase-1 task **1.9** added to update the "single column only" JSDoc in `list-view.ts`/`list-rows.ts`; the JSDoc edit is in the 00-index Related-Files list.

---

### PF-004: `History(31,3,34,4)` notation implies a rect constructor jsvision's `History` doesn't have 🟡 MINOR

**Dimension:** 12 (Consistency) + 13 (Stale API)
**Location:** `00-ambiguity-register.md` PA-9; `03-05` History §; `03-03`/`03-04` composition tables (`History(31,3,34,4)` / `History(42,3,45,4)`).
**Codebase Evidence:** `packages/ui/src/dropdown/history.ts:38-60` — `History` takes `HistoryOptions { link: Input, historyId?, history?, maxRows? }`; **no rect/coords**. Placement is via `layout: { position:'absolute', rect }` (`layout/types.ts:69-75`), and its popup anchors to the linked `Input`. Existing usage: `new History({ link: input, historyId: 1 })` (`examples/dropdowns-demo/main.ts:70`).
**The Problem:** `History(31,3,34,4)` is TV's `THistory(TRect,link,histId)` shorthand carried over verbatim; a jsvision implementer could read it as constructor args. The intent (place the History icon at that rect, linked to the file/dir input) is fine, but the construction is `new History({ link, historyId })` + an absolute `layout.rect`, not positional coords.
**Recommendation:** Only viable fix — restate the placement in 03-05/PA-9 as "`new History({ link, historyId })` positioned at the decoded rect via absolute layout"; keep the TV rects as the *coordinate* source. (Considered and dropped: leaving it, since it risks a wrong-API implementation attempt.) **Confidence:** High.

**User Decision:** **Resolved — User accepted recommendation.** Fix applied: PA-9 + 03-05 + the 03-03/03-04 composition tables restate History as `new History({ link, historyId })` positioned via absolute layout at the decoded rects.

---

### PF-005: `FileDialog` (49×19) / `ChDirDialog` (48×18) exceed the kitchen-sink smoke canvas (72×16) — clipped, vs the "no clipped text" showcase rule 🟡 MINOR

**Dimension:** 4 (Completeness) + 6 (Feasibility)
**Location:** `03-05` Showcase §; `00-ambiguity-register.md` PA-12; RD ST-17/AC-17.
**Codebase Evidence:** `packages/examples/test/kitchen-sink.smoke.spec.test.ts:22-23` — `WIDTH=72`, `HEIGHT=16`; stories are built with `story.build({ caps, width, height })` and the buffer is asserted only *non-empty*. Plan geometry: `FileDialog` min **49×19**, `ChDirDialog` min **48×18** (both > 16 rows). CLAUDE.md kitchen-sink rule: "Keep it polished: **no clipped text**."
**The Problem:** A 19-row dialog cannot render un-clipped in a 16-row canvas. The smoke test still *passes* (it only checks `paintedCells > 0`), so this won't block CI — but the showcase's stated goal ("render the dialog, navigate the list") and the "no clipped text" polish rule are compromised at 16 rows. The plan doesn't address how the story presents a taller-than-canvas dialog.
**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Have the stories present a *reduced/representative* scene (e.g. the `FileList`+`FileInfoPane` trio, or a shrunk dialog) sized to the canvas, and note the full dialog is exercised in specs/`demo:files`. | Polished, unclipped; smoke stays meaningful | Story ≠ the full dialog at full size |
| B | Confirm the live shell canvas is terminal-sized (≥19 rows) and scope the constraint to the smoke harness only; document that the smoke shows a clipped-but-painting dialog. | Least change | Smoke "renders the dialog" is really "paints a clipped dialog"; polish rule still bent |

**Recommendation:** Option **A** — the kitchen-sink gate values polish; a representative, unclipped scene serves the showcase better than a clipped full dialog. Add a line to the Showcase § noting the canvas constraint. **Confidence:** Medium (the *live* shell canvas height wasn't confirmed; the finding is anchored on the smoke harness's fixed 16 rows).

**User Decision:** **Resolved — User accepted Option A.** Fix applied: 03-05 Showcase § + Phase-8 task 8.3 now specify a **canvas-fit representative scene** (72×16 smoke canvas < the 49×19/48×18 dialogs), full dialog exercised in specs + `demo:files`.

---

### PF-006: Phase task-count headers (58) don't match the enumerated tasks (42); "Progress: 0/58" is inconsistent 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** `99-execution-plan.md` — "Progress: 0/58", the phase table ("Total: 58 tasks"), and the per-phase headers vs the enumerated task tables + Master Progress Checklist.
**Codebase Evidence (the artifact itself):** Enumerated tasks — Phase 1: 1.1–1.8 (**8**, header says 12); Phase 2: 2.1–2.7 (**7**, header 9); Phase 3: 3.1–3.5 (**5**, header 8); Phase 4: 4.1–4.4 (**4**, header 6); Phase 5: 5.1–5.4 (**4**, header 6); Phase 6: 6.1–6.4 (**4**, header 6); Phase 7: 7.1–7.5 (**5**, header 6); Phase 8: 8.1–8.5 (**5**, header 5). Actual total = **42**; headers/Progress claim **58**.
**The Problem:** The Progress denominator and every phase count except Phase 8 overstate the enumerated task list. Either the counts are wrong, or ~16 intended sub-tasks were collapsed and not written. This will make progress tracking during `exec_plan` inconsistent.
**Recommendation:** Only viable fix — reconcile the counts to the enumerated checklist (42), or add the missing sub-tasks if the higher counts were intentional. Recommend recount to 42 unless specific tasks were dropped. **Confidence:** High (arithmetic on the artifact).

**User Decision:** **Resolved — recounted.** Fix applied: enumerated tasks recounted; PF-003's fix added one task (1.9), so the reconciled total is **43** (phase counts 9/7/5/4/4/4/5/5). Progress header, phase table, Total line, and Success-Criteria #1 all updated to 43.

---

## Determination

**✅ PREFLIGHT PASSED — all 6 findings resolved; fixes applied** (2026-07-05). Both majors (PF-001 FileList bar seam, PF-002 opener host/lifecycle) and all four minors were resolved per the user's acceptance of the recommendations, and the fixes were written into the plan documents (00-index, 00-ambiguity-register, 02, 03-02, 03-03, 03-04, 03-05, 07, 99). PF-001's original "horizontal-paging" framing was **source-corrected** during the fix (see its ⚠️ note): the scroll model is vertical; the seam adds bar orientation/placement + `numCols` draw. The plan was otherwise strong on first scan — grounded decodes, a thorough AR register, and packaging/sync-versions/scaffold/`sanitize`/`Dialog`-reuse/TV-decode claims all verified TRUE against primary source.

**Recommended next step:** the two majors changed the `@jsvision/ui` seam scope (PA-14 now adds an injectable/orientable-bar seam, not just `numCols`) — a light **re-scan (iteration 2)** after the edits settle would verify the cross-document consistency, but the plan is execution-ready as amended. *(Re-scan completed — see below.)*

---

## Re-scan — Iteration 2

> **Status**: ✅ PASSED — 2 new findings (both MINOR), resolved and applied
> **Previous Iteration**: 6 findings — all resolved, all verified landed
> **This Iteration**: 2 new findings (PF-007, PF-008)
> **Carried Forward**: none open

### Verification of iteration-1 fixes

All six iteration-1 fixes were re-verified as landed and internally consistent. Two claims *introduced by the fixes* were re-grounded against code:
- **PF-002 opener host** — `Application` exposes `readonly desktop: Desktop` + `readonly loop: EventLoop` (`packages/ui/src/app/application.ts:67-70`), and the shipped idiom is `app.desktop.addWindow(dialog)` + `app.loop.execView`/`focusView` (`packages/examples/controls-live/main.ts:97`). The fix's `host = createApplication() result` claim is **accurate**. ✓
- **Task-count reconcile** — detail tables (43) = master checklist (43) = 9+7+5+4+4+4+5+5. ✓

### PF-007: `ChDirDialog` realization prose still composed a separate "+ ScrollBar" child 🟡 MINOR

**Dimension:** 12 (Consistency) — regression from the PF-001 fix (table fixed, prose missed).
**Location:** `03-04-dir-list-chdir-dialog.md`, ChDirDialog jsvision-realization bullet.
**Codebase Evidence:** `packages/ui/src/list/list-view.ts:75-80` — `ListView`/`ListBox` create + own + lay out their vertical bar; `DirList extends ListBox`, so a separately-composed `ScrollBar` is redundant/contradictory (the table row already said so, `03-04:43`).
**The Problem:** The realization prose listed "`DirList` … + `ScrollBar` +" as a composed child, contradicting the table's "DirList owns its bar, not separately composed."
**Recommendation:** Only viable fix — drop the separate `ScrollBar` from the prose and note DirList owns its bar. **Confidence:** High.
**User Decision:** **Resolved — applied.** The ChDirDialog realization bullet now reads "`DirList` (… `extends ListBox` ⇒ owns its vertical bar, so no separately-composed `ScrollBar`)".

### PF-008: Injected-bar ownership/placement was ambiguous (child-of-ListView vs sibling-of-Dialog) 🟡 MINOR

**Dimension:** 1 (Ambiguity) + 6 (Feasibility) + 13 (Codebase Alignment).
**Location:** `00-ambiguity-register.md` PA-14 seam (2); `03-02` FileList bar bullet; `03-05` numCols § point 2.
**Codebase Evidence:** `packages/ui/src/list/list-view.ts:76-80` — the default bar is a *laid-out child* (`this.rows.bar = this.bar`; `this.add(this.bar)`) in the `[rows fr | bar 1]` layout, i.e. at the list's **right edge**. TV: the scrollbar is a **sibling owned by the parent dialog** (`TListViewer(bounds, numCols, 0, sb)`, `tlistbox.cpp:30`), placed at `(3,14,34,15)` (the dialog's bottom, *outside* the list's `(3,6,34,14)` bounds).
**The Problem:** The PA-14 wording "supply/position the bar" didn't say whether ListView *lays out* the injected bar (→ wrong: list's right edge) or merely *binds* to a bar the FileDialog owns + places (→ correct: dialog's bottom). An implementer could produce the wrong placement.
**Recommendation:** Only viable fix (single-dominant — one correct model, the TV/parent-owned one) — specify the seam as **bind-to-external-bar**: the `FileDialog` owns + places the bar as an absolute sibling; `FileList` shares `focused` + drives `setRange`; ListView does not lay it out in that mode. **Confidence:** High (directly code-grounded).
**User Decision:** **Resolved — applied.** PA-14 seam (2), the `03-02` bar bullet, and `03-05` numCols point 2 now state the ownership explicitly (Dialog owns + places the sibling bar; ListView binds, does not lay out).

### Iteration-2 determination

**✅ PREFLIGHT PASSED (iteration 2)** — the 6 iteration-1 fixes are verified landed and consistent; the 2 new minor findings (a fix-introduced prose remnant + a bar-ownership ambiguity) are resolved and applied. No CRITICAL/MAJOR findings this iteration; no findings carried forward. The plan is execution-ready. A further iteration is unlikely to yield more than observations — recommend concluding.
