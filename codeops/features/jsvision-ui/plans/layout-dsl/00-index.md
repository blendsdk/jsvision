# Plan: layout-dsl — declarative flex builders for @jsvision/ui

> **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.3.2
> **Implements**: jsvision-ui/DX-P8 (DX-ASSESSMENT.md Proposal 8 — a builder for declarative
> composition; also lifts dimension 11 "Layout ergonomics" and dimension 14 "Composition model")
> **Status**: Plan Created · **Created**: 2026-07-08

## Overview

A thin, declarative authoring layer over the existing view/layout API: `col` / `row` containers,
`grow` / `fixed` / `fill` size shorthands, `spacer`, and a `stack` z-overlay with placement helpers
(`place` / `centered` / `topRight` / `bottomRight` / `topLeft`). It removes the imperative
`new X()` → `.layout = {…}` → `parent.add()` triple and the raw-pixel-math wall the DX assessment
flags, while keeping every existing API untouched (purely additive).

One small **engine** change lands with it: a `position: 'fill'` placement mode (a child takes its
parent's full content box) so overlay fills re-solve lag-free on resize — the piece the prototype
could not do in pure user-land because `View.bounds` has no change hook.

## Why it resizes for free

The reflow re-solves the whole flex from the live view tree on every invalidation
(`render-root.ts:326-329` → `reflow.ts:23-36`), so a viewport resize *or* a parent-container resize
(a dragged window) already re-lays-out the builders' output. The builders add no resize machinery;
`fill` just closes the one lag-free gap for overlays.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — all items resolved (AR-1…AR-13) |
| [01-requirements.md](01-requirements.md) | Scope, functional requirements, out-of-scope |
| [02-current-state.md](02-current-state.md) | The engine/view/reflow facts this builds on |
| [03-01-builders.md](03-01-builders.md) | The `view/dsl` module — every builder's contract |
| [03-02-engine-fill-mode.md](03-02-engine-fill-mode.md) | The `position:'fill'` engine addition |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-1…ST-N) |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, verify |

## Verify

`yarn verify` — the full gate in one command: `yarn lint && turbo run typecheck build test check:docs`
(lint, per-package `tsc --noEmit`, build, vitest, and the JSDoc/`@example` check). Vitest itself does
not type-check `test/`, so spec oracles assert runtime behavior (see AR-10).
