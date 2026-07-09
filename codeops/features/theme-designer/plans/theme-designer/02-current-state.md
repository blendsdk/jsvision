# Current State: Theme Designer

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists to reuse (verified by recon)

**`@jsvision/core` theming (complete):**
- `createTheme(options: ThemeOptions): Theme` — 16 aliases → 63 roles; `ThemeOptions` = `{ mode, accent, neutral?, danger?, warning?, success?, info?, overrides?: Partial<ThemeColors>, roleOverrides?: Partial<Theme> }`. `overrides` re-drives roles; `roleOverrides` is a final per-role field patch. (`color/create-theme.ts`)
- `ThemeColors` — the 16 alias tokens: `foreground`, `foregroundMuted`, `foregroundDisabled`, `foregroundOnAccent`, `background`, `backgroundRaised`, `backgroundSunken`, `backgroundSelected`, `accent`, `accentMuted`, `border`, `borderMuted`, `danger`, `warning`, `success`, `info`. (`color/aliases.ts`)
- `Theme` — a fixed-key map of **63** role names → `ThemeRole {fg, bg, hotkey?, attrs?}` (some roles add `border`/`title`/`icon`/`pattern`). (`color/theme.ts`)
- `contrastRatio(a, b): number` — WCAG ratio 1..21, **returns NaN** when either color is `'default'`/unresolvable; never throws. (`color/contrast.ts`)
- `serializeTheme(theme): string` / `parseTheme(json): Theme` / `InvalidThemeError` — `{version:1, roles:{…}}` envelope, canonical key order (byte-identical for equal themes), pure `JSON.parse`, enforces the exact 63-role contract, never a partial theme. (`color/serialize.ts`)
- `toRgb(color): Rgb | null` — accepts `#rgb`/`#rrggbb`, the 16 `Ansi16Name`s, and `'default'` (→ null). Rejects `rgb()`/CSS names (throws `InvalidColorError`). No HSL anywhere. (`color/color.ts`)
- `nearest256`/`nearest16` (redmean), `PALETTE` (DOS-16 hex), `ANSI16_ORDER`, `ColorDepth = 'mono'|'16'|'256'|'truecolor'`. (`color/downsample.ts`, `palette.ts`)
- 7 presets: `turboVisionTheme` (=`defaultTheme`), `monochromeTheme`, `slateTheme`, `nordTheme`, `draculaTheme`, `solarizedDarkTheme`, `gruvboxDarkTheme`. (`color/presets.ts`)

> **⚠️ Gaps in the reusable surface (verified by recon — this feature closes them additively):**
> - `aliasesFromSeeds(options) → ThemeColors` (the seeds→16-alias step) is **internal** to `create-theme.ts`
>   and not exported; the model needs it to resolve/display aliases. **Export it.** (PF-001)
> - `rgb256(index) → Rgb` exists in `palette.ts` but is **not** re-exported from the barrel; `depthSamples`
>   needs it. **Re-export it.** (PF-005)
> - `defaultTheme`/`turboVisionTheme` is a **hand-authored DOS-16 literal** — it has *no* alias/seed form, so
>   it (and `monochromeTheme`) can only be adopted as a **role snapshot**, not alias-edited. (PF-001/003)
> - The 5 derived presets bake their seed sets into `createTheme(...)` calls (not exported as data). Expose
>   those seed sets (or hold a small in-model table) so they load into derive mode. (PF-003)

**`@jsvision/files` open/save idiom:** the package ships a higher-level **`openFile(host, { save })`** opener
(add-window → `execView` → remove-window → `Promise<string | null>`) + `errorBox` — reuse these instead of
driving `FileDialog` by hand. (PF-007)

**`@jsvision/ui` widgets (reuse):**
- `ColorSwatch` (palette grid, `value: Signal<Color>`, `onInput`/`onChange`) and `ColorPicker` (chip + swatch + hex `Input`). (`color/`)
- `Input` + validators (`filter`/`range`/`lookup`/`picture`); live per-keystroke charset filtering; `filter('#0-9a-fA-F')` is the current hex approach. (`controls/input.ts`, `controls/validators/`)
- `Dialog`, `messageBox(host,…)`, `confirm`, `inputBox`, standard buttons; `ModalDialogHost` seam satisfied by an `Application`. (`dialog/`)
- App shell: `createApplication(opts)` → `Application {desktop, loop, onCommand, setTheme, run}`; menu/status builders; `Window`; flex layout via `Group` + `LayoutProps` (`fr`/`fixed`/`absolute`/`fill`). (`app/`, `menu/`, `status/`, `layout/`)
- `ScrollBar` — the closest existing value control: `value: Signal<number>`, `min`/`max`, `orientation: 'vertical'|'horizontal'`, proportional thumb-drag with pointer capture, track-click, wheel, `setRange(min,max,…)`. (`scroll/scroll-bar.ts`)

**`@jsvision/files` (reuse):** `FileDialog` (real open/save browser, sanitizes filenames) + `nodeFileSystem`.

**Existing designer to lift from:** `packages/examples/themes-demo/designer.ts` (pure state machine: `currentTheme`/`cycleAccent`/`cycleMode`/`cycleDepth`/`exportJson`/`contrastWarnings`, with `CONTRAST_PAIRS`) + `main.ts` (TTY-split host, `previewWidgets`, `capsFor`, `printFrame`).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/engine/color/theme.ts` | 63-role `Theme` + `defaultTheme` | **+2 roles** `sliderTrack`/`sliderThumb` |
| `packages/core/src/engine/color/presets.ts` | 7 presets | ensure the 2 new roles derive/appear (createTheme-based presets get them via `rolesFromAliases`; hand-authored `defaultTheme`/`monochromeTheme` get literals); **expose the 5 derived presets' seed sets as data** (PF-003) |
| `packages/core/src/engine/color/roles.ts` | `rolesFromAliases` (alias→63 roles) | **+2 role mappings** for the new roles |
| `packages/core/src/engine/color/create-theme.ts` | `aliasesFromSeeds` (internal) | **export `aliasesFromSeeds`** (seeds→16 aliases) (PF-001) |
| `packages/core/src/engine/color/{index.ts}` + `engine/index.ts` | public barrels | **re-export `rgb256`** (PF-005) + `aliasesFromSeeds` + preset seed data |
| `packages/ui/src/scroll/scroll-bar.ts` | ScrollBar value control | refactor value↔position/drag/clamp to use the new shared helper |
| `packages/ui/src/controls/` | leaf controls | **new** `track.ts` (pure helper), `slider.ts` (`Slider`) |
| `packages/ui/src/index.ts` | barrel | export `Slider`/`SliderOptions` |
| `packages/examples/kitchen-sink/stories/` | stories | **new** `slider.story.ts` + registry line |
| `packages/examples/themes-demo/main.ts` | old designer host | drop the live-TTY branch; keep the headless walkthrough |
| `packages/theme-designer/**` | the app | **new package** |
| `.github/workflows/ci.yml` | CI | add the new package's `test:e2e` step |
| root `package.json` | scripts | add a `demo:theme-designer`/passthrough convenience script |

## Gaps Identified

### Gap 1: No interactive Slider
**Current:** `ScrollBar` is `focusable:false`, mouse-only, and renders as a scrollbar (end-arrows/track). `ProgressBar` is passive.
**Required:** a focusable, keyboard-driven, groove+thumb `Slider`, both orientations.
**Fix:** extract the pure track math (shared with ScrollBar), build `Slider` on it; add `sliderTrack`/`sliderThumb` roles. (AR-3, AR-9, AR-18)

### Gap 2: No 24-bit picker with channel sliders
**Current:** the only truecolor entry surface is `ColorPicker`'s hex `Input`; no per-channel control.
**Required:** R/G/B sliders + hex + swatch, synchronized.
**Fix:** compose three `Slider`s + a hex `Input` (custom `#rrggbb` validator) + a `ColorSwatch` in the inspector. (AR-2)

### Gap 3: No published-app / `bin` precedent
**Current:** every runnable thing is a private `tsx <file>` demo inside `@jsvision/examples`; no package builds a `bin`.
**Required:** a standalone package identity.
**Fix:** a new private package launched via a `start` script; publish (with `bin`) deferred until `@jsvision/ui` is public. (AR-10)

### Gap 4: No HSL math
Out of scope for v1 (AR-7); noted so the picker is specced RGB-only.

## Dependencies

### Internal
- `@jsvision/core` (theming + downsample), `@jsvision/ui` (widgets, app shell, the new `Slider`), `@jsvision/files` (FileDialog).

### External
- Dev-only: `tsx`, `vitest`, `@types/node` (mirroring `packages/core`). No runtime deps.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| ScrollBar regression from the track-math extraction | Med | High | The helper is pure; ScrollBar's existing spec/impl tests are the unchanged regression oracle (AR-9). |
| `defaultTheme` byte drift from the 2 new roles breaks golden/a11y/`*-theme.spec` | Med | High | New roles are purely additive keys; update the byte-freeze spec deliberately; golden screens never reference the new roles. (AR-18) |
| Import adopting a file's roles vs. later alias re-derivation is confusing | Med | Med | Documented "roles authoritative until next alias edit" model (AR-25); covered by ST cases. |
| CI e2e/pack steps are name-hardcoded | Low | Med | Plan explicitly edits `ci.yml` for the new package's `test:e2e` (AR-22). |
| Scope creep toward a full color-management app | Med | Med | Deferrals fixed in AR-7; acceptance criteria bound v1. |
