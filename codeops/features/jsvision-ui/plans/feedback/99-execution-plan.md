# Execution Plan: Feedback (`ProgressBar` + `Spinner`)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-03 19:53
> **Progress**: 6/22 tasks (27%)
> **CodeOps Skills Version**: 3.2.0

## Overview

Implement `ProgressBar` + `Spinner` + `runSpinner` in a new `src/feedback/` subsystem over the shipped
RD-01…RD-07 facilities, plus 2 additive core `progress*` theme roles, the additive `DrawContext.caps`
seam (PA-1), a kitchen-sink story per widget, and a headless `demo:feedback`. RD-18 has **no TV
counterpart** (GATE-1, AR-186), so the fidelity work is narrow but mandatory: **pin** the fill-glyph +
partial table (PA-4), the spinner presets incl. `blocks` (PA-5), the whole-cell ASCII form + predicate
(PA-2), and the `progress*` extension-colour bytes (PA-3) — captured as the two GATE tasks below (per
the NON-NEGOTIABLE TV-fidelity directive + `codeops/tv-fidelity-gate.md`).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | GATE-1 decode + `DrawContext.caps` seam + core `progress*` roles | 6 |
| 2 | `ProgressBar` + `Spinner` + `runSpinner` (spec-first) | 5 |
| 3 | GATE-1 AFTER-diff + impl tests & hardening | 4 |
| 4 | Packaging, kitchen-sink stories, `demo:feedback` | 7 |

**Total: 22 tasks across 4 phases.**

---

## Phase 1: GATE-1 decode + `DrawContext.caps` seam + core `progress*` roles

### Step 1.1: Pin the fidelity decodes, land the caps seam + the theme roles

**Reference**: [03-01](03-01-progress-bar.md) · [03-02](03-02-spinner.md) · [03-03](03-03-theme-packaging.md)
**Objective**: Record the GATE-1 pins, add the additive `DrawContext.caps` seam, and land the 2 roles spec-first.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 1.1.1 | **[GATE-1 BEFORE-decode]** Record in `03-01`/`03-02`/`03-03` + (later) the code JSDoc: the fill glyphs `█`(U+2588)/`PARTIAL[1..7]`(U+258F…U+2589)/`░`(U+2591) + `round`-first formula (PA-4); the `SPINNERS` presets incl. `blocks=▏▎▍▌▋▊▉█` (PA-5); the whole-cell ASCII `#`/`-` form + `asciiOnly=!utf8\|\|!halfBlocks` predicate (PA-2); the `progressFill 0x1B`/`progressTrack 0x13` extension-colour bytes grounded in the cyan-on-blue scrollbar gauge family (PA-3). | `03-0*.md` |
| 1.1.2 | Add the **`DrawContext.caps` seam** (PA-1): `readonly caps: CapabilityProfile` on the `DrawContext` interface; add a `caps` param to `makeDrawContext` + return it; pass `this.caps` at `render-root.ts:134`; update **all ~11 direct `makeDrawContext` test call sites across 5 files** (mechanical arg add — `caps` is required). **First `grep -rn "makeDrawContext(" packages/ui/test` to enumerate them** — the set spans the 4 `view.drawcontext*` files **and `view.hardening.spec.test.ts:119` (outside that glob)**. Run `yarn verify` — existing suite still green. | `packages/ui/src/view/types.ts`, `view/draw-context.ts`, `view/render-root.ts`, `packages/ui/test/view.drawcontext*.test.ts`, `packages/ui/test/view.hardening.spec.test.ts` |
| 1.1.3 | Write `feedback-theme.spec.test.ts` from ST-11 (roles exist + `encode()` non-throw + no existing role changed). **Do not** hard-code a byte beyond the pinned pair. | `packages/ui/test/feedback-theme.spec.test.ts` |
| 1.1.4 | Run spec tests — verify **FAIL** (red) | — |
| 1.1.5 | Implement the 2 additive `progress*` roles in `Theme` + `defaultTheme` (bytes from 1.1.1) | `packages/core/src/engine/color/theme.ts` |
| 1.1.6 | Run spec tests — verify **PASS** (green); `yarn verify` | — |

**Deliverables**:
- [x] GATE-1 decode recorded (glyphs + presets + predicate + bytes)
- [x] `DrawContext.caps` seam landed additively; full suite still green
- [x] `progress*` roles land additively; no existing role changed
- [x] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 2: `ProgressBar` + `Spinner` + `runSpinner` (spec-first)

### Step 2.1: Specification tests (BEFORE implementation)

**Reference**: [03-01](03-01-progress-bar.md) · [03-02](03-02-spinner.md) · [07](07-testing-strategy.md)
**Objective**: Encode the widget + helper oracles before any implementation.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 2.1.1 | Write `progress-bar.spec.test.ts` (ST-1…5, ST-14 bar part) + `spinner.spec.test.ts` (ST-6…9, ST-14 spinner part). Render through `createEventLoop`+`mount` (the `tab-strip.spec` idiom); ST-3/ST-8 pass a Unicode-off `resolveCapabilities` override; ST-2 asserts cell-by-cell pre-`serialize`. MUST NOT read implementation logic. | `packages/ui/test/progress-bar.spec.test.ts`, `packages/ui/test/spinner.spec.test.ts` |
| 2.1.2 | Run spec tests — verify **FAIL** (red) | — |

### Step 2.2: Implementation

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 2.2.1 | Implement `progress-bar.ts`: `ProgressBar extends View`, `ProgressBarOptions`, `PARTIAL` table, `clamp`/`clampNaN`, **exported `asciiOnly`**, `round`-first sub-cell fill + whole-cell ASCII branch, optional centred caption, `set`/`percent`. Record the GATE-1 decode in the JSDoc. ≤ 500 lines. | `packages/ui/src/feedback/progress-bar.ts` |
| 2.2.2 | Implement `spinner.ts` (`Spinner extends View`, `SPINNERS` frozen presets, `SpinnerName`, negative-safe mod, preset-swap fallback importing `asciiOnly`, optional label; decode in JSDoc) + `run-spinner.ts` (`runSpinner`, `TimerSeam`, self-re-arming timer, idempotent `stop`) + `index.ts` barrel. Each ≤ 500 lines. | `packages/ui/src/feedback/spinner.ts`, `run-spinner.ts`, `index.ts` |
| 2.2.3 | Run spec tests — verify **PASS** (green). If any fails: fix the **code**, never the spec (immutable oracle). `yarn verify`. | — |

**Deliverables**:
- [ ] `progress-bar.spec` + `spinner.spec` written, red before impl, green after
- [ ] `ProgressBar`/`Spinner`/`runSpinner` implemented; files ≤ 500 lines
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 3: GATE-1 AFTER-diff + impl tests & hardening

### Step 3.1: Fidelity diff + edge/internal tests

**Reference**: [03-01](03-01-progress-bar.md) · [03-02](03-02-spinner.md) · [07](07-testing-strategy.md)
**Objective**: Verify the rendered glyphs/colours against the decode; cover edges.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 3.1.1 | **[GATE-1 AFTER-diff]** Diff the composed buffer **cell-by-cell** against the PA-2…PA-5 decodes: bar `█`/`PARTIAL[k]`/`░` sequence + `progressFill`/`progressTrack` styles at representative `(value,width)`; the `#`/`-` ASCII branch; each spinner preset's exact code points + the non-`line`→`line` swap. Record the diff result in the code JSDoc/commit; fix code on any disagreement. *(AR-186 grounded-pieces)* | `progress-bar.ts`/`spinner.ts` JSDoc / commit |
| 3.1.2 | Write `progress-bar.impl.test.ts` — `clamp`/`clampNaN`, rounding boundaries (PF-002 cases), `percent`, caption centring, `asciiOnly` truth table | `packages/ui/test/progress-bar.impl.test.ts` |
| 3.1.3 | Write `spinner.impl.test.ts` (negative mod, preset identity, empty label, preset-swap matrix) + `run-spinner.impl.test.ts` (default interval, `stop` before first fire, double-`stop` idempotent, no timer after stop, ST-10) | `packages/ui/test/spinner.impl.test.ts`, `run-spinner.impl.test.ts` |
| 3.1.4 | Full verification | — |

**Deliverables**:
- [ ] AFTER-diff passes (rendered output matches the decode) and is recorded
- [ ] Impl/edge tests written and passing
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## Phase 4: Packaging, kitchen-sink stories, `demo:feedback`

### Step 4.1: Packaging (spec-first)

**Reference**: [03-03](03-03-theme-packaging.md)
**Objective**: Explicit re-exports; zero deps; ≤ 500 lines — proven by spec.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 4.1.1 | Write `feedback.packaging.spec.test.ts` (ST-12: re-exports present, `check:deps` clean, files ≤ 500) | `packages/ui/test/feedback.packaging.spec.test.ts` |
| 4.1.2 | Run — verify **FAIL** (red) | — |
| 4.1.3 | Add explicit named re-exports (`ProgressBar`/`Spinner`/`runSpinner`/`SPINNERS` + the types) to the ui public entry | `packages/ui/src/index.ts` |
| 4.1.4 | Run — verify **PASS** (green) | — |

### Step 4.2: Kitchen-sink stories + headless demo (NON-NEGOTIABLE showcase)

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 4.2.1 | **Kitchen-sink stories for `ProgressBar` + `Spinner` (+ smoke test)** — `stories/progress-bar.story.ts` (id `feedback/progress-bar`, category `Feedback`, `rd:'RD-18'`; caption on, driven 0→100% with a live echo) + `stories/spinner.story.ts` (id `feedback/spinner`; animating, label, preset switcher) + two `stories/index.ts` lines; both pass `kitchen-sink.smoke.spec.test.ts` (ST-13). | `packages/examples/kitchen-sink/stories/progress-bar.story.ts`, `spinner.story.ts`, `stories/index.ts` |
| 4.2.2 | Headless `demo:feedback` — `feedback-demo/main.ts` (ASCII frame per step: bar 0→33→66→100%, then the spinner stepped through frames + the ASCII-fallback form) + `"demo:feedback"` script + `feedback-demo.e2e.test.ts` (ST-13). | `packages/examples/feedback-demo/main.ts`, `packages/examples/package.json`, `packages/examples/test/feedback-demo.e2e.test.ts` |
| 4.2.3 | Full verification incl. `yarn check:deps`; update CLAUDE.md/roadmap on completion (exec_plan post-analysis) | — |

**Deliverables**:
- [ ] Re-exports land; `check:deps` clean; files ≤ 500
- [ ] Both stories registered + smoke passing; `demo:feedback` runs headless + e2e passing
- [ ] `yarn verify` passing

**Verify**: `yarn verify`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** mark each task `[x]` with a timestamp immediately on completion; update the
> Progress header after every task; never batch. Immutable-oracle rule: a failing spec test means the
> code is wrong — fix the code, never the spec.

### Phase 1: GATE-1 decode + `DrawContext.caps` seam + core `progress*` roles
- [x] 1.1.1 [GATE-1 BEFORE-decode] Pin fill glyphs/partials (PA-4), presets incl. `blocks` (PA-5), ASCII form + predicate (PA-2), `progress*` bytes (PA-3); record ✅ (completed: 2026-07-03 19:29 — recorded in 03-01/03-02/03-03; echoed to code JSDoc in Phase 2/3)
- [x] 1.1.2 Add `DrawContext.caps` seam (interface + `makeDrawContext` param + render-root + **all 12 test call sites across 5 files incl. `view.hardening.spec.test.ts:119`** — grep-enumerated); suite green ✅ (completed: 2026-07-03 19:35 — `yarn verify` green, 826 ui tests)
- [x] 1.1.3 Write `feedback-theme.spec.test.ts` (ST-11) ✅ (completed: 2026-07-03 19:38 — existence + encode-non-throw + additive-guard snapshot)
- [x] 1.1.4 Run spec tests — verify RED ✅ (completed: 2026-07-03 19:38 — 2/3 red, roles absent)
- [x] 1.1.5 Implement 2 `progress*` roles in core `theme.ts` + `defaultTheme` ✅ (completed: 2026-07-03 19:53 — `progressFill` 0x1B / `progressTrack` 0x13)
- [x] 1.1.6 Run spec tests — verify GREEN; `yarn verify` ✅ (completed: 2026-07-03 19:53 — 829 ui tests green; PA-11 runtime: extended RD-17 `tabs-theme.spec` ST-30 key allowlist for the sanctioned `progress*` roles)

### Phase 2: `ProgressBar` + `Spinner` + `runSpinner`
- [ ] 2.1.1 Write `progress-bar.spec.test.ts` (ST-1…5) + `spinner.spec.test.ts` (ST-6…9)
- [ ] 2.1.2 Run spec tests — verify RED
- [ ] 2.2.1 Implement `progress-bar.ts` (fill math, ASCII branch, caption, clamp, `asciiOnly`, set/percent)
- [ ] 2.2.2 Implement `spinner.ts` (`SPINNERS`, preset-swap, label) + `run-spinner.ts` + `index.ts`
- [ ] 2.2.3 Run spec tests — verify GREEN (fix code, never the spec); `yarn verify`

### Phase 3: GATE-1 AFTER-diff + impl tests & hardening
- [ ] 3.1.1 [GATE-1 AFTER-diff] Cell-by-cell diff of fill glyphs/colours + spinner presets/fallback vs the decode; record
- [ ] 3.1.2 Write `progress-bar.impl.test.ts` (clamp, rounding boundaries, percent, caption, asciiOnly)
- [ ] 3.1.3 Write `spinner.impl.test.ts` + `run-spinner.impl.test.ts`
- [ ] 3.1.4 Full verification

### Phase 4: Packaging, kitchen-sink stories, `demo:feedback`
- [ ] 4.1.1 Write `feedback.packaging.spec.test.ts` (ST-12)
- [ ] 4.1.2 Run — verify RED
- [ ] 4.1.3 Add explicit named re-exports to `src/index.ts`
- [ ] 4.1.4 Run — verify GREEN
- [ ] 4.2.1 Kitchen-sink stories `feedback/progress-bar` + `feedback/spinner` (+ smoke, ST-13)
- [ ] 4.2.2 `demo:feedback` headless walkthrough + script + e2e (ST-13)
- [ ] 4.2.3 Full verification incl. `check:deps`; post-completion re-analysis

---

## Dependencies

```
Phase 1 (GATE-1 decode + DrawContext.caps seam + theme roles)
    ↓
Phase 2 (widgets + helper — need the caps seam + the roles + the pinned glyphs)
    ↓
Phase 3 (AFTER-diff + impl tests — need the rendered output)
    ↓
Phase 4 (packaging + stories + demo — need the public API)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 22 tasks completed
2. ✅ `yarn verify` passing (typecheck + build + test across packages)
3. ✅ No warnings/errors; `yarn check:deps` clean (zero runtime deps)
4. ✅ No dead code — no unused parameters, functions, or modules
5. ✅ Security hardened — `value`/`frame` clamped/mod-safe, caption/label sanitized + width-clipped, `runSpinner.stop()` clears its timer
6. ✅ GATE-1 BEFORE + AFTER fidelity tasks done and the decode recorded in code/commit (PA-2…PA-5)
7. ✅ Kitchen-sink `feedback/progress-bar` + `feedback/spinner` stories pass smoke; `demo:feedback` runs headless + e2e
8. ✅ `DrawContext.caps` seam landed additively (no existing widget behavior changed)
9. ✅ Documentation/roadmap updated (post-completion re-analysis handled by the exec_plan skill)
