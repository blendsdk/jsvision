# Preflight Report: flex-dialog-bodies

> **Status**: ✅ PASSED — all 6 findings resolved (recommendations applied to the plan, 2026-07-19)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/layout-dsl-adoption/plans/flex-dialog-bodies/`
> **Codebase Grounded**: 12 source files + 4 test oracles examined; ~30 file:line references verified
> **Last Updated**: 2026-07-19
> **Review independence**: Reviewed in a fresh session (post-`/clear`); the plan was authored in a prior session, so same-agent bias is reduced. One independent challenger was run on the CRITICAL/MAJOR batch (both converged).

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest (unit `*.spec`/`*.impl`, e2e). Zero runtime deps.
**Architecture:** `@jsvision/ui` widget framework over `@jsvision/core`; a cell-native flex layout engine (`layout/`) + a declarative DSL (`view/dsl/` — `col`/`row`/`grow`/`fixed`/`spacer`/`cover`/`at`) re-exported through the ui barrel; `@jsvision/forms` composes on ui by package name.
**Key Files Examined:** `ui/src/dialog/message-box.ts`, `ui/src/editor/dialogs.ts`, `forms/src/form-dialog.ts`, `ui/src/view/dsl/{flex,absolute}.ts`, `ui/src/layout/{layout,types,measure}.ts`, `ui/src/dialog/buttons.ts`, `ui/src/view/group.ts`; oracles `editor-dialogs.spec.test.ts`, `message-box.impl.test.ts`, `form-dialog.impl.test.ts`.

**Verified GREEN (plan claims that hold):**
- `justify:'center'` is implemented (`layout.ts:205`); `col`/`row`/`grow`/`fixed`/`cover`/`at`/`spacer` are all re-exported through the ui barrel (`view/index.ts:27-40`).
- Bare `okButton()`/`cancelButton()` in a `row` do NOT collapse: `Button.measure()` returns `{width: stringWidth(label)+4, height: 2}` (`button.ts:117`), wired into the layout box (`reflow.ts:80`) — so `auto` buttons self-size (though to their label width, e.g. OK→6, Cancel→10, not the old fixed 10).
- Focusable-order claims match current DOM add-order for find/replace/confirm/inputBox; DFS tree-order Tab (#122) preserves them. Traversal specs are writable (Tab-drive + `getFocused()`).
- `cover(body)` (position:'fill') genuinely guards the all-absolute-children collapse (`layout.ts:104-107`); AR-2/AR-3 reasoning is sound.
- Re-baselining `editor-dialogs.spec` is authorized (RD-01 deliberate-divergence + `CLAUDE.md:186-192` carve-out); it is a TV-decode-derived `.spec` oracle, sanctioned as an exception.
- No exported-symbol JSDoc changes → no plugin API-ref drift; `check-plugin` PASS claim holds.

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | ✅ resolved (fix applied) |
| 🟠 MAJOR | 1 | ✅ resolved (fix applied) |
| 🟡 MINOR | 3 | ✅ resolved (fix applied) |
| 🔵 OBSERVATION | 1 | ✅ resolved (fix applied) |

---

### PF-001: formDialog button nesting breaks the "unedited" witness tests `:139` and `:184` 🔴 CRITICAL

**Dimension:** 13 (Codebase Alignment — Impact Blindness / Test Impact) · also 3 (Contradiction)
**Location:** `03-03-form-dialog-buttons.md` (target structure §, oracle §); `07-testing-strategy.md` ST-W3/§non-goals; `01-requirements.md` success criterion #3; `99-execution-plan.md` task 3.1/3.3.
**Codebase Evidence:** `packages/ui/src/view/group.ts:62` (`children` is a shallow direct-child array); `packages/forms/test/form-dialog.impl.test.ts:92-93` (`:80`), `:166` (`:139`), `:203/211` (`:184`).

**The Problem:** The plan's formDialog structure is `const buttonBand = row({justify:'center',gap:2}, ok, cancel); at(buttonBand, …); dlg.add(buttonBand);`. This makes OK/Cancel **grandchildren** of the dialog (children of the `row` Group). But `form-dialog.impl.test.ts` locates buttons with the **shallow** `dlg.children.filter(c => c instanceof Button)` — which now returns `[]` (the row is a Group, not a Button). Concretely:
- **`:139`** (L166) `…filter(…)[1]` → `undefined`; `loop.renderRoot.originOf(undefined)` → the test **hard-crashes** on `o.x`.
- **`:184`** (L203/211) `buttons` is `[]`; L211 `expect(buttons.filter(disabled).length).toBe(1)` gets `0` → **assertion fails**.
- **`:80`** (L92-93) the plan says "keep `buttons.length===2` (L93)" — but that count also reads the shallow filter, so it is `0` unless the lookup is changed.

This directly contradicts the plan's own contract: R-5 / RD-02 NFR-3 permit editing **only** `:80`; success criterion #3 and ST-W3 assert `:139` and `:184` pass **unedited**; and `07-testing-strategy.md` §non-goals declares any other behavioral test going red "is a conversion defect." Those three statements are jointly unsatisfiable under the chosen structure — an executor following the plan literally traps on red tests it is forbidden to touch. (Message-box/editor tests are immune: they use a recursive `descendants()` walk.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Re-scope: permit mechanical **locator** edits to `:139` (L166), `:184` (L203), and `:80`'s L92 lookup — swap `dlg.children.filter(...)` → a `descendants()` walk (the pattern the other suites already use). Document them as behavior-preserving test-plumbing updates, explicitly **distinct** from the two RD-01 geometry re-baselines; correct NFR-3 accounting + success criterion #3 + ST-W3 to list them. | Honest; minimal; changes *how a button is found*, not *what is asserted*; keeps the flex structure. | Widens the edited-oracle set from 2 to ~4 files — the NFR-3 story must be updated (but the two RD-01 geometry re-baselines stay exactly two). |
| B | Keep OK/Cancel as **direct** children of the dialog (don't wrap in a `row`); center each via `at()` at a measured x. | Zero test-locator churn. | Reintroduces the per-button centering math (`PAIR_WIDTH`/`startX`) the plan exists to delete — defeats FR-5. Not viable. |
| C | Leave as-is. | — | Plan fails its own gate at execution; not viable. |

**Recommendation:** **Option A** — it is the only resolution that preserves the flex goal and the deletion payoff. The edits are pure locator swaps (find-by-descendant instead of find-by-direct-child); no asserted value changes, so behavior-invariance holds. The plan must (1) add a task to update the three lookups, (2) amend NFR-3 accounting/success-criterion #3/ST-W3 to record them as non-geometry mechanical edits, and (3) note the re-baselined `:80` test needs a `renderRoot.flush()` before reading solved `.bounds` (buttons no longer carry a static `.layout.rect`).

**Confidence:** High — breakage reproduced from the actual test source + plan text. **Hardening:** challenger converged (independently reproduced the `:139` crash and `:184` assertion-fail and reached CRITICAL + Option A). **Challenger:** converged.

**User Decision:** Resolved — User accepted the recommendation; fix applied to the plan docs (2026-07-19).

---

### PF-002: No render/paint verification for the messageBox family (and, less so, editor dialogs) 🟠 MAJOR

**Dimension:** 4 (Completeness Gaps) · 13 (Test Impact)
**Location:** `07-testing-strategy.md` ST-K1 + §"Why these are the only new tests"; `01-requirements.md` success criterion #5; `00-ambiguity-register.md` AR-11.
**Codebase Evidence:** No kitchen-sink story or smoke test references `messageBox`/`confirm`/`inputBox`/`findDialog`/`replaceDialog`/`confirmBox` (grep of `packages/examples/kitchen-sink/` + `packages/*/test/` returns none); `message-box.impl.test.ts:42/51/60` assert only `bounds.width`; `message-box.spec.test.ts` asserts only resolved promise values; the existing collapse-guard pattern lives at `form-dialog.impl.test.ts:104-133`.

**The Problem:** The plan's only render check (ST-K1) is `forms-dialog.story`. The **messageBox family has zero child-rect oracle** — its child positions are declared "sanctioned divergence… no oracle asserts them" (`03-01:37`) — and no paint/no-clip test either. Its behavioral specs assert only promise values / the width formula, so a clipped `Text`, a cramped inset (the old ~2–3-cell interior margin becomes `col padding:1` = 1 cell), or a button band that overruns the frame would ship **undetected**. This is precisely the one property sanctioned divergence must still preserve. The clip/collapse failure mode is not hypothetical — it already bit `formDialog`'s body (the reason `form-dialog.impl:104` exists), and that cheap guard is not extended to the family taking the larger inset change.

Scope nuance (from the challenger): the **editor** family is only *partially* exposed — `editor-dialogs.spec` still asserts exact child `layout.rect`s (being re-baselined), which is a de-facto geometry check. So the sharp gap is the **message-box family**; an editor paint guard is lower marginal value.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (scoped) | Add a lightweight headless paint guard mirroring `form-dialog.impl:104`: mount each messageBox/confirm/inputBox, `flush()`, assert a known body string paints **and** buttons have non-zero solved `bounds`. Optionally one for confirmBox. Skip the editor family (its re-baselined rect oracles cover it). | Cheap; directly guards the rebuild's core risk on its highest-delta, least-covered surface; reuses an existing pattern. | ~3 small tests to author (net-new beyond the plan's stated test list). |
| B | Accept the risk; rely on a manual/visual inspection note for message-box (as forms already has). | Zero new tests. | The behavior-invariance claim is unguarded on message-box; regressions are silent between manual passes. |
| C | Add full kitchen-sink stories for all these dialogs. | Best long-term coverage + dogfooding. | Heavier than the risk warrants; AR-11 already (defensibly) decided no new stories. |

**Recommendation:** **Option A, scoped to the message-box family** — a `:104`-style paint+non-zero-bounds guard is the cheapest thing that closes the one real hole (zero-oracle + largest geometry change), and it mirrors a pattern already in the suite. The editor family's re-baselined rect asserts make a separate paint guard low-value; forms already has ST-K1. Add these to `07-testing-strategy.md`'s test table and Phase-1/Phase-4 tasks.

**Confidence:** Med — the residual clip risk depends on how simple the message-box children are; if they are plain framework labels, a manual note (B) could suffice, dropping this to MINOR. **Hardening:** challenger converged on "real defect, MAJOR (defensible MINOR), Option A scoped to message-box" and supplied the editor-family partial-coverage nuance now folded in. **Challenger:** converged.

**User Decision:** Resolved — User accepted the recommendation; fix applied to the plan docs (2026-07-19).

---

### PF-003: `BUTTON`/`GAP` "delete" instruction contradicts the target code that still uses them 🟡 MINOR

**Dimension:** 3 (Contradiction) · 12 (Consistency)
**Location:** `02-current-state.md` Target 1 (":53-55 delete `PAIR_WIDTH`/`BUTTON`") + Target 3 (":54-56 delete `PAIR_WIDTH`/`BUTTON`/`GAP`"); vs `03-01:23-24` (`fixed(row(...), BUTTON.height)`) and `03-03:20/29/38` (`options.height - BUTTON.height - 1`, `height: BUTTON.height`, "keep a local `BUTTON`/`GAP` const only if still referenced").
**Codebase Evidence:** `message-box.ts:54-55`, `form-dialog.ts:54-56` define these consts; the plan's own target snippets reference `BUTTON.height`.

**The Problem:** `02-current-state` lists `BUTTON`/`GAP` among helpers "to delete," but the target code in `03-01`/`03-03` still references `BUTTON.height`, and success criterion #1's grep list omits `BUTTON`/`GAP`. So the "to delete" list is internally inconsistent — an executor deleting `BUTTON` per `02-current-state` then breaks the `03-0x` snippets.

**Recommendation:** Only one viable fix: keep a small `BUTTON` (and `GAP`) const where still referenced (or inline `2`), and drop `BUTTON`/`GAP` from the `02-current-state` "to delete" lists so they match `03-0x` + success criterion #1 (which only mandates deleting `at`/`tv`/`place`/`centerX`/`PAIR_WIDTH`/`buttonRects`). No genuine second option.

**User Decision:** Resolved — User accepted the recommendation; fix applied to the plan docs (2026-07-19).

---

### PF-004: inputBox sample references the non-exported `Empty` class 🟡 MINOR

**Dimension:** 13 (Phantom Reference) · 6 (Feasibility)
**Location:** `03-01-message-box.md` inputBox target (`grow(new Empty())`, line ~52).
**Codebase Evidence:** `packages/ui/src/view/dsl/flex.ts:196` (`class Empty extends View` — **not exported**); the public spacer is `spacer()` (`flex.ts:215`, re-exported `view/index.ts:31`). `Empty` appears nowhere in the barrel.

**The Problem:** The primary inputBox code sample writes `grow(new Empty())`, but `Empty` is a private class — the literal sample won't compile. The plan hedges ("or `spacer()` … use whichever is idiomatic"), so it's a doc bug, not a design one.

**Recommendation:** Only viable fix: replace the sample with `spacer()` (already `{kind:'fr',weight:1}`, so no `grow()` wrapper needed) and drop the `new Empty()` mention. Trivial.

**User Decision:** Resolved — User accepted the recommendation; fix applied to the plan docs (2026-07-19).

---

### PF-005: Re-baselining `editor-dialogs.spec` will leave its header comment misdescribing the oracle's provenance 🟡 MINOR

**Dimension:** 12 (Consistency) · 4 (Completeness)
**Location:** `03-02-editor-dialogs.md` oracle-re-baseline §; `99-execution-plan.md` task 2.2.
**Codebase Evidence:** `packages/ui/test/editor-dialogs.spec.test.ts:5-14` — the header states children "sit at VERBATIM dialog-relative rects" from the TV decode and "Expectations derive from RD-08 + the decode, **never the implementation**."

**The Problem:** The plan re-baselines the `:51`/`:89` child-rect assertions to flex-solved values that intentionally **diverge** from the TV decode and are, by construction, derived from the implementation. That makes the file's own header comment false. The plan never mentions updating it, so the edited oracle would misrepresent where its numbers come from.

**Recommendation:** Only viable fix: as part of task 2.2, update the header comment to record the RD-01 deliberate re-derivation (child rects now solve from the `col`/`row` flex tree, not the TV decode; outer bounds + record round-trips remain decode-faithful). Keeps the oracle self-honest.

**User Decision:** Resolved — User accepted the recommendation; fix applied to the plan docs (2026-07-19).

---

### PF-006: "Import … from the ui barrel" is imprecise for in-package files 🔵 OBSERVATION

**Dimension:** 12 (Consistency — Convention)
**Location:** `03-01:14`, `03-02:9` ("Import `col`, `row`, … from the ui barrel").
**Codebase Evidence:** `message-box.ts` and `editor/dialogs.ts` live *inside* `@jsvision/ui` and idiomatically import from the internal relative barrel (`../view/index.js`, `../controls/index.js`), not the package name `@jsvision/ui` (which `@jsvision/forms` correctly uses). Existing imports in both files already follow the relative convention.

**The Problem:** Minor wording imprecision — an executor will almost certainly do the right thing (match the file's existing relative imports), but "the ui barrel" reads as the package name, which an in-package file should not self-import.

**Recommendation:** Optional: reword to "the internal view/controls barrels (`../view/index.js`)" for `03-01`/`03-02`; `03-03` (forms) correctly uses `@jsvision/ui`.

**User Decision:** Resolved — User accepted the recommendation; fix applied to the plan docs (2026-07-19).

---

## Pass/Fail

**✅ PREFLIGHT PASSED — all 6 findings resolved.** The user accepted every recommendation and the fixes
were applied to the plan documents (`01`, `02`, `03-01`, `03-02`, `03-03`, `07`, `99`, `00-ambiguity-register`).
Net effect: PF-001 re-scopes the oracle-edit accounting (two RD-01 geometry re-baselines + a mechanical
button-locator swap in `form-dialog.impl:80/139/184`, no assertion change); PF-002 adds a message-box
family paint guard (ST-K2, `message-box.render.impl.test.ts`, new task 1.2); PF-003/004/005/006 are doc
corrections. The plan's feasibility, focus-order, collapse-guard, and oracle-authorization claims were all
verified green against the code. Ready for `exec_plan`.
