# Preflight Report: Theme Designer

> **Artifact**: `codeops/features/theme-designer/plans/theme-designer/` (full plan set)
> **Scanned**: 2026-07-08 · CodeOps Skills 3.3.2
> **Reviewer session**: fresh session (artifact authored in a prior session — review independence OK)
> **Outcome**: ✅ PASSED — all 10 findings (4 MAJOR, 5 MINOR, 1 OBSERVATION) accepted and applied to the
> plan (2026-07-08). PF-001/002/003/005/006/009 → Unified Resolution (two-mode model + 3 additive core
> exports); PF-004 → R7 scoped to the sample strip; PF-007 → reuse `openFile`/`errorBox`; PF-008 → path
> fixed; PF-010 → wording corrected (barrel-less package is skipped by `check-jsdoc`, so no dead script).

## Codebase Context Summary

Grounded against the real code (not just the docs):

- **`@jsvision/files` exists** (`packages/files/`) with `FileDialog`, `nodeFileSystem`, `FileSystem`,
  and a higher-level `openFile(host,{save})` / `changeDir` opener + `errorBox`. (CLAUDE.md doesn't
  list this package, but the plan's dependency on it is sound.)
- **`check:docs` is a real script** (`turbo run check:docs` → `scripts/check-jsdoc.mjs .`), wired into
  `yarn verify`. `core`/`ui`/`files` define it; `examples` does **not**.
- **`yarn verify` already runs `lint` + `check:docs`** (`yarn lint && turbo run typecheck build test
  check:docs`) — the plan's repeated "verify + lint + check:docs" is redundant but harmless. (A user
  memory claiming verify excludes lint is stale.)
- **Theme = exactly 63 roles** (verified) · **`ThemeColors` = exactly 16 aliases** (verified).
  `sliderTrack`/`sliderThumb` are absent (good). `defaultTheme` + `monochromeTheme` are **literal**
  `Theme`s; the other 5 presets are `createTheme(...)`-derived.
- **Core exports verified present**: `createTheme`, `rolesFromAliases`, `serializeTheme`, `parseTheme`,
  `InvalidThemeError`, `contrastRatio` (returns NaN, never throws), `nearest256`, `nearest16`,
  `PALETTE`, `ANSI16_ORDER`, `toRgb`, `ColorDepth`, `ThemeColors`, `Theme`, `ThemeRole`, `ThemeOptions`.
- **Core exports verified MISSING**: `rgb256` (exists in `palette.ts`, NOT re-exported from the barrel),
  `PresetName` (no such type), and any resolved `ThemeColors` value / exported `aliasesFromSeeds`
  (both internal).
- **`ScrollBar`** value↔position math is inline (`getSize()-2` groove, thumb ∈ `[1,size-2]`, proportional
  thumb) — the extraction target. Regression oracle is `packages/ui/test/scrollbar.{spec,impl}.test.ts`
  (note: **no hyphen**, unlike the plan's `scroll-bar.impl.test.ts`).
- **App has a single `RenderRoot` whose `caps` is `private readonly`** (immutable); `setTheme` swaps the
  theme only. There is no runtime depth/caps switch on the app RenderRoot.
- **Existing `themes-demo/designer.ts` is seed-based** (`{mode, accent, neutral?, status, depth}` →
  `createTheme`), materially different from the plan's alias-centric model. Its e2e only exercises the
  piped/walkthrough path, so retiring `runLive()` is low-risk.

## Unified Resolution (revised after re-check — recommended)

PF-001, PF-002, PF-003 (and PF-005/006/009) share **one root cause**: the model is single-mode
alias-centric, but the core theming API is asymmetric — you can go **seeds → Theme**, never **Theme →
aliases**, and `defaultTheme`/`monochromeTheme`/imported files are **hand-authored/opaque `Theme`s with no
alias form** (verified: `defaultTheme` is a raw `PALETTE.*` literal, not `createTheme`-derived; the 5 other
presets *are* clean `{mode, accent, neutral, overrides}` seed sets with no `roleOverrides`). Patching each
symptom leaves the model brittle. The robust fix is a **two-mode `DesignerState`**:

- **`derive` mode** — `{ seeds: {mode, accent, neutral?, danger?…}, aliasOverrides: Partial<ThemeColors>,
  roleOverrides: Partial<Theme> }`; `theme()` = `createTheme({ …seeds, overrides: aliasOverrides,
  roleOverrides })`. Resolved alias chips/`colorOf` use an exported `aliasesFromSeeds`. "Fresh"/`reset()` =
  default seeds (a **generated** palette — *not* the DOS-16 `defaultTheme`). The **5 derived presets** load
  here (seed sets), so alias editing works immediately.
- **`roles` mode** — the 63 roles verbatim, entered by **import** *and* by loading a literal `Theme`
  (`defaultTheme`/`turboVisionTheme`/`monochromeTheme`). `theme()` = those roles. The first `setAlias`/seed
  edit **transitions to `derive`** and drops the role snapshot (keeping only explicit user role-edits) — no
  masking bug.

Additive **core** surface this needs (supersedes the "exactly two roles" claim): export `aliasesFromSeeds`
(or a resolved `defaultAliases`), export `rgb256`, and expose the 5 derived presets' **seed sets** as data
(or accept a small in-model table). All additive, no behavior change to shipped packages.

The per-finding recommendations below are folded into this unified resolution.

## Findings

### 🟠 MAJOR

**PF-001 — The alias-centric model has no source for resolved `ThemeColors`.**
`DesignerState.aliases: ThemeColors` holds all **16 resolved** aliases; `theme()` derives via
`createTheme({ overrides: aliases, … })`; `reset()` = "defaultTheme aliases"; `colorOf(alias)` and the
left-rail chips ("color chip + name + hex" per 03-03) all need concrete resolved alias colors. But core
exposes only **seeds→Theme** (`createTheme`) and **Theme** consts (`defaultTheme`/presets);
`aliasesFromSeeds` is internal and there is **no exported resolved `ThemeColors` value**. Aliases are not
roles, so they cannot be read back off `theme()` (63 roles). The model therefore cannot initialize, reset,
or display its 16 aliases via any reuse path. **Corrected on re-check:** `reset()` → "defaultTheme aliases"
is *not well-defined* — `defaultTheme` is a hand-authored DOS-16 literal with **no alias form**, and
`aliasesFromSeeds` yields a *different* generated ramp palette.
_Self-challenge_: Could the model be override-only (`Partial<ThemeColors>` on seeds)? Display of an
un-overridden alias still needs its resolved value → still blocked. _Confidence: High._
→ **Resolved by the Unified Resolution** (`derive` mode + exported `aliasesFromSeeds`; `reset()` = default
*seeds* / generated palette; the exact DOS-16 look is available by loading `turboVisionTheme` in `roles`
mode).

**PF-002 — Import-adoption (AR-25) makes post-import alias edits ineffective as specified.**
Import populates `roleOverrides` from **all 63** parsed roles (R10/ST-19) and sets `rolesAuthoritative`.
`createTheme` applies `roleOverrides` **last**. AR-25 says the first `setAlias` "re-enters derive mode for
the roles that alias drives" — but with all 63 roles still in `roleOverrides` (applied last), an alias edit
is fully masked (e.g. `button.bg` stays at the imported byte). The single-boolean `rolesAuthoritative` does
not model per-role authority, and there is **no exported inverse** of `rolesFromAliases` to know which roles
an alias drives. As written, "first alias edit re-enters derive mode" cannot take visible effect.
_Self-challenge_: Does flipping `rolesAuthoritative=false` help? No — `roleOverrides` (63 roles) still wins
last. _Confidence: High._
→ **Resolved by the Unified Resolution** (cleaner than my first take): import lands in **`roles` mode** with
the 63 roles held in a **separate role snapshot**, *not* mingled into `roleOverrides`. The first alias/seed
edit transitions to `derive` mode and drops the snapshot — so the alias edit is immediately visible, no
reverse alias→roles map needed. (My earlier "build a reverse map" option is dominated by this and dropped.)

**PF-003 — `loadPreset` cannot map a resolved preset `Theme` into alias-centric state.**
The 5 `createTheme`-derived presets don't export their seed aliases; `defaultTheme`/`monochromeTheme` are
literal `Theme`s with **no seeds at all**. So `loadPreset('nord')` cannot populate `aliases: ThemeColors`
from `nordTheme`. Adopting the 63 roles import-style contradicts AR-16's "seed a **starting point** for
alias editing" (the rail would show stale default alias chips over a Nord preview) and re-triggers PF-002.
The plan (03-02 `loadPreset`) does not specify the mapping. _Confidence: High._
Verified: the 5 derived presets are clean `{mode, accent, neutral, overrides}` seed sets (no `roleOverrides`),
so they map exactly to `derive` mode.
→ **Resolved by the Unified Resolution**: the 5 derived presets load as **seed sets** into `derive` mode
(alias editing works immediately); `defaultTheme`/`monochromeTheme` load into **`roles` mode** (role-adopt).
Expose the 5 seed sets as core data (DRY) or hold a small in-model table.

**PF-004 — R7 "re-render the whole preview at a chosen ColorDepth" has no feasible mechanism as hinted.**
03-03 says "the preview `RenderRoot`/app caps are pinned to `model.state().depth`", but the app's
`RenderRoot.caps` is `private readonly` and `setTheme` changes only the theme — neither switches depth at
runtime. The depth **sample strip** (4 hex swatches via `depthSamples`) is fine (pure math). The
whole-gallery re-render needs one of: (a) an independent **nested `RenderRoot` → `SurfaceView`** at the
chosen caps (real, unplanned complexity), (b) **theme quantization** (map every role's fg/bg through
`nearest256`/`nearest16` to concrete hex, then `setTheme`) — feasible without caps changes but applies
app-wide, or (c) rebuild the whole app on toggle. _Confidence: High that the hinted mechanism fails; the
alternatives are viable but must be chosen and scoped._
- **Option A (recommended)** — scope R7 to the depth-**sample strip** only (drop whole-gallery re-render);
  it still satisfies "preview the selected color at each depth."
- **Option B** — commit to theme-quantization (whole-app preview at depth) and add the task; simplest of the
  full-re-render options.
- **Option C** — nested `RenderRoot`→`SurfaceView` preview (most faithful, most work).

### 🟡 MINOR

**PF-005 — `rgb256` is not exported from the core barrel** but `depthSamples` 256 row (ST-17,
`rgb256(nearest256(rgb))`) needs it. One-line additive export missing from the plan. (Dependency Reality)

**PF-006 — "Additive-only = exactly two new roles" (Tech Reqs / AC-3) understates the real additive core
surface.** The plan also needs `rgb256` exported (PF-005) and an aliases source (PF-001). Reword the claim
to "two new roles + N additive exports". (Consistency)

**PF-007 — File I/O reinvents the existing `openFile(host,{save})` opener.** `@jsvision/files` already
ships `openFile`/`changeDir` (add-window → `execView` → remove-window, returns `Promise<string|null>`) and
`errorBox`. 03-03's `file-io.ts` describes the manual dance. Recommend reusing `openFile` + `errorBox`.
(Redundancy / Convention)

**PF-008 — Phantom test-file path.** 07 references `packages/ui/test/scroll-bar.impl.test.ts` (ST-10
regression oracle); the actual file is `scrollbar.impl.test.ts` (no hyphen). Fix the reference. (Phantom
Reference)

**PF-009 — `PresetName` type doesn't exist.** 03-02 `loadPreset(name: PresetName)` references a type core
does not export; the model must define its own preset registry/union (ties to PF-003). (Convention)

### 🔵 OBSERVATION

**PF-010 — `theme-designer` omits a `check:docs` script** (matching `examples`), so its `src/` is never
scanned for banned CodeOps/TV references — despite 03-04 asserting it "obeys the banned-reference rule."
Enforcement is manual only. Matches the `examples` precedent; add `check:docs` if enforcement is wanted.

## Notes

- Dimensions with **no findings**: Security (hex validator + `parseTheme` JSON-only + sanitized filenames
  are sound), Testability (ST cases are concrete and traceable), Ordering (preset role-derivation sequencing
  is correct), Scope Creep (deferrals are firmly bounded in AR-7).
- PF-001, PF-002, PF-003 (+ PF-005/006/009) share one root cause and are jointly resolved by the **Unified
  Resolution** above (two-mode model + three additive core exports). PF-004 is an independent rendering
  decision; PF-007/008/010 are standalone cleanups.
