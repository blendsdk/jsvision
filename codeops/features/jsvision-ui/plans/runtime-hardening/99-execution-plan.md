# Execution Plan: Runtime Hardening (RD-13)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-02
> **Progress**: 82/120 tasks (68%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Remediates RD-13's 3 critical + 12 major + ~20 minor confirmed defects across `@jsvision/core` and
`@jsvision/ui`, spec-first per HR (RED→GREEN→impl), fidelity items behind GATE-1/GATE-2 TV decodes.
Phase order per **PA-19** (the RD's closing note): critical trio → core majors → lifecycle majors →
shell majors → minor batches by subsystem → governance/final gate. **No new components** — no
kitchen-sink story tasks are required (AC-10 only keeps the existing smoke/demos green).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Critical trio — HR-01/02/03 | 3 | 4–6 h |
| 2 | Core majors — HR-04/05/06/07 | 3 | 4–6 h |
| 3 | Lifecycle majors — HR-10/11/12/13/14 | 3 | 5–7 h |
| 4 | Shell majors — HR-08/09 (GATE) | 3 | 3–4 h |
| 5 | Minor batch: core engine — HR-15…26 | 3 | 6–8 h |
| 6 | Minor batch: reactive/view — HR-27…34 | 3 | 5–7 h |
| 7 | Minor batch: event/shell — HR-35…42 (GATE) | 3 | 5–7 h |
| 8 | Minor batch: controls — HR-43…48, 52, 54…60 (GATE) | 4 | 8–10 h |
| 9 | Minor batch: containers/lists — HR-49…51, 53, 61, 62 (GATE) | 3 | 4–6 h |
| 10 | Governance + final gate | 1 | 2–3 h |

**Total: 29 sessions, ~46–64 hours**

**Verify (every phase)**: `yarn verify` · `yarn test:e2e` · `yarn check:deps` · `yarn lint` · `yarn gate` (ST-9). Commits via **/gitcm** per the exec_plan commit mode.

---

## Phase 1: Critical trio (HR-01, HR-02, HR-03)

**Reference**: [03-01](03-01-core-input-decoder.md) · [03-06](03-06-event-loop-focus.md) · [03-04](03-04-reactive-core.md)

### Session 1.1: Specification tests (RED)
| # | Task | File |
|---|------|------|
| 1.1.1 | Write ST-1.x + fuzz seed (hostile UTF-8 totality) | `packages/core/test/input-hardening.spec.test.ts` |
| 1.1.2 | Write ST-1.y + offset-invariance property (modal hit-test) | `packages/ui/test/event.hardening.spec.test.ts` |
| 1.1.3 | Write ST-1.z/z2 (dispose finality) | `packages/ui/test/reactive.hardening.spec.test.ts` |
| 1.1.4 | RED run — all three **must reproduce** (AC-1) | — |

### Session 1.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 1.2.1 | HR-01 post-assembly UTF-8 validation (range/surrogate/overlong → drop) | `packages/core/src/engine/input/keys.ts` |
| 1.2.2 | HR-02 modal branch uses `absoluteOrigin(scopeRoot)` | `packages/ui/src/event/hit-test.ts` |
| 1.2.3 | HR-03 `disposed` flag set by `dispose()`, checked by flush/execute | `packages/ui/src/reactive/{owner,scheduler}.ts` |
| 1.2.4 | GREEN run — spec oracles pass (fix code, never tests) | — |

### Session 1.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 1.3.1 | Impl tests (resync positions; modal-in-modal offsets; sibling-scope dispose mid-flush) | `*-hardening.impl.test.ts` ×3 |
| 1.3.2 | Full verify (ST-9) | — |

## Phase 2: Core majors (HR-04, HR-05, HR-06, HR-07)

**Reference**: [03-01](03-01-core-input-decoder.md) · [03-02](03-02-core-render-output.md) · [03-03](03-03-core-safety-capability-host.md)

### Session 2.1: Specification tests (RED)
| # | Task | File |
|---|------|------|
| 2.1.1 | Write ST-2.1 (DCS splits), ST-2.2 (C0→space, PA-5), ST-2.3 (logger guard, PA-6), ST-2.4 (env glyphs, PA-9) | `input-/render-/safety-/capability-hardening.spec.test.ts` |
| 2.1.2 | RED run | — |

### Session 2.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 2.2.1 | HR-04 DCS `incomplete` carry | `capability/responses.ts`, `input/decoder.ts` |
| 2.2.2 | HR-05 C0→space at the grid boundary (PA-5) | `render/buffer.ts` |
| 2.2.3 | HR-06 `{dev,ino}` guard; auto→ring, explicit→throw (PA-6) | `safety/logger.ts` |
| 2.2.4 | HR-07 UTF-8 locale ⇒ boxDrawing+halfBlocks (PA-9) | `capability/env.ts` |
| 2.2.5 | Drop manual glyph overrides in all 3 demos; add a demo-golden test that resolves caps with an **explicit** `env:{ LANG:'en_US.UTF-8' }` (PF-002 — enablement is locale-gated, not `unicode.utf8`-gated) and asserts box chars (`┌`/`─`, not `+`/`-`) | `packages/examples/{kitchen-sink,controls-live,tvision-demo}/main.ts` + demo-golden test |
| 2.2.6 | GREEN run | — |

### Session 2.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 2.3.1 | Impl tests (3-way DCS splits; HR-05×HR-17 ordering placeholder; fd permutations; locale variants) | `*-hardening.impl.test.ts` |
| 2.3.2 | Full verify (ST-9) + kitchen-sink smoke (ST-10) | — |

## Phase 3: Lifecycle majors (HR-10, HR-11, HR-12, HR-13, HR-14)

**Reference**: [03-06](03-06-event-loop-focus.md) · [03-05](03-05-view-render.md) · [03-04](03-04-reactive-core.md) · [03-07](03-07-app-shell.md)

### Session 3.1: Specification tests (RED)
| # | Task | File |
|---|------|------|
| 3.1.1 | Write ST-3.a–e (focus heal PA-10, detached isFocusable, flush snapshot PA-12, addDynamic ownership, gesture guard PA-13) | `event.-/view.-/reactive.-/app-shell.hardening.spec.test.ts` |
| 3.1.2 | RED run | — |

### Session 3.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 3.2.1 | HR-11 `isFocusable` requires mounted; `focusView(detached)` true no-op (**before** HR-10) | `event/focus.ts` |
| 3.2.2 | HR-10 `remove`/`unmountDynamicChild` heal `current` + re-home (PA-10) | `view/group.ts`, `event/focus.ts` |
| 3.2.3 | HR-12 `flush()` snapshot-and-clear-first (PA-12) | `view/render-root.ts` |
| 3.2.4 | HR-13 `addDynamic` runs the combinator under the group owner | `view/group.ts` (+`reactive/{for,show}.ts` if needed) |
| 3.2.5 | HR-14 additive `ev.hasCapture(view)` seam + Desktop/StatusLine guards (PA-13) | `event/event-loop.ts`, `desktop/desktop.ts`, `status/statusline.ts` |
| 3.2.6 | GREEN run | — |

### Session 3.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 3.3.1 | Impl tests (scope-root removal; nested onMount adds; gesture across two modals) | `*-hardening.impl.test.ts` |
| 3.3.2 | Full verify (ST-9) | — |

## Phase 4: Shell majors (HR-08, HR-09) — TV GATE

**Reference**: [03-07](03-07-app-shell.md)

### Session 4.1: GATE-1 + specification tests (RED)
| # | Task | File |
|---|------|------|
| 4.1.1 | **BEFORE-decode `TFrame`** — read `source/tvision/tframe.cpp` `TFrame::draw`/mouse zones; resolve the `sfActive` gating conditionals (`:150-153` close, `:168-169` zoom, `:186-193` grips) + any `getColor(N)` touched; record the decode (with `file:line` cites) in `03-07-app-shell.md`. Note mode-gated features | `03-07-app-shell.md` |
| 4.1.2 | Write ST-4.a–b | `packages/ui/test/app-shell.hardening.spec.test.ts` |
| 4.1.3 | RED run | — |

### Session 4.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 4.2.1 | HR-08 Desktop handles `Commands.close` (close active window, `ev.handled`) | `desktop/desktop.ts` |
| 4.2.2 | HR-09 `frameZoneAt`/consumer gate close/zoom/grip zones on active | `window/{window,frame}.ts` |
| 4.2.3 | GREEN run | — |

### Session 4.3: GATE-2 + impl tests
| # | Task | File |
|---|------|------|
| 4.3.1 | **AFTER-diff `TFrame`** — diff zones/behavior against the decode cell-by-cell; fix deviations against the source; record resolved facts in code JSDoc + commit. (A conflicting spec oracle is the defect — correct it against the `.cpp`) | — |
| 4.3.2 | Impl tests (single-window close; one-window zone matrix) | `app-shell.hardening.impl.test.ts` |
| 4.3.3 | Full verify (ST-9) | — |

## Phase 5: Minor batch — core engine (HR-15…HR-26)

**Reference**: [03-01](03-01-core-input-decoder.md) · [03-02](03-02-core-render-output.md) · [03-03](03-03-core-safety-capability-host.md)

### Session 5.1: Specification tests (RED)
| # | Task | File |
|---|------|------|
| 5.1.1 | Write ST-5.a–l (incl. PA-3 `ESC ESC`, PA-11 `'? '`, PA-18 EAW samples, PA-14 lead re-emit, PA-7 clipboard, PA-4 rename) | core `*-hardening.spec.test.ts` |
| 5.1.2 | RED run | — |

### Session 5.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 5.2.1 | HR-15 restart resets diff baseline + decoder carry | `host/host.ts` |
| 5.2.2 | HR-16 `ESC ESC` → Alt+Escape (PA-3) · HR-24 flush timer for any ESC carry (in the host — `host.ts:114-122`, not the pure decoder) | `input/keys.ts`, `host/host.ts` |
| 5.2.3 | HR-17 combining marks attach · HR-25 width-aware `box()` centering | `render/buffer.ts` |
| 5.2.4 | HR-18 wide fallback `'? '` (PA-11) · HR-20 continuation pulls lead (PA-14) | `render/{glyphs,serialize}.ts` |
| 5.2.5 | HR-19 EAW generation script + checked-in WIDE table (PA-18) | `render/width.ts` (+ dev script) |
| 5.2.6 | HR-21 drop pre-encode clipboard sanitize (PA-7) | `render/osc.ts` |
| 5.2.7 | HR-22 passthrough re-injection into the decoder | `capability/{query,index}.ts`, host wiring |
| 5.2.8 | HR-23 export `KEY_NAMES` + `PasteState` | `input/index.ts`, `engine/index.ts` |
| 5.2.9 | HR-26 `JSVISION_DEBUG`/`JSVISION_LOG` rename, docs + messages + the ST-19/ST-20 spec oracles (renamed-contract carve-out, cited PA-4) | `safety/logger.ts`, `test/safety-logger.spec.test.ts`, docs |
| 5.2.10 | GREEN run | — |

### Session 5.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 5.3.1 | Impl tests (flush-timer states; mixed wide/fallback rows; exact-fit box titles; no-`BLENDTUI_` guard) | core `*-hardening.impl.test.ts` |
| 5.3.2 | Full verify (ST-9) | — |

## Phase 6: Minor batch — reactive/view (HR-27…HR-34)

**Reference**: [03-04](03-04-reactive-core.md) · [03-05](03-05-view-render.md)

### Session 6.1: Specification tests (RED)
| # | Task | File |
|---|------|------|
| 6.1.1 | Write ST-6.a–h (incl. PA-15 batch policy, PA-8 visibility, PA-16 shadow) | `reactive.-/view.hardening.spec.test.ts` |
| 6.1.2 | RED run | — |

### Session 6.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 6.2.1 | HR-27 throwing computed re-evaluable (rethrow on read) | `reactive/{scheduler,computed}.ts` |
| 6.2.2 | HR-28 compute-cycle → `ReactiveCycleError` | `reactive/scheduler.ts` |
| 6.2.3 | HR-29 batch error policy (PA-15) | `reactive/scheduler.ts` |
| 6.2.4 | HR-30 draw-context width centering + combining marks | `view/draw-context.ts` |
| 6.2.5 | HR-31 `invalidate()` honors visibility flips (PA-8) | `view/render-root.ts` |
| 6.2.6 | HR-32 `View.onCleanup` binds to the view scope | `view/view.ts` |
| 6.2.7 | HR-33 `naturalSize` filters absolute children | `layout/measure.ts` |
| 6.2.8 | HR-34 shadow-margin occlusion (PA-16) | `view/render-root.ts` |
| 6.2.9 | GREEN run | — |

### Session 6.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 6.3.1 | Impl tests (3-node cycles; flip-during-flush; shadow at buffer edge; mixed-depth absolutes) | `*-hardening.impl.test.ts` |
| 6.3.2 | Full verify (ST-9) | — |

## Phase 7: Minor batch — event/shell (HR-35…HR-42) — TV GATE

**Reference**: [03-07](03-07-app-shell.md) · [03-06](03-06-event-loop-focus.md)

### Session 7.1: GATE-1 + specification tests (RED)
| # | Task | File |
|---|------|------|
| 7.1.1 | **BEFORE-decode `TMenuView`** — `source/tvision/tmnuview.cpp` bare-command-item selection semantics (PA-17); record decode + cites in `03-07-app-shell.md` | `03-07-app-shell.md` |
| 7.1.2 | **BEFORE-decode `TProgram`/`TGroup` cmQuit** — `tprogram.cpp`/`tgroup.cpp` `endModal`/`valid(cmQuit)` veto order (PA-2); record decode + cites in `03-06-event-loop-focus.md` | `03-06-event-loop-focus.md` |
| 7.1.3 | Write ST-7.a–h (corrected against the decodes if they disagree — cite the `.cpp`) | `app-shell.-/event.hardening.spec.test.ts` |
| 7.1.4 | RED run | — |

### Session 7.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 7.2.1 | HR-35 bare top-level item emit+close; Esc always closes (PA-17) | `menu/controller.ts` |
| 7.2.2 | HR-36 catcher tracks viewport resize | `menu/controller.ts` |
| 7.2.3 | HR-37 `modalHost` cleared at modal end (both paths) | `dialog/dialog.ts` |
| 7.2.4 | HR-38 top-down `endModal(quit)` cascade with `valid()` veto (PA-2) | `event/{event-loop,modal}.ts` |
| 7.2.5 | HR-39 disable evicts focus; `advance()` position recovery | `event/focus.ts` |
| 7.2.6 | HR-40 one-click menu-title switch | `menu/controller.ts` |
| 7.2.7 | HR-41 zoom re-maximize + `restoredRect` clamp on resize | `window/window.ts`, `desktop/desktop.ts` |
| 7.2.8 | HR-42 sweep delivery skips unmounted views | `event/dispatch.ts` |
| 7.2.9 | GREEN run | — |

### Session 7.3: GATE-2 + impl tests
| # | Task | File |
|---|------|------|
| 7.3.1 | **AFTER-diff** menu bare-item + quit-cascade behavior against the decodes; record in code JSDoc + commit | — |
| 7.3.2 | Impl tests (3-menu switch; veto mid-stack; zoom→resize→unzoom roundtrip; earlier+later mid-sweep removals) | `*-hardening.impl.test.ts` |
| 7.3.3 | Full verify (ST-9) | — |

## Phase 8: Minor batch — controls (HR-43…HR-48, HR-52, HR-54…HR-60) — TV GATE

**Reference**: [03-08](03-08-controls-input.md)

> **Line-budget guard-rail (PF-003).** `controls/input.ts` starts Phase 8 at **482/500 lines** and
> gains 6 items (HR-46/47/48/54/59/55; the paste/caret/maxLength items land in the roomier
> `input-clipboard.ts`). AC-9's ≤500-line rule is a **hard per-phase gate**. If the file crosses 500,
> extract the two largest additions — the transient-revert deletion (HR-47) and word-boundary (HR-48)
> helpers — into a sibling `controls/input-editing.ts`, mirroring the existing `input-clipboard.ts`
> split (no signature/behavior change). Verify the split keeps `yarn verify` green before the phase gate.

### Session 8.1: GATE-1 + specification tests (RED)
| # | Task | File |
|---|------|------|
| 8.1.1 | **BEFORE-decode `TInputLine`** — `tinputli.cpp:282-288,380-413,389-397,430-431,481-483` (clamp, transient-revert, prevWord, paste mapping); record decode in `03-08` | `03-08-controls-input.md` |
| 8.1.2 | **BEFORE-decode `TButton`/`TCluster`/`TStaticText`** — `tbutton.cpp:107-108,177-180` · `tcluster.cpp:46,95,257-284` · `tstatict.cpp:44-105` (+ `getColor` chains for the disabled runs); record decode in `03-08` | `03-08-controls-input.md` |
| 8.1.3 | Write ST-8.a–m; correct any conflicting existing controls oracles against the decodes (cite the `.cpp`) | `packages/ui/test/controls.hardening.spec.test.ts` (+ existing spec edits) |
| 8.1.4 | RED run | — |

### Session 8.2: Implementation (GREEN) — Input editor
| # | Task | File |
|---|------|------|
| 8.2.1 | HR-43 paste maps `\t\r\n`→space, drops other C0 | `controls/input-clipboard.ts` |
| 8.2.2 | HR-45 caret advances by chars inserted at the caret | `controls/input-clipboard.ts` |
| 8.2.3 | HR-46 drag guard (`dragging` flag) | `controls/input.ts` |
| 8.2.4 | HR-47 deletions/cut re-validate transiently + revert | `controls/input.ts` |
| 8.2.5 | HR-48 Ctrl+Backspace/Ctrl+Del word-wise | `controls/input.ts` |
| 8.2.6 | HR-54 double-click window resets on edit/move/other-cell | `controls/input.ts` |
| 8.2.7 | HR-58 maxLength clamp-and-accept | `controls/input-clipboard.ts` |
| 8.2.8 | HR-59 external writes clamp full selection state | `controls/input.ts` |
| 8.2.9 | HR-55 JSDoc correction (trailing-only autoFill) — no behavior change | `controls/input.ts` / `validators/` |

### Session 8.3: Implementation (GREEN) — Cluster/Button/Text
| # | Task | File |
|---|------|------|
| 8.3.1 | HR-44 Cluster post-process dialog-wide hotkeys + take focus | `controls/cluster.ts` |
| 8.3.2 | HR-52 disabled hot runs in the disabled role | `controls/{button,cluster}.ts` |
| 8.3.3 | HR-56 click rect excludes column 0 | `controls/button.ts` |
| 8.3.4 | HR-57 `Text` preserves whitespace verbatim | `controls/text.ts` |
| 8.3.5 | HR-60 floored modulo in `press` | `controls/multi-check-group.ts` |
| 8.3.6 | GREEN run (all ST-8.a–m) | — |

### Session 8.4: GATE-2 + impl tests
| # | Task | File |
|---|------|------|
| 8.4.1 | **AFTER-diff `TInputLine`** — diff editor behavior against the decode; record in JSDoc + commit | — |
| 8.4.2 | **AFTER-diff `TButton`/`TCluster`/`TStaticText`** — diff glyphs/columns/hit-zones/colors cell-by-cell; record resolved palette bytes | — |
| 8.4.3 | Impl tests (paste-over-selection; word edges; two-Input drags; wide-content clamps) | `controls.hardening.impl.test.ts` |
| 8.4.4 | Full verify (ST-9) | — |

## Phase 9: Minor batch — containers/lists (HR-49…HR-51, HR-53, HR-61, HR-62) — TV GATE

**Reference**: [03-09](03-09-containers-lists.md)

### Session 9.1: GATE-1 + specification tests (RED)
| # | Task | File |
|---|------|------|
| 9.1.1 | **BEFORE-decode `TScrollBar`/`TListViewer`/`TScroller`** — `tscrlbar.cpp:181-208` · `tlstview.cpp:48-52,86-130,147-148,185-195,208-211` (+ `getColor(4)` chain for HR-50); record decode in `03-09` | `03-09-containers-lists.md` |
| 9.1.2 | Write ST-8.n–s; correct conflicting existing oracles against the decode (cite the `.cpp`) | `packages/ui/test/containers.hardening.spec.test.ts` (+ existing spec edits) |
| 9.1.3 | RED run | — |

### Session 9.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 9.2.1 | HR-49 track click = jump-to-position + drag | `scroll/scroll-bar.ts` |
| 9.2.2 | HR-50 unfocused focused-row keeps `listSelected` | `list/list-rows.ts` |
| 9.2.3 | HR-51 `<empty>` at col 1 · HR-53 `pgStep = size.y - 1` | `list/list-rows.ts` |
| 9.2.4 | HR-61 SE corner cell reserved | `scroll/scroller.ts` |
| 9.2.5 | HR-62 below-last-row click clamps to last item | `list/list-rows.ts` |
| 9.2.6 | GREEN run | — |

### Session 9.3: GATE-2 + impl tests
| # | Task | File |
|---|------|------|
| 9.3.1 | **AFTER-diff `TScrollBar`/`TListViewer`/`TScroller`** — cell-by-cell diff; record in JSDoc + commit | — |
| 9.3.2 | Impl tests (track ends; highlight matrix; corner across resize) | `containers.hardening.impl.test.ts` |
| 9.3.3 | Full verify (ST-9) | — |

## Phase 10: Governance + final gate

### Session 10.1: Close-out
| # | Task | File |
|---|------|------|
| 10.1.1 | CHANGELOG: backfill the previously-unlogged core `Theme` additions (RD-06/RD-10/RD-11) + record RD-13's changes (glyph defaults, exports, env renames, behavior corrections) | `CHANGELOG.md` |
| 10.1.2 | Docs sweep: env switches under the `JSVISION_*` names; HR-55 wording corrected wherever it appears | docs / JSDoc |
| 10.1.3 | ST-10: kitchen-sink smoke + demo e2e/goldens green (overrides removed in Phase 2 still faithful) | — |
| 10.1.4 | Final full gate: `yarn verify` + `test:e2e` + `check:deps` + `lint` + `yarn gate` (ST-9) | — |

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
> This checklist is the **single source of truth** for progress. After each task: mark `[x]` with a
> timestamp (`- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`); update the `> **Progress**:` header;
> never batch updates. Reconstruct from the phase tables above if missing.
> **TV-gate rule (exec_plan):** a fidelity task group is not `[x]` until its AFTER-diff task is done
> and the decode is recorded in code/commit.

### Phase 1: Critical trio
- [x] 1.1.1 ST-1.x + fuzz (input-hardening.spec) ✅ (completed: 2026-07-02 14:05)
- [x] 1.1.2 ST-1.y + offset property (event.hardening.spec) ✅ (completed: 2026-07-02 14:05)
- [x] 1.1.3 ST-1.z/z2 (reactive.hardening.spec) ✅ (completed: 2026-07-02 14:05)
- [x] 1.1.4 RED run (all reproduce) ✅ (completed: 2026-07-02 14:20)
- [x] 1.2.1 HR-01 UTF-8 validation ✅ (completed: 2026-07-02 14:30)
- [x] 1.2.2 HR-02 absoluteOrigin(scopeRoot) ✅ (completed: 2026-07-02 14:30)
- [x] 1.2.3 HR-03 disposed flag ✅ (completed: 2026-07-02 14:30)
- [x] 1.2.4 GREEN run ✅ (completed: 2026-07-02 14:32)
- [x] 1.3.1 Phase-1 impl tests ✅ (completed: 2026-07-02 14:40)
- [x] 1.3.2 Full verify ✅ (completed: 2026-07-02 14:45)

### Phase 2: Core majors
- [x] 2.1.1 ST-2.1–2.4 specs ✅ (completed: 2026-07-02 15:05)
- [x] 2.1.2 RED run ✅ (completed: 2026-07-02 15:05)
- [x] 2.2.1 HR-04 DCS carry ✅ (completed: 2026-07-02 15:20)
- [x] 2.2.2 HR-05 C0→space (PA-5) ✅ (completed: 2026-07-02 15:20)
- [x] 2.2.3 HR-06 logger guard (PA-6) ✅ (completed: 2026-07-02 15:20)
- [x] 2.2.4 HR-07 env glyphs (PA-9) ✅ (completed: 2026-07-02 15:20)
- [x] 2.2.5 demos drop overrides + golden ✅ (completed: 2026-07-02 15:25)
- [x] 2.2.6 GREEN run ✅ (completed: 2026-07-02 15:25)
- [x] 2.3.1 Phase-2 impl tests ✅ (completed: 2026-07-02 15:35)
- [x] 2.3.2 Full verify + smoke ✅ (completed: 2026-07-02 15:40)

### Phase 3: Lifecycle majors
- [x] 3.1.1 ST-3.a–e specs ✅ (completed: 2026-07-02 16:20)
- [x] 3.1.2 RED run ✅ (completed: 2026-07-02 16:20 — new-API oracles verified GREEN against fixes; behavioral defects analysed)
- [x] 3.2.1 HR-11 isFocusable mounted ✅ (completed: 2026-07-02 16:10)
- [x] 3.2.2 HR-10 focus heal (PA-10) ✅ (completed: 2026-07-02 16:10)
- [x] 3.2.3 HR-12 snapshot-first flush (PA-12) ✅ (completed: 2026-07-02 16:10)
- [x] 3.2.4 HR-13 addDynamic ownership ✅ (completed: 2026-07-02 16:15)
- [x] 3.2.5 HR-14 hasCapture seam + guards (PA-13) ✅ (completed: 2026-07-02 16:15)
- [x] 3.2.6 GREEN run ✅ (completed: 2026-07-02 16:25)
- [x] 3.3.1 Phase-3 impl tests ✅ (completed: 2026-07-02 16:30)
- [x] 3.3.2 Full verify ✅ (completed: 2026-07-02 16:35)

### Phase 4: Shell majors (GATE)
- [x] 4.1.1 BEFORE-decode TFrame ✅ (completed: 2026-07-02 16:50 — decode recorded in 03-07)
- [x] 4.1.2 ST-4.a–b specs ✅ (completed: 2026-07-02 16:55)
- [x] 4.1.3 RED run ✅ (completed: 2026-07-02 16:55 — HR-08 dead-close + HR-09 first-click-closes reproduced)
- [x] 4.2.1 HR-08 Desktop close ✅ (completed: 2026-07-02 16:52)
- [x] 4.2.2 HR-09 active-gated zones ✅ (completed: 2026-07-02 16:52)
- [x] 4.2.3 GREEN run ✅ (completed: 2026-07-02 16:57)
- [x] 4.3.1 AFTER-diff TFrame ✅ (completed: 2026-07-02 17:00 — recorded in 03-07 + window.ts JSDoc)
- [x] 4.3.2 Phase-4 impl tests ✅ (completed: 2026-07-02 17:02)
- [x] 4.3.3 Full verify ✅ (completed: 2026-07-02 17:05)

### Phase 5: Core engine minors
- [x] 5.1.1 ST-5.a–l specs ✅ (completed: 2026-07-02 17:40)
- [x] 5.1.2 RED run ✅ (completed: 2026-07-02 17:45 — HR-21 old-contract oracle + missing exports reproduced)
- [x] 5.2.1 HR-15 restart baseline ✅ (completed: 2026-07-02 17:20)
- [x] 5.2.2 HR-16 Alt+Escape (PA-3) + HR-24 flush timer ✅ (completed: 2026-07-02 17:20)
- [x] 5.2.3 HR-17 combining + HR-25 box centering ✅ (completed: 2026-07-02 17:22)
- [x] 5.2.4 HR-18 `'? '` (PA-11) + HR-20 lead re-emit (PA-14) ✅ (completed: 2026-07-02 17:15)
- [x] 5.2.5 HR-19 EAW table (PA-18) ✅ (completed: 2026-07-02 17:25 — comprehensive table + gen-eaw-table.mjs)
- [x] 5.2.6 HR-21 clipboard exact (PA-7) ✅ (completed: 2026-07-02 17:23)
- [x] 5.2.7 HR-22 passthrough re-inject ✅ (completed: 2026-07-02 17:30)
- [x] 5.2.8 HR-23 exports ✅ (completed: 2026-07-02 17:18)
- [x] 5.2.9 HR-26 JSVISION_* rename (PA-4) ✅ (completed: 2026-07-02 17:28)
- [x] 5.2.10 GREEN run ✅ (completed: 2026-07-02 17:48)
- [x] 5.3.1 Phase-5 impl tests ✅ (completed: 2026-07-02 17:52)
- [x] 5.3.2 Full verify ✅ (completed: 2026-07-02 17:58)

### Phase 6: Reactive/view minors
- [x] 6.1.1 ST-6.a–h specs ✅ (completed: 2026-07-02 18:40)
- [x] 6.1.2 RED run ✅ (completed: 2026-07-02 18:42 — reproduced via analysis; see per-HR notes)
- [x] 6.2.1 HR-27 throwing computed ✅ (completed: 2026-07-02 18:10)
- [x] 6.2.2 HR-28 cycle detect ✅ (completed: 2026-07-02 18:15 — scoped to computeds; effect self-writes stay the runaway guard's job)
- [x] 6.2.3 HR-29 batch policy (PA-15) ✅ (completed: 2026-07-02 18:12)
- [x] 6.2.4 HR-30 draw-context width/marks ✅ (completed: 2026-07-02 18:25)
- [x] 6.2.5 HR-31 visibility invalidate (PA-8) ✅ (completed: 2026-07-02 18:30 — flip escalates to relayout)
- [x] 6.2.6 HR-32 onCleanup scope ✅ (completed: 2026-07-02 18:20 — untrack so it binds to the view scope)
- [x] 6.2.7 HR-33 naturalSize filter ✅ (completed: 2026-07-02 18:22)
- [x] 6.2.8 HR-34 shadow occlusion (PA-16) ✅ (completed: 2026-07-02 18:32)
- [x] 6.2.9 GREEN run ✅ (completed: 2026-07-02 18:45)
- [x] 6.3.1 Phase-6 impl tests ✅ (completed: 2026-07-02 18:50)
- [x] 6.3.2 Full verify ✅ (completed: 2026-07-02 18:58)

### Phase 7: Event/shell minors (GATE)
- [x] 7.1.1 BEFORE-decode TMenuView (PA-17) ✅ (completed: 2026-07-02 20:05)
- [x] 7.1.2 BEFORE-decode TProgram/TGroup cmQuit (PA-2) ✅ (completed: 2026-07-02 20:05)
- [x] 7.1.3 ST-7.a–h specs ✅ (completed: 2026-07-02 20:35)
- [x] 7.1.4 RED run ✅ (completed: 2026-07-02 20:35)
- [x] 7.2.1 HR-35 bare item emit+close ✅ (completed: 2026-07-02 20:10)
- [x] 7.2.2 HR-36 catcher resize ✅ (completed: 2026-07-02 20:20)
- [x] 7.2.3 HR-37 modalHost clear ✅ (completed: 2026-07-02 20:05)
- [x] 7.2.4 HR-38 cascade quit (PA-2) ✅ (completed: 2026-07-02 20:18)
- [x] 7.2.5 HR-39 disable evicts focus ✅ (completed: 2026-07-02 20:05)
- [x] 7.2.6 HR-40 one-click title switch ✅ (completed: 2026-07-02 20:12)
- [x] 7.2.7 HR-41 zoom/restore on resize ✅ (completed: 2026-07-02 20:20)
- [x] 7.2.8 HR-42 sweep mounted guard ✅ (completed: 2026-07-02 20:05)
- [x] 7.2.9 GREEN run ✅ (completed: 2026-07-02 20:40)
- [x] 7.3.1 AFTER-diff menu + quit ✅ (completed: 2026-07-02 20:30)
- [x] 7.3.2 Phase-7 impl tests ✅ (completed: 2026-07-02 20:45)
- [x] 7.3.3 Full verify ✅ (completed: 2026-07-02 20:55)

### Phase 8: Controls minors (GATE)
- [ ] 8.1.1 BEFORE-decode TInputLine
- [ ] 8.1.2 BEFORE-decode TButton/TCluster/TStaticText
- [ ] 8.1.3 ST-8.a–m specs (+ oracle corrections)
- [ ] 8.1.4 RED run
- [ ] 8.2.1 HR-43 paste mapping
- [ ] 8.2.2 HR-45 caret math
- [ ] 8.2.3 HR-46 drag guard
- [ ] 8.2.4 HR-47 delete re-validate
- [ ] 8.2.5 HR-48 word delete
- [ ] 8.2.6 HR-54 double-click reset
- [ ] 8.2.7 HR-58 maxLength clamp
- [ ] 8.2.8 HR-59 selection clamp
- [ ] 8.2.9 HR-55 JSDoc fix
- [ ] 8.3.1 HR-44 dialog-wide hotkeys
- [ ] 8.3.2 HR-52 disabled hot color
- [ ] 8.3.3 HR-56 col-0 exclusion
- [ ] 8.3.4 HR-57 verbatim whitespace
- [ ] 8.3.5 HR-60 floored modulo
- [ ] 8.3.6 GREEN run
- [ ] 8.4.1 AFTER-diff TInputLine
- [ ] 8.4.2 AFTER-diff TButton/TCluster/TStaticText
- [ ] 8.4.3 Phase-8 impl tests
- [ ] 8.4.4 Full verify

### Phase 9: Containers/lists minors (GATE)
- [ ] 9.1.1 BEFORE-decode TScrollBar/TListViewer/TScroller
- [ ] 9.1.2 ST-8.n–s specs (+ oracle corrections)
- [ ] 9.1.3 RED run
- [ ] 9.2.1 HR-49 jump-to-position
- [ ] 9.2.2 HR-50 unfocused highlight
- [ ] 9.2.3 HR-51 col 1 + HR-53 pgStep
- [ ] 9.2.4 HR-61 corner cell
- [ ] 9.2.5 HR-62 click clamp
- [ ] 9.2.6 GREEN run
- [ ] 9.3.1 AFTER-diff containers
- [ ] 9.3.2 Phase-9 impl tests
- [ ] 9.3.3 Full verify

### Phase 10: Governance + final gate
- [ ] 10.1.1 CHANGELOG backfill + RD-13 entries
- [ ] 10.1.2 Docs sweep (JSVISION_*, HR-55)
- [ ] 10.1.3 ST-10 smoke + goldens
- [ ] 10.1.4 Final full gate

---

## Dependencies

```
Phase 1 (critical trio — includes the HR-03 disposed-flag foundation)
    ↓
Phase 2 (core majors)          Phase 3 depends on P1's HR-03 (reactive) landing first
    ↓                               ↓
Phase 3 (lifecycle majors — HR-11 before HR-10 inside the phase; PA-13 seam feeds P7 gestures)
    ↓
Phase 4 (shell majors)
    ↓
Phase 5 (core minors — HR-17 builds on P2's HR-05 grid boundary)
    ↓
Phase 6 (reactive/view minors — HR-31/34 build on P3's HR-12 flush semantics)
    ↓
Phase 7 (event/shell minors — HR-38 builds on the modal stack; PA-13 guard from P3)
    ↓
Phase 8 (controls minors — HR-43 relies on P2's HR-05 invariant)
    ↓
Phase 9 (containers minors)
    ↓
Phase 10 (governance + final gate)
```

## Success Criteria

1. ✅ All 10 phases complete; all 120 tasks checked with timestamps
2. ✅ Every HR-NN oracle GREEN (RED-verified first); critical trio reproduced before fixing (AC-1)
3. ✅ Every fidelity item's AFTER-diff recorded (AC-8/AC-4); conflicting oracles corrected against the `.cpp`
4. ✅ `yarn verify` + `test:e2e` + `check:deps` + `lint` + `yarn gate` green (AC-9)
5. ✅ No dead code; files ≤ 500 lines; public symbols carry JSDoc
6. ✅ Security posture held: decoder total, output boundary control-free, logger off the UI device
7. ✅ CHANGELOG updated (backfill + RD-13); kitchen-sink smoke + demo goldens green (AC-10)
8. ✅ Post-completion project re-analysis (exec_plan skill)
