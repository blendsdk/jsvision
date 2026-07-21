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

**Why `Object.assign` is safe — and the one place it is not.** `setLayout` currently *replaces* the
object, so in-place mutation is observable to anything holding the old reference. The full holder
inventory (corrected at preflight; the original survey covered `src/` only):

| Holder | Shape | Effect of in-place mutation |
|---|---|---|
| `view/reflow.ts:78` | `props: view.layout` | none — the `LayoutBox` is rebuilt every pass |
| `view/dsl/stack.ts:139` | `const cur = view.layout.rect` | none — compares by value |
| `datagrid/src/overlay.ts:106` | `const pre = view.layout` | none — read precedes the write |
| `datagrid/test/kitchen-sink/story.ts:56` | parameter alias | none after conversion |
| **`datagrid/src/grid-panels.ts:201`** | **module-level `const fr: LayoutProps`**, assigned as `.layout` to up to 3 views per segment plus the footer band (`:546`, `:550`, `:554`, `:634`), for **every grid in the process** | **real** — a later `setLayout()` on any view still holding `fr` would mutate it for every other grid |
| `ui/test/view-setlayout.impl.test.ts:52`, `:115` | `expect(v.layout).not.toBe(before)` | **asserts the opposite of the new contract** — see below |

The `fr` hazard is closed **by the conversion itself**: once `header.setLayout(layout)` copies props
into each view's own object, nothing aliases the singleton. That is a consequence rather than a
plan, so task 2.2.3 states it explicitly — and it stops holding for any `.layout = <shared object>`
write that escapes conversion.

**Two committed impl tests assert the replace contract** and must be inverted with the flip, not
discovered during it: `view-setlayout.impl.test.ts:41-54` (ST-I1, *"replaces the object"*) and
`:106-115` (ST-I4, whose comment reasons from `view.layout.rect = …` sites this phase is removing).
Both are `.impl.`, so AC-6 does not block the edit; each gets a recorded verdict.

## Conversion rules

**Rule 1 — wholesale write → `setLayout`.**

```ts
- this.chip.layout = { size: { kind: 'fr', weight: 1 } };
+ this.chip.setLayout({ size: { kind: 'fr', weight: 1 } });
```

Note the semantic change this *fixes*: the old form dropped every prop it omitted.

**Rule 1a — the three sites that relied on that erasure convert explicitly** (AR-16). These are not
"flag it if you notice"; they are known, named, and decided:

| Site | Documented intent | Conversion |
|---|---|---|
| `app/application.ts:334` | *"a caller's own layout on the content view is intentionally discarded"* | `body.setLayout({ size: {…}, direction: undefined, padding: undefined, position: undefined, rect: undefined, … })` |
| `datagrid/src/overlay.ts:129` | *"an overlay can never be dragged off its cell by the view it hosts"* | same shape, keeping `position: 'absolute'` + `rect` |
| `datagrid/src/editing.ts:233` | *"an editor always fills its cell no matter what the factory set"* | same shape, keeping `position: 'fill'` |

The explicit `undefined` reset is a documented, pinned contract (`view.ts:232-234`), not a trick.
The last two sit on customization seams (`filterPopup`, `createCellEditor`) where a third-party
layout is exactly what is expected, and `padding` is the load-bearing prop in a replace→merge swap.

**Rule 2 — in-place rect mutation → `setLayout({ rect })`. The 32 sites are not uniform.**

*2a — the ~6 mounted-path sites that carry a paired invalidate:* collapse the pair.

```ts
- g.target.layout.rect = { x, y, width: rect.width, height: rect.height };
- g.target.invalidateLayout();
+ g.target.setLayout({ rect: { x, y, width: rect.width, height: rect.height } });
```

*2b — the 4 sites with an `onResized()` between the write and the invalidate* —
`gestures.ts:57-59`, `gestures.ts:74-76`, `arrange.ts:18-20`, `window.ts:205-208`. That ordering is
load-bearing (*"re-pin children to the new size before the repaint reads them"*). **These are not
collapsible pairs**: replace the raw write and keep the other two statements exactly where they are.

```ts
  w.setLayout({ rect: { x, y, width, height } });
  w.onResized();        // reads the NEW rect
  w.invalidateLayout(); // reflow AFTER the re-pin
```

> **Corrected at execution (EX-5).** This document previously prescribed `w.onResized()` **first**,
> before `setLayout`. That is a defect: `EditWindow.onResized()` (`edit-window.ts:125`) calls
> `layoutGadgets()`, whose first statement reads `this.currentRect()` — i.e. `this.layout.rect` — so
> running it ahead of the write re-pins the editor and both scroll bars to the *pre-drag* geometry.

Collapsing naively would instead move the reflow ahead of the re-pin. That is harmless under the
default `queueMicrotask` scheduler (`render-root.ts:260`), where `markRelayout()` only sets a flag
and `scheduleFlush()` coalesces at most one frame per tick — so the two reflow requests above cost
one frame, not two — and **not** harmless under the synchronous scheduler the suite uses
(`view.occlusion.impl.test.ts:54,80`, `layout-dsl.spec.test.ts:94`), which flushes inline.

*2c — the ~21 pre-mount construction sites* carry **no** invalidate at all (`edit-window.ts:78`,
`kitchen-sink/shell.ts:192,230`, `amiga-clock/main.ts:105,111,117,133`,
`tvision-demo/main.ts:145,151,157`, `demo-shell.ts:216`, `shell-demo/main.ts:95`,
`matrix-rain/main.ts:111`, `live-dashboard.ts:87`, `chrome-bars-demo/tree.ts:35`,
`web-xterm/app.ts:146,152`, `datagrid-showcase/shell.ts:224,262`,
`docs-site/examples/apps/desktop.ts:69,75`, …). Plain rewrite; the invalidate `setLayout` adds is a
documented no-op while `host` is null. **Do not go looking for a call to delete here** — the
original plan said every one of the 32 carried one, and that was generalized from three samples.

**Rule 3 — teaching demos convert but stay absolute** (AR-8). The protected lesson is the raw
spine and absolute placement, not the raw field assignment.

## Ordering — convert first, flip last (AR-7)

Every site moves while the field is still writable, so the repo stays green and each task verifies
and commits on its own. The flip is the final task and compiles clean. Flipping first is the right
*discovery* technique — it produced these counts — but it would leave the repo red for the whole
phase, and exec_plan requires a passing verify per task.

## Site inventory — ~810 (re-derive before starting; see 02-current-state)

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
| `theme-designer/test` | 1 | 1 |

Heaviest single files: `datagrid/src/grid-panels.ts` (8), `examples/view-demo/main.ts` (7),
`examples/dropdowns-demo/main.ts` (6), `ui/src/editor/edit-window.ts` (5).

The test batches are mechanical and high-volume — they convert by file, and the compiler confirms
each batch. They are the bulk of the work and the lowest risk in it.

## What the flip breaks that is *not* a type error

The discovery spike asked "what stops compiling?" and never asked "what stops passing?". Four things
inside `yarn verify` break with the flip and must land in the same phase (FR-13):

| Artifact | Why it breaks | Fix |
|---|---|---|
| `docs-site/test/jsdoc-examples.spec.test.ts` | Compiles every shipped `@example`. `window.ts::Window` and `application.ts::createApplication` are unlisted, so they must compile — they gain `TS2540`. `desktop.ts::Desktop` is allowlisted as `codes:[2322]` exactly, so the added code makes it mismatch | Rewrite the 3 blocks to `setLayout({ rect })`; re-verify the `Desktop` entry (it may become stale and need deleting) |
| Plugin API-ref snapshot | Records `layout: LayoutProps` in 5 rows; the type and its JSDoc both change | `yarn plugin:sync --fix` + commit. Deterministic, no API key. `--detect` does not catch it |
| `ui/test/view-setlayout.impl.test.ts` | ST-I1/ST-I4 assert `not.toBe(before)` | Invert ST-I1, delete ST-I4, one recorded verdict each |
| 16 `docs-site/**/*.md` snippets + 8 shipped prose sites | Teach an idiom that no longer compiles | Rewrite to `setLayout`; the field's own JSDoc (`view.ts:68-73`) currently describes a hazard that ceases to exist |

## The phase's close

`turbo run typecheck` green with the flip in place, plus proof that every package's config actually
resolves its `test/` (`tsc --listFiles`) — AC-5. Note this is *not* an independent instrument: once
the flip is in the tree, "re-run the spike" is just `tsc`, which task 2.4.3 already ran. It cannot
report anything but 0. The honest close is AC-3's widened grep plus the four artifacts above.

## Risks

| Risk | Mitigation |
|---|---|
| A site relied on wholesale replacement erasing a prop | The three known ones are named and decided (Rule 1a / AR-16); the render control and existing suites cover the rest |
| An 11th escape hatch appears later | AC-3's grep runs over all packages **and their `test/` dirs** |
| `Object.assign` identity change bites something unmeasured | Full holder inventory above, including the `grid-panels.ts:201` singleton; full suite is the backstop |
| ~810 edits swamp review | Batched by directory; each batch verifies independently |
| The conversion run happens with `verify` dark | ST-7/ST-8 move to immediately before the flip, so the red window is one task, not nine |
