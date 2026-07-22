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
- [`@jsvision/forms`](/api/forms/) — the headless, reactive form/field store with Zod validation.
- [`@jsvision/datagrid`](/api/datagrid/) — the editable, enterprise-class data grid.

Where a symbol has a hand-written component guide, its reference page links back to it under
**Documented in →**, and the component page links here under **API reference →**.

## Pre-release packages

These are the published `@jsvision` packages you can install. Their APIs are still **pre-release**
(`0.x`) and may change before `1.0`. The private `@jsvision/web` browser runtime powers this site's
live examples but is not a product package, so it is not documented here.
