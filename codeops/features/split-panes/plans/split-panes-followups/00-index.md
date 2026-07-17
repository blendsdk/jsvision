# Plan: Split-Panes Follow-ups

> **Feature**: split-panes · **Plan**: split-panes-followups
> **Implements**: no upstream RD — a component-scale follow-on (the plans-only precedent the parent
> `split-panes` plan set; see its `01-requirements.md`).
> **Branch**: `feat/split-panes` (AR-10) · **CodeOps Skills Version**: 3.8.0
> **Status**: Plan Created

## Overview

Three cohesive follow-ups to the just-shipped `SplitView`, requested after the feature landed:

1. **Grab-mark toggle (shipped code).** Make the `▓` divider grab mark optional and reactive: a
   `grabMark?: boolean` option (default `true`) plus a public `SplitView.grabMark: Signal<boolean>`
   that flips at runtime. *(AR-2, AR-3)*
2. **Scrolling-in-a-pane demo (examples).** A new kitchen-sink story proving a `ListBox` scrolls
   inside a pane — no framework change, panes already accept any `View`. *(AR-5, AR-6)*
3. **Split-in-a-window demo (examples).** A 4th "Clocks" window in the amiga-clock demo hosting a
   nested `SplitView` of the three clocks, showing a split nested inside a `Window`. *(AR-7)*

Only item 1 touches shipped source (`packages/ui/src/split/**`). `@jsvision/core` is untouched — no
theme role is added. Items 2–3 are demo code.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — all 12 items resolved |
| [01-requirements.md](01-requirements.md) | Requirements, scope, acceptance criteria |
| [02-current-state.md](02-current-state.md) | The shipped code these follow-ups build on |
| [03-01-grabmark-option.md](03-01-grabmark-option.md) | Component spec: the reactive `grabMark` option (item 1) |
| [03-02-demos.md](03-02-demos.md) | Spec: the scroll story (item 2) + the amiga-clock split window (item 3) |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-*) + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, progress |

## Verify command

`CI=1 yarn verify` *(AR-9)* — turbo forwards `CI`, auto-skipping the machine-dependent perf assertion.

## Definition of done

- `grabMark?: boolean` + `SplitView.grabMark: Signal<boolean>` ship with JSDoc `@example`s;
  `scripts/check-jsdoc.mjs` green; the plugin API reference regenerated.
- The `layout/split` story flips the grab mark live on `g`; a new scroll story shows a `ListBox`
  scrolling in a pane and passes the smoke test.
- The amiga-clock demo gains a "Clocks" split window (typecheck + manual run; no automated test — AR-8).
- `CI=1 yarn verify` green; `yarn check:deps` green; the shipped `split.spec.test.ts` oracle untouched.
