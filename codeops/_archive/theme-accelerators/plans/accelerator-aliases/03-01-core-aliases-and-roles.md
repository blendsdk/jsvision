# Core Aliases & Roles: Accelerator Aliases

> **Document**: 03-01-core-aliases-and-roles.md
> **Parent**: [Index](00-index.md)

## Overview

The `@jsvision/core` change: two new semantic aliases, ten re-pointed role references, two optional
seeds, and explicit per-preset parity pins. Pure data/mapping — no algorithm change.

## Architecture

### Current Architecture

`seeds → aliasesFromSeeds → 16 ThemeColors → (merge overrides) → rolesFromAliases → 63-role Theme`.
`danger`/`warning` feed only the 10 hotkey references.

### Proposed Changes

The same pipeline with an 18-token alias tier. `accelerator`/`menuAccelerator` are first-class,
independent aliases (not derived from `warning`/`danger`); the 10 hotkey references read them;
`danger`/`warning` feed nothing.

## Implementation Details

### New Types / Interfaces

**`ThemeColors` gains two required fields** in their own `// --- accelerator (2) ---` group placed
immediately **after** the existing `accent (2)` group (hotkey accents are conceptually
accent-adjacent; this fixes the `Object.keys` order, which drives the designer rail order and ST-1's
key list). Rewrite the `danger`/`warning` doc comments so they no longer claim a hotkey role.

```ts
// --- accelerator (2) ---
/** The highlighted hotkey letter of an in-dialog control — a focused button, a tab, a label/cluster shortcut. */
readonly accelerator: Color;
/** The highlighted hotkey letter of the global chrome — the menu bar and the status line. */
readonly menuAccelerator: Color;

// --- status (4), docs rewritten ---
/** Danger / destructive signal — error emphasis, a destructive action. Reserved for app content; drives no built-in role. */
readonly danger: Color;
/** Warning / attention signal. Reserved for app content; drives no built-in role. */
readonly warning: Color;
```

**`create-theme.ts` — `ThemeOptions` gains two optional seeds:**

```ts
/** In-dialog control hotkey (accelerator) seed; defaults to an amber. */
readonly accelerator?: Color;
/** Menu-bar / status-line hotkey (accelerator) seed; defaults to a red. */
readonly menuAccelerator?: Color;
```

### New Functions / Methods

No new functions. Two existing functions change:

**`aliasesFromSeeds` (`create-theme.ts`)** — add two fields to the returned object, independent of
the `warning`/`danger` values so decoupling is real (R5, R8):

```ts
accelerator: options.accelerator ?? '#f59e0b',
menuAccelerator: options.menuAccelerator ?? '#ef4444',
```

**`rolesFromAliases` (`roles.ts`)** — re-point the 10 references per the map in
`02-current-state.md §Code Analysis` (6 → `c.accelerator`, 4 → `c.menuAccelerator`). Update the
function's `@example` `ThemeColors` literal to include the two new tokens.

`createTheme` itself is unchanged: `{ ...aliasesFromSeeds(options), ...options.overrides }` already
carries the two new fields (they are part of `ThemeColors` and `Partial<ThemeColors>`).

### Preset Parity (`preset-seeds.ts`) — R7

For each of the **10 curated presets** (`nord`, `dracula`, `solarizedDark`, `gruvboxDark`, `janus`,
`warp`, `solstice`, `platinum`, `workbench`, `horizon`) add two lines to its `overrides` block,
mirroring that preset's existing `warning`/`danger`:

```
accelerator:     <that preset's `warning` value>,
menuAccelerator: <that preset's `danger`  value>,
```

`slate` (no `overrides`; default `warning`/`danger`) needs **no** edit — its defaults already equal
the new aliases' defaults. The two literal presets (`classicTheme`, `monochromeTheme`) are
role-literals with literal `hotkey` fields and are **untouched** (AR-14).

### Integration Points

- `index.ts` re-exports are unchanged (no new symbol; `ThemeColors` field additions flow through).
  Only the barrel doc comment's "16 aliases" wording updates.
- `serialize.ts` — unchanged (AR-13).
- The designer consumes `ThemeColors`/`createTheme` structurally; its automatic pickup + the
  "(reserved)" annotation are covered in `03-02`.

## Code Examples

### Example: decoupled retune

```ts
const t = createTheme({
  mode: 'dark',
  accent: '#3b82f6',
  overrides: { warning: '#ff0', danger: '#f00' }, // status only — NO hotkey moves
});
t.labelShortcut.fg; // still the accelerator default '#f59e0b'
t.menuBar.hotkey; // still the menuAccelerator default '#ef4444'
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A new alias seed is `'default'` / unresolvable | Same as existing status seeds — surfaces via `toRgb`/`InvalidColorError` at encode time; no new handling | AR-18 |
| A preset omits the parity pin | Prevented structurally by R7's explicit edits; caught by the **data-driven ST-6** (the serialize/parse round-trip does **not** catch a mis-pin — it is a self round-trip) | AR-08 |

> **Traceability:** Every design choice references its Ambiguity Register entry. See
> `00-ambiguity-register.md`.

## Testing Requirements

- Spec: 18-token count; the 10 re-pointed references (accelerator/menuAccelerator, not warning/danger);
  the decouple behavior; default color parity; curated-preset hotkey parity; seed handling. See
  ST-1…ST-8 in `07-testing-strategy.md`.
- Regression: `presets.impl.test.ts` round-trip must pass unchanged — but it guards **serialization
  losslessness only** (a self round-trip, each preset compared to itself); the byte-parity guard is
  the data-driven ST-6 over every curated preset.
