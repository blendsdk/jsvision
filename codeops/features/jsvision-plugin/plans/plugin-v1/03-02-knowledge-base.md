# Knowledge Base: the `jsvision` skill

> **Document**: 03-02-knowledge-base.md
> **Parent**: [Index](00-index.md)

## Overview

The `jsvision` skill is the plugin's core: an auto-invoked router (`SKILL.md`) plus
progressive-disclosure reference files. `SKILL.md` stays concise (mental model + non-negotiables +
a routing table); depth lives in `references/` files loaded on demand. Owns FR-2, FR-3, FR-4, and
the widget-authoring reference of FR-7.

## Architecture

### `SKILL.md` (concise router — AR-14 auto-invoked)

Frontmatter:

```yaml
---
name: jsvision
description: >-
  Build terminal-UI (TUI) applications with the jsvision SDK (@jsvision/ui). Use when the user
  wants to create, build, run, or extend a jsvision app, a Turbo Vision-style terminal app, or
  any @jsvision/* TUI in this repo.
---
```

Body (short): (1) the **mental model** — single-import from `@jsvision/ui`; retained view tree +
Solid signals; `createApplication → desktop.addWindow → run()`. (2) the **non-negotiables** —
ESM `.js` specifiers; `bind()` in `onMount`; leaf views need `measure()`; build apps as
`packages/<app>/` (start with `/jsvision-new-app`). (3) a **routing table** telling the agent which
reference to open for which task, and to open `gotchas.md` before finishing any app.

### `references/` files (AR-12)

Each is a focused, example-rich page. Content is distilled from the verified sources listed in
02-current-state (barrels, `application.ts`/`run.ts`, examples) — **plain-language, user-facing,
no CodeOps/TV process IDs** (the plugin markdown follows the spirit of the JSDoc directive).

| File | What it teaches |
| ---- | --------------- |
| `app-lifecycle.md` | `createApplication` options (`caps:'auto'`, `requireTty`, `theme`, `menuBar`/`statusLine`); `app.desktop.addWindow`; `app.onCommand`; `Commands.*`; `await app.run()` + guaranteed restore; browser `mountApp`. |
| `reactivity.md` | `signal`/`computed`/`effect`/`batch`/`untrack`/`createRoot`/`Show`/`For`; the `view.bind(reader, apply, {relayout})` bridge and the **onMount-not-constructor** rule; `derived`. |
| `layout.md` | Absolute placement via `LayoutProps`/`at()` (parent-relative rects); the `col`/`row`/`stack`/`centered` DSL; `measure()` discipline; `Window`/`Dialog` `padding` inset. |
| `component-catalog.md` | The ~40 widgets grouped (controls · containers · data · feedback · date/color · editor/terminal · surface): one line each — what it is + when to reach for it + its key `*Options`. |
| `gotchas.md` | **FR-3** — the ~12 footguns, each: symptom → cause → fix. |
| `running-and-testing.md` | **FR-4** — the three run modes (Node TTY / headless compose-to-ScreenBuffer / browser); the headless-verify loop (synthetic events → `paintedCells`); the smoke + `*-demo.e2e` patterns; links to `/jsvision-new-app`. |
| `theming.md` | The 13 presets; `createTheme`; `app.setTheme`; depth downsampling; passing `theme` to `createApplication`. |
| `widget-authoring.md` | **FR-7** — subclass `View`; implement `draw(ctx)` (clipped `DrawContext`: `role`/`fill`/`text`), `measure(available)`, `onEvent`; bind reactivity in `onMount`; when to use `Group`; the repo's authoring conventions (user-facing JSDoc + `@example`; TV-fidelity discipline only when porting an existing TV component). Links to the example widget (03-03). |
| `recipes/index.md` + `recipes/<archetype>.md` | **FR-6** — one page per archetype; each **embeds a literal, drift-checked code block copied from** its real module in `packages/examples/recipes/` (03-03) and explains the pattern + where to adapt it. |

### The gotchas set (FR-3 — the expert differentiator)

`gotchas.md` must cover, each with the fix:
1. Leaf view without `measure()` collapses to `{0,0}` → override `measure(available)`.
2. `bind()` called in the constructor throws → call it in `onMount`.
3. Absolute position via `view.layout = { position:'absolute', rect }` (an `at()` helper);
   rects are parent-interior-relative.
4. `Window`/`Dialog` `padding:1` double-insets absolute children → account for it (or `padding:0`).
5. A `Dialog` with `width/height` and no `rect` auto-centers; an explicit `rect` is honored
   verbatim unless `centered:true`.
6. A signal write outside a dispatch tick marks dirty but won't paint → `loop.renderRoot.flush()`
   (or emit a no-op command under `run()`).
7. Late-added windows compose into 0×0 until a reflow → `app.loop.resize(...)` after adding.
8. A modal frame close/Esc must resolve `cancel` (not `Window.close()`), or the `execView`
   promise hangs.
9. Reactive graphs must be owned (`createRoot`) or they leak across swaps.
10. Focus `list.rows`, not the list container.
11. NodeNext ESM: `.js` in import specifiers even for `.ts` sources.
12. A custom `View` is the sanctioned escape hatch; drawing is view-local + clipped.

## Integration Points

- The routing table points at `jsvision-new-app` (03-04) for "start a new app".
- `recipes/*.md` embed literal copied blocks from `packages/examples/recipes/*` (03-03); the blocks
  are drift-checked by `check-plugin.mjs` (03-01).
- `widget-authoring.md` links to the example custom widget (03-03).

## Error Handling

Content correctness is enforced structurally, not at runtime:

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A reference links to a missing file | `check-plugin.mjs` link-graph check fails | AR-10 |
| A recipe page quotes stale code | snippet-drift check fails | AR-10 |
| SKILL description too weak to auto-invoke | Validated by the acceptance check (skill discoverable) ST-17 | AR-14 |

> **Traceability:** Strategies reference the register entries that resolved them.

## Testing Requirements
- Link-graph + drift integrity via `check-plugin.mjs` (ST-13…ST-15).
- The `gotchas.md` list is complete (all 12) — asserted by a structural check in `check-plugin.mjs`
  or a content spec (ST covered under integrity).
