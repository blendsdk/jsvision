# Current State: demo-app-flex-port

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Swept**: 2026-07-20 on `feat/setlayout-primitive` (clean tree), all line refs verified
> **Re-scoped**: 2026-07-20 (preflight PF-001 → AR-15; counts re-measured, PF-015)

## Existing Implementation

### What Exists

`@jsvision/examples` holds 26 demo directories plus two Storybook-for-TUI showcases. The layout DSL
(`packages/ui/src/view/dsl/`) is fully available to it — `#113` hardened it and `#117` shipped
`View.setLayout(patch)` — but six local helpers still hand-roll placement the DSL already provides.
Two of them are *exported* and carry 411 call sites between them.

### The measured surface

| Bucket | Count | Verdict |
|---|---|---|
| `at()` call sites riding the two shadows | **411** (kitchen-sink **300** · datagrid-showcase **111**) across **84** files | Converted in two lines via re-export (AR-6) |
| local placement/`row` shadows in the touched set | 5 | 4 converted + 1 already dead (AR-12) |
| local `at()`/`row` shadows outside the touched set | 3 | Deferred and named (AR-16) |
| examples — `at()`-idiom absolute writes | ~25 | Out (AR-2) |
| examples — `.layout.rect =` window placement | ~20 | Out (AR-3) |
| examples/theme-designer flex-shaped composition writes | ~47 | **Owned by PR #127** (AR-15) |

### Relevant Files

| File | Purpose | Changes needed |
|---|---|---|
| `packages/examples/kitchen-sink/story.ts:69` | Exported `at()` used by ~300 story calls | Delete body, re-export `@jsvision/ui`'s `at` (AR-6) |
| `packages/examples/datagrid-showcase/story.ts:68` | Exported `at()` used by ~111 story calls | Same (AR-6) |
| `packages/examples/wizard-demo/main.ts:52,178` | Local `place()` shadow + `row` text helper | Adopt `at`; rename `row` → `fieldRow` |
| `packages/examples/themes-demo/main.ts:37` | Local `place()` shadow (void, mutates) | Adopt `at` |
| `packages/examples/tabs-demo/main.ts:43` | Local `placed()` absolute helper | Adopt `at` (AR-13) |
| `packages/examples/kitchen-sink/stories/wizard.story.ts:113` | `row` text helper shadowing the DSL builder | Rename → `fieldRow` |

### Deferred shadows (named, not fixed — AR-16)

| File | Shape | Why deferred |
|---|---|---|
| `packages/theme-designer/src/view/gallery.ts:32` | `function at<T>(g, view, x, y, w, h)` — replaces `layout` **and** `g.add(view)` | Different signature: retiring it rewrites every call site to `g.add(at(v, …))`. The package's only headless vehicle (`host/walkthrough.ts`) does render the gallery, but the pair is a per-file conversion, not a re-export |
| `packages/theme-designer/src/view/inspector-panel.ts:55` | Same shape | Same; `walkthrough.ts` does **not** render the inspector at all, so there is no zero-diff vehicle for it today |
| `packages/examples/keyboard-mouse-playground/main.ts:126` | `const row = (y, label, value): void => …` | A `row` name shadow in an FR-4 keep-absolute demo. Mechanical, but outside every file this plan opens |

## Gaps Identified

### Gap 1: the shadow `at()` diverges from the builder it is named after

**Current behavior.** Both `story.ts` helpers do:

```ts
const layout: LayoutProps = { position: 'absolute', rect: { x, y, width, height } };
view.layout = layout;          // REPLACE — drops every other layout prop, no reflow request
```

The real builder (`packages/ui/src/view/dsl/absolute.ts:47`) does:

```ts
view.setLayout({ position: 'absolute', rect });   // MERGE + invalidateLayout()
```

**Required behavior.** One `at()` in `@jsvision/examples`, with merge semantics. (Repo-wide there are
three further local `at`/`row` shadows outside this plan's reach — see AR-16 above.)

**Fix required.** Audit every one of the 411 call sites for the two ways the swap can change
behaviour (see [03-01](03-01-shadow-retirement.md) for the audit's decision columns), then re-export.

### Gap 2: the type-check net does not cover most of what this plan touches

`packages/examples/tsconfig.json` includes only `capability-probe`, `resize-demo`,
`keyboard-mouse-playground`, `chrome-bars-demo`, `recipes`, and `datagrid-showcase`. Verified:
`npx tsc --noEmit --listFiles | grep -c packages/examples/kitchen-sink` → **0**, and likewise 0 for
`themes-demo|editor-demo|router-demo|test/`. Only `datagrid-showcase/story.ts` (~111 sites) is
typechecked by the standing build; `kitchen-sink/story.ts` + its ~300 sites, all four local-placer
demos, and the new `test/story-at.spec.test.ts` are not — demos run through `tsx`, which strips types
without checking. Task 1.5.1 supplies the one-shot sweep that makes AC-1 real.

## Dependencies

### Internal

- `View.setLayout(patch)` — shipped by the `setlayout-primitive` plan (GH #117), **PR #128 open
  against `feat/dsl-adoptation`**. Required so that the ui `at()` this plan re-exports actually
  *requests a reflow*: on the base branch `at()` already merges (`view.layout = { ...view.layout, … }`)
  but does **not** call `invalidateLayout()`, so ST-4 would be unsatisfiable without #128. This plan
  must branch from `feat/dsl-adoptation` **after** #128 merges, or from #128's head.
- `at` — exported from the `@jsvision/ui` barrel since #113 (`packages/ui/src/index.ts:65`).
- Examples tests import the **built** `@jsvision/ui` dist, so the `build` step of `yarn verify` is
  load-bearing; a stale dist silently invalidates the buffer diffs.

### External

None. Both packages are private-until-release and zero-runtime-dependency.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A call site relies on the shadow's **replace** semantics to clear a previously-set layout prop | Low | High — silent visual break in a showcase story | The 03-01 audit's "does the view carry another layout prop at call time?" column; ST-2 pins the merge contract |
| The added `invalidateLayout()` fires during a draw pass and loops | Very low | High | `RenderRoot.flush()` snapshots `needsReflow` before composing, so a draw-time `markRelayout` lands next frame and cannot re-enter — established during #117 |
| A type error lands in one of the ~300 untypechecked kitchen-sink sites | Medium | Medium | Task 1.5.1's one-shot `tsc --noEmit` sweep with a temporary include over `kitchen-sink` + `test` |
| The kitchen-sink smoke suite passes on a wrong-but-nonempty screen | Medium | Medium | It asserts only `paintedCells(...) > 0`; the audit table plus the two showcase screen diffs are the real Phase-1 evidence (AC-5) |
| Buffer diffs compared against a stale `@jsvision/ui` dist | Medium | High | Baselines and post-conversion captures are both taken after a `yarn build` |
| Merge conflict with PR #127/#128, both open against `feat/dsl-adoptation` | Medium | Low | This plan's six source files are **verified disjoint** from #127's diff; the only overlap is the two roadmap files, resolved manually at close-out |
