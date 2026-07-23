---
name: jsvision
description: Build, extend, debug, test, and review professional JSVision terminal applications using @jsvision/core, @jsvision/ui, @jsvision/forms, @jsvision/datagrid, @jsvision/files, and @jsvision/web. Use for new JSVision apps, Turbo Vision-style TUIs, application shells, responsive layouts, reactive state, forms, editable enterprise grids, file tools, browser terminals, custom widgets, themes, accessibility, performance, security, headless rendering, and production-readiness work.
---

# Build professional JSVision applications

Treat JSVision as a retained terminal application framework, not printed output. Build a persistent `View` tree, size it with the layout DSL, drive it with signals, and let the render root repaint damaged cells.

## Work from evidence

1. Inspect the target package, nearby apps, and installed `@jsvision/*` versions.
2. Use public exports and this skill's API reference. Never copy internal symbols into app code.
3. Obey repository instructions and use its generators and gates.
4. For version-sensitive details, inspect installed declarations or public barrels.
5. Do not claim success from typechecking alone. Render, interact, and test.

## Select packages

- Use `@jsvision/ui` for views, layout, reactivity, input, shell, dialogs, and standard widgets.
- Use `@jsvision/core` for capabilities, theme presets/types/generation, color and contrast utilities,
  and engine work. Import only from its public barrel.
- Use `@jsvision/forms` for headless form state, Zod validation, bindings, and form dialogs.
- Use `@jsvision/datagrid` for editable, typed, windowed enterprise grids. Use UI `DataGrid` for read-oriented tables.
- Use `@jsvision/files` for filesystem abstractions, dialogs, navigation, and editing.
- Use `@jsvision/web` for browser hosting, virtual filesystems, clipboard, and key reclaim only when
  working inside this repository; it is not part of the current public npm release.

Read [architecture.md](references/architecture.md) before designing a multi-screen or data-heavy app.

## Execute the workflow

1. Clarify users, terminal sizes, keyboard workflows, volume, persistence, and host.
2. Sketch screens and command ownership. Separate domain state and services from views.
3. Use the supported generator. Otherwise create a Node 22+, ESM TypeScript package with `.js` relative specifiers.
4. Build shell and layout first with `col`, `row`, `stack`, `grow`, `fixed`, `fill`, and `spacer`.
5. Add `signal`, `computed`, `effect`, and owned cleanup. Put `view.bind` in `onMount`.
6. Choose standard widgets via [component-catalog.md](references/component-catalog.md).
7. Use [forms.md](references/forms.md) and [datagrid.md](references/datagrid.md) when relevant.
8. Wire one command vocabulary across menus, status items, accelerators, and buttons.
9. Add loading, empty, error, confirmation, narrow-terminal, and capability-degradation states.
10. Follow [quality-workflow.md](references/quality-workflow.md) and [gotchas.md](references/gotchas.md).

## Preserve rendering invariants

- Use the DSL for normal content. Reserve rectangles for top-level placement and genuine overlays.
- Implement `measure()` for custom auto-sized leaf views.
- Bind after mount; dispose roots, effects, timers, subscriptions, and async work with the owner.
- Request repaint for visual changes and reflow for desired-size changes.
- Draw through clipped `DrawContext`; never emit ANSI from a widget.
- Preserve keyboard operation, focus order, visible focus/selection, accelerators, and contrast.

## Route reference loading

| Task                                    | Read                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| Architecture and production boundaries  | [architecture.md](references/architecture.md)             |
| Shell and lifecycle                     | [app-lifecycle.md](references/app-lifecycle.md)           |
| Layout and terminal sizes               | [layout.md](references/layout.md)                         |
| Signals and ownership                   | [reactivity.md](references/reactivity.md)                 |
| Widget selection                        | [component-catalog.md](references/component-catalog.md)   |
| Forms                                   | [forms.md](references/forms.md)                           |
| Enterprise grids                        | [datagrid.md](references/datagrid.md)                     |
| Themes, palettes, contrast, and shadows | [theming.md](references/theming.md)                       |
| Runtime theme designer and live preview | [theme-designer.md](references/recipes/theme-designer.md) |
| Custom widgets                          | [widget-authoring.md](references/widget-authoring.md)     |
| Exact UI/files/web API                  | [api/index.md](references/api/index.md)                   |
| Complete patterns                       | [recipes/index.md](references/recipes/index.md)           |
| Verification                            | [quality-workflow.md](references/quality-workflow.md)     |
| Diagnosis                               | [gotchas.md](references/gotchas.md)                       |

## Require a professional completion bar

1. Typecheck and run focused tests.
2. Run JSVision doctor or equivalent static checks.
3. Render deterministic screens at normal and constrained sizes.
4. Exercise keyboard navigation, focus, accelerators, modals, and mutations.
5. Test relevant empty, loading, error, invalid, and large-data states.
6. Confirm cleanup on replacement and shutdown.
7. Run the repository's broader gate when repository-local.
8. Report commands, results, and unverified interactive behavior.
