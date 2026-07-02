# Portfolio Roadmap: Ink

> **Status**: Active
> **Last Updated**: 2026-07-02 (new feature-set **bun-runtime** — RD-01 Bun runtime support & self-contained executables drafted ✏️; Zero-Ambiguity Gate PASSED AR-1…AR-10, grounded in a same-day empirical Bun 1.3.14 analysis. Earlier today: jsvision-ui RD-13 runtime-hardening → 📋 Plan Created)
> **Features**: 0 / 2 done
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| jsvision-ui | [→](features/jsvision-ui/00-roadmap.md) | 9 ✅ Done (RD-01…RD-07, RD-10, RD-11) · RD-13 🔄 executing (Phase 2/10) · Backlog (RD-08/09, RD-12+) | 9 / 12 done | 🔄 | 2026-07-02 |
| bun-runtime | [→](features/bun-runtime/00-roadmap.md) | RD-01 ✏️ drafted (Bun runtime support & self-contained executables) | 0 / 1 done | 🔄 | 2026-07-02 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| — | — | — | — |

## Notes

- 2026-07-02: **NEW feature-set `bun-runtime` — RD-01 (Bun runtime support & self-contained
  executables) drafted** → ✏️ RD Drafted ([RD-01](features/bun-runtime/requirements/RD-01-bun-runtime-support.md)).
  `add_requirement` grounded in a same-day strict empirical analysis (Bun 1.3.14): the stack already
  runs on Bun unmodified — **1,105/1,105 unit tests pass on the Bun runtime**, the interactive host
  lifecycle was PTY-verified (raw mode, alt-screen, mouse, truecolor, SIGWINCH resize,
  SIGSTOP/SIGCONT suspend/resume, restore-on-exit), and `bun build --compile` binaries behave
  byte-identically (Linux executed; Windows cross-built). The RD adds **guarantees, not fixes**:
  merge-blocking 3-OS Bun CI lane (latest stable, floor ≥ 1.3), compile smokes + 5-target
  cross-build verification, a PTY-driven compiled-binary e2e + `yarn gate` criterion, Bun-children
  e2e variants, engines/README/docs/CHANGELOG declarations, a Windows manual TTY checklist, and a
  benchmarked Bun-native spike (≥ 20% adoption bar; `bun:ffi`/Bun-test excluded). Gate AR-1…AR-10
  all user-resolved. Next: `make_plan bun-runtime RD-01` (or `preflight` the RD first).
- 2026-07-02: **jsvision-ui RD-13 (Runtime hardening & defect remediation) planned** → 📋 Plan Created
  ([`plans/runtime-hardening/`](features/jsvision-ui/plans/runtime-hardening/00-index.md)). 14-doc plan over
  the five-agent deep-audit backlog (3 critical + 12 major + ~20 minor confirmed defects across core + ui):
  Zero-Ambiguity Gate PASSED (19 decisions PA-1…PA-19 — 11 interactive user choices + 8 batch-confirmed
  dominants), 9 component specs with GATE-1 citation indexes, per-HR spec oracles (critical trio fuzz/property-
  locked), 10 phases / 29 sessions / 120 tasks with TV BEFORE-decode/AFTER-diff pairs for HR-09/35/38/43…62.
  Next: preflight, then `exec_plan runtime-hardening`. Cascaded from **jsvision-ui**.
- 2026-07-02: **jsvision-ui RD-07 (Essential-control completions) COMPLETE** → ✅ Done. Executed all 7
  phases spec-first (RED→GREEN→impl): `Input` text selection + logical caret + OSC-52 clipboard + bracketed
  paste, the `picture(mask)` validator (full DSL + autoFill via additive `Validator.fill`, bounds-safe), a
  `MultiCheckGroup` (idiomatic `Signal<number[]>`, faithful `drawMultiBox`), and the visible hardware caret
  (additive `EventLoop.onCaret`/`refreshCaret` + `View.desiredCaret` + `RenderRoot.originOf`, positioned by
  `run()`). Cluster base generalized to TV's marker-string model (PF-001); caret survives partial recompose
  (PF-002). DEF-01/02/03/19 → Shipped; DEF-21/22/25 opened. Spec ST-01…ST-16 green; final gate clean. Cascaded
  from **jsvision-ui**.
- 2026-07-02: **jsvision-ui RD-07 (Essential-control completions) plan preflighted** → 🔬 Plan Preflighted
  ([report](features/jsvision-ui/plans/essential-control-completions/00-preflight-report.md)). Codebase-grounded
  audit (~14 files; ~40 `file:line` refs verified; 3 TV decodes re-checked; 1 challenger). 8 findings, all
  resolved (2🟠 + 4🟡 + 2🔵): PF-001 `Cluster` base generalized to TV's marker-string model (MultiCheckGroup
  couldn't inherit the boolean draw seam) + PF-002 hardware caret now derived by the EventLoop from
  `RenderRoot.originOf()` post-`flush()` (compose-walker coupling broke partial recompose); task total 34→32.
  Next: `exec_plan essential-control-completions`. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-07 (Essential-control completions) planned** → 📋 Plan Created
  ([`plans/essential-control-completions/`](features/jsvision-ui/plans/essential-control-completions/00-index.md)).
  9 docs; 7 phases / 34 tasks, spec-first (ST-01…ST-16 ↔ AC-1…AC-15); PA-1…PA-13 (4 user + 9 dominant/source,
  ✅ GATE PASSED). Grounded in 3 citation-rich GATE-1 TV decodes (`TInputLine`, `TPXPictureValidator`,
  `TMultiCheckBoxes`). 4 user gate-choices: code-point caret unit (grapheme→DEF-21), reject-at-syntaxCheck
  mask DoS bound, autoFill default ON, role `inputSelection`. Additive-only (core `inputSelection` role +
  `Commands.cut/copy/paste` + caret/clipboard seams; no core host change). Next: `exec_plan
  essential-control-completions`. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-07 (Essential-control completions) preflighted** → 🔎 RD Preflighted
  ([report](features/jsvision-ui/requirements/00-preflight-report-RD-07.md)). Same-session codebase-grounded
  audit (6 parallel recon agents + 1 adversarial challenger). **PASSED WITH NOTES** — 0🔴 / 0🟠 + 3🟡 + 2🔵.
  Every infra-existence claim verified exact; the pivotal **decoder-chord feasibility** (Shift/Ctrl-Shift
  arrows, Ctrl+A, Ctrl/Shift-Ins/Del) confirmed YES (test-backed); the hardware-caret host seam confirmed
  **additive with no core change** (challenger REFUTED an initial MAJOR framing). 3 MINOR fixed (caret
  suspend/resume clause · 2 drifted TV `file:line` cites corrected · "Depends On" reworded); 2 OBS carried to
  `make_plan`. Next: `make_plan RD-07`. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-07 (Essential-control completions) drafted** → ✏️ RD Drafted
  ([RD-07](features/jsvision-ui/requirements/RD-07-essential-control-completions.md)). `add_requirement`
  resolved the roadmapped "high-value controls" bucket into a **thin control-completions slice** (AR-115):
  `Input` selection + **system clipboard** (DEF-01, OSC-52 write + bracketed paste), the **`picture(mask)`**
  validator (DEF-02, full DSL + autoFill), **`MultiCheckGroup`** (DEF-03, `Signal<number[]>`), and the
  **visible caret** (DEF-19, logical + hardware via an additive `View`→host seam). AR-115…AR-124; 15 AC.
  The remaining high-value controls (History/Tree/ComboBox/Tabs/Table/Progress/Surface) re-sliced to
  **RD-12+** sibling RDs (like RD-06→RD-11). Deferred: overwrite/`Ins` (DEF-20), OSC-52 read. jsvision-ui
  still 8/11 done (RD-07 drafted). Next: `make_plan RD-07`. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-11 (Containers, scrolling & lists) complete** → ✅ Done — all 6 phases
  shipped spec-first: `packages/ui/src/{scroll,list,dialog}/` (`ScrollBar`·`Scroller`·`ListView<T>`/
  `ListBox`·`Dialog` + OK/Cancel/Yes/No helpers), 4 Containers kitchen-sink stories + the dogfooding
  `ListBox` navigator + `demo:containers`. ST-01…16 green (incl. fidelity ST-14 + packaging ST-15);
  final gate clean (verify 8/8, e2e, check:deps, lint, `gate` PASSED). **DEF-16 Shipped** (Dialog
  `valid()` close-gate). PA-16…19 runtime decisions. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-11 (Containers, scrolling & lists) executing** → 🔄 Executing — Phase 0
  (foundations) complete: six decoded core theme roles (ST-13) + `Commands.ok/cancel/yes/no` + the
  `attachModalHost` loop seam (PA-1) + `scroll/`·`list/`·`dialog/` skeletons; verify + check:deps green.
  Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-11 (Containers, scrolling & lists) preflighted** → 🔬 Plan Preflighted
  ([report](features/jsvision-ui/plans/containers-scrolling-lists/00-preflight-report.md)) — 8 findings
  (1🔴 modal close/Esc bypass · 1🟠 Dialog frame reuse not additive · 4🟡 + 2🔵), **all resolved**; the
  "additive-only" claim corrected (`frame.ts` generalized for Dialog). Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-11 (Containers, scrolling & lists) planned** → 📋 Plan Created
  ([`plans/containers-scrolling-lists/`](features/jsvision-ui/plans/containers-scrolling-lists/00-index.md)).
  12 docs; 6 phases (0 foundations → ScrollBar → Scroller → ListView/ListBox → Dialog → kitchen-sink) / 34
  tasks, spec-first (ST-01…ST-16 ↔ AC-1…AC-15); **PA-1…PA-15 (3 user + 12 decoded/dominant, ✅ GATE
  PASSED)**. Grounded in 2 recon passes: UI seams (**all RD-11 changes additive**) + a hand-verified TV
  GATE-1 decode (byte-checked `cpGrayDialog`→`cpAppColor` chain → real theme colours). One additive loop
  seam (`attachModalHost`, PA-1); DEF-16 realized by the Dialog `valid()` gate. Next: `exec_plan
  containers-scrolling-lists`. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-11 (Containers, scrolling & lists) drafted** → ✏️ RD Drafted
  ([RD-11](features/jsvision-ui/requirements/RD-11-containers-scrolling-lists.md)). `add_requirement`
  fleshed out the AR-93 stub (unblocked now RD-06 is settled): `ScrollBar` (two-way `value`, V+H) ·
  `Scroller` (auto-owned bars) · generic single-column virtual-scroll `ListView<T>` (+ sorted/type-ahead ·
  `ListBox` preset) · rich modal+modeless `Dialog` (terminating-command result + a child `valid()`
  close-gate that **realizes DEF-16** · OK/Cancel/Yes/No helpers). Additive `cpScrollBar` (4–5) + ListViewer
  (26–29) core roles + `ok`/`cancel`/`yes`/`no` `Commands`; new `src/{scroll,list,dialog}/`; the kitchen-sink
  navigator upgrades to a `ListView` sidebar (dogfooding AC). 15 AC; **AR-103…AR-114** (8 user + 4 dominant).
  Deferred → RD-07: multi-column `ListViewer`/`Table`, `ComboBox`. jsvision-ui still 7/11 done (RD-11 now
  drafted, not stubbed). Next: `make_plan RD-11`. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-06 (Essential controls + validators) complete** → ✅ Done. Executed all
  7 phases spec-first (RED→GREEN→impl): `packages/ui/src/controls/` = `Text`/`Label`/`Button`/`Input`/
  `CheckGroup`/`RadioGroup` (+ internal `Cluster` base) + `filter`/`range`/`lookup` validators; the
  additive `cpGrayDialog` core theme roles; two additive intra-ui primitives (`ev.emit`/`ev.focusView`
  + the PF-009 focus-change signal); `examples/controls-demo/` (`demo:controls`). ST-01…ST-16 green;
  final gate clean (`yarn verify` 8/8, `check:deps`, `lint`, e2e 14/14). One runtime decision PA-15 —
  TV-faithful `range` `validChars` (`tvtext2.cpp`). jsvision-ui now 7/11 done. Cascaded from **jsvision-ui**.
- 2026-07-01: **jsvision-ui RD-06 (Essential controls + validators) planned** → 📋 Plan Created
  ([`plans/essential-controls/`](features/jsvision-ui/plans/essential-controls/00-index.md)). 12 docs,
  gate passed (PA-1…PA-14; 3 user choices — the `ev.emit` command primitive, expose-`valid()`-no-trap,
  `boolean[]`/`number` cluster values). 7 phases / 24 tasks / ~21–35 h, spec-first; grounded in 3 recon
  passes (UI seams · TV `t*.cpp` · `tvalidat.cpp`+`app.h` palette, hand-verified). One additive core edit
  (control theme roles, buttons reuse existing) + one additive intra-ui primitive (`ev.emit`/`focusView`).
  DEF-16…18 added to `DEFERRED.md`. Next: `exec_plan essential-controls`. Cascaded from **jsvision-ui**.
- 2026-06-30: **jsvision-ui RD-06 (Essential controls + validators) drafted** → ✏️ RD Drafted; **RD-11
  (Containers, scrolling & lists) stubbed** as its sibling. `add_requirement` **split** Phase-1 controls
  (AR-93): RD-06 = leaf controls + validators (Text/Label/Button/Input/CheckGroup/RadioGroup + filter/
  range/lookup), demoable via headless `demo:controls`; ScrollBar/Scroller/ListView/Dialog reserved in
  the RD-11 stub. AR-93…AR-102; one additive cross-package edit (faithful cpGrayDialog control theme
  roles on core). Deferred-tracked → RD-07: Input selection+clipboard, picture/mask validator,
  MultiCheckGroup. jsvision-ui now 6/11 done (RD-06 drafted). Next: `make_plan RD-06`. Cascaded from the
  **jsvision-ui** row.
- 2026-06-30: **RD-10 TV behavioral-fidelity SHIPPED** → ✅ Done. All 4 phases executed spec-first via
  `exec_plan --auto-commit`: status emit-on-release + pointer capture (additive `statusSelected` role;
  PA-10 = item-under-release), TV-exact cascade + tile (`tdesktop.cpp` algorithms ported verbatim,
  `tileError` no-op), functional left-grow resize (`dmDragGrowLeft` SW grip). core 483 · ui 301 ·
  examples 49 + e2e green; `yarn gate` PASSED. Commits `d326604`→`2aa8877`. jsvision-ui now 6/10 done;
  RD-06 (essential controls) next for the widget tiers. Cascaded from the **jsvision-ui** row.
- 2026-06-30: **RD-10 TV behavioral-fidelity planned** → 📋 Plan Created
  ([`plans/tv-behavioral-fidelity/`](features/jsvision-ui/plans/tv-behavioral-fidelity/00-index.md)).
  4 phases / 10 sessions / 14 tasks / ~12–19 h, spec-first; PA-1…PA-9 over inherited AR-88…AR-92
  (GATE PASSED). TV `tdesktop.cpp`/`tstatusl.cpp`/`tframe.cpp` algorithms ported verbatim; one user
  plan-choice (too-small desktop ⇒ TV `tileError` no-op). One additive cross-package edit
  (`statusSelected` role). Cascaded from the **jsvision-ui** row. Next: `exec_plan tv-behavioral-fidelity`.
- 2026-06-30: **RD-10 TV behavioral-fidelity drafted** → ✏️ RD Drafted ([RD-10](features/jsvision-ui/requirements/RD-10-tv-behavioral-fidelity.md)).
  Follows the shipped TV **drawing**-fidelity pass (commit `1caa188` — desktop/window/menu/status colors,
  glyphs, geometry, hotkeys corrected against `magiblot/tvision`; 823 tests + lint green). RD-10 captures
  the four **behaviors** that pass deferred: status-line press-feedback + emit-on-release (supersedes
  emit-on-press), TV-exact cascade + tile geometry (supersede AR-87), and the functional left-grow resize
  gesture. 5 user choices AR-88…AR-92; 11 AC; one additive `statusSelected` core role; placed as RD-10
  since RD-06…09 are reserved for the widget tiers. jsvision-ui now 5/10 (RD-10 drafted; RD-06 still next
  for widgets — the two are independent). Cascaded from the **jsvision-ui** row.
- 2026-06-30: **RD-05 app-shell complete** → ✅ Done (all 6 phases executed spec-first; 22 spec oracles
  ST-01…ST-22 + impl tests green; full gate clean — `yarn verify` 273 ui + core, `test:e2e` 8 core +
  examples shell-demo, `check:deps`, `lint`; largest new file `menu/controller.ts` 332 lines). Lands
  `packages/ui/src/{app,desktop,window,menu,status}/` + Phase-0 additive primitives (RD-02
  `position:'absolute'`+`rect`, RD-03 `DrawContext.role`, RD-04 `EventLoop` `setCapture`/`onFrame`, the
  sole cross-package edit = core `Theme.windowInactive`) + `examples/shell-demo/` (`demo:shell`).
  jsvision-ui now 5/9 done; RD-06 (essential controls) next. Cascaded into the **jsvision-ui** row.
- 2026-06-30: **RD-05 app-shell plan preflighted ×2** → 🔬 Plan Preflighted ([report](features/jsvision-ui/plans/app-shell/00-preflight-report.md)).
  Iter-1 (PF-01…PF-09, 1 CRITICAL) added a spec-first **Phase 0** (RD-02 `position:'absolute'` + RD-03 `DrawContext.role`) and
  re-baselined to **6 phases / 18 sessions / 48 tasks** (PA-15…PA-19). Iter-2 (PF-10…PF-14, 1 CRITICAL — an empty full-viewport
  overlay would swallow all mouse input; + ST-04/AR-66 restore-on-throw contradiction; + a Phase-2↔Phase-3 ordering gap) all
  resolved Option A (PA-20…PA-22); independent challenger confirmed the critical/major findings against live source. Ready for
  `exec_plan`. Cascaded from the **jsvision-ui** row.
- 2026-06-30: **RD-05 app-shell planned** → 📋 Plan Created ([`plans/app-shell/`](features/jsvision-ui/plans/app-shell/00-index.md)).
  6 phases / 16 sessions / ~30–42 h; PA-1…PA-14 (4 user choices + 10 dominant, ✅ GATE PASSED); 22 spec oracles
  (ST-01…ST-22). One cross-package edit (`windowInactive` core role); two additive intra-package loop seams
  (pointer capture + `onFrame`). Cascaded from the **jsvision-ui** row.
- 2026-06-30: **RD-04 event-loop complete** → ✅ Done (all 5 phases executed spec-first; 20 spec
  oracles ST-01…ST-20 + impl tests green; full gate clean — `yarn verify` 8/8, `test:e2e` event-demo
  + core, `check:deps`, `lint`; every `event/` file ≤ 227 lines). Lands `packages/ui/src/event/` +
  additive `view.ts`/`group.ts`/`view/types.ts` + `demo:events`. jsvision-ui now 4/9 done; RD-05
  (Application/`run()`/shell) next. Cascaded into the **jsvision-ui** row.
- 2026-06-30: **RD-04 event-loop plan preflighted** → 🔬 Plan Preflighted (codebase-grounded audit,
  every `file:line` claim verified; 2 MAJOR + 3 MINOR + 2 OBSERVATION resolved — single `runTick`
  per public mutator PA-11, modal Phase-2 bubble clamp PA-12, built-in Tab→focus PA-10; 33 tasks).
  Ready for exec_plan. Cascaded into the **jsvision-ui** row.
- 2026-06-30: **RD-04 event-loop plan created** → 📋 Plan Created (`plans/event-loop/`; 5 phases /
  15 sessions; PA-1…PA-9; spec-first ST-01…ST-20). New `packages/ui/src/event/` + additive
  `view`/`group` edits + `demo:events`; no cross-package primitive. Cascaded into the
  **jsvision-ui** row.
- 2026-06-29: **RD-04 event-loop preflighted** → 🔎 RD Preflighted (codebase-grounded audit; 3
  MAJOR + 4 MINOR + 1 OBS, all resolved Option A; AR-60…AR-66). Corrected the dispatch `handled`
  envelope (core `InputEvent` is readonly), the loop now **builds** the `RenderRoot` (the schedule
  seam is construct-time), and reuse of core's existing `createKeymap`. Cascaded into the
  **jsvision-ui** row.
- 2026-06-29: **RD-04 event-loop drafted** → ✏️ RD Drafted (`add_requirement`; AR-47…AR-59, 20
  AC). The host-agnostic dispatch mechanism (`EventLoop`) that makes the RD-03 spine interactive;
  concrete `Application`/shell deferred to RD-05. Cascaded into the **jsvision-ui** row.
- 2026-06-29: migrated from the flat layout via setup_codeops.
- 2026-06-29: **RD-03 view-group-spine complete** → ✅ Done (all 7 phases executed spec-first, 8
  commits; ui 142 unit + 3 e2e green, verify/check:deps/lint clean). jsvision-ui now 3/9 done;
  RD-04 (event loop) next. Cascaded into the **jsvision-ui** row.
- 2026-06-29: **RD-03 view-group-spine plan preflighted** → 🔬 Plan Preflighted (1 MAJOR + 2 MINOR
  resolved, 0 CRITICAL; report in the plan folder). Cascaded into the **jsvision-ui** row.
- 2026-06-29: update_roadmap refined the **jsvision-ui** row from disk — Stage Summary + Progress
  (2/9 done) cascaded from the feature roadmap (RD-01/02 ✅, RD-03 📋 Plan Created, RD-04…09 ⬜).
- 2026-06-29: archived the completed **monorepo-restructure** plan (30/30 tasks done; the repo is
  now a yarn 1.x + Turborepo monorepo) → `_archive/monorepo-restructure/`. It was repo-level
  infrastructure swept under `jsvision-ui` by the migration, never a tracked feature row.
