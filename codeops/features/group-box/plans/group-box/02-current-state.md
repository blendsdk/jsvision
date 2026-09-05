# Current State: GroupBox

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

- `Group` already owns ordered children, dynamic children, nested reactive scopes, removal cleanup,
  layout participation, and descendant focus traversal.
- `View` defaults to non-focusable, inert input behavior and `castsShadow = false`; `bind()` is owned
  by the mounted view scope.
- `DrawContext.box()` fills and draws a clipped single-line frame, centers an optional title by
  display width, and relies on renderer capability fallback. It returns before filling for bounds
  below 2×2.
- `clipCellText()` and `stringWidth()` already implement the required width-safe prefix clipping and
  measurement and are reused internally by window chrome.
- The render root composes inherited shadows under the parent's clip and accounts for their 2×1
  occlusion footprint without changing layout bounds.
- The docs site has a machine-readable component catalog, family example registries, standard
  `template1` application examples, component page validators, behavior contracts, and API map.
- The kitchen-sink has an explicit story registry and headless smoke coverage.

### Relevant Files

| File | Purpose | Changes Needed |
|---|---|---|
| `packages/ui/src/view/group.ts` | Child lifecycle and passive container behavior | Reuse unchanged |
| `packages/ui/src/view/view.ts` | Focus, bind, layout, shadow defaults | Reuse unchanged |
| `packages/ui/src/view/draw-context.ts` | Opaque clipped frame and fallback | Reuse unchanged; fill tiny bounds before calling it |
| `packages/ui/src/controls/measure.ts` | Display-cell measurement and prefix clipping | Reuse internally unchanged |
| `packages/ui/src/view/render-root.ts` | Standard shadow composition | Reuse unchanged |
| `packages/ui/src/index.ts` | Public UI package entry point | Export new class and types |
| `packages/examples/kitchen-sink/stories/index.ts` | Story registry | Register GroupBox story |
| `packages/docs-site/components.json` | Component coverage and navigation catalog | Add GroupBox entry |
| `packages/docs-site/src/example-registry/containers.ts` | Lazy container example registry | Add `kind: 'app'` example |
| `packages/docs-site/src/api/api-map.mjs` | Hand-written page ↔ generated API links | Add `GroupBox` mapping |
| `tools/jsvision-skill/references/component-catalog.md` | Canonical agent-facing component catalog | Add GroupBox guidance |

## Code Analysis

`Group.draw()` only fills when `background` is set. `GroupBox` must override `draw()` so opacity and
frame painting are unconditional and role-controlled. Inherited `Group` methods require no override.

The runtime implementation can call `ctx.fill(' ', style)` first, then `ctx.box(...)`. This closes
the tiny-bounds opacity gap without changing global `box()` semantics. For a non-empty title, draw
the undecorated frame first and overlay a caption calculated with `clipCellText()` and
`stringWidth()`. This supports all alignments without widening the public drawing interface (AR #3,
AR #4, AR #5).

The constructor can call `setLayout({ padding: options?.padding ?? 1 })`. Because `setLayout()` merges
a patch, every other `Group` layout property keeps its default and callers can change any property,
including padding, later.

## Gaps Identified

### Gap 1: No public captioned passive container

**Current Behavior:** Callers must manually combine a `Group`, opaque background, border painter,
caption math, padding, and shadow flag.

**Required Behavior:** One documented public component supplies that contract.

**Fix Required:** Add the dedicated module, exports, and contract tests (AR #2, AR #3).

### Gap 2: Existing box title supports center only

**Current Behavior:** `DrawContext.box()` centers its optional caption.

**Required Behavior:** `GroupBox` supports start, center, and end without changing the public drawing
API.

**Fix Required:** Draw the base frame and overlay the width-safe caption in `GroupBox` (AR #3–AR #5).

### Gap 3: No discovery or teaching surfaces

**Current Behavior:** The package, showcases, docs catalog, API map, and JSVision skill do not mention
`GroupBox`.

**Required Behavior:** All issue-defined and repository-required surfaces ship together.

**Fix Required:** Add the story, docs page/lab, catalog entries, skill update, generated plugin, and
changelogs (AR #6, AR #7).

## Dependencies

### Internal Dependencies

- `Group`, `DrawContext`, `ThemeRoleName`, `Padding`, `clipCellText`, and `stringWidth`.
- Existing render-root shadow, reactivity, layout, theme replacement, focus traversal, example shell,
  docs registries, TypeDoc generation, and plugin synchronization.

### External Dependencies

None. No package dependency changes are planned.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Caption overwrites a corner at narrow widths | Medium | High | Allocate only `width - 2` cells and cover widths 0–3 in ST cases |
| Wide or combining glyph drifts alignment | Medium | High | Reuse tested cell-width helpers and assert exact buffer cells |
| Tiny frame stays transparent | Medium | Medium | Fill before `box()` and assert 0×N, 1×N, and clipped cases |
| Shadow expectation tests the wrong level | Medium | Medium | Mount GroupBox as a child so render-root composition is exercised |
| Reactive getter leaks after unmount | Low | Medium | Use mounted `bind()` and assert no repaint after disposal |
| Docs example clips after resize/restore | Medium | Medium | Use `Template1Dialog` responsive layout and focused geometry tests |
| Plugin surface drifts | Medium | Medium | Edit canonical skill, run `plugin:update`, then `plugin:check` |
