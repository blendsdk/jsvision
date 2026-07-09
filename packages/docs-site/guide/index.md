---
title: Guide
description: Learn JSVision — installation, core concepts, and building your first terminal application.
---

# Guide

The JSVision guide walks you from a first install to a full Turbo Vision-style application.

> **Placeholder.** The Getting Started walkthrough, core concepts, and tutorials land in a later
> milestone. This page exists so the navigation skeleton has no dead links.

## A first taste

Detect what the terminal can do, then adapt — the engine is pure, so this runs the same everywhere:

```ts
import { resolveCapabilities } from '@jsvision/core';

const { profile } = resolveCapabilities();

console.log(`Colour depth: ${profile.colorDepth}`);
console.log(`Unicode:      ${profile.unicodeLevel}`);
```

Copy the snippet with the button in its top-right corner, paste it into a TypeScript project that
depends on `@jsvision/core`, and run it.
