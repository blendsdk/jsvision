# Data at Scale Implementation Plan

> **Feature**: Continuous virtual scroll for `@jsvision/datagrid` over a **windowed/async** data
> source — 100k+ rows fed one visible window at a time, with loading placeholders, server-side
> push-down, and per-frame prefetch coalescing.
> **Status**: Planning Complete
> **Created**: 2026-07-18
> **Implements**: datagrid/RD-11
> **CodeOps Skills Version**: 3.8.0

## Overview

Today the grid materializes its **entire** source into a dense in-memory array on every
re-derivation: `display = derived(() => materialize(source) → filter → sort)` (`grid.ts:415`), where
`materialize` (`grid.ts:221`) full-scans `source.rowAt(0…length())` and **collapses `undefined`
holes**. That is correct for an eager in-memory source but structurally fatal for a windowed one —
a source with only rows `[1000,1050)` loaded would materialize to a 50-element array, losing all
index alignment — and nothing anywhere calls the already-declared `ensureRange` seam
(`data-source.ts:41`).

This plan makes the grid **windowed-aware** without regressing the eager path and **without touching
`@jsvision/ui`**. The mechanism (red-teamed before adoption, see [AR-2](00-ambiguity-register.md)):
on the windowed path only — detected by `isWindowed = !!source.ensureRange` — `display()` returns a
**length-correct lazy `Proxy`** (`.length === source.length()`, `[i] → source.rowAt(i)`) instead of a
materialized array, so every inherited `GridRows` read of `display().length` / `display()[i]` keeps
working untouched. The body renders a muted `…` placeholder for an unloaded (`undefined`) row, drives
`source.ensureRange(start,end)` for the visible window plus a one-viewport prefetch buffer coalesced
to ≤1 call per frame, and repaints when a page lands via a new reactive `revision?()` signal on
`GridDataSource`. Every **full-scan** consumer (auto-width, footer aggregates, header select-all + range,
distinct, positional duplicate) is gated behind `isWindowed` so none of them page-faults the dataset —
and the lazy view **fails loud** (a whole-array access throws), so a missed gate is a located test
failure, not a silent crash/fetch-storm.

Scope is **Must-Have only** ([AR-1](00-ambiguity-register.md)): continuous virtual scroll, async
loading, placeholders, coalescing, in-memory-large validation, a shipped async windowed-source
helper, the kitchen-sink story, the showcase cluster, and the security oracle. The opt-in **pager**
mode, infinite/lazy load-more, pluggable REST adapters, and a server aggregate are deferred to a
Phase-B plan; the AC-4 16 ms frame-budget *measurement* belongs to RD-14's bench.

The work is phased **foundation-first**: the windowed contract + lazy `display()` + repaint seam;
then windowed rendering, prefetch, and coalescing; then the full-scan consumer guards; then the
helper source, story, showcase, barrel, and security oracle. All new logic lands in a new module
(`windowing.ts`) with `grid.ts` holding thin `isWindowed`-guarded wiring — the RD-08/09/10/12 pattern
(`grid.ts` is at its `< 1500` line guard).

## Document Index

| #   | Document                                                                     | Description                                                        |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                               | Zero-Ambiguity Gate decisions (audit trail)                       |
| 00  | [Index](00-index.md)                                                         | This document — overview and navigation                           |
| 01  | [Requirements](01-requirements.md)                                           | Scope delta over RD-11                                             |
| 02  | [Current State](02-current-state.md)                                         | Grounded analysis of the code RD-11 builds on                     |
| 03-01 | [Windowed contract & lazy display](03-01-windowed-contract-and-lazy-display.md) | `revision?()` seam, `isWindowed`, the lazy `Proxy` `display()`, repaint |
| 03-02 | [Windowed rendering & prefetch](03-02-windowed-rendering-and-prefetch.md)   | `…` placeholder, `ensureRange` driving, prefetch buffer, per-frame coalescing, read-only unloaded cell |
| 03-03 | [Full-scan consumer guards](03-03-full-scan-consumer-guards.md)             | `isWindowed` gating: auto-width, push-down hard-fail, footer defer, select-all + range, counts, mutation, distinct |
| 03-04 | [Helper source, showcase & security](03-04-helper-source-showcase-and-security.md) | Async paged source helper, kitchen-sink story, showcase cluster, barrel, AC-1 bounded-views test, security oracle |
| 07  | [Testing Strategy](07-testing-strategy.md)                                   | Specification test cases (ST-1…ST-21) + verification              |
| 99  | [Execution Plan](99-execution-plan.md)                                       | Phases, sessions, task checklist (single source of truth)         |

## Key invariants

- **Zero `@jsvision/ui` change.** The windowed read path lives entirely in `@jsvision/datagrid`; the
  ui base stays whole-array. ([AR-2](00-ambiguity-register.md))
- **Eager path byte-identical.** A source without `ensureRange` never enters any windowed branch —
  `materialize` + client filter/sort are untouched → the RD-01…12 suite stays green. ([AR-2](00-ambiguity-register.md), [AR-17](00-ambiguity-register.md))
- **`display()` is always length-correct** (`.length === source.length()`), windowed or eager — the
  inherited `GridRows` nav/scroll/clamp paths depend on it. ([AR-2](00-ambiguity-register.md))
- **Client validation stays UX-only.** A windowed source's `onCommit` / server remains the
  authoritative persistence boundary; nothing here bypasses it.
