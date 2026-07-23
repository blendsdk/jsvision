# Requirements: Accelerator Aliases

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

This is a standalone plan (no upstream RD); this document owns the requirements.

## Feature Overview

Give `@jsvision/core` themes a first-class, independently themeable concept for the highlighted
hotkey (accelerator) letter, and free the `danger`/`warning` status aliases from their current
double-duty as hotkey colors. Two new semantic aliases join the palette; every hotkey/shortcut role
reference re-points onto them; `danger`/`warning` stay as app-reserved status tokens.

## Functional Requirements

### Must Have

- [ ] R1 — `ThemeColors` gains two **required** fields: `accelerator` and `menuAccelerator`, taking
  the alias tier from 16 to 18 tokens. (AR-01, AR-06, AR-07)
- [ ] R2 — `rolesFromAliases` sources the six in-dialog control hotkey references from
  `accelerator` (`buttonFocused.hotkey`, `tabActive.hotkey`, `tabInactive.hotkey`,
  `labelShortcut.fg`, `buttonShortcut.fg`, `clusterShortcut.fg`). (AR-02)
- [ ] R3 — `rolesFromAliases` sources the four global-chrome hotkey references from
  `menuAccelerator` (`menuBar.hotkey`, `menuSelected.hotkey`, `statusBar.hotkey`,
  `statusSelected.hotkey`). (AR-02)
- [ ] R4 — `danger` and `warning` remain in `ThemeColors` but drive **no** built-in role. (AR-03)
- [ ] R5 — `aliasesFromSeeds` returns `accelerator` defaulting to `#f59e0b` and `menuAccelerator`
  defaulting to `#ef4444` (today's hotkey colors), independent of the `warning`/`danger` seeds.
  (AR-07, AR-11)
- [ ] R6 — `ThemeOptions` gains optional `accelerator?` / `menuAccelerator?` seed params, symmetric
  with `danger?`/`warning?`. (AR-11)
- [ ] R7 — Every shipped preset renders **byte-identical** to today. Each of the 10 curated,
  `overrides`-driven presets explicitly pins `accelerator`/`menuAccelerator` to its historical
  `warning`/`danger` value; `slate` relies on the defaults; the two literal presets are unaffected.
  (AR-04, AR-08, AR-14)
- [ ] R8 — Editing `warning` or `danger` (as a seed or an `overrides` entry) changes **no** hotkey
  in a generated theme; editing `accelerator`/`menuAccelerator` changes the corresponding hotkeys.
  (AR-07)
- [ ] R9 — The theme-designer lists the two new alias rows (automatic via `resolvedAliases()`) and
  marks the `danger`/`warning` rail rows "(reserved)". (AR-09)

### Should Have

- [ ] R10 — Public JSDoc reflects the 18-token vocabulary; `danger`/`warning` field docs no longer
  describe a hotkey role; the two new fields are documented; the `rolesFromAliases` `@example`
  literal carries all 18 tokens. (AR-15)
- [ ] R11 — `CHANGELOG.md` records the new aliases and the `warning`/`danger` decoupling
  behavior change. (AR-10, AR-15)
- [ ] R12 — The `theming/presets` kitchen-sink story copy reads "18 aliases". (AR-17)

### Won't Have (Out of Scope)

- New theme **roles** or any change to the 63-role count. (AR-14)
- Serialization format changes. (AR-13)
- Per-role editing of the `hotkey` subfield in the designer inspector (the alias approach supersedes
  it).
- Renaming the `ThemeRole.hotkey` field or the `*Shortcut` roles.
- A dedicated per-widget accelerator (e.g. separate tab vs. button accelerators) — the two-alias
  split is the whole scope.

## Technical Requirements

### Performance

- No runtime cost change: the same alias→role expansion, two more constant fields.

### Compatibility

- `@jsvision/core` is at **v0.2.0** (pre-1.0). Adding two required `ThemeColors` fields is a
  minor-acceptable, documented change. In-repo, the only `ThemeColors` literals are the core spec
  `SAMPLE` and the `rolesFromAliases` `@example` — both updated here. (AR-07, AR-10)

### Security

- No new untrusted-input path. The only external-input boundary (`parseTheme`) is unchanged and
  remains injection-safe. (AR-18)

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Alias count | one / menu-only / two | two | Independent control- vs. chrome-hotkey tuning; matches the two distinct DOS colors | AR-01 |
| Names | accelerator+menuAccelerator / +bar / +chrome / shortcut+menuShortcut | accelerator + menuAccelerator | Standard term; reads clearly | AR-06 |
| Field optionality | required / optional+fallback | required | Full decouple with no residual coupling; pre-1.0 makes it safe | AR-07 |
| Preset parity | derive-unless-set / explicit pin | explicit pin | Byte-obvious; keeps accelerator truly independent of warning | AR-08 |
| Designer | annotate / no change | annotate "(reserved)" | Prevents "I edited danger and nothing happened" confusion | AR-09 |

> **Traceability:** Every scope decision references its Ambiguity Register entry. See
> `00-ambiguity-register.md`.

## Acceptance Criteria

1. [ ] R1–R9 satisfied and covered by spec tests (ST-1…ST-9 in `07-testing-strategy.md`).
2. [ ] `presets.impl.test.ts` round-trip passes **unchanged** (serialization losslessness — a self
   round-trip) **and** ST-6 passes: the data-driven byte-parity oracle across every curated preset.
3. [ ] `yarn verify` green (lint + typecheck + build + test + check:docs across packages).
4. [ ] `CHANGELOG.md` + JSDoc + kitchen-sink copy updated.
5. [ ] No dead code; `check:deps` green; `check-jsdoc` green.
