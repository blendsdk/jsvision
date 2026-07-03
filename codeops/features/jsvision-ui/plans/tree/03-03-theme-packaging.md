# 03-03 · Theme roles + packaging + demo

> **Document**: 03-03-theme-packaging.md
> **Parent**: [Index](00-index.md)
> **Decode**: [03-01 §5](03-01-tree.md) · **Pattern**: RD-14 `history*` roles (`theme.ts:147-180,263-267`)

## Additive `cpOutlineViewer` theme roles (AC-9, PA-8)

Four flat `ThemeRole`s added to the `Theme` interface + `defaultTheme` in
`packages/core/src/engine/color/theme.ts` — the same additive, non-breaking pattern as the RD-06/07/
11/14 control roles. No role-only extras (unlike `historyWindow`); `ThemeRoleName = keyof Theme`
picks them up automatically, so `TreeRows.draw` uses `ctx.color('outlineFocused')` with no other
change.

```ts
/** Outline/tree normal row. cpOutlineViewer slot 1 (outline.h:66), local index 6. */
readonly outlineNormal: ThemeRole;
/** Outline/tree focused row. cpOutlineViewer slot 2 (Focus), local index 7. getColor(0x0202). */
readonly outlineFocused: ThemeRole;
/** Outline/tree selected row. cpOutlineViewer slot 3 (Select), local index 3. getColor(0x0303). */
readonly outlineSelected: ThemeRole;
/** Outline/tree collapsed-node text (two-tone `color>>8`). cpOutlineViewer slot 4 (NotExpanded),
 *  local index 8. Used as the high byte of the Normal pair getColor(0x0401), toutline.cpp:82. */
readonly outlineNotExpanded: ThemeRole;
```

### Colour bytes — resolved at exec GATE-1 (PA-9)

The **structure** is fully decoded (03-01 §5): four slots, parent local indices
`Normal=6 · Focus=7 · Select=3 · NotExpanded=8`, resolved `local → owner → cpAppColor` via `mapColor`
(`mapcolor.cpp:20-38`). The **final `{fg,bg}`** depends on the canonical host = **gray `TDialog`**
(PA-9, matching the 03-01 history-decode convention). The exec **GATE-1 BEFORE** task walks the real
`getColor(0x0202/0x0303/0x0401)` chain through `cpGrayDialog` → `cpAppColor` and pins the concrete
attribute bytes into `defaultTheme`; **GATE-2 AFTER** re-diffs each cell.

> **Confidence: structure HIGH, final bytes MEDIUM (pinned/verified at exec).** The attribute
> convention is `0xHL` (high nibble `H` = bg, low nibble `L` = fg). The theme spec test (ST below)
> asserts the four roles exist, `encode()` without throwing, and equal the **GATE-1-pinned** bytes —
> it is written after the GATE-1 BEFORE task fixes them, so the oracle and the code share one decoded
> source (the C++). This is the same sequencing RD-14 used for the `history*` bytes.

Provisional working values (to be **confirmed/replaced** at GATE-1 — not authoritative): the outline
NotExpanded/Focus slots resolve toward blue-family attributes (slot indices 8/7 in the app palette
region), Select toward a light-gray highlight (slot 3). The GATE-1 task supersedes this line.

## Packaging (AC-11, PA-7)

- New `packages/ui/src/tree/`:
  - `graph.ts` — `createGraph`, `flattenVisible`, `FlatRow`, `OV_*` (pure; ≤ 500).
  - `tree-rows.ts` — `TreeRows<T> extends View` (the renderer; ≈ 450, ≤ 500).
  - `tree.ts` — `Tree<T> extends Group`, `TreeNode<T>`, `TreeOptions<T>`, expand-state model (≤ 500).
  - `index.ts` — barrel (`Tree`, `TreeNode`, `TreeOptions`; `TreeRows`/`graph` internal unless a test imports).
- `packages/ui/src/index.ts` gains the explicit-named-re-export block (02-current-state §Barrel):
  ```ts
  export { Tree } from './tree/index.js';
  export type { TreeNode, TreeOptions } from './tree/index.js';
  ```
- `yarn check:deps` stays green (zero runtime deps; only `@jsvision/core`). Files ≤ 500 lines.

## Kitchen-sink story + headless demo (AC-12, AR-150)

- **Story** `packages/examples/kitchen-sink/stories/tree.story.ts` — an expandable outline (a small
  file-tree forest) with a **visible focused/selected echo**, interaction hints (← collapse / →
  expand / `+`/`-`/`*` / click-to-toggle), faithful colours; `build(ctx)` returns a `Group` of
  absolutely-positioned children in `ctx.width × ctx.height`. Registered in `stories/index.ts`
  (a "Tree" entry under `category: 'Containers'` — alongside its structural twin `ListView` and the
  other container-tier stories `Scroller`/`ScrollBar`; verified the sibling stories all use that
  category). Passes the headless smoke test
  (`kitchen-sink.smoke.spec` — mounts, paints, unique id, required metadata).
- **Demo** `packages/examples/tree-demo/main.ts` + `demo:tree` script — a headless, dispatch-driven
  walkthrough, one ASCII frame per step: **expand a node → navigate ↑↓ → collapse → select (Enter)**,
  matching `demo:controls`/`demo:containers`. Backed by `tree-demo.e2e.test.ts` (spawns `tsx`, exit
  0, asserts the graph glyphs + each step's narration).

## Security (AC-13)

- Node text drawn only via `DrawContext.text` → `ScreenBuffer` + `sanitize` (no raw escapes from
  `getText` reach the terminal).
- Flattened-row access is bounds-checked: `focused` clamped via `clampIndex` (RD-11); the visible
  window indexes the flattened array within `[0, n)`.
- `flattenVisible` is iterative + `MAX_DEPTH`-guarded (03-02) — the eager, caller-bounded tree can't
  drive unbounded recursion.
