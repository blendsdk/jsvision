---
title: API Reference
description: The generated TypeScript API reference for the JSVision packages — types, functions, and classes.
---

# API Reference

This is the complete, generated TypeScript API surface for the JSVision packages. Every entry is
produced directly from each package's public entry point (its `index.ts` barrel) and its source
JSDoc, so the reference can never drift from the shipped types — it is regenerated before every
build.

## How it is organized

The reference is grouped **by package, then by kind** (classes, functions, interfaces, type aliases,
variables). Each package's page links into its own tree:

- [`@jsvision/core`](/api/core/) — the foundation engine: capability detection, input decoding, the
  rendering engine, host & lifecycle, safety, and color & styling.
- [`@jsvision/ui`](/api/ui/) — the Turbo Vision-style widget framework: the reactive core, layout
  engine, view spine, event loop, app shell, and every control.
- [`@jsvision/files`](/api/files/) — the file-system dialog family (file/directory pickers).
- [`@jsvision/web`](/api/web/) — the browser runtime that runs any JSVision app in an xterm.js
  terminal with no backend.

Where a symbol has a hand-written component guide, its reference page links back to it under
**Documented in →**, and the component page links here under **API reference →**.

## Pre-release packages

`@jsvision/core` is published. `@jsvision/ui`, `@jsvision/files`, and `@jsvision/web` are documented
here ahead of their first release — their APIs are **pre-release** and may change before they are
published.
