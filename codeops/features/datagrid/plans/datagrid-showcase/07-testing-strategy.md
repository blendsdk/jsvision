# 07 — Testing Strategy

> **Parent**: [Index](00-index.md)

Two headless tiers (AR #6, AR #40), both `*.spec.test.ts` under the examples `unit` project
(`vitest run --project unit`), no TTY. The **smoke** tier is the per-demo render oracle; the
**walkthrough** tier is the shell/navigation oracle. Expectations derive from RD-15 (the spec), never
from the demos' internals. Tier files:

- `packages/examples/test/datagrid-showcase.smoke.spec.test.ts`
- `packages/examples/test/datagrid-showcase.walkthrough.spec.test.ts`
- lib spec folded into the smoke file (or `datagrid-showcase.spy-source.spec.test.ts`).

## Smoke oracle — registry + per-demo render

Mirrors `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts`: build each `Story` over fixed caps,
mount on a `createRenderRoot({width,height},{caps})`, count non-blank cells.

| ST | Input | Expected |
|----|-------|----------|
| ST-1 | `STORIES` | non-empty | 
| ST-2 | each story | `id`, `category`, `title`, `blurb` all truthy |
| ST-3 | all ids | unique |
| ST-4 | each `story.build({caps,W,H})` mounted | does not throw; paints ≥1 non-blank cell |
| ST-5 | categories present | `Foundation`, `Editing`, `Cell editors`, `Formatting`, `Sorting`, `Filtering`, `Roadmap` |
| ST-6 | `Roadmap` category | exactly 8 placeholder entries (RD-07…RD-14) |
| ST-7 | per-cluster shipped counts | Foundation 5 · Editing 5 · Cell editors 9 · Formatting 8 · Sorting 5 · Filtering 6 (= 38) |

*(ST-5…ST-7 encode the RD-15 §Demo Inventory scope; a future RD that adds a cluster updates these.)*

→ Covers RD AC #3 (each demo renders), AC #4 (8 placeholders), AC #5 (smoke passes), AC #7 (registry
shape).

## Walkthrough oracle — the shell navigates every demo

A bespoke headless driver constructs the showcase (`createDatagridShowcase(caps)`) and drives its
**real navigation command path** — it never calls `run()` (which asserts a TTY at `run.ts:128`). It
dispatches each entry via `showcase.app.loop.emitCommand(story.id)` (routed to the shell's
`CommandSink` exactly as a menu/sidebar selection is → `showStory`) and reads the painted canvas from
`showcase.app.loop.renderRoot.buffer().rows()` (the same headless buffer read the shell itself performs
at `shell.ts:313-317`), slicing the canvas region (`x ≥ SIDEBAR_W`). Disposal is observed directly via
the shell's read-only `disposedCount()` accessor (see `03-01 §shell.ts`). This is a shell-navigation
driver, **not** the pure-model render narration theme-designer's `runWalkthrough` performs — a distinct
pattern with no in-repo precedent, so ST-10 front-loads its feasibility as the Phase-1 green gate.

| ST | Input | Expected |
|----|-------|----------|
| ST-8 | `emitCommand(story.id)` for every registry entry (no TTY) | no throw; each swap paints ≥1 non-blank cell in the canvas region |
| ST-9 | navigate story A → story B | `disposedCount()` increments **and** B paints with no A residue (clean swap — the previous reactive owner disposed, no double-mount) |
| ST-10 | the Foundation `sizing` **seed** demo, driven in the shell via `emitCommand` | a real `EditableDataGrid` paints (proves the vertical — AR #8) |

→ Covers RD AC #2 (navigation), AC #6 (walkthrough drives every demo). ST-10 is the Phase-1 green gate.

## Lib spec — the bespoke push-down source

| ST | Input | Expected |
|----|-------|----------|
| ST-11 | `spySource.setSort(keys)` then read | records `keys`; `length()`/`rowAt` reflect the sorted order; the recorded-keys signal updates (drives the push-down echo) |
| ST-12 | `spySource.setFilter(model)` then read | records `model`; `length()` reflects the filtered count |

→ Grounds the Sorting §5.5 / Filtering §6.6 push-down demos and their echo (RD AC #3, PF-020).

## What is NOT unit-tested (by design)

Interactive behavior behind a live grid — opening a funnel popup, keystroke-driven commit/veto, the
bound-state echo updating on input — is demonstrated **live** and already covered by the datagrid
package's own spec/impl suites; the showcase tests assert *render + navigation*, not re-test datagrid
behavior (RD §Testing; PF-021 keeps the two tiers distinct — smoke = per-demo render, walkthrough =
shell lifecycle).

## Verify

Per task: `yarn workspace @jsvision/examples vitest run --project unit <file>` for fast iteration;
full `yarn verify` (lint + turbo `typecheck build test check:docs`) before a phase is `[x]` and at
plan end (AR #4). `typecheck` now covers the demos (AR #2).
