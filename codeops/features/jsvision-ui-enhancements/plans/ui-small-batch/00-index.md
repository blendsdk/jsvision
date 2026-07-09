# UI Small Batch — Implementation Plan

> **Feature**: A batch of three additive `@jsvision/ui` enhancements — clearer Tree expand/collapse markers, a developer warning on duplicate keyboard accelerators, and a modern `Switch`/toggle control.
> **Implements**: jsvision-ui-enhancements/GH-#17, GH-#6, GH-#11 (no RD — the GitHub issues are the requirements source)
> **Status**: Planning Complete
> **Created**: 2026-07-09
> **CodeOps Skills Version**: 3.3.2

## Overview

Three independent, additive-only enhancements to the private `@jsvision/ui` package, batched into one
plan because each is small and shares the same verify/commit rhythm:

1. **Tree markers (GH #17)** — the expand/collapse indicator is a single subtle glyph (`+` collapsed /
   `─` expanded). Add an opt-in `markerStyle: 'tv' | 'brackets' | 'triangle'` to `TreeOptions`; the
   default stays the TV-faithful `'tv'`, so fidelity is preserved unless an app asks for the modern
   look (`[+]`/`[-]` pure-ASCII brackets, or `▸`/`▾` 1-cell triangles).

2. **Duplicate-accelerator warning (GH #6)** — a same-scope duplicate `~X~` hotkey silently makes the
   later item unreachable. Add a pure `findDuplicateAccelerators()` and an additive `View.accelerators()`
   seam, then emit a dev-only warning across **all** tilde-accelerator scopes (menu bar, submenus,
   Dialog/cluster focus scope, TabView strip). StatusLine's chord mechanism is a fast-follow.

3. **Switch / Toggle (GH #11)** — a modern on/off control bound to a `Signal<boolean>`, built over
   `View` (the `Slider` idiom), reusing existing theme roles (no new core role), with a kitchen-sink
   story.

All three are **additive-only**: no `@jsvision/core` API change, no breaking change to `@jsvision/ui`.

## Document Index

| #     | Document                                                     | Description                                             |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)               | Zero-Ambiguity Gate decisions (audit trail)             |
| 00    | [Index](00-index.md)                                         | This document — overview and navigation                 |
| 01    | [Requirements](01-requirements.md)                           | Requirements and scope, per issue                       |
| 02    | [Current State](02-current-state.md)                         | What exists to reuse; the exact seams to touch          |
| 03-01 | [Tree Markers](03-01-tree-markers.md)                        | GH #17 — `markerStyle` in `tree/graph.ts` + `tree.ts`   |
| 03-02 | [Duplicate Accelerators](03-02-duplicate-accelerators.md)    | GH #6 — pure validator + `View.accelerators()` seam     |
| 03-03 | [Switch / Toggle](03-03-switch-toggle.md)                    | GH #11 — `Switch extends View` + story                  |
| 07    | [Testing Strategy](07-testing-strategy.md)                   | Spec test cases (ST-1…ST-27) and verification           |
| 99    | [Execution Plan](99-execution-plan.md)                       | Phases, sessions, and task checklist                    |

## Quick Reference

- **Package:** `@jsvision/ui` (private). All source under `packages/ui/src/`, tests under `packages/ui/test/`.
- **Verify:** `yarn verify` = `yarn lint` (eslint + prettier) **then** `turbo run typecheck build test check:docs` — one command covers lint, types, build, tests, and the JSDoc `@example`/provenance gate.
- **Additive surface:** `TreeOptions.markerStyle` · `View.accelerators()` (optional) + `findDuplicateAccelerators()` + a shared `devWarn(scope, msg)` · `Switch` + `SwitchOptions`. **No `@jsvision/core` change.**
- **Kitchen-sink:** new `controls/switch` story (+ smoke); Tree story shows a non-`tv` `markerStyle`.
