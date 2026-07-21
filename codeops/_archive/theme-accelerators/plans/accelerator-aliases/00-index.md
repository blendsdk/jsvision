# Accelerator Aliases Implementation Plan

> **Feature**: Dedicated `accelerator` / `menuAccelerator` theme aliases — decouple hotkey accents from the `danger`/`warning` status tokens
> **Status**: Planning Complete
> **Created**: 2026-07-13
> **CodeOps Skills Version**: 3.6.0

## Overview

Today a generated `@jsvision/core` theme has no dedicated token for the highlighted hotkey letter.
The accelerator accents are borrowed from two of the sixteen semantic aliases: control hotkeys ride
on `warning` (yellow) and menu/status hotkeys ride on `danger` (red). Those two aliases drive
**nothing else** — verified against `roles.ts`, they are the hotkey colors wearing status names. The
consequence surfaces the moment you retune a theme: changing the menu hotkey means changing
`danger`, which is supposed to mean "destructive/error", and the two intents fight.

This plan introduces two dedicated semantic aliases — **`accelerator`** for in-dialog control
hotkeys and **`menuAccelerator`** for the global menu bar + status line — growing `ThemeColors` from
16 to 18 tokens. Every hotkey/shortcut reference in `rolesFromAliases` re-points onto them, and
`danger`/`warning` remain in the vocabulary as clean, app-author-reserved status tokens that no
built-in widget consumes.

The change is **visually byte-identical** for every shipped preset by default: the new aliases carry
the historical hotkey colors as their defaults, and each generated preset explicitly pins them to the
color it used before, so the preset round-trip oracle stays green untouched. The one intended
behavior change — editing `warning`/`danger` no longer retints any hotkey — is documented and
acceptable at v0.2.0. The theme-designer picks up the two new alias rows automatically and marks
`danger`/`warning` "(reserved)" so their new inertness is not surprising.

## Document Index

| #   | Document                                            | Description                                   |
| --- | --------------------------------------------------- | --------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)      | Zero-Ambiguity Gate decisions (audit trail)   |
| 00  | [Index](00-index.md)                                | This document — overview and navigation       |
| 01  | [Requirements](01-requirements.md)                  | Requirements and scope                        |
| 02  | [Current State](02-current-state.md)                | Analysis of the current theming code          |
| 03-01 | [Core Aliases & Roles](03-01-core-aliases-and-roles.md) | `ThemeColors`, `createTheme`, `rolesFromAliases`, preset parity |
| 03-02 | [Designer & Docs](03-02-designer-and-docs.md)     | Theme-designer "(reserved)" annotation, JSDoc/doc accuracy |
| 07  | [Testing Strategy](07-testing-strategy.md)          | Spec test cases (ST-*) and verification       |
| 99  | [Execution Plan](99-execution-plan.md)              | Phases and task checklist                     |

## Quick Reference

### Usage Examples

```ts
import { createTheme } from '@jsvision/core';

// Retune only the hotkey accents — danger/warning untouched.
const t = createTheme({
  mode: 'dark',
  accent: '#3b82f6',
  overrides: {
    accelerator: '#00e5ff', // control hotkeys (buttons, tabs, labels, clusters)
    menuAccelerator: '#ffd400', // menu bar + status line hotkeys
    danger: '#ff5555', // now a pure app-content status color — no hotkey moves
  },
});
t.labelShortcut.fg; // '#00e5ff'
t.menuBar.hotkey; // '#ffd400'
```

### Key Decisions

| Decision | Outcome | AR Ref |
| -------- | ------- | ------ |
| Number of new aliases | Two (`accelerator`, `menuAccelerator`) | AR-01, AR-06 |
| `danger`/`warning` fate | Kept, app-reserved (drive no built-in role) | AR-03 |
| Field optionality | **Required** `ThemeColors` fields (full decouple) | AR-07 |
| Preset parity | Explicit per-preset pin; byte-identical output | AR-04, AR-08 |
| Designer | Auto-list new rows; mark `danger`/`warning` "(reserved)" | AR-09 |
| Serialization | Unchanged (roles-based, byte-stable) | AR-13 |

## Related Files

- `packages/core/src/engine/color/aliases.ts` — `ThemeColors` (+2 fields)
- `packages/core/src/engine/color/create-theme.ts` — `ThemeOptions` (+2 seeds), `aliasesFromSeeds`
- `packages/core/src/engine/color/roles.ts` — re-point 10 hotkey references
- `packages/core/src/engine/color/preset-seeds.ts` — pin the two new aliases in 10 curated presets
- `packages/core/src/engine/color/index.ts` — doc-comment accuracy
- `packages/theme-designer/src/view/roles-panel.ts` — "(reserved)" annotation
- `packages/core/test/create-theme.spec.test.ts` — updated ST oracle + new ST cases
- `packages/examples/kitchen-sink/stories/theming.story.ts` — copy fix (16 → 18)
- `CHANGELOG.md` — behavior-change note
