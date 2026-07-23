# 03-01: Keymap Model (`keymap.ts`)

> **Parent**: [Index](00-index.md) · **AR**: AR-1, AR-4, AR-9, AR-10, AR-14, AR-15
> **New file**: `packages/datagrid/src/keymap.ts`

The pure, view-free keymap model — the data-plane twin of `sort.ts`/`filter.ts`/`selection.ts`, and a
direct mirror of `packages/ui/src/editor/keymap.ts` (pure tables + a resolver returning internal action
ids, not app-level command names). No `@jsvision/ui` view imports.

## The `GridAction` vocabulary

```ts
/** One grid input intent — the vocabulary a chord resolves to and the router dispatches. */
export type GridAction =
  // navigation (base-owned keys included for full remappability — AR-4)
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight'
  | 'rowStart' | 'rowEnd' | 'gridStart' | 'gridEnd'
  | 'pageUp' | 'pageDown'
  | 'nextCell' | 'prevCell'            // command-triggered (Tab), never body-key-resolved (03-03)
  // editing
  | 'beginEdit' | 'commit' | 'cancel'  // commit/cancel are editor-host-scoped (AR-15), documented here
  // selection
  | 'toggleSelect' | 'extendUp' | 'extendDown'
  // value help + filter
  | 'valueHelp' | 'openFilter';        // openFilter = Alt+Down (AR-15)

/** A chord→action map. Chord grammar is core's `createKeymap` grammar: 'ctrl+alt+shift+key'. */
export type GridKeymap = Record<string, GridAction>;
```

`nextCell`/`prevCell`/`commit`/`cancel` are part of the vocabulary but are **not** in the body's
`DEFAULT_KEYMAP`: `Tab` is delivered as a loop command (03-03) and `Enter`/`Esc` are handled by the open
editor's host (`editing.ts`). They exist so the action set is complete and documented in one place.

## `DEFAULT_KEYMAP` (frozen, exported)

The one documented default table. `Object.freeze`d so a caller cannot mutate the shared default (ST-6).

| Chord | GridAction | Notes |
|-------|-----------|-------|
| `left` / `right` | `moveLeft` / `moveRight` | column cursor (overrides the base H-scroll) |
| `up` / `down` | `moveUp` / `moveDown` | delegate to base `focusBy(∓1)` (AR-4) |
| `home` / `end` | `rowStart` / `rowEnd` | first/last column |
| `ctrl+home` / `ctrl+end` | `gridStart` / `gridEnd` | first/last cell of the whole grid |
| `pageup` / `pagedown` | `pageUp` / `pageDown` | delegate to base `focusBy(∓viewportRows)` |
| `f2` | `beginEdit` | editable cell |
| `enter` | `beginEdit` | editable cell; read-only → falls through to base `activate` (AR-9) |
| `f4` | `valueHelp` | begin edit + open the dropdown |
| `space` | `toggleSelect` | read-only cell; editable → `beginEdit` fallback wins first (AR-9) |
| `shift+up` / `shift+down` | `extendUp` / `extendDown` | range extend |
| `alt+down` | `openFilter` | funnel opener (AR-15) |

> `enter`/`space` map to a single primary action, but the **router** applies editability gating
> identical to today's `tryBeginEdit`-before-`handleSelectionKey` precedence: `beginEdit` on a read-only
> cell no-ops and falls through to base activate / `toggleSelect` (03-02, AR-9). Printable type-to-edit is
> a router fallback, not a chord.

## The resolver

```ts
/** The structural key-event subset the resolver reads (mirrors editor/keymap.ts KeymapKeyEvent). */
export interface KeymapKeyEvent { readonly key: string; readonly ctrl: boolean; readonly alt: boolean; readonly shift: boolean; }

/**
 * Resolve one key event to a GridAction against a merged keymap, or undefined when unmapped (the
 * router then applies its printable/base fallbacks — AR-9). Never throws (AC-2/AC-8).
 */
export function resolveGridAction(ev: KeymapKeyEvent, keymap: GridKeymap): GridAction | undefined;

/**
 * Merge a caller keymap over DEFAULT_KEYMAP (caller wins per-chord — AR-10). A caller entry is dropped
 * — `devWarn`-ed and skipped, never thrown (AC-8) — when EITHER its value is not a known GridAction OR
 * its chord is malformed (unknown modifier/key). Returns a fresh, frozen map containing only entries
 * whose chord parses cleanly under core's grammar, so compiling it downstream never throws.
 */
export function mergeKeymap(user?: GridKeymap): GridKeymap;
```

- `resolveGridAction` reuses core's chord canonicalization by compiling the merged map **once** into a
  core `Keymap` (`createKeymap`, memoized by the frozen map's identity) and calling `.lookup(ev)` — it
  does **not** rebuild the table per keystroke and does **not** hand-roll the grammar. Letter keys are
  case-normalized exactly as core's `canonicalize` does. Because `mergeKeymap` already dropped any
  malformed chord, this compile never throws.
- `mergeKeymap` validates each caller entry on **both** axes: (1) the value against a `Set` of the
  `GridAction` literals, and (2) the chord against core's grammar by attempting to compile it in a
  per-entry `try/catch` (core exposes no standalone chord validator — `parseChord`/`canonicalize` are
  private and `createKeymap` throws on a bad chord). Either failure → `devWarn('keymap', …)` (from
  `dev.ts`) + skip that entry; **never** thrown (AC-8). An unknown-but-*valid* chord simply isn't in the
  map, so it resolves to `undefined` at runtime (ignored — AC-2). No `eval`, no dynamic dispatch (AR-14).

## Reference, don't restate

- The chord grammar + canonicalization is **owned by** core `input/keymap.ts` — reuse it; this module
  does not re-define chord parsing.
- The editability gating + printable fallback are **owned by** 03-02 (the router); this module is pure
  chord→action, context-free.

## Verification hooks

Spec: ST-1…ST-6 ([07 §A](07-testing-strategy.md)). JSDoc `@example` on `GridAction`, `GridKeymap`,
`DEFAULT_KEYMAP`, `resolveGridAction`, `mergeKeymap` (all barrel-exported — AR-16).
