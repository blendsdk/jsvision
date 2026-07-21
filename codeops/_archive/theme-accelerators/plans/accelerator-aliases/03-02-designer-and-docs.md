# Designer & Docs: Accelerator Aliases

> **Document**: 03-02-designer-and-docs.md
> **Parent**: [Index](00-index.md)

## Overview

The theme-designer picks up the two new aliases automatically; the only functional edit is a
"(reserved)" annotation on the `danger`/`warning` rail rows. This document also covers the JSDoc /
doc-accuracy sweep and the CHANGELOG/kitchen-sink copy.

## Architecture

### Current Architecture

`roles-panel.ts` builds the rail's labels inline:

```ts
const labels = [
  ...aliasKeys.map((k) => `α ${String(k)}`),
  ...roleKeys.map((k) => `▸ ${String(k)}`),
];
```

`aliasKeys` comes from `Object.keys(model.resolvedAliases())`, so the two new aliases become rows
automatically. `colorOf({ kind: 'alias', name })` already returns any alias's color, so the new rows
are selectable and editable with no model change.

### Proposed Changes

Introduce a pure, unit-testable label helper and a `RESERVED_ALIASES` set so the "(reserved)" marker
is testable without mounting a view (mitigates the Risk-4 note in `02-current-state.md`).

## Implementation Details

### New Functions / Methods

In `roles-panel.ts` (or a small sibling module it imports):

```ts
/** Aliases that remain in the vocabulary for app content but drive no built-in role. */
const RESERVED_ALIASES: ReadonlySet<string> = new Set(['danger', 'warning']);

/** The rail label for an alias key: `α name`, suffixed `(reserved)` for an app-reserved alias. */
export function aliasRailLabel(name: string): string {
  return RESERVED_ALIASES.has(name) ? `α ${name} (reserved)` : `α ${name}`;
}
```

`buildRolesPanel` uses `aliasRailLabel` for the alias rows; role rows are unchanged. The `targets`
array (which drives `model.select`) keeps the raw key, so selection/editing is unaffected — only the
displayed label carries the suffix.

### Integration Points

- No change to `model.ts`, `contrast.ts`, `inspector-panel.ts`, or `preview-panel.ts`. The rail is
  the sole designer edit.

## Docs & Governance (R10–R12)

| Target | Change | AR Ref |
| ------ | ------ | ------ |
| `aliases.ts` | "16 semantic aliases" → "18"; "63 concrete roles" unchanged; rewrite `danger`/`warning` field docs (no hotkey claim); document `accelerator`/`menuAccelerator` | AR-15 |
| `create-theme.ts` | "16 semantic aliases"/"16 resolved aliases" → "18" | AR-15 |
| `roles.ts` | "16"→"18" at all **three** mentions (`:2` "Expand the 16 semantic aliases", `:15` "16-token `ThemeColors`", `:24` "@param c The 16 resolved semantic aliases"); `@example` literal gains the 2 tokens | AR-15 |
| `index.ts` | barrel comment "16 aliases → 63 roles" → "18 aliases → 63 roles" | AR-15 |
| `preset-seeds.ts` | "override all 16 semantic aliases" → "18" | AR-15 |
| `theme-designer/src/model/types.ts` | "one of the 16 aliases" → "18" (`:32`) | AR-15 |
| `theme-designer/src/view/roles-panel.ts` | "16 semantic aliases"/"16 aliases, then 63 roles" → "18" (`:2`, `:17`) — edited anyway for the "(reserved)" annotation | AR-15 |
| `theme-designer/src/model/model.ts` | "The 16 resolved aliases" → "18" (`:41`) | AR-15 |
| `CLAUDE.md` | **not hand-edited** — the "16 aliases" mentions are in auto-generated sections; `/analyze_project` refreshes them post-execution | AR-15 |
| `CHANGELOG.md` | new entry: two accelerator aliases; `warning`/`danger` no longer drive hotkeys (behavior change) | AR-10 |
| `packages/examples/kitchen-sink/stories/theming.story.ts` | "16 aliases" copy → "18" (2 occurrences: `blurb` + the in-canvas `Text`) | AR-17 |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A future alias added without a rail label decision | `aliasRailLabel` defaults to the plain `α name` form — non-reserved unless explicitly listed | AR-09 |

> **Traceability:** See `00-ambiguity-register.md`.

## Testing Requirements

- Spec: `aliasRailLabel('danger')` / `aliasRailLabel('warning')` include "(reserved)";
  `aliasRailLabel('accelerator')` / `aliasRailLabel('accent')` do not; the built rail includes rows
  for `accelerator` and `menuAccelerator`. See ST-9 in `07-testing-strategy.md`.
- `check-jsdoc` stays green (the two new `ThemeColors` fields are type members — documented, no
  `@example` required for a type).
