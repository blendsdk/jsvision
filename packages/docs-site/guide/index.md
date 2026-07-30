---
title: Introduction
description: JSVision is a TypeScript SDK for building full-screen, keyboard-and-mouse driven applications that run in a terminal — and, unchanged, in a browser.
---

# Introduction

JSVision is a TypeScript SDK for full-screen, event-driven applications rendered in terminal
cells. Instead of printing a result and exiting, a JSVision program keeps a view tree alive,
receives keyboard and mouse input, updates state, and paints new frames until the application
quits.

This course gives you the map before the details. You will learn what the application owns, what
the host runtime owns, run a small real application, and choose the next Guide course for your
goal.

## Who this course is for

Start here if you are comfortable reading a short TypeScript program but have not built a
terminal UI before. There are no JSVision prerequisites. To run the Node example locally you need
Node 22 or newer, an ESM project, and an interactive terminal; the next course walks through that
setup.

By the end, you should be able to:

- explain the difference between application code, the JSVision event loop, and a host runtime;
- recognize the rendered terminal frame as output rather than application state;
- run a first application and quit it cleanly; and
- choose the next course without learning packages, layout, or reactivity out of order.

## Mental model

Keep three responsibilities separate:

| Layer              | Owns                                                                      | Does not own                                       |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| **Application**    | Views, state, commands, focus, and the decision to quit                   | Reading terminal bytes or restoring terminal modes |
| **Host runtime**   | Input, resize events, capability-aware terminal setup, and frame delivery | Your feature state or screen structure             |
| **Terminal frame** | The cells currently visible to the user                                   | The durable source of truth for the application    |

The data moves in both directions:

```text
keyboard · mouse · resize
          ↓
host runtime → event loop → application views and state
          ↑                         ↓
          └──────── rendered terminal frame
```

`createApplication()` assembles the application shell and event loop. On Node,
`app.run()` connects that loop to the terminal host, enters the interactive screen, forwards input
and resizes, and writes rendered frames. When the quit command resolves—or startup or runtime work
throws—the run path restores the terminal in its cleanup path.

The live examples on this site use a browser host instead of `app.run()`. They still mount a real
application and drive its real event loop; the surrounding docs helper is not part of the public
API you copy into a project.

## Your first JSVision application

This is a complete application with one body view and one discoverable quit command:

```ts
import { Commands, Text, createApplication, statusItem, statusLine } from '@jsvision/ui';

const app = createApplication({
  content: new Text('Hello from JSVision'),
  statusLine: statusLine([statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X')]),
});

const exitCode = await app.run();
process.exitCode = exitCode;
```

Important details:

- `content` is the application body. Passing a body creates a full-screen content application;
  omitting it gives you the classic `Desktop` window manager.
- `statusItem()` makes the quit action and its key chord visible instead of hiding them in code.
- The first argument is the displayed label. `~Alt-X~` marks its emphasized segment, while the
  third argument binds the real **Alt+X** chord.
- `app.run()` resolves with the exit code carried by the quit command. Setting `process.exitCode`
  lets normal JavaScript cleanup finish.

Menus, windows, layouts, and reactive state are deliberately absent. They are later lessons, not
requirements for a first result.

## Run the application

After completing [Install & packages](/guide/install-and-packages), save the snippet as
`src/main.ts` and run it with the TypeScript runner configured by that course:

```sh
npx tsx src/main.ts
```

The screen should show the text body and a status line. Press **Alt+X** to emit the standard quit
command. A successful result is not merely “text appeared”: input reached the event loop, the
application produced a frame, and the host restored the terminal after the loop ended.

The laboratory below makes those boundaries visible. Press **Alt+N** or activate **Next stage** to
follow one frame from application construction, through the host runtime, to the terminal. Press
**Alt+R** to reset the explanation.

<PlayExample id="guides/introduction-runtime" title="Trace the first frame" blurb="Advance through application, host runtime, and terminal-frame stages to see what each layer owns." />

## Common first-run failures

| Symptom                                                                 | Likely cause                                                       | Correction                                                                     | Evidence                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Node reports an unsupported module or `require()` error                 | The project is not using the required ESM setup                    | Follow the package and TypeScript configuration exactly                        | The public import resolves before the app starts                           |
| Startup reports that terminal essentials are not met                    | The process has no interactive TTY, such as a redirected or CI run | Run it in an interactive terminal; use a deliberate headless harness for tests | The app enters its interactive screen instead of failing before host setup |
| The process keeps running after the first frame                         | A full-screen app is event-driven and waits for a quit command     | Keep the visible quit status item and press **Alt+X**                          | `app.run()` resolves and the normal shell returns                          |
| A browser example works but the copied program cannot import its helper | The docs shell is repository infrastructure, not consumer API      | Import `createApplication` from `@jsvision/ui`                                 | TypeScript resolves only public package exports                            |

Do not “fix” a missing TTY by disabling the runtime check in a production entry point. The
`requireTty: false` option exists for a controlled headless harness with injected input and output,
not for making an unusable interactive process appear healthy.

## Best practices

- **Keep the application model host-neutral.** Put feature state and commands in the application;
  later Node and browser hosts can drive the same model without owning it.
- **Give every important action a visible path.** A status or menu hint makes quit and recovery
  discoverable to keyboard users.
- **Treat the rendered frame as evidence, not state.** Tests may inspect frames, but business state
  belongs in signals and models so it remains explainable and reusable.
- **Let `run()` own the terminal lifecycle.** Bypassing its cleanup path risks leaving raw mode or
  the alternate screen active after an error.

## Choose your next course

| Your goal                                  | Continue with                                     | Why                                                                    |
| ------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Run the snippet locally or choose packages | [Install & packages](/guide/install-and-packages) | Establish Node 22+, ESM, TypeScript, and supported imports first       |
| Arrange views into a responsive screen     | [Layout](/guide/layout)                           | Learn terminal-cell geometry and size negotiation                      |
| Connect changing data to the interface     | [Reactive state](/guide/reactive-state)           | Learn signals, derived state, effects, and ownership                   |
| Use JSVision through Codex                 | [Codex plugin](/guide/codex-plugin)               | Install the supported integration and understand its canonical sources |

After those foundations, [The application shell](/guide/application-shell) teaches menus,
desktops, windows, status composition, and the complete lifecycle.

## Practice

1. Before running the lab, predict which layer owns keyboard decoding and which owns the quit
   command. Advance the stages and check your answer.
2. Change the greeting text in the snippet. Explain why this changes application state and the
   resulting frame but not the host runtime.
3. As a reading exercise, temporarily remove the visible status item. Notice that this also removes
   the snippet's **Alt+X** binding: registering `Commands.quit` does not create an input path by
   itself. Restore the item before running the application.

## Learning path

The Guide is a curriculum, not a symbol index. Follow it in order when you are new, or enter at a
course whose prerequisites you already understand. **Complete** courses meet the current course and
live-lab directive. **Upgrade** courses are available but still need that treatment. **Planned**
courses are part of the confirmed curriculum and appear here before they enter the sidebar.

### Getting started

| Course                                            | Stage    | Purpose                                                                 |
| ------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| [Introduction](/guide/)                           | Complete | Understand the product, run the live shell, and choose a learning path. |
| [Install & packages](/guide/install-and-packages) | Complete | Choose packages and configure a Node 22+ ESM project.                   |
| [Codex plugin](/guide/codex-plugin)               | Complete | Use the supported agent integration and canonical JSVision guidance.    |

### Core concepts

| Course                                                                       | Stage    | Purpose                                                                              |
| ---------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| [Layout](/guide/layout)                                                      | Complete | Compose responsive cell layouts, overlays, and exact placement.                      |
| [Reactive state](/guide/reactive-state)                                      | Complete | Model state, derived values, bindings, effects, and lifetimes.                       |
| [Views & focus](/guide/views-and-focus)                                      | Complete | Understand retained trees, mounting, invalidation, tab order, and focus restoration. |
| [Events, commands & keymaps](/guide/events-commands-and-keymaps)             | Complete | Route input and design discoverable command systems.                                 |
| [Keyboard & clipboard](/guide/keyboard-and-clipboard)                        | Complete | Use editing chords and authorized clipboard adapters.                                |
| [Text, Unicode & terminal cells](/guide/text-unicode-and-cells)              | Complete | Handle graphemes, wide glyphs, wrapping, clipping, and ASCII-safe fallbacks.         |
| [Scrolling, lists & large content](/guide/scrolling-lists-and-large-content) | Complete | Design viewports, selection, scrolling, and bounded rendering.                       |

### Building applications

| Course                                                     | Stage    | Purpose                                                                                  |
| ---------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| [The application shell](/guide/application-shell)          | Complete | Build and run menus, status, commands, desktops, and windows.                            |
| [Dialogs & modality](/guide/dialogs-and-modality)          | Complete | Build validated, cancellable, focus-safe modal workflows.                                |
| [Async work, cancellation & progress](/guide/async-work)   | Complete | Keep input responsive while handling progress, cancellation, cleanup, and stale results. |
| [Forms](/guide/forms)                                      | Complete | Build typed field state, validation, async submission, and reset.                        |
| [Files & the FileSystem seam](/guide/files-and-filesystem) | Complete | Run the same file workflows over native, virtual, and custom hosts.                      |
| [Internationalization](/guide/i18n)                        | Complete | Author, load, validate, switch, format, and test locales.                                |
| [Screens & routing](/guide/screens-and-routing)            | Complete | Build typed screen stacks with history, parameters, shared chrome, and focus.            |
| [Theming & colour depth](/guide/theming-and-colour-depth)  | Complete | Author semantic themes that preserve meaning as color capabilities degrade.              |

### Extending and integrating

| Course                                                    | Stage    | Purpose                                                                         |
| --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| [Running in the browser](/guide/running-in-the-browser)   | Complete | Mount unchanged applications through the browser host and virtual seams.        |
| [Writing your own widget](/guide/writing-your-own-widget) | Complete | Implement measurement, drawing, focus, input, reactivity, and cleanup.          |
| [Testing headlessly](/guide/testing-headlessly)           | Upgrade  | Drive views, input, dialogs, resize, and failures without a real terminal.      |
| Application architecture & best practices                 | Planned  | Organize state, services, commands, screens, ownership, and feature boundaries. |

### Specialist courses

| Course                                         | Stage    | Purpose                                                                                |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| [Data Grid course](/components/data-grid/)     | Complete | Progress from typed sources and columns through editing, scaling, and personalization. |
| [Code Editor course](/components/code-editor/) | Complete | Build editor experiences from documents through languages, LSP, safety, and recovery.  |

### Operating a real app

| Course                                                    | Stage   | Purpose                                                                                  |
| --------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| [Debugging](/guide/debugging)                             | Upgrade | Diagnose layout, focus, commands, rendering, capabilities, and lifecycle failures.       |
| [Crash safety & terminal restore](/guide/crash-safety)    | Upgrade | Understand restore guarantees, signals, essentials, and degradations.                    |
| [Displaying untrusted text safely](/guide/untrusted-text) | Upgrade | Prevent terminal injection and redact sensitive diagnostics.                             |
| Accessibility & resilient interaction                     | Planned | Design keyboard-complete, non-color-dependent, reduced-geometry interfaces.              |
| Terminal capabilities & portability                       | Planned | Adapt honestly across color, mouse, glyph, SSH, tmux, Windows, and browser environments. |
| [In production](/guide/in-production)                     | Upgrade | Package, deploy, observe, support, and set evidence-based expectations.                  |
| Build a complete application                              | Planned | Apply the complete curriculum in one beginner-to-production release workflow.            |

## Where to next

- **[Components](/components/)** — every widget, with a live example you can drive on each page.
- **[Apps](/apps/)** — complete sample applications, running in the browser.
- **[Keyboard & clipboard](/guide/keyboard-and-clipboard)** — the selection and clipboard chords
  every editable widget gets for free.
- **[API reference](/api/)** — the generated reference for every public symbol.
