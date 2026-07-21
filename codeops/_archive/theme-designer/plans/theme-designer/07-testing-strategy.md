# Testing Strategy: Theme Designer

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

| Code type | Target |
| --------- | ------ |
| Pure logic (`track.ts`, `DesignerModel`, hex validator) | 90% |
| Widgets / app view | 80% |
| Shell / glue / host I/O | 60% |

- Test names state behavior. Spec tests (`*.spec.test.ts`) are immutable oracles derived from
  `01-requirements.md`, the `03-*` specs, and the AR — a failing spec test means the code is wrong.
- Tests live in each package's `test/` dir (never colocated). `@jsvision/ui` tests under
  `packages/ui/test/`; app tests under `packages/theme-designer/test/`.
- The app is exercised headlessly (`createApplication` with injected `input`/`output`, `requireTty:false`) and
  via a piped walkthrough e2e — the existing repo pattern; no node-pty.

## 🚨 Specification Test Cases (MANDATORY)

> Derived from `01-requirements.md`, `03-01`/`03-02`/`03-03`/`03-04`, and `00-ambiguity-register.md`.
> IMMUTABLE ORACLE — do not edit an expectation to match code. In-code traceability comments quote the
> behavior in plain language, never an ST-/AR-/Req id or a plan path.

### Slider + shared track math (`@jsvision/ui`, `@jsvision/core`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `valueToOffset({min:0,max:100,length:11}, 50)` | thumb offset = center cell (5) | 03-01 §track, R4 |
| ST-2 | `offsetToValue({min:0,max:100,length:11}, 0)` and at last cell | 0 at start, 100 at end; monotone in between | 03-01 §track, R4 |
| ST-3 | `clampValue({min:0,max:255}, -5)` / `clampValue(…, 300)` | 0 / 255 | 03-01 §track, R4 |
| ST-4 | `stepValue({min:0,max:10}, 9, +1)` / `stepValue(…, 10, +1)` | 10 / 10 (clamped, no overflow) | 03-01 §track, R4 |
| ST-5 | horizontal `Slider` value 50 (min0 max100) composed to a buffer | groove in `sliderTrack`, one thumb cell in `sliderThumb` at the mapped column, no end-arrows | 03-01 §Slider, R4 |
| ST-6 | vertical `Slider` same value | thumb on the mapped row; cross-axis width 1 | 03-01 §Slider, AR-8 |
| ST-7 | focused horizontal Slider: `→` then `End` then `Home` | value +step, then max, then min; each fires `onInput` and `onChange` | 03-01 §Slider, AR-17 |
| ST-8 | mouse press on groove at offset k, drag, release | value tracks `offsetToValue` continuously (`onInput` each move), `onChange` once on release | 03-01 §Slider, AR-17 |
| ST-9 | wheel up / down on Slider | value ±step, clamped, fires `onInput`+`onChange` | 03-01 §Slider, AR-17 |
| ST-10 | `ScrollBar` value↔thumb for a fixed (min,max,len) case, before vs after the track-math extraction | identical result; ScrollBar's existing suite unchanged and green | AR-9 |
| ST-11 | `defaultTheme.sliderTrack` / `.sliderThumb` | equal the pinned DOS-16 byte pair (frozen) | AR-18 |

### Designer model (`@jsvision/theme-designer`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-12 | `setAlias('accent', '#3b82f6')` | `theme().button.bg` reflects the accent-derived value; `dirty` true | 03-02 §derive, R1 |
| ST-13 | `setRole('button', {bg:'#ff0000'})` then `setAlias('accent', …)` | `theme().button.bg` stays `#ff0000` (roleOverrides applied last) | 03-02 §derive, R2/AR-25 |
| ST-14 | `setRole('button',{bg:'#ff0000'})` then `clearRole('button')` | `button.bg` reverts to the derived value | 03-02, R2 |
| ST-15 | `loadPreset('nord')` (derived preset) / `loadPreset('turbo-vision')` (literal) | Nord → derive mode seeded from Nord's seed set, `theme()` deep-equals `nordTheme`; turbo-vision → roles mode (`roleSnapshot`=`defaultTheme`); both `dirty` false | 03-02 §presets, R8/AR-16 |
| ST-16 | `contrastRows` on a theme with a low-contrast pair and a `'default'` pair | low pair → `fail`/`AA` per ratio; the `'default'` pair is absent (skipped, not flagged) | 03-02 §contrast, AR-14 |
| ST-17 | `depthSamples('#3b82f6')` | 4 rows; `256`=`rgb256(nearest256)`, `16`=nearest DOS-16 hex, `mono`∈{#000000,#ffffff} | 03-02 §depth, AR-15 |
| ST-18 | `exportJson()` then `parseTheme(...)` | valid JSON; parses back to a theme deep-equal to `theme()` | 03-02, R9 |
| ST-19 | `importJson(validThemeJson)` | model enters roles mode (`roleSnapshot` set to the parsed theme, `dirty` false); `theme()` deep-equals the file | 03-02, R10/AR-25 |
| ST-20 | `importJson('{bad}')` and `importJson(wrongRoleSet)` | throws `InvalidThemeError`; model state unchanged | 03-02 §errors, AR-20 |
| ST-21 | any edit sets dirty; `loadPreset`/`importJson`/`markSaved` clear it | `dirty` transitions as specified | 03-02, AR-24 |
| ST-22 | hex validator: `#3b82f6` / `#f00` / `#12` / `zzz` / `12345` | valid / valid / invalid / invalid / invalid | 03-02 §hex, AR-20 |
| ST-31 | after `importJson(valid)` (roles mode), `setAlias('accent', '#ff0000')` | model transitions to derive mode (`roleSnapshot` cleared); the accent-driven roles reflect the edit (edit is visible, not masked) | 03-02 §derive, AR-25/PF-002 |

### App / integration (`@jsvision/theme-designer`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-23 | headless walkthrough (piped) | prints a non-empty composed frame for each step (initial→alias→role→preset→depth→contrast→export) | 03-03 §walkthrough, R12 |
| ST-24 | select an alias row in the rail | `model.selected` = that alias; inspector picker loads its color | 03-03, AR-13 |
| ST-25 | drag an R/G/B slider in the picker | `model` updates the selected target; `app.setTheme` called → preview repaints | 03-03, R3/R5 |
| ST-26 | Open / Load-preset / Quit while `dirty` | a `confirm` is shown; proceeding only on yes | 03-03, AR-24 |
| ST-27 | Open via a fake FileDialog returning a valid file; and cancel | valid → `importJson` adopts it; cancel → no-op | 03-03, R10/AR-24 |
| ST-28 | Save via a fake FileDialog path | `writeFile(path, exportJson())` called; `dirty` cleared | 03-03, R9 |
| ST-29 | Open a malformed theme file | `messageBox` error shown; current theme unchanged; no crash | 03-03 §errors, AR-20 |
| ST-30 | mount the `controls/slider` kitchen-sink story headlessly | mounts, paints something, unique id + required metadata | AR-19, R15 |

> **⚠️ AUTHORING RULE:** expectations derive from the specs above, not imagined implementation output. Any gap
> is an ambiguity — add it to the register and resolve it before writing the test.

## Test Categories

### Specification tests (written first)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/ui/test/track.spec.test.ts` | ST-1…ST-4 | shared track math |
| `packages/ui/test/slider.spec.test.ts` | ST-5…ST-9 | `Slider` |
| `packages/ui/test/scrollbar.impl.test.ts` (existing) + a new assertion | ST-10 | ScrollBar regression |
| `packages/core/test/slider-theme.spec.test.ts` | ST-11 | role byte-freeze |
| `packages/theme-designer/test/model.spec.test.ts` | ST-12…ST-21, ST-31 | `DesignerModel` |
| `packages/theme-designer/test/hex-validator.spec.test.ts` | ST-22 | hex validator |
| `packages/theme-designer/test/app.spec.test.ts` | ST-24…ST-29 | app-core (headless) |
| `packages/theme-designer/test/walkthrough.e2e.test.ts` | ST-23 | piped walkthrough |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (existing) | ST-30 | slider story |

### Implementation tests (after green)

| Test File | Description |
| --------- | ----------- |
| `packages/ui/test/{track,slider}.impl.test.ts` | degenerate range, non-integer value, vertical drag, capture release, measure |
| `packages/theme-designer/test/model.impl.test.ts` | roles↔derive transitions (`roleSnapshot` lifecycle, user role edits surviving as `roleOverrides`), light/dark derivation, preset↔dirty, `resolvedAliases` in both modes |
| `packages/theme-designer/test/app.impl.test.ts` | menu/command wiring, depth toggle re-renders preview, save-error path |

## Verification Checklist
- [ ] All ST cases defined with concrete input/output pairs, each traced to a Req / 03-doc / AR.
- [ ] Spec tests written and RED before implementation; GREEN after.
- [ ] Impl tests for edges/internals.
- [ ] `ScrollBar` existing suite unchanged and green after the refactor.
- [ ] `defaultTheme` byte-freeze + golden/a11y suites green (only the 2 new roles added).
- [ ] `yarn verify` + `yarn lint` + per-package `typecheck` + `check:docs` green; new-package `test:e2e` in CI.
- [ ] No regressions in existing tests.
