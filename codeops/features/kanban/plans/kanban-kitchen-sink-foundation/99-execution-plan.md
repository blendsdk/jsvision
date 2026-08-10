# Execution Plan: Permanent Kanban Kitchen-Sink Foundation

> **Implements**: kanban/T-01
> **Status**: Complete
> **Created**: 2026-08-10
> **Last Updated**: 2026-08-10

## Objective

Create the permanent standalone `@jsvision/kanban` showcase now, seed it only with verified Phase B
capabilities, and leave a small story-registry seam that later implementation phases can extend
without rebuilding the application shell.

## Scope boundaries

- The showcase is a runnable developer application under `packages/examples/kanban-showcase/`.
- The initial stories demonstrate real cards, semantic styles, checklist presentation, swimlanes,
  responsive density, keyboard navigation, selection, and pointer interaction.
- A dense localized story uses long Dutch and German values, multiple labels and summaries, and
  oversized checklists to expose bounded wrapping, ellipsis, omission, degradation, and scrolling.
- Drag/drop, editors, lane-configuration dialogs, filtering UI, persistence, and history are not
  simulated before their owning package capabilities exist.
- This task establishes incremental example infrastructure; it does not claim completion of RD-15.

## Tasks

- [x] 1. Add specification oracles for the permanent registry, runnable script, story rendering,
      responsive shell, and real interaction feedback; confirm the new oracles fail first.
- [x] 2. Add the documented story contract and explicit registry.
- [x] 3. Build a responsive specialist shell that opens directly on a working story and disposes
      story-owned reactive state when navigation changes.
- [x] 4. Add polished Phase B stories using only public `@jsvision/kanban` APIs.
- [x] 5. Wire the runnable command and package dependencies, and update truthful package guidance.
- [x] 6. Run focused examples/package/plugin checks and the repository local verification gate.
- [x] 7. Add focused coverage and a dense localized-content story without simulating unshipped
      editing behavior.

## Verification

- `yarn workspace @jsvision/examples typecheck`
- `yarn workspace @jsvision/examples test --pool=forks --maxWorkers=1` — 53 files, 409 tests
- `yarn plugin:check`
- `yarn verify:local`
