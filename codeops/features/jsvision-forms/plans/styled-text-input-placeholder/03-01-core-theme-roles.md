# Core Theme Roles: `dangerText` & `warningText`

> **Document**: 03-01-core-theme-roles.md
> **Parent**: [Index](00-index.md)
> **Owns**: the `@jsvision/core` role additions, their per-theme values, and the own-guard.

## Overview

Promote the already-seeded `danger`/`warning` **aliases** into two real, required `Theme` **roles**
— `dangerText` and `warningText` — so `Text.severity` (03-02) and the showcase's amber advisories
(RD-05) have a themeable colour to paint, and `createTheme({ danger, warning })` overrides flow
through automatically (AR-25, AR-P4). Role names deliberately differ from the alias names to avoid
the `warning`-role/`warning`-alias collision (AR-27, PF-003).

## Architecture

### Current
`Theme` = 65 roles; `danger`/`warning` aliases seeded (`create-theme.ts:117-118`) but consumed by no
role (`roles.ts` maps only `c.success`). See 02 §"What exists — core theming".

### Proposed
Add `dangerText` and `warningText` as **required** members of `Theme`, present in all three full
`: Theme` literals, with these per-theme values:

| Theme (literal) | `dangerText` | `warningText` | Source |
| --------------- | ------------ | ------------- | ------ |
| `defaultTheme` (`theme.ts`) | `{ fg: '#ef4444', bg: PALETTE.lightGray }` | `{ fg: '#f59e0b', bg: PALETTE.lightGray }` | AC #1 pins these exact hexes; bg matches `staticText.bg` |
| `rolesFromAliases` (`roles.ts`) | `{ fg: c.danger, bg: c.backgroundRaised }` | `{ fg: c.warning, bg: c.backgroundRaised }` | override-flow (AR-25); bg matches its own `staticText.bg` |
| `monochromeTheme` (`presets.ts`) | `{ fg: W, bg: B }` | `{ fg: W, bg: B }` | achromatic — no hue at mono; `attrs` unset (AR-P3, RD "no bold") |

**Design rules (AR-P2/P3):**
- Roles are **appended at the end** of the interface and each literal — the additive convention the
  tripwire allowlists model. `Object.keys`-based guards are set-membership, so position is free.
- `attrs` is **unset** on every variant (plain colour; no bold) — per the RD.
- `bg` is **each theme's own `staticText.bg`**, so a severity `Text` sits on the same surface as a
  static `Text` (and behaves identically on a non-grey surface — not a regression).
- `hotkey?`/`attrs?` are omitted (the roles need only `fg`/`bg`).

### `createTheme` reach — no logic change (AR-P4)
`createTheme` already routes `options.danger`/`options.warning` → aliases → `rolesFromAliases`
(`create-theme.ts:117-118,156-159`). Once `rolesFromAliases` consumes `c.danger`/`c.warning`, an
override reaches `dangerText.fg`/`warningText.fg` with **zero** change to `createTheme`/`aliasesFromSeeds`.
The **only** edit in `create-theme.ts` is correcting the now-false doc-comments on `danger?`/`warning?`
(`:31,33` — drop *"drives no built-in role"*, state that they now drive `dangerText`/`warningText`).
The same stale *"drives no built-in role"* phrasing also lives at **`aliases.ts:65,67`** (the `danger`/
`warning` alias docs) — correct both in the same pass (03-03 owns the alias-doc/count edits). The
theme-designer's identical `(reserved)`/"drives no built-in role" claim (`roles-panel.ts:12,19` + its
spec) is corrected too — see §Integration Points below.

## Implementation Details

### New roles on the `Theme` interface (`theme.ts`, appended before `shadow` or at end)
```ts
/** Danger/error body text — a validation error, an alert line: danger-red on the static-text field. */
readonly dangerText: ThemeRole;
/** Advisory/warning body text — a non-blocking caution: amber on the static-text field. */
readonly warningText: ThemeRole;
```

### `defaultTheme` (`theme.ts` literal)
```ts
dangerText: { fg: '#ef4444', bg: PALETTE.lightGray },
warningText: { fg: '#f59e0b', bg: PALETTE.lightGray },
```
> `Color` accepts a hex string (as `create-theme.ts` already uses); pinning the exact alias-default
> hex keeps `defaultTheme` and the `createTheme` default in agreement (AC #1).

### `rolesFromAliases` (`roles.ts` return)
```ts
dangerText: { fg: c.danger, bg: c.backgroundRaised },
warningText: { fg: c.warning, bg: c.backgroundRaised },
```

### `monochromeTheme` (`presets.ts` literal)
```ts
dangerText: { fg: W, bg: B },
warningText: { fg: W, bg: B },
```

### Integration Points
- `ThemeRoleName = keyof Theme` (`ui/src/view/types.ts:30`) auto-widens `ctx.color('dangerText'|'warningText')`
  the moment the interface gains the roles — 03-02 relies on this.
- The tripwire allowlists + own-guard are owned by 07 (testing). The auto-adapting coupling guards
  (`create-theme.spec` ST-8, `presets.spec` ST-21, `serialize-theme.spec`, `view.drawcontext-role.impl`)
  need **no** edit but must stay green — their green is the proof the roles are wired through every
  generation path.
- **theme-designer reserved-alias semantics (RD-09 AC #7).** Because `danger`/`warning` now *drive*
  `dangerText`/`warningText`, editing either alias in the designer re-colours the role
  (`model.ts:84-85` derive-mode `createTheme` + `setAlias`), so the `(reserved)` = "editing does
  nothing" label is no longer true. Drop `danger`/`warning` from `RESERVED_ALIASES`
  (`roles-panel.ts:15`), correct the `:12,19` docstrings, and revise `roles-panel.spec.test.ts`
  (`:4-6,16-17`) — a sanctioned oracle-follows-requirement update (the change invalidates the oracle's
  stated premise), owned by 07 and sequenced in 99 (task 1.2.5).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A `: Theme` literal missing the new role | Compile error (roles are required) — surfaced at typecheck, fixed by adding to the literal | AR-25 |
| `createTheme({ danger })` override not reaching the role | Prevented by construction — the alias already flows to `rolesFromAliases` | AR-P4 |
| Stale doc claiming the alias drives no role | Corrected in `create-theme.ts:31,33` + `aliases.ts:65,67` + theme-designer `roles-panel.ts:12,19` (all four sites carry the identical phrase) | AR-P4 |

> **Traceability:** decisions reference `00-ambiguity-register.md` (AR-25/27/29/32, AR-P2/P3/P4) and
> RD-09 §"Semantic theme roles".

## Testing Requirements
- Own-guard spec pinning `defaultTheme.dangerText/.warningText` to the exact `{fg,bg}` bytes and
  `Object.keys(defaultTheme).length === 67` — 07 ST-C1/ST-C2.
- `createTheme({ danger, warning })` override-flow assertion — 07 ST-C3.
- The five inventory tripwires extended and green — 07.
- theme-designer `roles-panel.spec.test.ts` revised (danger/warning no longer `(reserved)`) and green — 07.
- No new runtime dependency (`yarn check:deps` stays green).
