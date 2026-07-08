# Roadmap: Theme Designer

> **Feature-Set**: Theme Designer
> **Status**: In Progress
> **Created**: 2026-07-08
> **Last Updated**: 2026-07-08
> **Progress**: 0 / 1 (0%)
> **CodeOps Skills Version**: 3.3.2

A standalone, "pro" terminal application (`@jsvision/theme-designer`) for authoring `@jsvision/core`
themes — live preview, per-channel RGB color picking, WCAG contrast, depth downsampling, the 7 presets,
and JSON import/export via a real file dialog. Dogfoods the SDK: built from the widgets it themes. Along
the way it fills a real framework gap — a reusable **`Slider`** control in `@jsvision/ui` (both
orientations), sharing its value-track math with `ScrollBar`. Standalone plan (no upstream RD); the plan's
`01-requirements.md` owns the requirements.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| PL-01 | Theme designer app + reusable `Slider` | — (standalone plan) | [theme-designer](plans/theme-designer/00-index.md) | Executing | 🔄 | 2026-07-09 | 4 phases / 35 tasks, spec-first (ST-1…ST-31). Zero-Ambiguity Gate PASSED (AR-1…AR-25); **Preflight PASSED** — 10 findings applied (see `plans/theme-designer/00-preflight-report.md`): two-mode model (`roleSnapshot` derive/roles) replaces the single alias-set; +3 additive core exports (`aliasesFromSeeds`, `rgb256`, preset seed sets) beyond the `sliderTrack`/`sliderThumb` roles; R7 depth scoped to a display-only sample strip (app `RenderRoot.caps` immutable); file I/O reuses `openFile`/`errorBox`. New private package `@jsvision/theme-designer` (deps core+ui+files; publish deferred while ui is private). Additive ui: `Slider` (H+V) on an extracted shared track-math helper (ScrollBar refactored, its tests guard it). Deferred v1: HSL · undo/redo · draggable splitters · custom-preset library. Next: `exec_plan theme-designer`. |

## Notes

- 2026-07-09: **Phase 2 DONE** (23/40 tasks). New private package `@jsvision/theme-designer` scaffolded
  (app shape: `tsx start`, no build/barrel; deps core+ui+files; workspace linked). The pure, headless
  `DesignerModel` landed — two-mode state (`roleSnapshot` null⇒derive / non-null⇒roles; first alias/seed
  edit transitions), `createTheme`-based derivation + last-applied role overrides, `resolvedAliases`,
  preset mapping (5 derived→derive, 2 literal→roles), `contrastRows`, `depthSamples`, serialize
  round-trip, import validation, dirty lifecycle — plus the `#rrggbb` `hexValidator`. Spec-first
  (ST-12…ST-22, ST-31; +9 impl). **Runtime decision AR-26:** the 16-color depth swatch draws the
  Borland/DOS-16 hex for the emitted slot (fixed CGA reindex of `PALETTE`) — the plan's
  `PALETTE[ANSI16_ORDER[…]]` was invalid (key-set mismatch). `yarn verify` green (16/16); `sync-versions
  --check` green (private skipped). _Note: the plan's task counts were off (preflight drift); corrected to
  40 total._
- 2026-07-09: **PL-01 → EXECUTING** 🔄 (`exec_plan`). **Phase 1 DONE** (14/35 tasks): the reusable
  `Slider` (both orientations, keyboard/mouse/drag/wheel, `onInput`/`onChange`) landed in `@jsvision/ui`
  on an extracted pure `track.ts` value↔position helper that `ScrollBar` now shares (its suite + new
  ST-10 pin the math unchanged); `@jsvision/core` gained the `sliderTrack`/`sliderThumb` roles (byte-frozen
  by `slider-theme.spec`, derived in `rolesFromAliases`, attr-driven in `monochromeTheme`) plus the three
  additive exports the model needs (`aliasesFromSeeds`, re-exported `rgb256`, `PRESET_SEEDS` data — with
  per-preset seed consts preserving tree-shaking). Kitchen-sink `controls/slider` story added. Full
  `yarn verify` green (core 688 · ui 1456 · smoke 49). Spec-first throughout (ST-1…ST-11).
- 2026-07-08: **PL-01 → PLAN CREATED** 📋 (`make_plan`). Preceded by an approved visual mockup and three
  codebase-recon passes (theming core API · ui widget inventory · package scaffolding). **Zero-Ambiguity
  Gate PASSED (AR-1…AR-25):** 9 individually-chosen decisions (edit model = aliases+role-overrides · picker
  = RGB sliders+hex+swatches · Slider→`@jsvision/ui` · both orientations · **extract shared ScrollBar track
  math** · open/save via `@jsvision/files` FileDialog · curated-gallery preview · keep only the `demo:themes`
  headless walkthrough · defer HSL/undo/splitters/custom-presets) + 16 bulk-accepted (package/app/security/
  testing recommendations). 8 plan docs. Scope is additive-only to shipped packages: `defaultTheme` gains 2
  roles (byte-freeze updated; golden/a11y unaffected), `ScrollBar` public behavior unchanged. Cascaded to the
  portfolio roadmap.
