---
title: I Built a Turbo Vision-Style TUI SDK for TypeScript
published: false
description: Meet JSVision, an open-source TypeScript SDK for building reactive terminal applications with windows, dialogs, forms, data grids, code editors, and browser-hosted live examples.
tags: showdev, typescript, node, cli
cover_image: https://raw.githubusercontent.com/blendsdk/jsvision/develop/assets/promo/jsvision-social-preview.png
---

I have always liked terminal applications that feel like complete environments rather than a stream
of formatted output: persistent menus, movable windows, focused controls, modal dialogs, keyboard
shortcuts, and a clear sense of place.

That idea led me to build **[JSVision](https://github.com/blendsdk/jsvision)**, an open-source
TypeScript SDK for creating full terminal user interfaces on Node.js.

![JSVision demonstrations showing its desktop, themes, data grid, code editor, and Matrix rain](https://raw.githubusercontent.com/blendsdk/jsvision/develop/assets/promo/jsvision-demo.gif)

JSVision takes visual inspiration from classic Turbo Vision applications, but its internals are
designed around modern TypeScript: ESM packages, strict public APIs, fine-grained reactive state,
headless testing, and explicit host boundaries.

You can run the applications in a native terminal or interact with the same examples in a browser
through xterm.js.

## What can you build with it?

JSVision is intended for applications that need more structure than prompts and formatted logs:

- administration consoles and operational dashboards;
- database and data-management tools;
- terminal editors and development utilities;
- interactive forms and configuration tools; and
- retro desktop-style applications.

The SDK includes application menus, windows, dialogs, buttons, text inputs, lists, trees, tabs,
scrolling containers, forms, file controls, an editable data grid, and a terminal-native code
editor.

Rather than asking each application to coordinate ANSI output, focus, clipping, keyboard decoding,
mouse input, and repainting, JSVision gives those responsibilities to the framework.

## The smallest useful application

JSVision requires Node.js 22 or newer. Install the rendering engine and UI framework together:

```sh
npm install @jsvision/core @jsvision/ui
```

Here is a small reactive counter:

```ts
import { resolveCapabilities } from '@jsvision/core';
import { Button, Text, col, createApplication, signal } from '@jsvision/ui';

const count = signal(0);

const app = createApplication({
  caps: resolveCapabilities().profile,
  content: col(
    new Text(() => `Count: ${count()}`),
    new Button('~A~dd one', {
      onClick: () => count.update((value) => value + 1),
    }),
  ),
});

const exitCode = await app.run();
process.exitCode = exitCode;
```

The `Text` control reads the signal. The button updates it. JSVision records that dependency and
repaints the affected view automatically. The `~A~` marker also makes <kbd>Alt</kbd>+<kbd>A</kbd> a
usable hotkey rather than decorative text.

## What is happening underneath?

JSVision separates the work into a few layers:

```text
application state
      ↓
retained widget tree
      ↓
layout, focus, events, and clipping
      ↓
zero-dependency screen-buffer renderer
      ↓
native terminal host or browser host
```

The retained tree gives controls a stable identity. Fine-grained signals let views subscribe only
to the state they read. The renderer computes terminal-cell changes and writes the resulting frame
through the active host.

This separation is also why a browser example is not a visual reimplementation of the native app.
It mounts the same application logic against a browser host.

## A desktop made from terminal cells

The desktop shell provides menus, a status line, overlapping windows, modal execution, focus
routing, and commands. Windows can be moved, resized, maximized, restored, cascaded, and tiled.

[Open the interactive desktop example](https://blendsdk.github.io/jsvision/apps/desktop?example=apps%2Fdesktop)

![A JSVision desktop with two movable windows](https://raw.githubusercontent.com/blendsdk/jsvision/develop/assets/readme/desktop.png)

The application still occupies a character-cell grid. The windows, shadows, patterned desktop,
focus state, and mouse hit targets are all produced by the terminal UI engine.

## Controls for applications that grow

Small examples are useful, but I also wanted the SDK to support applications that become more
ambitious.

### Editable data grids

`@jsvision/datagrid` supports typed columns, sorting, filtering, grouping, per-cell editing, column
resizing, selection, and virtual scrolling.

[Try the Data Grid example](https://blendsdk.github.io/jsvision/components/data-grid/?example=data-grid%2Fquick-start)

![Read-only and editable JSVision data grids](https://raw.githubusercontent.com/blendsdk/jsvision/develop/assets/readme/data-grid.png)

### A terminal-native code editor

`@jsvision/code-editor` includes document state, search and replace, syntax highlighting, folding,
editing commands, and language-service UI boundaries.

[Try the Code Editor example](https://blendsdk.github.io/jsvision/components/code-editor/?example=code-editor%2Fquick-start)

![The JSVision code editor showing TypeScript source](https://raw.githubusercontent.com/blendsdk/jsvision/develop/assets/readme/code-editor.png)

### Themes and internationalization

Themes are structured roles rather than scattered color constants. The i18n package supports
localized application text, while controls continue to measure and lay out content in terminal
cells.

[Try the localized Theme Designer](https://blendsdk.github.io/jsvision/components/theming/i18n-theme-designer?example=theming%2Fi18n-theme-designer)

## Testing without driving a real terminal

The renderer and application shell can run headlessly. Tests can construct a real widget tree,
dispatch keyboard or mouse events, and inspect the resulting screen buffer without launching a
pseudo-terminal.

That matters because terminal UI bugs often involve state and geometry together: focus moving to
the wrong control, content clipping after a resize, stale reactive text, or a modal allowing input
to escape into the desktop underneath it.

Headless rendering makes those behaviors deterministic enough to cover with ordinary automated
tests. Real-terminal checks can then focus on the smaller host integration boundary.

## The project today

JSVision is currently:

- open source under the MIT license;
- ESM-only and built for Node.js 22+;
- published as focused packages under the `@jsvision` npm scope;
- documented with interactive component examples and API references; and
- developed as a TypeScript monorepo with automated type checking and tests.

The core packages are:

| Package                 | Responsibility                                                              |
| ----------------------- | --------------------------------------------------------------------------- |
| `@jsvision/core`        | Rendering, screen buffers, terminal input, capabilities, and hosts          |
| `@jsvision/ui`          | Application shell, retained views, reactivity, layout, themes, and controls |
| `@jsvision/forms`       | Reactive form state and validation                                          |
| `@jsvision/files`       | File and directory controls                                                 |
| `@jsvision/datagrid`    | Typed, editable data grids                                                  |
| `@jsvision/code-editor` | Terminal-native source editing                                              |
| `@jsvision/i18n`        | Internationalization services                                               |

## Try it without installing anything

The fastest way to explore JSVision is through the browser examples:

- **[Application gallery](https://blendsdk.github.io/jsvision/apps/)**
- **[Component gallery](https://blendsdk.github.io/jsvision/components/)**
- **[Getting started guide](https://blendsdk.github.io/jsvision/guide/)**
- **[GitHub repository](https://github.com/blendsdk/jsvision)**

If you build terminal tools in TypeScript, I would especially value feedback on three questions:

1. Which control or workflow would you need before using JSVision in a real project?
2. Does the retained, reactive model feel natural for terminal applications?
3. Which native terminal or environment should receive more compatibility testing?

Bug reports, ideas, examples, and contributions are all welcome. If the project is useful to you,
you can also support its continued development through
**[GitHub Sponsors](https://github.com/sponsors/blendsdk)**.
