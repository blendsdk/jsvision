# Current State: UI Small Batch

> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.3.2

What exists today, grounded in the real source, and the exact seams each issue touches.

## R1 — Tree (GH #17)

- `packages/ui/src/tree/graph.ts` owns the pure prefix builder.
  - `GRAPH` glyphs: `markCollapsed: '+'`, `hFill: '─'` (also the expanded marker).
  - `createGraph(level, lines, flags, guides)` emits, per row: ancestor guides, then the end graphic =
    fork/corner (1) + `hFill` (1) + marker (1). The marker is `expanded ? GRAPH.hFill : GRAPH.markCollapsed`.
  - Flags: `OV_EXPANDED` (expanded **or leaf**), `OV_CHILDREN` (expanded **and** has children),
    `OV_LAST`. So: collapsed-with-children = `!EXPANDED`; expanded-with-children = `CHILDREN`;
    **leaf = `EXPANDED` set but `CHILDREN` clear** — the key distinction for the blank-leaf rule (AR-6).
  - `graphWidth(level) = level * LEVEL_WIDTH + LEVEL_WIDTH` (`LEVEL_WIDTH = 3`). This is the single
    source of truth for the row prefix width **and** the mouse toggle-zone.
- `packages/ui/src/tree/tree.ts` owns `TreeOptions` + the `Tree` view; `tree-rows.ts` renders rows and
  hit-tests the graph zone as `mouse.x < graphWidth(level)` (so a wider end graphic auto-adapts).
- **Fidelity oracle:** the Tree graph spec pins the current glyphs. A new `markerStyle` is a recorded
  deviation; the oracle gains per-style cases (the `'tv'` case stays byte-identical).

**Gap:** `createGraph`/`graphWidth` are style-blind, and there is no `markerStyle` in `TreeOptions`.

## R2 — Accelerators (GH #6)

- Hotkeys use the `~X~` tilde convention parsed by `parseTilde()` / `tildeSegments()` in
  `packages/ui/src/menu/builders.ts` (hotkey lowercased). `MenuItem = { kind:'item', title, command, key? } | { kind:'sub', title, items } | { kind:'separator' }` — **no `disabled` field** (AR-12).
- Runtime resolution is **first-match-wins**: `menu/controller.ts` `findIndex(... parseTilde(node.title).hotkey === lower)` for items and `layoutTitles(tops).find(...)` for bar titles — a duplicate silently shadows the later item.
- The other accelerator-bearing views each hold a parsed hotkey but expose **no common seam**:
  - `controls/button.ts` — `this.parsed = parseTilde(text)` (`Button.parsed.hotkey`).
  - `controls/label.ts` — `this.parsed = parseTilde(text)`.
  - `controls/cluster.ts` — `this.parsed` = one `ParsedLabel` **per item** (`CheckGroup`/`RadioGroup`/`MultiCheckGroup`); a disabled item still holds its hotkey.
  - `tabs/tab-strip.ts` — parses each tab title's `~X~` (Alt-hotkeys handled at the `TabView` level).
- `packages/ui/src/reactive/warnings.ts` — `devWarn(message)` = a `NODE_ENV`-gated `console.warn`
  prefixed `[jsvision/ui reactive]`, the established footgun sink (used by `for.ts`'s duplicate-key
  warning). **The only sanctioned `console.*` path in a shipped TUI.**

**Gaps:** (1) no pure duplicate finder; (2) no `View.accelerators()` seam to enumerate a scope's hotkeys
uniformly; (3) `devWarn` is reactive-prefixed only — needs a scope-tagged shared form (AR-11);
(4) no scope-root mount hook wired to run the check.

## R3 — Switch (GH #11)

- `controls/cluster.ts` (the `CheckGroup`/`RadioGroup` base) provides ↑↓/Space/Alt/click, but `draw()`
  hardcodes `clusterNormal`/`clusterSelected`/`clusterDisabled` and a fixed 5-cell box at col 0 — it
  **cannot** paint a green-on/dim-off track without a `draw()` override, and ↑↓ nav is meaningless for a
  single toggle. So `Cluster` is the wrong base (AR-14).
- `controls/slider.ts` — the closest precedent: a **single bound-value** control that `extends View`,
  binds a two-way `Signal`, handles keyboard + mouse + wheel, and draws groove + thumb. `Switch` mirrors
  this shape.
- Theme roles already present in `packages/core/src/engine/color/theme.ts`: `button` (`black/green`),
  `buttonFocused` (`white/green`, `hotkey: yellow`), `staticText` (`black/lightGray`), `clusterDisabled`.
  So the on/off/focus rendering reuses existing roles — **no new core role** (AR-16).
- Kitchen-sink registry: `packages/examples/kitchen-sink/stories/*.story.ts` + `stories/index.ts`
  (one file + one registry line per component); the `controls/slider` story is the template.

**Gap:** no `Switch` component; no `controls/switch` story.

## Shared facts

- `@jsvision/ui` re-exports via **explicit named** re-exports in `packages/ui/src/index.ts` (except
  `reactive`, which uses `export *`). New public symbols must be added there.
- Tests live in `packages/ui/test/` only (never colocated). `*.spec.test.ts` = immutable oracle;
  `*.impl.test.ts` = internals/edges.
- `check-jsdoc.mjs` (in `yarn verify`) fails on any public export missing an `@example` and on any
  CodeOps ID / TV-C++ provenance in shipped `src`.
