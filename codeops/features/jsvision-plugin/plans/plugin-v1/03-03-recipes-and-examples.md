# Recipes & Examples

> **Document**: 03-03-recipes-and-examples.md
> **Parent**: [Index](00-index.md)

## Overview

Four verified recipe apps (one per archetype, AR-4) plus one example custom widget (AR-16), all as
**real modules under `packages/examples/recipes/`**, smoke-tested by the existing harness (AR-5).
The plugin's `recipes/*.md` (03-02) embed literal, drift-checked copies of these modules so taught code == running code. Owns FR-6,
FR-7 (the example widget).

## Architecture

### Location & conventions

```
packages/examples/recipes/
├── data-grid/          # archetype 1: data-driven & master-detail
├── form-dialog/        # archetype 2: forms, dialogs & wizards
├── file-tools/         # archetype 3: file & text tools
├── live-dashboard/     # archetype 4: live/dashboard (+ a browser-hosted variant)
└── custom-widget/      # the example custom widget (FR-7)
packages/examples/test/
├── recipes.smoke.spec.test.ts     # mount each recipe headless → paintedCells > 0 (+ behavior ST)
└── recipes-*.e2e.test.ts          # optional child-process walkthroughs where interactive
```

Each recipe module carries comment-delimited region markers (`// #region example … // #endregion example`)
so `check-plugin.mjs` can extract that region; each recipe `.md` **embeds a literal copy** of it — a
skill file has no build step, so there is no `<<<` transclusion (PF-002). Modules are SSR/headless-safe
(no hard DOM/`@xterm` except the isolated browser-mount layer), matching `defineExample`. Add `recipes/`
to `packages/examples/tsconfig.json`'s include so the modules typecheck; the recipe *tests* live under
`packages/examples/test/` to match the vitest `unit` glob (PF-004).

### The four recipes

- **`data-grid/`** — `DataGrid<T>` over a typed row `signal`, with `focused`/`selected`/`sort`
  signals, click-to-sort, and a detail `Text` bound to the selected row (master-detail). Teaches
  reactive data + `DataGrid` + selection wiring.
- **`form-dialog/`** — a `Dialog` opened via `execView`, hosting `Input`s with `filter`/`range`/
  `picture` validators, `CheckGroup`/`RadioGroup`, and `okButton`/`cancelButton`; the `valid()`
  gate vetoes OK on an out-of-range field then resolves once corrected. Teaches forms + modal
  lifecycle + validation.
- **`file-tools/`** — a `FileDialog`/`FileEditor` flow from `@jsvision/files` over an injected
  `FileSystem` (a temp dir on Node, or `createBrowserFileSystem`), plus a `Memo`/`Editor`. Teaches
  the files family + editor.
- **`live-dashboard/`** — `ProgressBar` + `Spinner` advanced by the emit-a-tick idiom (a timer that
  bumps signals and emits a no-op command per frame), plus a browser-hosted variant that runs the
  same app via `mountApp` (`@jsvision/web`). Teaches live updates + the three run modes.

### The example custom widget (FR-7 / AR-16)

`custom-widget/` — a small, genuinely useful widget (e.g. a labelled key/value badge strip or a
sparkline) that subclasses `View`, implements `measure(available)` (returns a non-zero size),
`draw(ctx)` (via the clipped `DrawContext`), and binds a `signal` in `onMount` so an update
repaints. It follows the repo's authoring conventions (user-facing JSDoc + `@example`; no TV/C++
provenance since it is a new component). `widget-authoring.md` (03-02) walks through it.

## Implementation Details

### Test wiring (reuses the existing harness)

- `recipes.smoke.spec.test.ts` iterates the recipe modules: `createRoot((dispose) => { mount via
  createRenderRoot; expect(paintedCells(rows) > 0); dispose() })` — the `kitchen-sink.smoke`
  pattern. Adds behavior assertions per ST (sort order, `valid()` veto, progress advance, widget
  `measure()` non-zero, bound-update repaint).
- Interactive flows that need synthetic dispatch (the modal veto/resolve) use `createEventLoop` +
  synthetic `key`/mouse events, asserting on the composed buffer / resolved command — the
  `containers-demo` pattern.
- The browser variant is exercised headlessly via an `@xterm/headless` terminal + `mountApp`
  (`web/test` pattern) or, at minimum, typechecked; no real browser needed in CI.

### Recipe `.md` embedding

Each `recipes/<name>.md` in the skill **embeds a literal copy** of the module's `example` region and
links to the full module. `check-plugin.mjs` asserts the embedded block equals the source region
(ST-15); a future `--fix` mode can regenerate it.

## Integration Points

- Quoted by `03-02` `recipes/*.md`; drift-gated by `03-01` `check-plugin.mjs`.
- Live in `packages/examples`, so `yarn verify` (turbo `test`) already runs their specs.
- Reuse SDK entry points from `@jsvision/ui`/`/web`/`/files` by name (built dist).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A recipe fails to paint headless | smoke spec fails (`paintedCells === 0`) | AR-5 |
| `file-tools` touches the real disk in tests | Inject a temp-dir / virtual `FileSystem`; never write outside it | AR-17 |
| Browser variant pulls DOM into the smoke path | Keep the mount layer isolated; smoke path stays headless-safe | AR-5 |

> **Traceability:** Strategies reference the register entries that resolved them.

## Testing Requirements
- Spec tests: paint smoke + per-recipe behavior (ST-7…ST-11) and the example-widget `measure()`/
  repaint (ST-11).
- Impl/e2e: optional child-process walkthroughs for the interactive recipes.
