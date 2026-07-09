# 03-01 — Tree Markers (GH #17)

> **Parent**: [Index](00-index.md) · **Requirement**: [R1](01-requirements.md#r1--tree-markers-gh-17) · **AR**: AR-2…AR-6
> **Files**: `packages/ui/src/tree/graph.ts`, `tree.ts`, `tree-rows.ts`, `index.ts`; tests `packages/ui/test/*graph*`, `*tree*`; story `packages/examples/kitchen-sink/stories/tree.story.ts`

## Design

Add an opt-in marker style. The end graphic's **marker column** becomes style-driven; the ancestor
guides and fork/corner are unchanged.

### `MarkerStyle` type + glyph table

```ts
/** How a Tree draws its expand/collapse marker. `'tv'` is the default (faithful single char). */
export type MarkerStyle = 'tv' | 'brackets' | 'triangle';
```

| Node state (flags) | `tv` | `brackets` | `triangle` |
|---|---|---|---|
| collapsed w/ children (`!EXPANDED`) | `+` | `[+]` | `▸` |
| expanded w/ children (`CHILDREN`) | `─` | `[-]` | `▾` |
| leaf (`EXPANDED` & `!CHILDREN`) | `─` | `   ` (3 spaces) | ` ` (1 space) |

Marker cell-width: `tv` = 1, `brackets` = 3, `triangle` = 1 (AR-4, AR-6).

### No-Unicode fallback (AR-5)

`triangle` requires Unicode; `▸`/`▾` are unavailable under a caps profile without Unicode. Resolve the
**effective** style at draw time: `triangle` → `brackets` when `!ctx.caps` supports Unicode; `brackets`
and `tv` are ASCII-safe as-is. The fallback is decided by the row renderer (which holds `ctx.caps`) and
passed into `createGraph`, so `graph.ts` stays pure (no caps dependency).

### Geometry (AR-4)

- `createGraph(level, lines, flags, guides, style)` — new final param (default `'tv'` so existing
  callers/tests are unaffected). The end graphic emits fork/corner (1) + `hFill` (1) + `marker(style, flags)`.
- `graphWidth(level, style)` — new final param: `level * LEVEL_WIDTH + endWidth(style)` where
  `endWidth('tv') = endWidth('triangle') = 3` and `endWidth('brackets') = 5`. Default `'tv'` keeps the
  current `level*3 + 3`.
- `tree-rows.ts` computes the effective style once (caps fallback) and uses it for **both** `createGraph`
  and the mouse toggle-zone `mouse.x < graphWidth(level, style)` — so the hit-zone stays correct for the
  wider bracket graphic with no separate edit.

### Threading

- `TreeOptions.markerStyle?: MarkerStyle` (default `'tv'`), stored on `Tree`, read by `tree-rows.ts`.
- Export `MarkerStyle` from `tree/index.ts` → `packages/ui/src/index.ts`.

## Behavior notes / invariants

- The `'tv'` path is **byte-identical** to today (default param + same glyphs) — the fidelity oracle's
  existing assertions stay green unchanged; new assertions cover `brackets`/`triangle`.
- Blank leaf markers keep column alignment: a `brackets` leaf occupies the same 3 cells as `[+]`, a
  `triangle` leaf the same 1 cell as `▸`.
- All glyphs remain single-width per cell (`[`,`+`,`]`,`▸`,`▾`,` ` are width 1), so column math stays exact.

## JSDoc / docs

- `MarkerStyle` and the new `TreeOptions.markerStyle` get JSDoc; the `Tree` `@example` gains a
  `markerStyle: 'brackets'` line. No CodeOps IDs / TV provenance in shipped code (the fidelity note lives
  in the plan + commit message, not the JSDoc).

## Acceptance (maps to ST-1…ST-8)

- Collapsed vs. expanded unmistakable under `brackets` and `triangle`; `tv` unchanged.
- `graphWidth`/column math correct per style; mouse graph-zone toggle still works (incl. the 5-cell
  bracket graphic).
- `triangle` degrades to `brackets` with no Unicode.
- Kitchen-sink tree story shows a non-`tv` style; `yarn verify` green.
