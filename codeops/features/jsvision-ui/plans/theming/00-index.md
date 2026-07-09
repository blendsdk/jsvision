# Theming Implementation Plan

> **Feature**: A Fluent-inspired, TUI-sized color theme system for jsvision — a semantic alias tier + OKLab ramp + `createTheme` builder + optional per-role text attributes + lossless serialize/parse + curated presets + runtime hot-swap + a live theme-designer.
> **Status**: Planning Complete
> **Created**: 2026-07-08
> **Implements**: jsvision-ui/RD-22
> **CodeOps Skills Version**: 3.3.2

## Overview

Today a jsvision `Theme` is a flat record of **63 named roles** (`menuBar`, `button`, `listFocused`,
…), each a literal `{fg, bg}` pair. Authoring a new look means hand-writing all 63. RD-22 adds the two
tiers *below* the roles so a whole theme derives from a handful of seeds:

```
seeds (mode + accent + optional neutral/status + overrides)
  │  createTheme()
  ▼  OKLab ramps → 16 semantic ALIASES (ThemeColors)
  │  rolesFromAliases()
  ▼  the existing 63 CONTROL ROLES → the flat Theme widgets already read
```

Everything is **additive**. The flat `Theme` stays the runtime contract every widget reads through
`DrawContext.color()` — no widget changes — and the built-in **`defaultTheme` (the classic Turbo
Vision look) is byte-for-byte unchanged** and remains the default (`turboVisionTheme` is exported as
an alias of it). The one enabling change is a runtime theme hot-swap on the render root, plumbed
through the event loop so a swap repaints the terminal from any call site.

The deliverables span three packages: `@jsvision/core` owns the model (`ThemeColors`, `ramp`,
`createTheme`, `rolesFromAliases`, `ThemeRole.attrs`, `serializeTheme`/`parseTheme`, `contrastRatio`,
7 presets); `@jsvision/ui` owns the hot-swap (`RenderRoot`/`EventLoop`/`Application.setTheme`);
`@jsvision/examples` owns a live `demo:themes` designer + a kitchen-sink `Theming` story.

## Document Index

| #   | Document | Description |
| --- | -------- | ----------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Plan-time gate decisions PA-1…PA-8 (audit trail) |
| 00  | [Index](00-index.md) | This document — overview and navigation |
| 01  | [Requirements](01-requirements.md) | Scope delta vs. RD-22 + plan-local decisions |
| 02  | [Current State](02-current-state.md) | The color subsystem, render root, loop, governance & demo conventions as they stand |
| 03-01 | [Aliases, Ramp & Contrast](03-01-aliases-ramp-contrast.md) | `ThemeColors` (16 tokens), OKLab `ramp`/`lighten`/`darken`/`mix`, `contrastRatio` |
| 03-02 | [createTheme & rolesFromAliases](03-02-create-theme-and-roles.md) | The builder + the full 63-role semantic-collapse mapping |
| 03-03 | [Attrs & Serialize](03-03-attrs-and-serialize.md) | `ThemeRole.attrs` pass-through + versioned serialize/parse + `InvalidThemeError` |
| 03-04 | [Presets & Governance](03-04-presets-and-governance.md) | 7 presets + api-stability/treeshake/packaging/jsdoc guards |
| 03-05 | [Hot-swap](03-05-hot-swap.md) | `RenderRoot`/`EventLoop`/`Application.setTheme` |
| 03-06 | [Designer & Story](03-06-designer-and-story.md) | `demo:themes` (pure `designer.ts` + real-TTY `main.ts`) + kitchen-sink `Theming` story |
| 07  | [Testing Strategy](07-testing-strategy.md) | ST-1…ST-40 specification test cases + verification |
| 99  | [Execution Plan](99-execution-plan.md) | 7 phases, spec-first task checklist |

## Quick Reference

### Usage Examples

```ts
import { createTheme, nordTheme, serializeTheme, parseTheme, contrastRatio } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

// Generate a theme from seeds.
const brand = createTheme({ mode: 'dark', accent: '#3b82f6' });

// Author discretely with overrides.
const custom = createTheme({ mode: 'light', accent: '#3b82f6', overrides: { accent: '#ff0000' } });

// Round-trip losslessly (no filesystem in core).
const json = serializeTheme(nordTheme);      // { "version": 1, "roles": { … } }
const back = parseTheme(json);               // deep-equals nordTheme

// Runtime hot-swap.
const app = createApplication({ theme: brand });
app.setTheme(nordTheme);                     // repaints the terminal immediately

// Contrast check (WCAG).
contrastRatio('#000000', '#ffffff');         // 21
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Generated-theme role fidelity | Semantic collapse to the 16 aliases; `defaultTheme` stays literal | PA-2 |
| Hot-swap mechanism | `setTheme` mirrors `setRevealAccelerators` (`markRelayout`); loop seam wraps in `runTick` | PA-3, AR-276/AR-279 |
| `defaultTheme`-unchanged oracle | The data-level `*-theme.spec` `toStrictEqual` tests, not golden-screen | PA-4, AC-7 |
| `desktop.pattern` validation | Single printable cell (`sanitize` + no `\t`/`\n` + one cell wide) | PA-5, AR-281 |
| Additive-surface guard | New `theme-packaging.spec` + CHANGELOG `[Unreleased]`; `@example` on functions/class only | PA-6 |
| Verify command | `yarn verify` per phase; `+ yarn lint` + typecheck at the final gate | PA-1 |

## Related Files

**New (core):** `packages/core/src/engine/color/{aliases,ramp,create-theme,contrast,serialize,presets}.ts`
**Edit (core):** `packages/core/src/engine/color/{theme,index}.ts`, `packages/core/src/engine/index.ts`, root `CHANGELOG.md`
**New (ui):** —
**Edit (ui):** `packages/ui/src/view/{theme-style,render-root}.ts`, `packages/ui/src/event/{event-loop,types}.ts`, `packages/ui/src/app/application.ts`, `packages/ui/src/index.ts`
**New (examples):** `packages/examples/themes-demo/{main,designer}.ts`, `packages/examples/kitchen-sink/stories/theming.story.ts`
**Edit (examples):** `packages/examples/package.json`, `packages/examples/kitchen-sink/stories/index.ts`
