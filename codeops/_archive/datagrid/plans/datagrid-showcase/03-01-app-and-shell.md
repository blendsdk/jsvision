# 03-01 — App, Shell & Wiring

> **Parent**: [Index](00-index.md) · **Component of**: Phase 1

The runnable app skeleton, the dedicated shell, and the package/tooling wiring.

## Files

```
packages/examples/datagrid-showcase/
  main.ts        # TTY guard → createDatagridShowcase(caps).run()
  shell.ts       # dedicated shell (sidebar nav + menu + status + welcome), focused copy of kitchen-sink/shell.ts
  story.ts       # Story contract + at()/firstFocusable() (copy of kitchen-sink/story.ts)
  window.ts      # grey StoryWindow canvas (copy of kitchen-sink/window.ts)
  stories/
    index.ts     # explicit STORIES registry (one import + one entry per demo/placeholder)
```

## `main.ts`

Mirror `kitchen-sink/main.ts` exactly (AR #7): if `process.stdout.isTTY !== true`, print a one-line
"needs a real terminal — run `yarn workspace @jsvision/examples demo:datagrid`" notice and return 0;
else resolve caps (force SGR mouse + UTF-8, as kitchen-sink does) and `return
createDatagridShowcase(caps).run()`. The `.then(code => process.exit(code)).catch(...)` tail is
identical.

## `story.ts`, `window.ts`

Verbatim copies of `kitchen-sink/story.ts` and `kitchen-sink/window.ts`, renamed only where a symbol
would collide across the two example apps. `story.ts` exports `StoryContext`, `Story`, `at()`,
`firstFocusable()` — the datagrid `test/kitchen-sink/story.ts` is the same trimmed model, so the
demos and the smoke test both bind to this contract.

## `shell.ts`

A focused copy of `kitchen-sink/shell.ts` — `createDatagridShowcase(caps): Showcase` returning
`{ app, run, disposedCount }`. Keep the whole navigator apparatus (sidebar `ListBox` from `buildNavRows`,
per-category menu from `buildMenu`, status line, `NavKeys` `Ctrl`+←/→, welcome catalog, `showStory` /
`disposePrevious` swap). Category order is first-seen from the registry, so the sidebar reads:
Foundation · Editing · Cell editors · Formatting · Sorting · Filtering · Roadmap. The welcome screen
titles the app "DataGrid Showcase" and lists the categories with their demo counts.

**Test seam (sanctioned divergence from the verbatim copy).** The dedicated shell adds one read-only
`disposedCount(): number` accessor that increments inside `disposePrevious()` (each time a story's
reactive owner is disposed). The headless walkthrough (`07 §Walkthrough oracle`) drives navigation
through the **real** command path — `app.loop.emitCommand(story.id)` → the shell's `CommandSink` → the
private `showStory` — so it never needs `showStory` exposed and never calls `run()` (which asserts a
TTY, `run.ts:128`). `disposedCount()` is the only added surface, and it lets ST-9 observe the
dispose-previous lifecycle directly rather than inferring it from the buffer. AR #7 permits the focused
copy to diverge; the general kitchen-sink shell is untouched.

Datagrid-specific chrome (data-source-size toggle, theme switcher) is a deferred Should — the copy is
a focused clone now, not a shared module (AR #7 / RD AR #35); the general kitchen-sink shell is not
touched.

## `stories/index.ts`

The explicit aggregation registry (the examples idiom): one import + one array entry per demo.
Groups by `category`; the eight placeholder panels register under `category: 'Roadmap'`. Adding a
demo later is one file + one line (RD AC #7).

## Package & tooling wiring

- **`packages/examples/package.json`**:
  - `scripts`: add `"demo:datagrid": "tsx datagrid-showcase/main.ts"`.
  - `dependencies`: add `"@jsvision/datagrid": "0.2.0"` (private, workspace-resolved to `./dist`;
    turbo `typecheck`/`test` `dependsOn ^build`/`build` builds datagrid first).
- **`packages/examples/tsconfig.json`**: add `"datagrid-showcase"` to `include` so `tsc --noEmit`
  typechecks every demo (AR #2). (Test files are picked up by vitest, not this include.)
- **Root convenience script** (optional, matching `yarn designer`): a root `datagrid-showcase` alias
  MAY be added; not required by the acceptance criteria.

## Verify seam

The headless walkthrough (`07`) drives the **shell factory** `createDatagridShowcase` directly via
`app.loop.emitCommand`, so the interactive `app.run()` path is never mounted in CI. `main.ts` is
TTY-gated (mirrors `kitchen-sink/main.ts`: non-TTY → print the notice, return 0) and — like the
kitchen-sink `main.ts` — is not itself unit-tested; the two tiers assert the shell + demos, not the
`main.ts` entry tail.
