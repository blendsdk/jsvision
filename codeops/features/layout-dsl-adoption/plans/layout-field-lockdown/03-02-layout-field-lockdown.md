# 03-02 — The Lockdown (#117-P4)

> **Document**: 03-02-layout-field-lockdown.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-5…FR-8 · AR-1, AR-2, AR-3, AR-4, AR-7, AR-8

## Objective

Make `setLayout()` the only way to write layout, and have the compiler enforce it.

## The target state

```ts
// packages/ui/src/view/view.ts
readonly layout: Readonly<LayoutProps> = {};

setLayout(patch: Partial<LayoutProps>): void {
  // Shallow on purpose: `size` is a discriminated union, so a deep merge would carry the previous
  // variant's fields into the new one and produce a token that matches no branch cleanly.
  Object.assign(this.layout, patch);
  this.invalidateLayout();
}
```

and, at all 10 subclasses:

```ts
override readonly layout: Readonly<LayoutProps> = { /* unchanged */ };
```

**Why a field and not a getter.** A class field cannot override an accessor, so the private-backing
-field shape breaks all ten subclass initializers at compile time (AR-2). The issue's own body
implies the accessor; that is the trap, and it is why P1 shipped without one.

**Why `Object.assign` is safe.** `setLayout` currently *replaces* the object. In-place mutation is
only observable to something holding the old reference. The sole holder is `reflow.ts:78`
(`props: view.layout`), and that `LayoutBox` is rebuilt every pass; `stack.ts:139` reads `.rect`
purely to compare values (AR-2).

## Conversion rules

**Rule 1 — wholesale write → `setLayout`.**

```ts
- this.chip.layout = { size: { kind: 'fr', weight: 1 } };
+ this.chip.setLayout({ size: { kind: 'fr', weight: 1 } });
```

Note the semantic change this *fixes*: the old form dropped every prop it omitted. Where a site
relied on that erasure, preserve intent explicitly rather than assuming — flag it.

**Rule 2 — in-place rect mutation → `setLayout({ rect })`, dropping the paired invalidate.**

```ts
- g.target.layout.rect = { x, y, width: rect.width, height: rect.height };
- g.target.invalidateLayout();
+ g.target.setLayout({ rect: { x, y, width: rect.width, height: rect.height } });
```

Every one of these 32 sites already calls `invalidateLayout()` on the next line
(`gestures.ts:42-43`, `window.ts:188-193`, `arrange.ts:18`), so this removes a step that could be
forgotten rather than adding one.

**Rule 3 — teaching demos convert but stay absolute** (AR-8). The protected lesson is the raw
spine and absolute placement, not the raw field assignment.

## Ordering — convert first, flip last (AR-7)

Every site moves while the field is still writable, so the repo stays green and each task verifies
and commits on its own. The flip is the final task and compiles clean. Flipping first is the right
*discovery* technique — it produced these counts — but it would leave the repo red for the whole
phase, and exec_plan requires a passing verify per task.

## Site inventory — 816

| Batch | Sites | Files |
|---|---|---|
| `ui/src` | 31 | 16 |
| `datagrid/src` | 12 | 5 |
| `docs-site` (`src` + `examples`) | 5 | 4 |
| `theme-designer/src` | 4 | 4 |
| `examples/**` | 61 | 30 |
| `ui/test` | 474 | 147 |
| `datagrid/test` | 167 | 75 |
| `forms/test` | 31 | 10 |
| `files/test` | 18 | 16 |
| `examples/test` | 6 | 3 |
| `docs-site/test` | 4 | 4 |
| `web/test` | 3 | 3 |

Heaviest single files: `datagrid/src/grid-panels.ts` (8), `examples/view-demo/main.ts` (7),
`examples/dropdowns-demo/main.ts` (6), `ui/src/editor/edit-window.ts` (5).

The test batches are mechanical and high-volume — they convert by file, and the compiler confirms
each batch. They are the bulk of the work and the lowest risk in it.

## The phase's own oracle

Re-run the discovery spike after the flip: mark the hatches, run `tsc` per package. **0 `TS2540`**
is AC-5. This is the same instrument that produced the baseline, which is exactly why it is
trustworthy as the close.

## Risks

| Risk | Mitigation |
|---|---|
| A site relied on wholesale replacement erasing a prop | Rule 1 flags rather than assumes; the render control in Phase 3 and the existing suites cover behaviour |
| An 11th escape hatch appears later | AC-3's grep runs over all packages, not just `ui` |
| `Object.assign` identity change bites something unmeasured | Verified against the only two readers; full suite is the backstop |
| 816 edits swamp review | Batched by directory; each batch verifies independently |
