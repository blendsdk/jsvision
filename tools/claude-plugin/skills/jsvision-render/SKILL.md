---
name: jsvision-render
description: Print a headless ASCII "screenshot" of a jsvision app or view so you can SEE the layout (clipping, overlap, wrong position) without an interactive terminal. Use it to verify a screen after composing or changing UI — it is the visual complement to paintedCells>0.
argument-hint: '<module> [--export name] [--pick prop] [--size WxH] [--keys "tab enter"]'
allowed-tools: 'Bash Read'
---

# Screenshot a jsvision app headlessly

Mount an app or a single view into an offscreen buffer and print the composed screen as framed ASCII.
This closes the write → **see** → fix loop: `paintedCells > 0` tells you _something_ painted;
this shows you _what_, so you catch clipping, overlap, and misplacement without a TTY.

## What to do

1. Render the target (build the packages first if `dist/` is stale — it imports the built
   `@jsvision/ui`):

   ```bash
   yarn render:app <module> [--export name] [--pick prop] [--size WxH] [--keys "tab enter"]
   ```

   - `<module>` — path to the app/view module (e.g. `packages/todo/src/main.ts`).
   - `--export` — the export to render. Defaults to `buildApp`, then `build`, then `default`. A
     function is called with no args; the result may be an `Application` or a `View`/`Group`.
   - `--pick` — read a property off the built object, for a recipe-style handle
     (e.g. `--export buildPeopleGrid --pick root`).
   - `--size WxH` — the viewport (default `80x24`). Render at a few sizes to check reflow.
   - `--keys` — a space-separated chord sequence dispatched before the screenshot, to show state
     after interaction: `--keys "tab tab enter"`, `--keys "down down space"`, `--keys "ctrl+s"`.

2. Read the frame. The border marks the exact viewport bounds, so content spilling to the edge or
   leaving unexpected gaps is obvious. Compare it to what you intended; if a view is missing, it
   probably collapsed to `{0,0}` (run `/jsvision-doctor` — likely a missing `measure()`).

## Examples

```bash
# A scaffolded app's default window at 80×24:
yarn render:app packages/todo/src/main.ts

# A single recipe view at a small size:
yarn render:app packages/examples/recipes/data-grid.ts --export buildPeopleGrid --pick root --size 40x12

# A form after tabbing to the second field and typing:
yarn render:app packages/todo/src/main.ts --keys "tab tab enter" --size 60x20
```

## Notes

- It runs in this monorepo (the supported target); it imports the built `@jsvision/ui`, so run
  `yarn build` if you have not built since your last change.
- Reactive-leak warnings on stderr when rendering a bare handle (not a mounted app) are harmless — the
  screenshot is on stdout.
- Colors are not shown (ASCII only), but glyphs, geometry, and text are — enough to verify layout.
