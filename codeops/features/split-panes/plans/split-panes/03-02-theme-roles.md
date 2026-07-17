# Theme Roles: `splitter` + `splitterDragging`

> **Document**: 03-02-theme-roles.md
> **Parent**: [Index](00-index.md)
> **Governs**: `packages/core/src/engine/color/{theme,presets,roles}.ts`

## Overview

Add one role pair so a splitter can be themed directly and its drag state is visible:
`splitter` (at rest) and `splitterDragging` (while being dragged). This lands in `@jsvision/core`,
because `ThemeRoleName` is `keyof Theme` (`ui/src/view/types.ts:30`) and the `Theme` interface
(`core/src/engine/color/theme.ts:30-256`) is the single source of truth for the role union.

> **Decision per AR-15:** A dedicated pair, not a reuse of `staticText` + `indicatorDragging`.
> `staticText` is a *text* role — styling a structural divider off it is a category error, and
> borrowing the editor's `indicatorDragging` for a splitter is semantically wrong. Neither would let
> a theme author style splitters independently. The pair mirrors the existing
> `indicatorNormal`/`indicatorDragging` precedent exactly.

## Architecture

### Current Architecture

68 roles on `Theme`. `CANONICAL_ROLES` (`serialize.ts:33`) is **derived** —
`Object.keys(defaultTheme)` — so serialization is generic and needs no change. Of the 12 presets,
only `monochromeTheme` is hand-authored (`presets.ts:66`); the other 11 go through `createTheme`
and pick up new roles for free via `rolesFromAliases`.

There is **no** role named `frame` (contrary to issue #10's "drawn in `staticText` / frame colour").
Border/title/icon are structural extras on `window`, `windowInactive`, and `dialog`, reached via
`ctx.role('window').border` rather than `ctx.color()`.

### Proposed Changes

Four compiler-enforced edits, modelled line-for-line on the indicator pair.

## Implementation Details

| # | File | Change | Precedent line |
| - | ---- | ------ | -------------- |
| 1 | `core/src/engine/color/theme.ts` | Two `readonly splitter: ThemeRole;` / `readonly splitterDragging: ThemeRole;` members on `interface Theme`, each with JSDoc describing the colour in words (the file's house style) | `theme.ts:233,238` |
| 2 | `core/src/engine/color/theme.ts` | Two entries in the `defaultTheme` literal | `theme.ts:359-360` |
| 3 | `core/src/engine/color/presets.ts` | Two entries in `monochromeTheme` | `presets.ts:127-128` |
| 4 | `core/src/engine/color/roles.ts` | Two entries in `rolesFromAliases`, derived from semantic aliases so all 11 generated presets inherit them | `roles.ts:107-108` |

### Values

Mirroring the indicator pair, whose job is the same: chrome drawn over a window interior, with a
distinct dragging state.

```ts
// theme.ts — defaultTheme
splitter:         { fg: PALETTE.lightGray,   bg: PALETTE.blue },
splitterDragging: { fg: PALETTE.brightGreen, bg: PALETTE.blue },

// presets.ts — monochromeTheme (G/W/B/BLD are the file's local aliases)
splitter:         { fg: G, bg: B },
splitterDragging: { fg: W, bg: B, attrs: BLD },

// roles.ts — rolesFromAliases
splitter:         { fg: c.foregroundMuted,   bg: c.backgroundRaised },
splitterDragging: { fg: c.success,           bg: c.backgroundRaised },
```

> ⚠️ **Palette-name trap.** `PALETTE` uses **DOS-16** names, not ANSI16. There is **no**
> `brightWhite` key — bright white is `PALETTE.white`, and normal white is `PALETTE.lightGray`. A
> mistyped name is `undefined` at runtime and surfaces as `InvalidThemeError`, not a compile error.

### Integration Points

- `ui/src/view/types.ts:30` — `ThemeRoleName = keyof Theme` picks both roles up automatically; no
  edit, no allowlist to update (there is no hand-maintained list).
- `serialize.ts:33` — `CANONICAL_ROLES` is derived; no edit.
- `theme-designer/src/model/types.ts:37` — `RoleOverrides` is a mapped type (`{ [K in keyof Theme]?: … }`);
  no edit.
- `theme-designer/src/model/contrast.ts:19-23` — `CONTRAST_PAIRS` is a **curated shortlist, not
  exhaustive**; adding the splitter pair is optional and out of scope here.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A preset omits a new role | Impossible to ship: `Theme` is a total interface, so a missing key is a compile error in `defaultTheme`/`monochromeTheme`/`rolesFromAliases`. This is why "the 4 spots" is exactly 4 | AR-15 |
| A mistyped `PALETTE` key | `undefined` → `InvalidThemeError` at runtime. Mitigated by copying the indicator lines rather than typing palette names from memory | AR-15 |

## Known friction (accepted)

This bumps the theme-role count, a **recurring merge-conflict point with the in-flight datagrid
branch**, which also adds roles. The conflict is mechanical (a role-count assertion plus a union)
and is resolved at merge time, not pre-negotiated. Flagged in 02-current-state §Risks.

## Testing Requirements

- ST-25 (07-testing-strategy.md): both roles present in `defaultTheme`, in `monochromeTheme`, in
  every `createTheme`-generated preset, and in the derived `CANONICAL_ROLES`.
- The existing theming suite must stay green — note that `presets.impl.test.ts` is a **self
  round-trip** (serialization-lossless), **not** a byte-parity guard for generated presets; do not
  read a pass there as proof the new roles carry correct values.
</content>
