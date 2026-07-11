# Preflight Report — Flexible Chrome Bars

> **Feature**: jsvision-ui / flexible-chrome-bars · **CodeOps Skills Version**: 3.3.2
> **Scan date**: 2026-07-11 · **Reviewer**: independent review (plan authored in a prior session/repo)
> **Grounding**: codebase-verified against `packages/ui/src/{status,menu,app,layout,view,feedback}` +
> `packages/examples` + the immutable oracle suites, in this repo (`jsvision.status.chrome`, branch
> `feat/flexible-chrome-bars`).

## Codebase Context Summary

The plan targets the app-shell chrome bars. Verification of every referenced anchor:

| Plan reference | Real code | Verdict |
|---|---|---|
| `statusline.ts` class:91, `StatusItem`:17, `itemBoxes`:116, `draw`:138, `onEvent`:180, `attach`:111, `statusLine`:248, `statusItem`:266, `matchesChord`:63 | all present at those lines; file is **268 lines** (plan said 269) | ✅ accurate |
| `statusItem(text, command, key?)` — command **required** today | `statusline.ts:266` confirms required | ✅ |
| `builders.ts` `MenuItem`:30, `TITLE_MARGIN`=1:66, `TITLE_PAD`=2:68, `titleOf`:123, `menuItemHotkey`:128, `menuItemLabel`:133, `layoutTitles`:145, `titleIndexAt`:158, `TitleLayout {index,x,width,label}`:56 | all present | ✅ |
| `menubar.ts` class:41 (plan 40), `draw`:64 (plan cited :60 = actually the `createMenuController` line), `layoutTitles(this.items)`:82, `titleIndexAt`:110, `ctx.size.width`:81 | present; draw has the bar width available | ✅ (minor citation drift) |
| `controller.ts` popup anchor reads `layoutTitles(tops)[index]` at **:197 inside `openLevelForTop`** (`function openTop` is at :230) | confirmed | ⚠️ see PF-002 |
| `application.ts` `CHROME_ROW_HEIGHT`=1:117, menu layout:222, status layout:227, resize:285 | present; layout is **replaced** (AR-11 merge is real) | ✅ |
| `dsl.ts` `col`:101 `row`:117 `spacer`:180 (Empty view, fr/fixed) | present; `row/col/spacer` barrel-exported (`index.ts:52`) | ✅ |
| `apportion.ts` `apportion`:43, `solveTrack`:99 (largest-remainder) | present | ✅ |
| `progress-bar.ts` `measure()` height `top?2:1` :169 (plan :167); `ProgressBar` barrel-exported | present | ✅ |
| `app-shell.packaging.spec.test.ts` `const statusEntry: StatusItem = statusItem(...); .command` | confirmed ~:49-51 (hard constraint real) | ✅ |
| kitchen-sink `shell.ts:99` command-less `statusItem('~Tab~ …')` | confirmed (currently a latent type-mismatch since kitchen-sink isn't in the typecheck scope; AR-9 legitimises it) | ✅ |
| No external reads of `StatusLine.items` | grep confirms none — safe to back `.items` with filtered `children` | ✅ |
| **`packages/examples/playground/main.ts`** (T-4.2 "extend the existing", T-4.3, criterion #5) | **DOES NOT EXIST in this repo** (exists only in Ink); tsconfig `include` is exactly `["capability-probe","resize-demo","keyboard-mouse-playground"]` as claimed; **`demo:playground` script already maps to `keyboard-mouse-playground/main.ts`** | 🔴 see PF-001 |

**Bottom line:** the core refactor (Phases 1–3) is grounded and applies cleanly here — source and all
immutable oracles are byte-identical to the repo the plan was authored against. One Phase-4 demo
assumption is stale for this repo, plus three low-risk execution-guidance notes.

## Findings

### 🟠 PF-001 (MAJOR) — Playground demo target is a phantom reference in this repo
- **Dimension 13 (Phantom Reference / Stale Assumption).**
- T-4.2 says *"extend the existing"* `packages/examples/playground/main.ts` — **no such file exists here.**
  T-4.3 adds `"playground"` to the tsconfig include, and criterion #5 requires the file to run. The
  plan was authored against Ink, where `playground/` exists.
- Compounding: **`demo:playground` is already taken** — it maps to `keyboard-mouse-playground/main.ts`
  (`package.json:17`). A new `playground/` dir cannot reuse that script name.
- **Blast radius:** isolated to **Phase 4 demo tasks** (T-4.2, T-4.3, criterion #5). The core feature
  (Phases 1–3: `packRow`, StatusLine-as-container, MenuBar flex titles) and the kitchen-sink story
  (T-4.4) are unaffected.
- **Options:**
  - **A.** Keep the plan's `playground/main.ts` path — **create** it fresh (not "extend"), add
    `"playground"` to the include, add a **new** script (`demo:chrome-bars`). Minimal plan churn; but
    a `playground/` dir whose `demo:playground` script points elsewhere is confusing.
  - **B. (recommended)** Create `packages/examples/chrome-bars-demo/main.ts`, script `demo:chrome-bars`,
    add `"chrome-bars-demo"` to the include. Fits this repo's `*-demo/` convention (tvision-demo,
    controls-demo, feedback-demo…), avoids the name collision; costs a small path edit to T-4.2/4.3/#5.
  - **C.** Drop/defer the standalone demo; rely on the kitchen-sink "rich status bar" story (T-4.4) as
    the showcase. AR-14 was a `[U]` user decision, so de-scoping is the user's call.
- **Recommendation: B** — idiomatic for this repo, self-contained, no Ink coupling.
  *Confidence: High* that a new dir + new script name is required (both facts verified).
  *Hardening: in-context challenge* — considered folding into `tvision-demo` (rejected: it's the
  flagship DX demo and isn't in the typecheck scope) and dropping the demo entirely (offered as C).

### 🟡 PF-002 (MINOR) — Popup-anchor width must thread into `openLevelForTop`, not `openTop`
- **Dimension 13 (citation precision).** T-3.4 / 03-03 say thread `barWidth` into
  `MenuController.openTop`. The `layoutTitles(tops)[index]` read that anchors the popup is in
  **`openLevelForTop` (controller.ts:197)**; `openTop` (:230) calls into it. Execution must add the
  width at the `openLevelForTop` read site (using `viewport().width`). Safety net: ST-09.

### 🟡 PF-003 (MINOR) — StatusLine→Group must set a `statusBar` background to preserve the full-row fill
- **Dimension 4 (Completeness).** The current monolithic `draw()` fills the **entire** row with the
  `statusBar` bg (`statusline.ts:138`) before painting items. As a `Group`, empty gap cells (ST-01)
  and trailing cells past the last item only get that bg if `StatusLine` sets its group `background`
  to the `statusBar` bg. 03-02 doesn't state this. Safety net: the preserved pixel oracles + ST-01.

### 🟡 PF-004 (MINOR) — Accessor-text width changes need a layout invalidation, not just a repaint
- **Dimension 6 (Feasibility) / 9 (Edge cases).** ST-04 widens `() => label()` from "AA"→"BBBB". For
  the item's span to widen and shift its neighbours, the accessor binding must trigger
  `invalidateLayout()` (re-measure the row), not only `invalidate()` (repaint). 03-02 says "its span
  widens" but not the mechanism. Safety net: ST-04.

### 🔵 PF-005 (OBSERVATION) — Blast-radius count drift
- **Dimension 12 (Consistency).** 02 § blast radius says "61 `statusItem(` call sites"; this repo has
  **18 files / ~70 occurrences**. The *material* claim (only the packaging spec reads `.command` off a
  `statusItem` result) is verified true. The number is cosmetic — mark it approximate.

## Resolution

- **PF-001 → decision B (user):** create a new `packages/examples/chrome-bars-demo/main.ts` + a
  `demo:chrome-bars` script + add `"chrome-bars-demo"` to the tsconfig `include`. Folded into T-4.2/T-4.3,
  03-04, F-8, criterion #5, AR-14.
- **PF-002 → folded into T-3.4** (thread width into `openLevelForTop`, not `openTop`).
- **PF-003 → folded into T-2.3** (set the `statusBar` group background to preserve the full-row fill).
- **PF-004 → folded into T-2.2** (accessor text ⇒ `invalidateLayout()`; bind on mount).
- **PF-005 → accepted** (cosmetic count; left as-is, noted approximate).

## Verdict

**✅ PREFLIGHT PASSED WITH NOTES** — 1 MAJOR resolved by decision, 3 MINOR folded into the tasks as
execution guidance (each backed by a spec oracle), 1 cosmetic observation accepted. The plan is ready
for `exec_plan --auto-commit`.
