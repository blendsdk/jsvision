# Requirements: Theme Designer

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> This is a standalone plan — this document is the OWNING requirements doc (no upstream RD).

## Feature Overview

A standalone terminal application for authoring `@jsvision/core` themes. It presents a full-screen
three-pane workspace (roles rail · live preview · color inspector) under a menu bar and status bar,
matching the approved visual mockup. Editing any color repaints a curated gallery of themed widgets
live; the inspector offers RGB sliders, a `#rrggbb` hex field, and the DOS-16 swatch grid; WCAG
contrast is scored continuously; the selected color previews at every color depth; the 7 built-in
presets seed a starting point; and themes import/export to JSON through a real file dialog.

The app is the first-class consumer proof of the theming system shipped previously, and dogfoods the
widget framework it themes. It supersedes the interactive half of the `demo:themes` walkthrough.

## Functional Requirements

### Must Have

- [ ] **R1 — Alias editing.** Edit the 16 semantic aliases (`accent`, `background`, `foreground`, …); every edit re-derives all 63 roles via `createTheme` and repaints the preview. (AR-1)
- [ ] **R2 — Role overrides.** An advanced mode edits any of the 63 roles directly; a role edit becomes a `roleOverrides` entry applied last, surviving alias re-derivation until cleared. (AR-1, AR-13, AR-25)
- [ ] **R3 — Color inspector.** For the selected alias/role: draggable **R/G/B sliders** (0–255, keyboard + mouse), a live-validated **`#rrggbb` hex field**, and the **DOS-16 swatch grid**; all three stay in sync and drive the model. (AR-2, AR-13)
- [ ] **R4 — Reusable `Slider`.** A new `Slider` control in `@jsvision/ui`, horizontal **and** vertical, focusable, keyboard + mouse + drag + wheel, `onInput`/`onChange`, groove+thumb look, using new `sliderTrack`/`sliderThumb` roles. Shares its value↔position math with `ScrollBar` via one extracted pure helper. (AR-3, AR-8, AR-9, AR-17, AR-18)
- [ ] **R5 — Live preview.** A curated widget gallery (window/frame, menu strip, buttons, input, checkboxes, radio, list with selection, progress bar, status line) rendered with the live theme, repainting on every edit via `Application.setTheme`. (AR-5, AR-12)
- [ ] **R6 — WCAG contrast.** A warn-only panel scoring the key text/background role pairs with ratio + AA (≥4.5)/AAA (≥7) badges; pairs whose color is `'default'` (NaN) are skipped, never flagged. (AR-14)
- [ ] **R7 — Depth preview.** The selected color shown downsampled to truecolor/256/16/mono (a display-only sample strip via `depthSamples`). (AR-15) — _the whole-preview re-render at a chosen `ColorDepth` is dropped: the app has a single `RenderRoot` whose `caps` is immutable, so it has no feasible in-scope mechanism (see 00-preflight-report PF-004)._
- [ ] **R8 — Presets.** Load any of the 7 built-in presets as a starting point (replacing current edits, guarded when dirty). (AR-16)
- [ ] **R9 — Export.** Serialize the current theme to a JSON file at a FileDialog-chosen path. (AR-4, AR-20, AR-21)
- [ ] **R10 — Import.** Open + parse a theme JSON via FileDialog and adopt it; an invalid/unparseable file shows a `messageBox` error and leaves the current theme untouched. (AR-4, AR-20, AR-21, AR-25)
- [ ] **R11 — Unsaved-changes guard.** A `dirty` flag guards load-preset, open-file, and quit with a confirm; cleared on load/import/export-save. (AR-24)
- [ ] **R12 — Headless mode.** Piped (no TTY), the app runs a narrated walkthrough that composes and prints ASCII frames for each step (the e2e path), mirroring the repo's demo pattern. (AR-11, AR-22)
- [ ] **R13 — Package.** A new private `@jsvision/theme-designer` package, auto-discovered by the workspace, launched via `start` (`tsx src/main.ts`). (AR-10)

### Should Have

- [ ] **R14 — Menu + status affordances.** File (Open/Save/Save As/Quit), Theme (presets, reset), View (preview depth) menus, and a status line mirroring the mockup's key bindings. (AR-12)
- [ ] **R15 — Slider kitchen-sink story.** `controls/slider` story + smoke test. (AR-19)

### Won't Have (Out of Scope — deferred, AR-7)

- HSL/HSV sliders and the HSL⇄RGB math they need.
- Undo/redo (edit-history stack).
- Draggable panel splitters (resize panes by dragging dividers).
- A persistent **custom named-preset library** (plain export-to-file still ships).
- Publishing the package to npm (blocked by the private `@jsvision/ui` dependency; graduates later — AR-10).
- Named-color / `rgb()` text entry (only `#rrggbb` + named-via-swatch + `'default'`).

## Technical Requirements

### Architecture / Compatibility

- ESM-only, NodeNext `.js` specifiers, `strict` TypeScript; no unsafe casts. Node ≥ 20.
- `@jsvision/core` stays **pure** — zero filesystem I/O; all fs lives in the app host layer. (AR-21)
- Additive-only to shipped packages (no behavior change): `@jsvision/core` gains two new roles
  (`sliderTrack`, `sliderThumb`) **and** three new public exports the designer model needs —
  `aliasesFromSeeds` (resolve seeds→16 aliases), `rgb256` (already in `palette.ts`, not yet re-exported),
  and the 5 derived presets' **seed sets** as data; `ScrollBar`'s public behavior is unchanged after the
  track-math extraction. (AR-9, AR-18; see 00-preflight-report PF-001/004/005/006)
- Reuse over rebuild: `createTheme`/`aliasesFromSeeds`/`serializeTheme`/`parseTheme`/`contrastRatio`/`nearest256`/`nearest16`/`rgb256`/`toRgb` (core); `ColorSwatch`/`Input`+validators/`Dialog`/`messageBox`/`Application`/`setTheme`/flex layout (ui); `FileDialog`/`openFile`/`errorBox` (files).

### Security

- All color input is core `Color` and flows through `toRgb`; the hex field uses a `#rrggbb`-well-formed custom validator (charset alone is insufficient). (AR-20)
- Import is `parseTheme` — pure `JSON.parse`, no `eval`, enforcing the exact 63-role contract; malformed input yields a typed error surfaced as a `messageBox`, never a crash or partial adoption. (AR-20)
- Filenames come from `@jsvision/files` (which sanitizes names); no path is built from unsanitized user text. (AR-21)
- Every value written into the screen buffer passes the framework's existing `sanitize` boundary (unchanged; inherited from the widgets used).

### Performance

- Edits coalesce to one repaint per tick via the existing `setTheme` → `markRelayout` → `runTick` seam (no new perf work). Preview is a bounded, fixed-size gallery.

## Scope Decisions

| Decision | Options Considered | Chosen | AR Ref |
| -------- | ------------------ | ------ | ------ |
| Edit granularity | aliases / roles / both | both (alias-first + role overrides) | AR-1 |
| Color inputs | RGB+hex+swatch / +HSL / reuse picker | RGB+hex+swatch | AR-2 |
| Slider home | ui / app-local | `@jsvision/ui` | AR-3 |
| Slider orientation | horizontal / both | both | AR-8 |
| Slider ↔ ScrollBar | extract / mirror | extract shared math | AR-9 |
| Open/Save | FileDialog / inputBox / fixed | FileDialog | AR-4 |
| Preview | gallery / reuse / live-app | curated gallery | AR-5 |
| Package | private pkg / examples | private `@jsvision/theme-designer` | AR-10 |
| `demo:themes` | keep-walkthrough / retire / both | keep headless walkthrough only | AR-6 |
| Deferrals | — | HSL, undo, splitters, custom presets | AR-7 |

> **Traceability:** every scope decision references its Ambiguity Register entry. See `00-ambiguity-register.md`.

## Acceptance Criteria

1. [ ] R1–R13 met; R14–R15 met.
2. [ ] `Slider` (both orientations) passes its spec + impl tests and its `controls/slider` smoke test; `ScrollBar`'s existing tests still pass unchanged after the refactor.
3. [ ] `defaultTheme` gains only `sliderTrack`/`sliderThumb` (plus the additive core exports `aliasesFromSeeds`/`rgb256`/preset seed data — no role-byte change from those); the existing `*-theme.spec` byte-freeze oracles and golden/a11y suites stay green.
4. [ ] The pure `DesignerModel` passes its spec tests (derive, override, preset, contrast, depth, serialize round-trip, import validation, dirty state).
5. [ ] The app runs live on a TTY and, piped, prints composed frames for a full walkthrough (the e2e).
6. [ ] Import of a malformed theme shows an error and does not change the current theme or crash.
7. [ ] `yarn verify` + `yarn lint` + per-package `typecheck` + `check:docs` all green; new-package `test:e2e` wired into CI.
8. [ ] No banned references (CodeOps IDs / TV provenance) in shipped `packages/*/src`; every new public `@jsvision/ui` export (`Slider`) carries an `@example`.
