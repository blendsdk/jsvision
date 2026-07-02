# Execution Plan: Input Dropdowns (History · ComboBox)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-02 (Phase 1 complete)
> **Progress**: 20/35 tasks (57%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Implements RD-14: the `History` + `ComboBox<T>` dropdown controls on a shared anchored-popup, as a
new `packages/ui/src/dropdown/` subsystem + three additive seams. Foundation-first: Phase 0 lands
the seams + theme, Phase 1 the shared popup, Phase 2 History (TV-derived), Phase 3 ComboBox, Phase 4
the stories/demo + final fidelity + gate. Spec-first ordering per phase (spec RED → implement GREEN
→ impl tests). TV-derived components (History, the popup geometry, ComboBox visuals) carry the
GATE-1 decode ([03-01](03-01-history.md)) and a GATE-2 cell-by-cell diff.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 0 | Additive seams + core theme roles | 1 | 90 min |
| 1 | Shared anchored-popup primitive | 1 | 90 min |
| 2 | History control + MRU store (TV-derived) | 1-2 | 150 min |
| 3 | ComboBox (editable + select-only) | 1 | 120 min |
| 4 | Stories + `demo:dropdowns` + fidelity + gate | 1 | 90 min |

**Total: 5-6 sessions, ~7-8 hours**

---

## Phase 0: Additive seams + core theme roles

**Reference**: [03-04-seams-and-theme.md](03-04-seams-and-theme.md)
**Objective**: Land the Input linkage seam, the derived overlay-visibility seam (+ menu migration),
and the five decoded core History theme roles — the stable base for all controls.

### Session 0.1: Spec tests (RED)
| # | Task | File |
|---|------|------|
| 0.1.1 | Spec: History theme roles present with the decoded bytes, each `encode()`s (ST-32) | `packages/core/test/history-theme.spec.test.ts` |
| 0.1.2 | Spec: Input public seam (`getValueSignal`/`getMaxLength`/`selectAll` public) + derived overlay visibility (menu + a mounted child both visible) + popup-host envelope seam (`ev.getFocused()` + overlay-host accessor present during dispatch) | `packages/ui/test/dropdown.seams.spec.test.ts` |
| 0.1.3 | Run spec tests — verify FAIL (red) | — |

### Session 0.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 0.2.1 | Add 5 additive History roles to `Theme` + `defaultTheme` (decoded bytes, [03-04](03-04-seams-and-theme.md) §3) | `packages/core/src/engine/color/theme.ts` |
| 0.2.2 | Input seam: promote `selectAll()` public + add `getValueSignal()` / `getMaxLength()` | `packages/ui/src/controls/input.ts` |
| 0.2.3 | Add `syncOverlayVisible(overlay)` helper — imperative `visible = children.length > 0` + `invalidate()` (NOT an effect; `children`/`state.visible` are non-reactive, PF-001) | `packages/ui/src/app/application.ts` |
| 0.2.4 | **Replace** the menu controller's explicit `visible` toggles (`:229/:247`) with `syncOverlayVisible` calls at the same sites | `packages/ui/src/menu/controller.ts` |
| 0.2.5 | Popup-host envelope seam: add `getFocused()` + a `PopupHost` accessor to `DispatchEvent`, sourced in `routeContext` (PF-002) | `packages/ui/src/view/types.ts`, `packages/ui/src/event/{event-loop,dispatch}.ts` |
| 0.2.6 | Run spec tests — verify PASS (green) | — |

### Session 0.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 0.3.1 | **Menu regression**: `app-shell.menu.*` stays green after the migration | `packages/ui/test/*` |
| 0.3.2 | Impl tests: overlay derive edge cases (last child unmount hides); Input seam existing-caller safety | `packages/ui/test/dropdown.seams.impl.test.ts` |
| 0.3.3 | `yarn verify` green | — |

**Verify**: `yarn verify`

---

## Phase 1: Shared anchored-popup primitive

**Reference**: [03-02-anchored-popup.md](03-02-anchored-popup.md)
**Objective**: One non-modal anchored popup for both controls — mount + focus + clamped placement +
dismissal, generalizing the menu overlay/catcher without menu-specific state.

### Session 1.1: Spec tests (RED)
| # | Task | File |
|---|------|------|
| 1.1.1 | Spec: focus-on-open, bottom-edge clamp (no flip), scroll past `maxRows`, focus-loss dismiss, idempotent dismiss, non-modal (ST-18…ST-23) | `packages/ui/test/popup.spec.test.ts` |
| 1.1.2 | Run — verify FAIL (red) | — |

### Session 1.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 1.2.1 | `openAnchoredPopup` + `PopupHost`/`AnchoredPopup` + generic catcher (reuse the `CatcherView` shape, drop `y===0`) | `packages/ui/src/dropdown/popup.ts` |
| 1.2.2 | Placement math (grow ±1, **fixed height = maxRows+2** — entry count never sizes it, PF-003 — `intersect`-clamp is the only row reducer, no upward flip; decode §3) | `packages/ui/src/dropdown/popup.ts` |
| 1.2.3 | Dismissal wiring (Esc / outside-down consumed / `focusSignal()` loss **guarded on `list.rows.state.focused===false`**, PF-004; idempotent `dismiss()`) | `packages/ui/src/dropdown/popup.ts` |
| 1.2.4 | Run spec tests — verify PASS (green) | — |

### Session 1.3: Impl tests & hardening
| # | Task | File |
|---|------|------|
| 1.3.1 | Impl: double-dismiss race, focus save/restore, overlay mount/unmount derive, ScrollBar wiring | `packages/ui/test/popup.impl.test.ts` |
| 1.3.2 | `yarn verify` green | — |

**Verify**: `yarn verify`

---

## Phase 2: History control + MRU store (TV-derived)

**Reference**: [03-01-history.md](03-01-history.md) (carries the GATE-1 decode)
**Objective**: The `▐↓▌` History button + popup + per-id MRU store, faithful to `THistory`.

### Session 2.1: Spec tests (RED)
| # | Task | File |
|---|------|------|
| 2.1.1 | Spec: button draw/colors, open triggers, popup geometry, oldest-at-top order, pick/cancel (ST-1…ST-11) | `packages/ui/test/history.spec.test.ts` |
| 2.1.2 | Spec: store skip-empty/dedup/append/evict/order/shared/injectable (ST-12…ST-17) | `packages/ui/test/history-store.spec.test.ts` |
| 2.1.3 | Run — verify FAIL (red) | — |

### Session 2.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 2.2.1 | **GATE-1 BEFORE**: transcribe the [03-01](03-01-history.md) decode (icon bytes, `getColor(0x0102)` chain, rect `±1`/`+7`, frame/viewer bytes, pick→`selectAll`, store order) into the draw/geometry/store — cite `file:line` in JSDoc | `packages/ui/src/dropdown/history.ts` |
| 2.2.2 | Implement the store (per-id `Map<number,string[]>`, oldest→newest, cap 16, evict-oldest, bounds-checked reads) | `packages/ui/src/dropdown/history-store.ts` |
| 2.2.3 | Implement `History` (icon draw, open triggers incl. Alt+Down, record-then-open, pick via the Input seam, cancel) | `packages/ui/src/dropdown/history.ts` |
| 2.2.4 | Barrel + explicit re-exports from `src/index.ts` | `packages/ui/src/dropdown/index.ts`, `packages/ui/src/index.ts` |
| 2.2.5 | Run spec tests — verify PASS (green); fix **code** (not oracles) on failure | — |

### Session 2.3: GATE-2 + impl tests & hardening
| # | Task | File |
|---|------|------|
| 2.3.1 | **GATE-2 AFTER**: re-open `thistory.cpp`/`thistwin.cpp`/`thstview.cpp`/`histlist.cpp`; diff rendered button/popup/frame/rows cell-by-cell + re-confirm **oldest-at-top** order + resolved bytes; record the diff in the commit | `packages/ui/test/fidelity.dropdown.spec.test.ts` (ST-33) |
| 2.3.2 | Impl tests: open-guard, auto-hide-when-empty (Should-Have), `evBroadcast` record, `Infinity` maxLength clamp, cap boundary, `clearHistory` | `packages/ui/test/history*.impl.test.ts` |
| 2.3.3 | `yarn verify` green | — |

**Verify**: `yarn verify`

---

## Phase 3: ComboBox (editable + select-only)

**Reference**: [03-03-combobox.md](03-03-combobox.md)
**Objective**: `ComboBox<T>` composing an `Input` + `ListView<T>` in the shared popup, two modes.

### Session 3.1: Spec tests (RED)
| # | Task | File |
|---|------|------|
| 3.1.1 | Spec: editable filter + pick + null-on-no-match; select-only display + type-ahead + pick; binding; open (ST-24…ST-31) | `packages/ui/test/combobox.spec.test.ts` |
| 3.1.2 | Run — verify FAIL (red) | — |

### Session 3.2: Implementation (GREEN)
| # | Task | File |
|---|------|------|
| 3.2.1 | Implement `ComboBox<T>` (compose Input + ListView; editable `computed` filter; select-only type-ahead; two-signal binding; trailing `▐↓▌` button reusing History roles) | `packages/ui/src/dropdown/combo-box.ts` |
| 3.2.2 | Re-export `ComboBox`/`ComboBoxOptions` from the barrel + `src/index.ts` | `packages/ui/src/dropdown/index.ts`, `packages/ui/src/index.ts` |
| 3.2.3 | Run spec tests — verify PASS (green) | — |

### Session 3.3: GATE-2 + impl tests & hardening
| # | Task | File |
|---|------|------|
| 3.3.1 | **GATE-2 AFTER**: diff the ComboBox popup + single-column rows + focused-row color against the `TListBox`/History popup visuals; record the diff | `packages/ui/test/fidelity.dropdown.spec.test.ts` |
| 3.3.2 | Impl tests: custom `filter`, `onSelect`/`command` emit (Should-Have), `items` change while open, empty filtered list | `packages/ui/test/combobox.impl.test.ts` |
| 3.3.3 | `yarn verify` green | — |

**Verify**: `yarn verify`

---

## Phase 4: Stories + `demo:dropdowns` + fidelity + gate

**Reference**: [07-testing-strategy.md](07-testing-strategy.md), kitchen-sink gate
**Objective**: The mandatory kitchen-sink stories, the headless demo, and the final gate.

### Session 4.1: Kitchen-sink stories (+ smoke)
| # | Task | File |
|---|------|------|
| 4.1.1 | `History` story (Input + `▐↓▌` button, live MRU) | `packages/examples/kitchen-sink/stories/history.story.ts` |
| 4.1.2 | `ComboBox` story (both modes, visible bound-value echo) | `packages/examples/kitchen-sink/stories/combobox.story.ts` |
| 4.1.3 | Register both in the story index; smoke test passes (ST-36) | `packages/examples/kitchen-sink/stories/index.ts` |

### Session 4.2: Headless demo
| # | Task | File |
|---|------|------|
| 4.2.1 | `demo:dropdowns` walkthrough (open → filter/type-ahead → pick → Esc-cancel, ASCII frame per step) + `demo:dropdowns` script | `packages/examples/dropdowns-demo/`, `packages/examples/package.json` |
| 4.2.2 | `dropdowns-demo.e2e.test.ts` | `packages/examples/test/dropdowns-demo.e2e.test.ts` |

### Session 4.3: Final verification & gate
| # | Task | File |
|---|------|------|
| 4.3.1 | Packaging + security specs green (ST-34/ST-35); `yarn check:deps` (zero runtime deps); files ≤ 500 lines | `packages/ui/test/dropdown.packaging.*.test.ts` |
| 4.3.2 | Full `yarn verify` + `yarn test:e2e`; CHANGELOG entry; RD-14 roadmap row → implemented | root |
| 4.3.3 | Commit via **/gitcm** | — |

**Verify**: `yarn verify && yarn check:deps && yarn test:e2e`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp immediately on completion; update the
> Progress header after every task; never batch. Spec tests come BEFORE implementation in every
> phase. TV-derived draw code is NOT `[x]` until its GATE-2 AFTER-diff task passes.

### Phase 0: Additive seams + theme
- [x] 0.1.1 Spec: core History theme roles (ST-32) — 2026-07-02 `packages/core/test/history-theme.spec.test.ts`
- [x] 0.1.2 Spec: Input seam + derived overlay visibility — 2026-07-02 `packages/ui/test/dropdown.seams.spec.test.ts`
- [x] 0.1.3 Verify spec FAIL (red) — 2026-07-02
- [x] 0.2.1 Implement 5 core History roles (decoded bytes) — 2026-07-02 `theme.ts`
- [x] 0.2.2 Implement Input public linkage seam — 2026-07-02 `controls/input.ts` (getValueSignal/getMaxLength + public selectAll)
- [x] 0.2.3 Implement `syncOverlayVisible` helper (imperative child-count derive, PF-001) — 2026-07-02 `app/application.ts`
- [x] 0.2.4 Replace menu controller toggles with `syncOverlayVisible` calls — 2026-07-02 `menu/controller.ts` (openTop + close; sites moved to ~228/246 by HR-40)
- [x] 0.2.5 Implement popup-host `DispatchEvent` envelope seam (`getFocused`/PopupHost, PF-002) — 2026-07-02 `view/types.ts` + `event/{types,event-loop,dispatch}.ts` + app wiring
- [x] 0.2.6 Verify spec PASS (green) — 2026-07-02 (core 4/4, ui 5/5)
- [x] 0.3.1 Menu regression green (`app-shell.menu.*`) — 2026-07-02 (18/18)
- [x] 0.3.2 Impl tests (overlay derive, seam safety) — 2026-07-02 `dropdown.seams.impl.test.ts` (5/5)
- [x] 0.3.3 `yarn verify` green — 2026-07-02 (8 tasks; ui 591 tests). Note: input.ts hit the 500-line cap after the seam → extracted the pure display-math helpers to `controls/input-render.ts` (glyphAt/displayedPos/canScrollRight + arrow consts); input.ts now 481 lines.

### Phase 1: Anchored popup
- [x] 1.1.1 Spec: popup (ST-18…ST-23) — 2026-07-02 `popup.spec.test.ts` (8 tests)
- [x] 1.1.2 Verify spec FAIL (red) — 2026-07-02 (import of missing `dropdown/` → suite failed)
- [x] 1.2.1 Implement `openAnchoredPopup` + catcher — 2026-07-02 `dropdown/popup.ts` + `dropdown/index.ts`
- [x] 1.2.2 Implement placement math (clamp, no flip) — 2026-07-02 `placePopup` (grow ±1, height maxRows+2, intersect-clamp only reducer)
- [x] 1.2.3 Implement dismissal (Esc/outside/focus-loss, idempotent) — 2026-07-02 (PopupFrame Esc, PopupCatcher outside-consume, focusSignal guard on !state.focused)
- [x] 1.2.4 Verify spec PASS (green) — 2026-07-02 (8/8)
- [x] 1.3.1 Impl tests (race, focus, derive, scrollbar) — 2026-07-02 `popup.impl.test.ts` (6 tests, incl. onPick-on-Enter + menu coexistence)
- [x] 1.3.2 `yarn verify` green — 2026-07-02 (8 tasks; ui 605 tests). Runtime note PA-16 recorded (pick wired to `list.selected` change → single-click picks, no double-click in the input model).

### Phase 2: History + store (TV-derived)
- [ ] 2.1.1 Spec: History control (ST-1…ST-11)
- [ ] 2.1.2 Spec: History store (ST-12…ST-17)
- [ ] 2.1.3 Verify spec FAIL (red)
- [ ] 2.2.1 **GATE-1 BEFORE**: transcribe the 03-01 decode into draw/geometry/store (cite file:line)
- [ ] 2.2.2 Implement the per-id MRU store
- [ ] 2.2.3 Implement the `History` control
- [ ] 2.2.4 Barrel + re-exports
- [ ] 2.2.5 Verify spec PASS (green)
- [ ] 2.3.1 **GATE-2 AFTER**: diff vs C++ + confirm oldest-at-top (ST-33)
- [ ] 2.3.2 Impl tests (guards, auto-hide, clamp, cap, clear)
- [ ] 2.3.3 `yarn verify` green

### Phase 3: ComboBox
- [ ] 3.1.1 Spec: ComboBox (ST-24…ST-31)
- [ ] 3.1.2 Verify spec FAIL (red)
- [ ] 3.2.1 Implement `ComboBox<T>` (both modes)
- [ ] 3.2.2 Re-exports
- [ ] 3.2.3 Verify spec PASS (green)
- [ ] 3.3.1 **GATE-2 AFTER**: diff popup/rows vs TListBox/History visuals
- [ ] 3.3.2 Impl tests (filter, emit, items-change, empty)
- [ ] 3.3.3 `yarn verify` green

### Phase 4: Stories + demo + gate
- [ ] 4.1.1 `History` kitchen-sink story
- [ ] 4.1.2 `ComboBox` kitchen-sink story
- [ ] 4.1.3 Register + smoke test (ST-36)
- [ ] 4.2.1 `demo:dropdowns` headless walkthrough
- [ ] 4.2.2 `dropdowns-demo.e2e.test.ts`
- [ ] 4.3.1 Packaging + security specs + `check:deps` (ST-34/ST-35)
- [ ] 4.3.2 Full verify + e2e + CHANGELOG + roadmap
- [ ] 4.3.3 Commit via /gitcm

---

## Dependencies

```
Phase 0 (seams + theme)
    ↓
Phase 1 (anchored popup)
    ↓
Phase 2 (History + store) ──┐
    ↓                       │ (both use the popup + roles)
Phase 3 (ComboBox) ─────────┘
    ↓
Phase 4 (stories + demo + gate)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed; all ST-1…ST-36 pass
2. ✅ `yarn verify` + `yarn check:deps` + `yarn test:e2e` green
3. ✅ No warnings/errors
4. ✅ No dead code — no unused params/functions/modules
5. ✅ Security hardened — sanitized draws, bounded + bounds-checked store, validator-gated field text
6. ✅ **GATE-2 passed** for every TV-derived component (History button/popup/rows + ComboBox visuals)
   with the decode recorded in the commit
7. ✅ Kitchen-sink stories registered + smoke green; `demo:dropdowns` runs headless
8. ✅ Documentation updated (CHANGELOG, roadmap row)
9. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
