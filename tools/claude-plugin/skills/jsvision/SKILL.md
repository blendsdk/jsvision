---
name: jsvision
description: >-
  Build terminal-UI (TUI) applications with the jsvision SDK (@jsvision/ui). Use when the user wants
  to create, build, run, extend, or debug a jsvision app, a Turbo Vision-style terminal app, or any
  @jsvision/* TUI in this repo — including composing views, wiring reactivity, authoring custom
  widgets, theming, and verifying apps headlessly.
---

# Building jsvision apps

You are an expert developer of **jsvision** terminal-UI applications. jsvision is a Turbo
Vision-style TUI SDK: a retained widget tree, Solid-style fine-grained reactivity, a cell-accurate
layout/render engine, and an app shell (desktop, windows, menus, status line) — all behind one
import.

## Mental model

- **One import.** Everything comes from `@jsvision/ui` — widgets, layout, reactivity, the app shell,
  and re-exported `@jsvision/core` essentials. Import `@jsvision/web` only for the browser runtime
  (`mountApp`) and `@jsvision/files` only for the file dialogs/editor.
- **Retained tree + signals.** You build a tree of `View`s (leaves) and `Group`s (containers) once,
  then bind reactive `signal`s to them; the framework repaints the minimal damage on change.
- **App lifecycle.** `createApplication(opts)` → `app.desktop.addWindow(win)` → `await app.run()`.
  `run()` connects a real terminal and restores it on every exit path. In the browser, `mountApp`
  replaces `run()`.

A hello-world:

```ts
import { createApplication, Window, Text } from '@jsvision/ui';

const app = createApplication({});
const win = new Window('Hello');
win.layout.rect = { x: 2, y: 2, width: 30, height: 6 };
win.add(new Text('Hello, jsvision!'));
app.desktop.addWindow(win);
await app.run();
```

## Non-negotiables (get these wrong and nothing paints)

1. **Build apps as `packages/<app>/` in this monorepo.** `@jsvision/ui` is unpublished; a workspace
   package resolves it. Start every new app with the `/jsvision-new-app <name>` command — do not
   hand-roll the package.
2. **ESM `.js` specifiers.** Imports use `.js` even for `.ts` sources (`from './foo.js'`). NodeNext.
3. **Leaf views need `measure()`.** A custom `View` in an `auto`-sized slot with no `measure()`
   collapses to `{0,0}` and draws nothing.
4. **`bind()` goes in `onMount`, never the constructor** — the reactive scope only exists after
   mount.
5. **Finish every app by reading `references/gotchas.md`** and checking your code against all 12
   footguns. This is where "works" and "expert" diverge.

## Where to look (routing table)

Open the reference that matches the task; open `gotchas.md` before you call an app done.

| Task                                                                    | Open                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Start a new app                                                         | run `/jsvision-new-app <name>`, then `references/app-lifecycle.md` |
| App shell: windows, menus, status line, commands, `run()`               | `references/app-lifecycle.md`                                      |
| Reactivity: `signal`/`computed`/`effect`/`Show`/`For`, `view.bind`      | `references/reactivity.md`                                         |
| Placing/ sizing views: absolute rects, the `col`/`row` DSL, `measure()` | `references/layout.md`                                             |
| Pick a widget ("what shows a table/date/tree?")                         | `references/component-catalog.md`                                  |
| Colors/themes: presets, `createTheme`, `app.setTheme`, depth            | `references/theming.md`                                            |
| Author a custom widget (subclass `View`)                                | `references/widget-authoring.md`                                   |
| Run + verify an app (three run modes, headless smoke)                   | `references/running-and-testing.md`                                |
| Complete example apps by archetype                                      | `references/recipes/index.md`                                      |
| **Debugging "nothing paints", a hung modal, a leak**                    | `references/gotchas.md`                                            |
