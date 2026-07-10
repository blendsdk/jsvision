# 02 — Current State

> **Feature**: docs-website · **CodeOps Skills Version**: 3.3.2

What exists today and where each bug lives. All paths are repo-relative; line numbers are from the
code read during triage (see `../_draft/live-example-bugs.md` for the full analysis).

## The Play layer (workstream A, C-trigger, D-embed)

- **`packages/docs-site/.vitepress/theme/components/PlayExample.vue`** — the client-only Play button
  → modal xterm. `createTerminal` (`:67`) builds a fresh `Terminal` + `FitAddon`, `term.open(el)`,
  `fit.fit()`. `toggleSize` (`:116`) flips between two hardcoded presets (`SIZES`, `:43`) by calling
  `controller.remount({ size })`. The terminal host div `.play-term` has `overflow:hidden` and no
  resize affordance; the modal is capped at `95vw/90vh` (`:246`). **Bug #1 lives here** (remount +
  container-capped fit → viewport/terminal desync). The wheel is not `preventDefault`ed → **the
  wheel-leak** is here too.
- **`packages/docs-site/src/play/play-controller.ts`** — the headless lifecycle. `open` (`:122`)
  loads the module, builds via `demoShell`, calls `opts.createTerminal(el)`, `mountApp` (`:138`).
  `remount` (`:163`) = `close()` then `open()` — a full teardown/rebuild. Build size comes from the
  controller's `size` field (`:113`), independent of the terminal's real fit size — the desync.
- **`packages/web/src/mount.ts`** — `mountApp`. **Already supports live resize**: `term.onResize →
  loop.resize` (`:101`). The fix reuses this instead of remounting.

## The demo shell (workstream B)

- **`packages/docs-site/src/demo-shell.ts`** — `demoShell` (`:112`) normalizes content: a bare `View`
  → `shellForView` (owns a `createApplication` + centers the view on the desktop, `:163`); an
  `Application` → returned as-is with `wireCommands` (`:117`). `demoApp` (`:149`) builds a
  chromed app for Application-returning examples. Two chrome modes: `minimal` (status-line-only,
  `:220`) and `full` (menu bar + status, `:202`). **Bugs #4/#5/#6 live here**: `placeContent`
  (`:179`) adds a bare view straight onto the `Desktop` (whose `draw` fills with `role.pattern`,
  `packages/ui/src/desktop/desktop.ts:115`) → the dot background behind components (#4); `minimal`
  puts Theme/Depth/About only in the status line (#5); the three chrome paths differ (#6).
- **`packages/docs-site/examples/apps/desktop.ts`** — self-chromes via `createApplication` (`:73`)
  with its OWN `≡`/`Window` menu + status. `demoShell` only calls `wireCommands` on it → the shared
  `demo.theme.N`/`demo.depth.N` handlers are registered but **unreachable** (no menu/status item
  emits them). **Bug #6's concrete defect.**
- **`packages/docs-site/examples/index.ts`** — the registry; each entry declares a `chrome` mode
  (`minimal`/`full`). Component demos (`controls/button`, `input`, `containers/list-box`) are
  `minimal`; `data-grid`/`preset-gallery`/dialogs/desktop are `full`.

## The dialog examples (workstream C)

- **`packages/docs-site/examples/controls/form-dialog.ts`** (`:49-50`) and
  **`packages/docs-site/examples/files/file-dialog.ts`** (`:44`) — build a `demoApp(ctx,'full')`,
  add the dialog to the desktop, and call `execView` once in `build()`. On OK/Cancel/Esc the example
  is dead — **bug #7**.

## The DataGrid render path (workstream A / #3)

- **`packages/ui/src/table/grid-rows.ts`** — `GridRows.draw` (`:167`) pans columns by
  `x = starts[c] − indent` (`:214`) and draws a `│` at `x + widths[c]` (`:217`). At `indent>0` the
  leftmost cells have negative `x` (left-clip). **Coverage gap**: the DataGrid suite exercises the
  `indent` *signal* (`test/datagrid.spec.test.ts` ST-10 asserts `indent>0`; the impl clamp test) but
  **no test inspects the rendered buffer at `indent>0`** — the negative-`x` cell-clip / divider path
  is untested. The docs `table/data-grid.ts` example uses City `1fr` → `maxIndent=0` → it can never
  H-scroll, so the reported garble was not this example's H-scroll (see triage §Bug #3 repro).

## The docs pages (workstream D)

- **`packages/docs-site/components/**/*.md`** + **`apps/desktop.md`** — each embeds the whole example
  module via `<<< @/examples/<category>/<name>.ts` under a "Source" heading with a caption. The whole
  module leads with a large JSDoc + imports + data before `build()` — **bug #2**.
- **`packages/docs-site/scripts/check-docs-build.mjs`** — the build-output gate; its LIVE-EXAMPLES
  guard asserts every live-example page embeds its source (`<<<`) + mounts `<PlayExample>`. The drift
  spec (RD-03 ST-3) asserts a whole-file `<<<` + no pasted block. **Both change** under AR-9.

## Test harness (all workstreams)

- **`packages/docs-site/test/*.{spec,impl}.test.ts`** — the live-example harness (paint-smoke,
  snippet-drift, DemoShell, Play controller). Joins `yarn verify` via docs-site's `test` + `typecheck`.
- **`packages/ui/test/datagrid.*.test.ts`** — the DataGrid suite (the #3 golden lands here).
