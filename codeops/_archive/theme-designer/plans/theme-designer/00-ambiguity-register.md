## Ambiguity Register: Theme Designer

> **Status**: ✅ GATE PASSED — all 25 items resolved · **AR-15/16/25 revised by preflight** (see `00-preflight-report.md`)
> **Last Updated**: 2026-07-08
> **Feature**: theme-designer · standalone plan (no upstream RD; `01-requirements.md` owns requirements)

All decisions are the user's, captured live. Items AR-1…AR-9 were individually chosen; AR-10…AR-25
were presented as recommendations and **bulk-accepted** ("accept all") — each records the spelled-out
recommended option per the Zero-Ambiguity Gate bulk-acceptance rule.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Behavioral | What can be edited — aliases, roles, or both? | Aliases+role-overrides / Aliases only / Raw 63 roles | **Aliases + role overrides** — edit the 16 aliases (re-derive all roles via `createTheme`) plus an advanced per-role override mode | ✅ Resolved |
| 2 | UX & presentation | Color-input controls in the picker | RGB sliders+hex+swatches / +HSL / reuse ColorPicker only | **RGB sliders + hex + DOS-16 swatches** | ✅ Resolved |
| 3 | Technical | Where the new Slider control lives | Add to `@jsvision/ui` / app-local | **Reusable `Slider` in `@jsvision/ui`** (+ kitchen-sink story) | ✅ Resolved |
| 4 | Integration | Open/save theme files | `@jsvision/files` FileDialog / `inputBox` path / fixed `theme.json` | **`@jsvision/files` FileDialog** | ✅ Resolved |
| 5 | UX & presentation | What the live-preview pane renders | Curated widget gallery / reuse themes-demo widgets / live mini-app | **Curated widget gallery** (window, menu, buttons, inputs, list, checks, progress, status) | ✅ Resolved |
| 6 | Scope | Fate of the existing `demo:themes` designer | Keep headless walkthrough only / retire / keep both | **Keep the headless walkthrough only** — drop its live-TTY branch; lift its contrast/preset logic into the new app | ✅ Resolved |
| 7 | Scope | What is OUT of v1 (deferred) | (multi) HSL / undo-redo / splitters / custom presets | **Defer all four**: HSL sliders, undo/redo, draggable splitters, custom named-preset library | ✅ Resolved |
| 8 | Behavioral | Slider orientation | Horizontal only / both | **Both vertical and horizontal** (an `orientation` option, like `ScrollBar`) | ✅ Resolved |
| 9 | Technical | How Slider shares logic with ScrollBar | Extract shared track math / mirror fresh | **Extract the pure value↔position/drag/clamp math into one shared helper**; refactor `ScrollBar` to use it (its behavior tests guard the refactor) | ✅ Resolved |
| 10 | Technical / Naming | Package shape & publish status | — | ✅ Resolved — User accepted recommendation: a new **private** package `@jsvision/theme-designer` at `packages/theme-designer/` with its own `tsconfig`/`vitest`/`build`, deps on `@jsvision/core`+`@jsvision/ui`+`@jsvision/files`, launched via a workspace `start` script (`tsx src/main.ts`). Cannot publish while `@jsvision/ui` is private; graduates to a published `bin` CLI later. | ✅ Resolved |
| 11 | Technical | App architecture | — | ✅ Resolved — User accepted recommendation: a **pure, headless-testable model** (owns aliases + role overrides + selected target + preview depth; derives the live `Theme` via `createTheme`) separated from the **view/shell**. | ✅ Resolved |
| 12 | UX & presentation | App layout | — | ✅ Resolved — User accepted recommendation: the approved mockup — full-screen desktop, menu bar + status bar, three flex panels (roles rail · live preview · inspector); panels are framed Groups (not movable Windows); FileDialog/messageBox are the only modals. No draggable splitter (deferred, AR-7). | ✅ Resolved |
| 13 | Behavioral | Editing-target selection | — | ✅ Resolved — User accepted recommendation: left rail lists the 16 aliases + an "Advanced roles" section; selecting one loads it into the inspector picker; alias edits re-derive all roles, role edits become `roleOverrides`. | ✅ Resolved |
| 14 | Behavioral | Contrast panel | — | ✅ Resolved — User accepted recommendation: warn-only (never auto-adjusts); shows ratio + AA (≥4.5)/AAA (≥7) badges for the key text/bg role pairs; silently skips pairs whose color is `'default'` (`contrastRatio` → NaN). | ✅ Resolved |
| 15 | Behavioral | Depth panel | — | ✅ Resolved — shows the **selected** color downsampled to truecolor/256/16/mono (via `nearest256`/`nearest16`/`rgb256`) as a **display-only sample strip**. _Revised by preflight PF-004: the whole-preview re-render at a chosen `ColorDepth` is **dropped** — the app's single `RenderRoot` has immutable `caps`, so there is no in-scope mechanism._ | ✅ Resolved (revised) |
| 16 | Behavioral | Presets | — | ✅ Resolved — load any of the 7 built-ins as a starting point (replaces current edits, guarded by an unsaved-changes confirm); read-only list (custom library deferred, AR-7). _Revised by preflight PF-003: the **5 derived presets** load as seed sets into **derive** mode (alias-editable); the **2 literal presets** (`turbo-vision`/`monochrome`) load as a **role snapshot** into **roles** mode._ | ✅ Resolved (revised) |
| 17 | Behavioral | Slider interaction spec | — | ✅ Resolved — User accepted recommendation: `value: Signal<number>` + min/max/step; focusable + keyboard (arrows ±step, Home/End, PgUp/PgDn ±page), click-to-position, drag with pointer capture, wheel; groove+thumb look (no end-arrows); `onInput` (live) / `onChange` (commit). | ✅ Resolved |
| 18 | Data & state | Slider theme roles | — | ✅ Resolved — User accepted recommendation: add `sliderTrack` + `sliderThumb` core roles (byte-frozen by a theme spec), consistent with how `progress*`/`tab*` roles were added; delivered by this feature, shipped in `@jsvision/core`+`@jsvision/ui`. | ✅ Resolved |
| 19 | Scope | Kitchen-sink coverage | — | ✅ Resolved — User accepted recommendation: `Slider` gets a `controls/slider` story + smoke (mandatory); the app itself gets no story (it is an application, not a widget). | ✅ Resolved |
| 20 | Security | Colors, validation, import errors | — | ✅ Resolved — User accepted recommendation: all colors are core `Color` (`#rrggbb` / 16 named / `'default'`); hex field uses a small custom `#rrggbb` validator; import uses `parseTheme` (JSON-only, no eval, full 63-role contract); an invalid/unparseable file → a `messageBox` error, never a crash, current theme kept. | ✅ Resolved |
| 21 | Security / Integration | Filesystem I/O boundary | — | ✅ Resolved — User accepted recommendation: **all fs I/O lives in the app's host layer**; `@jsvision/core` stays pure; paths come from `@jsvision/files` (which sanitizes filenames). | ✅ Resolved |
| 22 | Non-functional / Testing | Test strategy + verify command | — | ✅ Resolved — User accepted recommendation: spec-first; verify = `yarn verify` (+ `yarn lint`, per-package `typecheck`, `yarn workspace @jsvision/theme-designer test:e2e`); pure-model unit tests, `Slider` spec+impl, app **headless-walkthrough e2e**; CI e2e step extended for the new package. | ✅ Resolved |
| 23 | Naming | New symbol / file names | — | ✅ Resolved — User accepted recommendation: `Slider`/`SliderOptions` in `packages/ui/src/controls/slider.ts`; the shared pure helper in `packages/ui/src/controls/track.ts` (`trackGeometry`); the app's model `DesignerModel` (`packages/theme-designer/src/model/`); the app has **no** public `src/index.ts` barrel (so `check:docs` is a no-op for it, like `examples`). Names may be refined during authoring without re-gating (cosmetic). | ✅ Resolved |
| 24 | Edge cases | Unsaved-changes / dirty-state guard | — | ✅ Resolved — User accepted recommendation: a `dirty` flag set on any edit and cleared on load/import/export-save; a confirm dialog guards **load-preset, open-file, and quit** when dirty; FileDialog cancel is a no-op. | ✅ Resolved |
| 25 | Data & state | Import adoption model | — | ✅ Resolved — importing a valid theme file adopts it as a **role snapshot** (`roleSnapshot`), the file being authoritative for exact bytes; the first alias/seed edit transitions to derive mode and drops the snapshot, so the edit is immediately visible. _Revised by preflight PF-002: the snapshot is a **separate field**, NOT merged into `roleOverrides` (which is applied last and would mask alias edits); this eliminates the masking bug and needs no reverse alias→roles map._ | ✅ Resolved (revised) |
| 26 | Behavioral (runtime) | The `depth` panel's **16-color** sample hex — the plan formula `PALETTE[ANSI16_ORDER[nearest16(rgb)]]` is invalid (`PALETTE` is keyed by Borland names, `ANSI16_ORDER` yields ANSI names → `undefined` for 8/16 colors + a typecheck error). | A) xterm ANSI-16 reference hex `rgb256(nearest16)` / B) Borland DOS-16 hex for the emitted slot (fixed CGA reindex of `PALETTE`) / C) nearest-match over `PALETTE` (can pick a different slot — rejected) | **B — Borland/DOS-16 hex for the emitted slot.** Both A and B agree on the slot `nearest16` emits; B draws that slot's DOS-16 color so the depth strip stays in the same Borland-`PALETTE` vocabulary as the swatch grid. Implemented as `PALETTE[DOS16_BY_SLOT[nearest16(rgb)]]` with a fixed 16-entry CGA correspondence in `depth.ts`; the ST-17 oracle encodes the same table independently. | ✅ Resolved (runtime) |

### Resolution Notes

**AR-9:** The shared helper is *pure* (no view), so refactoring `ScrollBar` to consume it is low-risk —
`ScrollBar`'s existing behavior/impl tests are the regression oracle and must stay green unchanged.

**AR-10:** Publish is blocked purely by the transitive private dependency (`@jsvision/ui`), not by choice;
the package is structured so flipping to published later is additive (add `bin` + `exports`/`types`/`files`,
drop `private`, extend CI pack). Recorded so the plan doesn't silently assume publishability.

**AR-18:** GATE-1 at implementation confirms Turbo Vision has **no** slider/trackbar class (`TScrollBar` is
the nearest analog), so `Slider` is a **documented new component** (like `ProgressBar`/`Spinner`) — its glyphs
and colors are a fresh design, not a TV decode.

**AR-25 (revised by preflight PF-002):** After import the model holds the parsed theme in a **separate
`roleSnapshot`** field (roles mode) — *not* mingled into `roleOverrides`. `theme()` returns
`applyRoleOverrides(roleSnapshot, roleOverrides)`. The first alias/seed edit clears `roleSnapshot` (→ derive
mode) and applies onto the retained seeds + `aliasOverrides`, so the edit is immediately visible; user role
edits made in roles mode survive as `roleOverrides`. This avoids the masking bug of the original design
(dumping all 63 roles into the last-applied `roleOverrides`) and needs no reverse alias→roles map.

**Preflight additive-surface note (PF-001/003/005/006):** the model's two-mode design needs three additive
`@jsvision/core` exports beyond the two slider roles — `aliasesFromSeeds` (seeds→16 aliases), `rgb256`
(re-export), and the 5 derived presets' seed sets as data. All additive; no behavior change to shipped
packages. `defaultTheme` is a hand-authored DOS-16 literal with no alias form, hence its roles-mode load.
