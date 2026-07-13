# Current State — layout-dsl

> **Feature**: jsvision-ui · **Plan**: layout-dsl

Facts verified against the code this session. Paths are repo-relative.

## The layout engine (`packages/ui/src/layout/`)

- **`types.ts`** — `LayoutProps` carries `position?: 'flow' | 'absolute'` (`:73`) and an absolute
  `rect?` (`:79`). `normalizeProps` fills defaults (`direction:'row'`, `size:'auto'`,
  `align:'stretch'`, …) and returns `ResolvedProps` with `position` + a normalized `rect` present only
  for `'absolute'` (`:193-205`). `Size` = `fixed | fr | auto`. **The engine addition (FR-7) extends
  `position` to include `'fill'` here.**
- **`layout.ts`** — `layoutContainer` splits children into flow vs absolute
  (`flowChildren = resolved.filter(c => c.props.position !== 'absolute')`, `:88`), solves the flow
  track, then `placeAbsolute` places each absolute child at `content.{x,y}+rect` and recurses
  (`:120-130`). **`'fill'` is placed like absolute but at the content-box rect `{0,0,contentW,contentH}`
  and joins the same non-flow filter.**
- **`measure.ts`** — `naturalSize` excludes absolute children from a container's intrinsic size
  (`:50`). **`'fill'` joins that exclusion (AR-8).**
- **`layout(root, viewport)`** ignores the root's own `size` and fills the viewport (`layout.ts:34-36`)
  — "root fills both axes" is already the default.

## The view/reflow spine (`packages/ui/src/view/`)

- **`view.ts`** — `bounds` is a plain field written by the layout pass (`:65`); there is **no**
  per-view "bounds changed" hook. `measure?()` is the only intrinsic-size seam (`:71`). `layout`
  is a public mutable field (`:69`). `invalidateLayout()` requests a reflow via the host (`:184`).
  `centered` (`:86`) makes the reflow re-center a view within its parent every pass.
- **`group.ts`** — `Group.background?: ThemeRoleName` fills the group rect before children paint
  (`:63`, `:75-79`); `add(child)` appends + reflows (`:88-95`). Paint order = child array order.
- **`reflow.ts`** — `reflow(root, viewport)` builds a fresh `LayoutBox` tree from the live views
  (reading `view.layout`), runs `layout()`, writes each rect back to `view.bounds`, then
  `applyCentering` re-centers every `centered` view **in the same pass** (`:34`, `:47-60`) — this is
  why a centered modal re-centers lag-free.
- **`render-root.ts`** — `resize(size)` and `markRelayout()` both set `needsReflow` and `flush()`
  runs `reflow()` + a full recompose (`:269-274`, `:326-329`). **This is why the builders' output
  auto-adjusts on any resize with zero extra code (FR-9).**

## Conventions in force

- Explicit named re-exports through each subsystem barrel into `src/index.ts` (the layout types
  `LayoutProps`/`Size`/`Direction`/`Rect` are already public — verified in `src/index.ts`; the DSL
  ships through the `view/` barrel since it builds `View`/`Group` — AR-5).
- **Layering (verified):** `layout/` has **zero** runtime dependency on `view/`; `view/` imports
  `layout/` (6 files). This is why the DSL builders live in `view/dsl.ts`, not `layout/` — see AR-5.
- UI `tsconfig` `include: ["src"]` — `test/` is not type-checked; vitest does not type-check
  (AR-10). Spec oracles must assert runtime behavior.
- `check-jsdoc.mjs` / `check:docs` fail on any public export missing `@example` or on any banned
  CodeOps/TV ID in shipped `src`.

## Design provenance

The API shape and resize behavior were validated with a throwaway pure-user-land prototype (a working
step, not a retained artifact) that type-checked against the built `.d.ts`. The full, self-contained
design is captured in 03-01 (builders) and 03-02 (engine `fill` mode); implement from those. The one
substantive change vs. the user-land proof: the self-correcting draw-time fill becomes the engine
`position:'fill'` mode (03-02), so overlay fills re-solve during the layout pass with no settle.
