# Testing Strategy: Accelerator Aliases

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core alias/role mapping (business logic) | 100% of changed lines |
| Preset parity | Every generated preset (round-trip oracle + spot hotkey checks) |
| Designer rail helper | 100% |

Pure data/mapping — every changed line is deterministically testable without mocks or a TTY.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md`, `03-01`/`03-02`, and the Ambiguity Register.
> Immutable oracles: if the implementation disagrees, the implementation is wrong.
>
> `SAMPLE18` below = a fully-populated 18-token `ThemeColors` literal in which `accelerator` and
> `menuAccelerator` are set to values **distinct from** `warning`/`danger`, so a test can prove which
> alias a role reads. The in-code traceability comment on each test quotes the behavior in plain
> language — never an ST-/AR- id or a `codeops/` path (per the standards' documentation ban).

### Core — alias tier & role mapping

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `Object.keys(SAMPLE18)` | length is **18**; contains `accelerator` and `menuAccelerator`; does **not** contain `accentForeground` | R1 / AR-01,06,07 |
| ST-2 | `rolesFromAliases(SAMPLE18)` with `accelerator` distinct from `warning` | `buttonFocused.hotkey`, `tabActive.hotkey`, `tabInactive.hotkey`, `labelShortcut.fg`, `buttonShortcut.fg`, `clusterShortcut.fg` all equal `SAMPLE18.accelerator`; none equals `SAMPLE18.warning` | R2 / AR-02 |
| ST-3 | `rolesFromAliases(SAMPLE18)` with `menuAccelerator` distinct from `danger` | `menuBar.hotkey`, `menuSelected.hotkey`, `statusBar.hotkey`, `statusSelected.hotkey` all equal `SAMPLE18.menuAccelerator`; none equals `SAMPLE18.danger` | R3 / AR-02 |
| ST-4 | `createTheme({mode:'dark', accent:'#3b82f6', overrides:{warning:'#00ff00', danger:'#ff0000'}})` | `labelShortcut.fg` is the accelerator default `#f59e0b`; `menuBar.hotkey` is the menuAccelerator default `#ef4444` (warning/danger overrides move **no** hotkey). With `overrides:{accelerator:'#00ffff', menuAccelerator:'#ffff00'}` instead → `labelShortcut.fg==='#00ffff'`, `menuBar.hotkey==='#ffff00'` | R8 / AR-07 |
| ST-5 | `createTheme({mode:'dark', accent:'#3b82f6'})` (no accelerator seeds) | `labelShortcut.fg` and `buttonFocused.hotkey` equal `#f59e0b`; `menuBar.hotkey` and `statusBar.hotkey` equal `#ef4444` (historical default hotkey colors) | R5,R7 / AR-04 |
| ST-6 | Curated preset hotkey parity — **data-driven over every curated preset** | Loop over `PRESET_SEEDS`: for each generated preset whose seeds carry `overrides`, its accelerator-fed roles equal that preset's historical `warning` and its menuAccelerator-fed roles equal its historical `danger` — `theme.labelShortcut.fg === overrides.warning` **and** `theme.menuBar.hotkey === overrides.danger`, for **all 10** curated presets (`slate` has no `overrides` → skipped; it rides the defaults). Spot-anchor by name for nord (`#ebcb8b`/`#bf616a`) and dracula (`#f1fa8c`/`#ff5555`). This is the **complete** parity oracle: it catches a forgotten *or transposed* pin in any preset — an omission is type-valid (`overrides` is `Partial<ThemeColors>`) and silently regresses to the generic default, which no other test detects. | R7 / AR-04,08 |
| ST-7 | `aliasesFromSeeds({mode:'dark', accent:'#3b82f6'})`; then with `accelerator:'#abcdef', menuAccelerator:'#fedcba'` seeds | defaults: `.accelerator==='#f59e0b'`, `.menuAccelerator==='#ef4444'`; seeded: those seed values are returned | R5,R6 / AR-11 |
| ST-8 | For fixed seeds `S = {mode:'dark', accent:'#3b82f6'}`: `createTheme(S)` vs `createTheme({...S, overrides:{danger:'#010203', warning:'#040506'}})` | The two themes are **`toStrictEqual`** — overriding `danger`/`warning` changes **no** role. A deterministic inertness proof (not a probabilistic hex-absence probe): since no role reads `danger`/`warning`, the outputs are byte-identical | R4 / AR-03 |

### Designer — rail annotation

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-9 | `aliasRailLabel('danger')`, `aliasRailLabel('warning')`, `aliasRailLabel('accelerator')`, `aliasRailLabel('accent')`; then `buildRolesPanel(model).targets` | `danger`/`warning` labels contain `(reserved)`; `accelerator`/`accent` labels do **not**; `targets` include `{kind:'alias', name:'accelerator'}` and `{kind:'alias', name:'menuAccelerator'}` | R9 / AR-09 |

> **⚠️ AUTHORING RULE:** Expectations come from the spec, not from imagined implementation output.
> The default hex constants (`#f59e0b`, `#ef4444`) and the curated preset hotkeys (`#ebcb8b`,
> `#bf616a`, `#f1fa8c`, `#ff5555`) are the *historical* values read from the current code — the
> parity oracle — not invented outputs.

## Test Categories

### Specification Tests (from ST-cases above)

> Written/updated BEFORE implementation.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/core/test/create-theme.spec.test.ts` (modify) | ST-1…ST-5, ST-7, ST-8 | Core alias tier & `createTheme` |
| `packages/core/test/presets.spec.test.ts` (modify) | ST-6 | Preset hotkey parity |
| `packages/theme-designer/test/roles-panel.spec.test.ts` (new) | ST-9 | Designer rail |

> ST-1 supersedes the existing `create-theme.spec.test.ts` "exactly 16 tokens" oracle. This is a
> **requirement-driven** spec re-derivation (the vocabulary is now 18) performed in the spec-test
> step — not a post-hoc edit to match code. All other existing assertions in that file (ST-8…ST-11
> there) stay intact.
>
> **Numbering note:** the `ST-N` ids in *this document* are a fresh local sequence and overlap the
> ids that already title tests in `create-theme.spec.test.ts` (`ST-7`…`ST-11`) — they are **not** the
> same tests. Per the docs standard, the *new* tests you add carry plain-language descriptions (no
> `ST-` prefix in the test name), so there is no runtime name collision. The **only** existing test
> that changes is the "exactly 16 tokens" oracle (→ 18); every other existing test in the file stays
> verbatim.

### Implementation Tests (edge cases, internals)

> Written AFTER implementation.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/core/test/accelerator-aliases.impl.test.ts` (new) | Seed precedence (`accelerator` seed vs default); `overrides.accelerator` wins over the seed; exhaustive "`danger`/`warning` appear in no role field" across a randomized set of distinct hexes | High |
| `packages/theme-designer/test/roles-panel.impl.test.ts` (optional) | `aliasRailLabel` on an unknown alias defaults to the plain form; label suffix does not leak into `targets` | Low |

### Regression (must pass UNCHANGED — the parity oracle)

| Test File | Guards |
| --------- | ------ |
| `packages/core/test/presets.impl.test.ts` | `parseTheme(serializeTheme(theme))` deep-equals every preset — proves **serialization is lossless** (a self round-trip: each preset is compared to itself, so it does **not** prove historical parity — that is ST-6's job). Must pass unchanged. |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | The `theming/presets` story still mounts and paints |
| `packages/theme-designer/test/*.{spec,impl}.test.ts` + `walkthrough.e2e` | Designer model/app/walkthrough unaffected |

## Test Data

### Fixtures Needed

- `SAMPLE18` — an 18-token `ThemeColors` literal (extend the file's existing `SAMPLE`), with
  `accelerator`/`menuAccelerator` set to values distinct from `warning`/`danger`.

### Mock Requirements

- None. Pure functions and real theme objects throughout.

## Verification Checklist

- [ ] ST-1…ST-9 defined with concrete input/output pairs, each traced to a requirement / AR entry
- [ ] Spec tests updated/written BEFORE implementation
- [ ] Spec tests verified to FAIL (red phase) — the new count + re-point + decouple assertions
- [ ] All spec tests pass after implementation (green phase)
- [ ] `presets.impl.test.ts` round-trip passes **unchanged**
- [ ] Implementation tests written for seed precedence + inertness
- [ ] `yarn verify` green; no regressions; `check:deps` + `check-jsdoc` green
