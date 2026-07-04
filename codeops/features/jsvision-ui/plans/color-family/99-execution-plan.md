# Execution Plan: Color family (`ColorSwatch` + `ColorPicker`)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-04
> **Progress**: 17/30 tasks (57%)
> **CodeOps Skills Version**: 3.2.0

## Overview

Implement `ColorSwatch` + `ColorPicker` in a new `src/color/` subsystem over the shipped RD-01…RD-20
facilities, plus **one** additive core `colorMarker` theme role, **two** additive core re-exports
(`ANSI16_ORDER` + `toRgb`), kitchen-sink stories, and a headless `demo:color`. `ColorSwatch` **has a TV
counterpart** (`TColorSelector`, `colorsel.cpp`), so the GATE-1 BEFORE-decode + GATE-2 AFTER-diff are
**mandatory** (per the NON-NEGOTIABLE TV-fidelity directive + `codeops/tv-fidelity-gate.md`): decode
the 3-wide cells + `◘`(CP437 8) marker + the black-cell `0x70` rule + the wrap-around nav + the
`row*columns + floor(localX/3)` drag hit BEFORE, and diff the rendered buffer cell-by-cell AFTER. The
generic-palette/hex/picker/state extensions get spec oracles but no diff.

The RD-14 anchored-popup generalization RD-21 needs **already landed in RD-20** — RD-21 **consumes**
`openAnchoredPopup` unchanged and does **not** edit `dropdown/` (so there is no popup-generalization
phase; only a Phase-5 regression check).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | GATE-1 decode + core re-exports + `colorMarker` role (spec-first) | 7 |
| 2 | `color-grid.ts` — pure grid math (spec-first) | 4 |
| 3 | `ColorSwatch` view — draw, marker, nav, drag (spec-first) | 4 |
| 4 | `ColorPicker` + hex field (spec-first) | 4 |
| 5 | GATE-2 AFTER-diff + impl tests & hardening | 4 |
| 6 | Packaging, kitchen-sink stories, `demo:color` | 7 |

**Total: 30 tasks across 6 phases.**

---

## Phase 1: GATE-1 decode + core re-exports + `colorMarker` role (spec-first)

### Step 1.1: GATE-1 BEFORE-decode + the additive core surface

**Reference**: [03-01](03-01-color-swatch.md) · [03-03](03-03-theme-packaging.md) · [02](02-current-state.md)
**Objective**: Record the fidelity decode; land the role + re-exports spec-first; extend the guards.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 1.1.1 | **[GATE-1 BEFORE-decode]** Confirm/expand `03-01` cell-by-cell: `█` cell glyph (`tvtext1.cpp:88`), 3-wide `moveChar(j*3,icon,c,3)`, `◘`(CP437 8) marker at `j*3+1`, the `c==0`→`0x70` rule, the wrap-around nav (`:196-217`), the `mouse.y*4+mouse.x/3` drag hit + revert-on-leave (`:165-177`). This decode is echoed into the `color-grid.ts`/`color-swatch.ts` JSDoc in Phases 2-3. | `03-01-color-swatch.md` |
| 1.1.2 | Write `color-theme.spec.test.ts` (ST-11) + `color.packaging.spec.test.ts` re-export half (ST-12): the `colorMarker` role exists (`0x70`), `encode()` non-throw, no existing role changed; `ANSI16_ORDER` + `toRgb` importable from `@jsvision/core`, no existing core export changed. | `packages/ui/test/color-theme.spec.test.ts`, `packages/core/test/*` (or ui packaging spec) |
| 1.1.3 | Run spec tests — verify **FAIL** (red) | — |
| 1.1.4 | Implement: (a) the `colorMarker` role in `Theme` + `defaultTheme` (`0x70`, JSDoc citing `colorsel.cpp:136` + PA-1/PA-2); (b) re-export `ANSI16_ORDER` + `toRgb` through `color/index.ts` → `engine/index.ts` (additive, lines 146-157). **PA-14:** append `colorMarker` to the **three** closed-set guards — `tabs-theme.spec` (ST-30), `feedback-theme.spec` (ST-11), `date-theme.spec` (calendar* "ONLY new keys"); `table-theme.spec` is NOT closed-set (no edit). Backstop with `grep -rn "LATER_ADDITIVE_ROLES\|additive\|ONLY" packages/ui/test/*theme*`; **keep every byte assertion** (PF-003). | `packages/core/src/engine/color/theme.ts`, `color/index.ts`, `packages/core/src/engine/index.ts`, `packages/ui/test/*theme*.spec.test.ts` |
| 1.1.5 | Run spec tests — verify **PASS** (green); `yarn verify` | — |

**Deliverables**:
- [ ] GATE-1 BEFORE-decode recorded (cells + marker + nav + drag hit)
- [ ] `colorMarker` role lands additively; guard allowlists extended; no existing role/byte changed
- [ ] `ANSI16_ORDER` + `toRgb` public on `@jsvision/core`; no existing core export changed
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 2: `color-grid.ts` — pure grid math (spec-first)

### Step 2.1: Specification tests → implementation

**Reference**: [03-01](03-01-color-swatch.md) · [07](07-testing-strategy.md)
**Objective**: The pure dims/hit/nav/near-black math, oracle-first.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 2.1.1 | Write `color-grid.spec.test.ts` (ST-4 nav wrap branches, ST-5 `hitCell` inside/partial-row/outside, ST-15 edges `n=0`/`n=1`/`columns≤0`, near-black predicate). MUST NOT read impl. Run — verify **FAIL** (red). | `packages/ui/test/color-grid.spec.test.ts` |
| 2.1.2 | Verify red (documented) | — |
| 2.2.1 | Implement `color-grid.ts` (`gridDims`/`insideGrid`/`hitCell`/`cellX`/`cellRow`/`navLeft|Right|Up|Down`/`isNearBlack`; pure, bounds-checked; `hitCell` returns a discriminated `number \| 'overshoot' \| 'outside'` so the swatch's revert-vs-clamp split (PA-10) lives in the pure layer, PF-002; transcribe the nav from `colorsel.cpp:196-217`; record the decode/PA in JSDoc). ≤ 500 lines. | `packages/ui/src/color/color-grid.ts` |
| 2.2.2 | Run `color-grid.spec` **PASS** (green; fix code, never the spec — a nav mismatch vs `colorsel.cpp` is a code defect); `yarn verify` | — |

**Deliverables**:
- [ ] `color-grid.spec` red before impl, green after
- [ ] `color-grid.ts` implemented; nav transcribed from the decode; zero-dep; all indexing bounds-checked
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 3: `ColorSwatch` view — draw, marker, nav, drag (spec-first)

### Step 3.1: Specification tests (BEFORE implementation)

**Reference**: [03-01](03-01-color-swatch.md) · [07](07-testing-strategy.md)
**Objective**: Encode the geometry + marker + nav + drag + state oracles before any view code.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 3.1.1 | Write `color-swatch.spec.test.ts` (ST-1…ST-7): render-through-loop (`createEventLoop`+`mount`); ST-2 grid geometry + ST-3 marker asserted **cell-by-cell pre-`serialize`** vs the `colorsel.cpp` decode; ST-4 wrap-around keyboard; ST-5 click/drag (revert vs clamp); ST-1/ST-6/ST-7 generic palette + truecolor value + cursor/value state model. MUST NOT read impl. | `packages/ui/test/color-swatch.spec.test.ts` |
| 3.1.2 | Run — verify **FAIL** (red) | — |

### Step 3.2: Implementation

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 3.2.1 | Implement `color-swatch.ts` (`ColorSwatch extends View`): draw (3-wide `█` cells in raw `Color`; `◘` marker on the `value` cell, near-black → `colorMarker`), the cursor `Signal` (init `indexOf(value)`/`0`, PA-9), value⟷cursor two-way bind, keyboard nav + Enter/Space commit, mouse down/move/up with capture (drag revert-outside / clamp-partial-row, PA-10), `select()`/`onChange`/`onCommit`. **Record the GATE-1 decode in the JSDoc.** ≤ 500 lines. | `packages/ui/src/color/color-swatch.ts` |
| 3.2.2 | Run `color-swatch.spec` **PASS** (green; on any fidelity mismatch the **code** is wrong — fix against `colorsel.cpp`); `yarn verify` | — |

**Deliverables**:
- [ ] `color-swatch.spec` red before impl, green after
- [ ] `color-swatch.ts` implemented; GATE-1 decode in JSDoc; ≤ 500 lines; cells use raw `Color`s (no role)
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 4: `ColorPicker` + hex field (spec-first)

### Step 4.1: Specification tests (BEFORE implementation)

**Reference**: [03-02](03-02-color-picker.md) · [07](07-testing-strategy.md)

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 4.1.1 | Write `color-picker.spec.test.ts` (ST-8 chip + open/commit-on-release/cancel + no-host guard; ST-9 hex entry + `allowCustom`; ST-10 popup consumption + RD-14/20 suites green). Use a fake/app-shell `PopupHost` (the ComboBox/DatePicker idiom). MUST NOT read impl. | `packages/ui/test/color-picker.spec.test.ts` |
| 4.1.2 | Run — verify **FAIL** (red) | — |

### Step 4.2: Implementation

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 4.2.1 | Implement `color-picker.ts` (`ColorPicker extends Group`): `ColorChip` (current-color block + caption via `nameFor`/`label`) + trailing `ColorButton` (`▐↓▌` via `drawDropdownIcon`) + `open(ev)` via the generalized `openAnchoredPopup` hosting `[ ColorSwatch (fr) | hex Input (allowCustom) ]` sharing `value`, `onCommit`→`commit()` (commit-on-release, PA-11), the hex field `filter`-gated + `toRgb()`-parsed (two-way value⟷text, ComboBox idiom), the `host===undefined` no-op guard. ≤ 500 lines. **Does NOT edit `dropdown/`.** | `packages/ui/src/color/color-picker.ts` |
| 4.2.2 | Run `color-picker.spec` **PASS** (green; fix code, never the spec); `yarn verify` | — |

**Deliverables**:
- [ ] `color-picker.spec` red before impl, green after
- [ ] `color-picker.ts` implemented; consumes `openAnchoredPopup` (no `dropdown/` edit); ≤ 500 lines
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 5: GATE-2 AFTER-diff + impl tests & hardening

### Step 5.1: Fidelity diff + edge/internal tests

**Reference**: [03-01](03-01-color-swatch.md) · [07](07-testing-strategy.md)
**Objective**: Verify the rendered grid against `colorsel.cpp`; cover edges; prove RD-14/20 green.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 5.1.1 | **[GATE-2 AFTER-diff]** Re-open `colorsel.cpp` and diff the composed `ColorSwatch` buffer **cell-by-cell**: 3-wide `█` cells + column math, the `◘` at `cellX+1`, the near-black `0x70` marker, the wrap-around nav results, and the `row*columns+floor(x/3)` drag hit + revert-on-leave, at representative palettes (4×4 ANSI-16 + an 8×1 truecolor row); **also assert `charWidth('◘')===1` and `charWidth('█')===1`** under the swatch's `wcwidth` caps (PF-005). Record the diff in the code JSDoc / commit; fix code on any disagreement (the C++ outranks our spec for TV-derived draws). | `color-swatch.ts` JSDoc / commit |
| 5.1.2 | Write `color-grid.impl.test.ts` (nav edge-wrap branches, `hitCell` partial/outside, `isNearBlack` threshold, `gridDims` degenerate) + `color-swatch.impl.test.ts` (cursor init/clamp, `value∉colors` re-home, drag revert vs clamp, `select`/`onChange`, near-black marker style). | `packages/ui/test/color-grid.impl.test.ts`, `color-swatch.impl.test.ts` |
| 5.1.3 | Write `color-picker.impl.test.ts` (no-host guard, open→pick-on-release→close, drag-preview-not-close, hex commit + reject, `allowCustom:false`, chip caption). Run the RD-14 `history.*`/`combo-box.*` + RD-20 `date-picker.*` suites → **green, unchanged** (AC-9). | `packages/ui/test/color-picker.impl.test.ts` |
| 5.1.4 | Full verification | — |

**Deliverables**:
- [ ] AFTER-diff passes (rendered output matches `colorsel.cpp`) and is recorded
- [ ] Impl/edge tests written and passing; RD-14 + RD-20 suites still green
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 6: Packaging, kitchen-sink stories, `demo:color`

### Step 6.1: Packaging (spec-first)

**Reference**: [03-03](03-03-theme-packaging.md)

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 6.1.1 | Complete `color.packaging.spec.test.ts` (ST-12): `color/` re-exports present, `check:deps` clean, `color/` files ≤ 500. Run — verify **FAIL** (red) for the ui re-export half. | `packages/ui/test/color.packaging.spec.test.ts` |
| 6.1.2 | Add `color/index.ts` barrel + explicit named re-exports (`ColorSwatch`/`ColorPicker` + `ColorSwatchOptions`/`ColorPickerOptions`) to `packages/ui/src/index.ts`. | `packages/ui/src/color/index.ts`, `packages/ui/src/index.ts` |
| 6.1.3 | Run — verify **PASS** (green) | — |

### Step 6.2: Kitchen-sink stories + headless demo (NON-NEGOTIABLE showcase)

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 6.2.1 | **Kitchen-sink stories for `ColorSwatch` + `ColorPicker` (+ smoke, ST-13)** — `stories/color-swatch.story.ts` (id `color/color-swatch`, category `Color`, `rd:'RD-21'`; DOS-16 grid + live name+hex echo + hints) + `stories/color-picker.story.ts` (id `color/color-picker`; chip + grid + hex field + echo) + two `stories/index.ts` lines; both pass `kitchen-sink.smoke.spec.test.ts`. | `packages/examples/kitchen-sink/stories/color-swatch.story.ts`, `color-picker.story.ts`, `stories/index.ts` |
| 6.2.2 | Headless `demo:color` — `color-demo/main.ts` (ASCII frame per step: render → arrow-nav → pick → open picker → enter a hex color → commit) + `"demo:color"` script + `color-demo.e2e.test.ts` (ST-13). | `packages/examples/color-demo/main.ts`, `packages/examples/package.json`, `packages/examples/test/color-demo.e2e.test.ts` |
| 6.2.3 | Full verification incl. `yarn check:deps`; update CLAUDE.md/roadmap on completion (exec_plan post-analysis). | — |

**Deliverables**:
- [ ] Re-exports land; `check:deps` clean; files ≤ 500
- [ ] Both stories registered + smoke passing; `demo:color` runs headless + e2e passing
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp immediately on completion; update the
> Progress header after every task; never batch. Immutable-oracle rule: a failing spec test means the
> code is wrong — fix the code, never the spec (for the TV-derived `ColorSwatch`, a spec oracle that
> disagrees with a faithful `colorsel.cpp` decode is the defect — fix it against the source, cite the `.cpp`).

### Phase 1: GATE-1 decode + core re-exports + `colorMarker` role
- [x] 1.1.1 [GATE-1 BEFORE-decode] Record cells + `◘` marker + `0x70` rule + nav + drag hit in 03-01 (2026-07-04 — verified `colorsel.cpp:120-237` matches 03-01 decode table cell-for-cell)
- [x] 1.1.2 Write `color-theme.spec` (ST-11) + packaging re-export half (ST-12) (2026-07-04)
- [x] 1.1.3 Run spec tests — verify RED (2026-07-04 — 4 fail: colorMarker byte/ONLY-key, ANSI16_ORDER, toRgb)
- [x] 1.1.4 Implement `colorMarker` role + `ANSI16_ORDER`/`toRgb` re-exports; extend PA-14 guard allowlists (2026-07-04)
- [x] 1.1.5 Run spec tests — verify GREEN; `yarn verify` (2026-07-04 — 8/8 turbo tasks, 965 ui tests green)

### Phase 2: `color-grid.ts` pure math
- [x] 2.1.1 Write `color-grid.spec` (ST-4/ST-5/ST-15 + near-black) (2026-07-04)
- [x] 2.1.2 Run — verify RED (2026-07-04 — module not found)
- [x] 2.2.1 Implement `color-grid.ts` (dims/hit/nav/near-black; nav transcribed from `colorsel.cpp:196-217`) (2026-07-04)
- [x] 2.2.2 Run — verify GREEN; `yarn verify` (2026-07-04 — color-grid.spec 15/15; full verify 8/8)

### Phase 3: `ColorSwatch` view
- [x] 3.1.1 Write `color-swatch.spec` (ST-1…ST-7; ST-2/ST-3 cell-by-cell pre-serialize) (2026-07-05)
- [x] 3.1.2 Run — verify RED (2026-07-05 — module not found)
- [x] 3.2.1 Implement `color-swatch.ts` (draw + marker + nav + drag + cursor/value model; GATE-1 decode in JSDoc) (2026-07-05)
- [x] 3.2.2 Run `color-swatch.spec` GREEN (fix code, never the spec); `yarn verify` (2026-07-05 — 13/13; full verify 8/8)

### Phase 4: `ColorPicker` + hex field
- [x] 4.1.1 Write `color-picker.spec` (ST-8…ST-10) (2026-07-05)
- [x] 4.1.2 Run — verify RED (2026-07-05 — module not found)
- [x] 4.2.1 Implement `color-picker.ts` (chip + `▐↓▌` + anchored swatch popup + hex field + no-host guard) (2026-07-05 — **PA-16 runtime:** the in-popup hex field required generalizing `openAnchoredPopup`'s focus-loss dismiss to popup-subtree membership, editing `dropdown/popup.ts`; user-decided, supersedes AC-9's "no dropdown/ edit" with a backward-compatible change guarded by the RD-14/20 suites. Also completed the swatch's opt-in commit-on-release (`color-swatch.ts`, gated on `onCommit`).)
- [x] 4.2.2 Run `color-picker.spec` GREEN; `yarn verify` (2026-07-05 — picker 13/13, RD-14/20 suites 60/60 green, full verify 8/8)

### Phase 5: GATE-2 AFTER-diff + impl tests
- [ ] 5.1.1 [GATE-2 AFTER-diff] Cell-by-cell diff of the composed `ColorSwatch` vs `colorsel.cpp`; record
- [ ] 5.1.2 Write `color-grid.impl` + `color-swatch.impl`
- [ ] 5.1.3 Write `color-picker.impl`; RD-14 History/ComboBox + RD-20 DatePicker suites GREEN (AC-9)
- [ ] 5.1.4 Full verification

### Phase 6: Packaging, kitchen-sink stories, `demo:color`
- [ ] 6.1.1 Complete `color.packaging.spec` (ST-12); run RED (ui half)
- [ ] 6.1.2 Add `color/index.ts` barrel + explicit re-exports in `src/index.ts`
- [ ] 6.1.3 Run — verify GREEN
- [ ] 6.2.1 Kitchen-sink `color/color-swatch` + `color/color-picker` stories (+ smoke, ST-13)
- [ ] 6.2.2 `demo:color` headless walkthrough + script + e2e (ST-13)
- [ ] 6.2.3 Full verification incl. `check:deps`; post-completion re-analysis

---

## Dependencies

```
Phase 1 (GATE-1 decode + colorMarker role + core re-exports)
    ↓
Phase 2 (color-grid.ts pure math — needs nothing but the decode)
    ↓
Phase 3 (ColorSwatch view — needs the role + re-exports + grid math)
    ↓
Phase 4 (ColorPicker — needs the ColorSwatch + the generalized popup [already landed])
    ↓
Phase 5 (GATE-2 AFTER-diff + impl tests — need the rendered output)
    ↓
Phase 6 (packaging + stories + demo — need the public API)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 30 tasks completed
2. ✅ `yarn verify` passing (typecheck + build + test across packages)
3. ✅ No warnings/errors; `yarn check:deps` clean (zero runtime deps)
4. ✅ No dead code — no unused parameters, functions, or modules
5. ✅ Security hardened — `filter`-gated + `toRgb()`-parsed hex field (invalid never commits), all
   grid/cell/drag indexing bounds-checked/clamped for any palette size / `columns` / empty set / drag
   beyond the grid edge, every glyph sanitized
6. ✅ GATE-1 BEFORE + GATE-2 AFTER fidelity tasks done and the decode recorded in code/commit (3-wide
   cells, `◘` marker + `0x70` rule, wrap-around nav, drag hit + revert)
7. ✅ Existing RD-14 `History` + `ComboBox` + RD-20 `DatePicker` tests stay green (popup consumed
   unchanged; no `dropdown/` edit — AC-9)
8. ✅ Kitchen-sink `color/color-swatch` + `color/color-picker` stories pass smoke; `demo:color` runs
   headless + e2e
9. ✅ One additive `colorMarker` role lands (`0x70`); two additive re-exports (`ANSI16_ORDER`,
   `toRgb`); no existing role/byte/export changed; guard allowlists extended (PA-14)
10. ✅ Documentation/roadmap updated (post-completion re-analysis handled by the exec_plan skill)
