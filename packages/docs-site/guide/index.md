---
title: Introduction
description: JSVision is a TypeScript SDK for building full-screen, keyboard-and-mouse driven applications that run in a terminal — and, unchanged, in a browser.
---

# Introduction

**JSVision is an SDK for building full-screen applications that live in a terminal.** Not a
command-line tool that prints lines and exits — a real application: a menu bar across the top, a
status line at the bottom, windows and dialogs you can move, resize, and tab through, with the mouse
working everywhere it should.

You write it once in TypeScript. It runs in a terminal — any terminal — and, with no changes and no
backend, inside a web page. The terminal is the fastest, lightest, most universally available display
surface there is; JSVision makes it a place you can build serious software for.

## See it for yourself

This is a real JSVision application, running in this page right now — the standard shell and a
welcome dialog. Press **Play**, then **Enter** to dismiss the dialog. Once it is gone, **F10** opens
the menu and **Alt+X** exits.

<PlayExample id="apps/hello" title="Hello, JSVision" blurb="The standard application shell — menu bar, status line, desktop — and a modal welcome dialog." />

Everything on this site works that way: every component page runs the real thing, not a recording.

## Why you might want this

- **It runs where a GUI cannot.** Anywhere there is a terminal, there is a place for your app.
- **It starts instantly and stays small.** No browser engine, no bundle to ship, no window manager.
- **Keyboard-first, mouse-friendly.** Every control is reachable by keyboard; every control also
  responds to a click, a drag, and a scroll wheel.
- **It is genuinely portable.** The engine measures what your terminal can actually do and adapts —
  the same application looks right on a modern truecolor terminal and on a monochrome one.

## What you get

**A complete widget set.** Buttons, text inputs with validators and input masks, checkboxes, radio
groups, switches, sliders, list boxes, trees, tables, tabs, progress bars, spinners, calendars and
date pickers, colour pickers, dropdowns with history, and a real multi-line text editor.

**A windowing desktop.** Movable, resizable, zoomable, cascading and tiling windows with a window
manager, plus modal dialogs that resolve as a promise — `await` a dialog and read what the user
chose.

**Reactive state.** Signals bind widget values to your data. Change the value, the widget repaints;
type in the widget, your value updates. No manual refresh calls.

**A layout engine.** Compose screens with flex-style rows, columns, and padding instead of computing
cell coordinates by hand — and drop to absolute placement whenever you want exact control.

**Theming that degrades gracefully.** Thirteen built-in presets, semantic colour roles, and automatic
downsampling from truecolor to 256 colours to 16 to monochrome, so you author once and it renders
sensibly everywhere.

**A rendering engine that is correct about text.** Width-aware handling of Unicode, CJK, and emoji,
and a damage-diff renderer that repaints only the cells that actually changed — so a full-screen app
stays fluid even over a slow connection.

**Batteries for real applications.** Form handling with schema validation, an editable enterprise
data grid, file-open and directory dialogs, and clipboard support across every editable widget.

**The same app in the browser.** `@jsvision/web` mounts any JSVision application into an xterm.js
terminal on a page. Every live example on this site is exactly that — the real SDK, running in
front of you.

**Testable without a terminal.** Applications mount headlessly, so you can assert on what is on
screen in an ordinary test run.

## Install

JSVision is ESM-only and needs Node 22 or newer.

```sh
npm install @jsvision/ui @jsvision/core
```

`@jsvision/core` is the rendering and terminal engine; `@jsvision/ui` is the widget framework you
build with. Add `@jsvision/web` to run in a browser, and `@jsvision/forms`, `@jsvision/datagrid`, or
`@jsvision/files` as you need them.

## Your first application

A complete, runnable application: a menu bar with an Exit item, a status line, and an app that runs
until you quit and leaves your terminal exactly as it found it.

```ts
import { createApplication, menuBar, subMenu, item, statusLine, statusItem, Commands } from '@jsvision/ui';

const app = createApplication({
  menuBar: menuBar([subMenu('~F~ile', [item('E~x~it', Commands.quit, 'Alt+X')])]),
  statusLine: statusLine([statusItem('~E~xit', Commands.quit, 'Alt+X')]),
});

// Runs until the quit command; restores the terminal on every exit path.
const code = await app.run();
process.exit(code);
```

That is the whole program. Terminal capabilities are detected for you, the screen is set up and torn
down for you, and `~x~` marks the keyboard shortcut letter in a label.

## Where to next

- **[Components](/components/)** — every widget, with a live example you can drive on each page.
- **[Apps](/apps/)** — complete sample applications, running in the browser.
- **[Keyboard & clipboard](/guide/keyboard-and-clipboard)** — the selection and clipboard chords
  every editable widget gets for free.
- **[API reference](/api/)** — the generated reference for every public symbol.
