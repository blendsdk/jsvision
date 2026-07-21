# Current State: Accelerator Aliases

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The theming tier lives under `packages/core/src/engine/color/`. A generated theme flows
**seeds → 16 aliases → 63 roles**:

- `aliases.ts` declares `ThemeColors` (the 16-token semantic vocabulary).
- `create-theme.ts` derives aliases from seeds (`aliasesFromSeeds`) and expands + overrides them
  (`createTheme`).
- `roles.ts` (`rolesFromAliases`) maps every one of the 63 roles onto an alias.
- `preset-seeds.ts` + `presets.ts` build the 13 shipped presets.

**The core finding** (verified): `danger` and `warning` are referenced **only** for hotkeys —
nowhere else in `rolesFromAliases`. They are effectively the hotkey colors under status names.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/engine/color/aliases.ts` | `ThemeColors` interface (16 fields) | +2 required fields; rewrite `danger`/`warning` docs; JSDoc "16"→"18" |
| `packages/core/src/engine/color/create-theme.ts` | `ThemeOptions`, `aliasesFromSeeds`, `createTheme` | +2 optional seeds; return the 2 new aliases with independent defaults; JSDoc "16"→"18" |
| `packages/core/src/engine/color/roles.ts` | `rolesFromAliases` role→alias map | re-point 6 refs `warning`→`accelerator`, 4 refs `danger`→`menuAccelerator`; update `@example` literal; JSDoc "16" |
| `packages/core/src/engine/color/preset-seeds.ts` | Curated preset seed/override sets | pin `accelerator`/`menuAccelerator` in 10 curated `overrides` blocks; JSDoc "16" |
| `packages/core/src/engine/color/index.ts` | Barrel doc comment | "16 aliases" → "18" |
| `packages/theme-designer/src/view/roles-panel.ts` | Alias/role rail label builder | mark `danger`/`warning` "(reserved)"; JSDoc "16 aliases"→"18" (`:2`, `:17`) |
| `packages/theme-designer/src/model/{types.ts,model.ts}` | Model types + `resolvedAliases` | JSDoc "16 aliases"→"18" (`types.ts:32`, `model.ts:41`) — no code change |
| `packages/examples/kitchen-sink/stories/theming.story.ts` | Theming showcase | copy "16 aliases" → "18" |
| `CHANGELOG.md` | Governance | add entry |
| `CLAUDE.md` | Project doc (**auto-generated**) | **not hand-edited** — its "16 aliases" mentions (`:92,96,271`) live in auto-generated sections; `/analyze_project` refreshes them post-execution |

### Code Analysis

**`roles.ts` — the 10 hotkey references to re-point** (current → target):

```
buttonFocused.hotkey : c.warning → c.accelerator      (line ~53)
labelShortcut.fg     : c.warning → c.accelerator      (line ~57)
buttonShortcut.fg    : c.warning → c.accelerator      (line ~60)
clusterShortcut.fg   : c.warning → c.accelerator      (line ~64)
tabActive.hotkey     : c.warning → c.accelerator      (line ~86)
tabInactive.hotkey   : c.warning → c.accelerator      (line ~87)
menuBar.hotkey       : c.danger  → c.menuAccelerator  (line ~41)
menuSelected.hotkey  : c.danger  → c.menuAccelerator  (line ~42)
statusBar.hotkey     : c.danger  → c.menuAccelerator  (line ~108)
statusSelected.hotkey: c.danger  → c.menuAccelerator  (line ~109)
```

**`create-theme.ts` — `createTheme` alias assembly** (line ~151):

```ts
const aliases: ThemeColors = { ...aliasesFromSeeds(options), ...options.overrides };
```

With `accelerator`/`menuAccelerator` returned by `aliasesFromSeeds` (independent defaults) and
included in `Partial<ThemeColors>` overrides, this line needs **no structural change** — the spread
already carries the two new fields. Only `aliasesFromSeeds` grows two return fields and
`ThemeOptions` two optional seeds.

**`preset-seeds.ts` — the parity mechanism.** The 10 curated presets set `danger`/`warning` inside
`overrides` (not as seeds). Because `accelerator` defaults from the seed path (not from the override),
a curated preset that overrides `warning` would otherwise fall back to the generic default and
**regress visually**. The fix is explicit: each curated `overrides` block gains
`accelerator: <its warning>` and `menuAccelerator: <its danger>`. Example (nord):

```
danger:  '#bf616a'  →  menuAccelerator: '#bf616a'
warning: '#ebcb8b'  →  accelerator:     '#ebcb8b'
```

`slate` has no `overrides` and its `warning`/`danger` are the defaults, which equal the new aliases'
defaults — so `slate` needs no edit.

**`serialize.ts` — unchanged.** `serializeTheme`/`parseTheme` enumerate roles from
`Object.keys(defaultTheme)` (`CANONICAL_ROLES`), and `hotkey` is already a serialized base key. The
`presets.impl.test.ts` `parseTheme(serializeTheme(theme))` round-trip therefore stays green with no
change — but note precisely what it does and does **not** prove: it is a *self* round-trip (each
preset is compared to itself), so it guards **serialization losslessness only**, not historical
parity. A preset whose hotkey silently regressed to the generic default would still round-trip
cleanly. The real byte-parity guard is the data-driven ST-6 below — every curated preset's hotkey
roles checked against its own `warning`/`danger`.

**`theme-designer` — mostly automatic.** The roles rail reads `Object.keys(model.resolvedAliases())`
(`roles-panel.ts`), so the two new aliases appear as rows for free; `colorOf` handles alias targets
generically. `contrast.ts` iterates a **fixed role-pair list** (`CONTRAST_PAIRS`), not aliases, so it
is unaffected. The only edit is the "(reserved)" label for `danger`/`warning`.

**The UI hotkey-color test suite is unaffected — and MUST NOT be edited.** Every UI assertion that
checks a hotkey/shortcut color pins it against the **untouched `defaultTheme` literal**, not the
alias-derived path: `controls.text-label.spec` (`labelShortcut`), `controls.button.spec`
(`buttonShortcut`), `controls.cluster.spec` (`clusterShortcut`), `tab-strip.spec`
(`tabActive.hotkey`), the `*-theme.spec` depth fixtures, and `color-palette-theme.spec` (decodes
`defaultTheme` against the TV cpGrayDialog source). Because this plan changes only the alias-derived
path (`ThemeColors`, `aliasesFromSeeds`, `rolesFromAliases`, curated preset seeds) and leaves
`defaultTheme` byte-identical, these all stay green with no change. An executor who greps
`warning`/`hotkey` will find them — they are expected passes, not regressions.

## Gaps Identified

### Gap 1: No dedicated hotkey token

**Current Behavior:** Hotkey accents are sourced from `danger`/`warning`; those aliases drive nothing
else.
**Required Behavior:** Dedicated `accelerator`/`menuAccelerator` aliases drive all hotkeys;
`danger`/`warning` become app-reserved. (R1–R4)
**Fix Required:** Add the two aliases; re-point the 10 references; pin them in curated presets.

### Gap 2: Preset visual regression risk

**Current Behavior:** Curated preset hotkeys come from `overrides.warning`/`overrides.danger`.
**Required Behavior:** Byte-identical output. (R7)
**Fix Required:** Explicit `accelerator`/`menuAccelerator` pins in the 10 curated `overrides` blocks.

### Gap 3: Designer would silently no-op on danger/warning

**Current Behavior:** Editing `danger`/`warning` retints hotkeys, so it visibly does something.
**Required Behavior:** After decoupling they change no built-in widget; the rail should say so. (R9)
**Fix Required:** "(reserved)" annotation on those two rows.

## Dependencies

### Internal Dependencies

- `@jsvision/theme-designer` depends on `@jsvision/core`'s built `dist` — the designer edits require
  core to be rebuilt first (turbo `^build`, already the pipeline default).

### External Dependencies

- None.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| A curated preset's hotkey silently regresses | Med | Med | Explicit per-preset pin (R7) + the **data-driven ST-6** asserting *every* curated preset's hotkey roles against its own `warning`/`danger`. (A forgotten/transposed pin is type-valid — `overrides` is `Partial<ThemeColors>` — and otherwise silent; the serialize/parse round-trip does **not** catch it, so ST-6 is the guard.) |
| A missed `warning`/`danger` reference elsewhere in `roles.ts` | Low | Med | Grep-verified: the 10 references are the *only* `danger`/`warning` uses in `roles.ts` |
| ThemeColors literal breakage for an external consumer | Low | Low | Pre-1.0 (0.2.0), documented in CHANGELOG; in-repo literals updated |
| Designer rail label change breaks a designer test | Low | Low | Put the reserved-marker logic in a pure, unit-testable helper |
