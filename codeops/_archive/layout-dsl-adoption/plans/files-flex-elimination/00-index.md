# Plan: files-flex-elimination

> **Implements**: layout-dsl-adoption/RD-01 (Tier 2, files) · verification layout-dsl-adoption/RD-02
> **GitHub**: [#120](https://github.com/blendsdk/jsvision/issues/120) · epic [#108](https://github.com/blendsdk/jsvision/issues/108)
> **Status**: 📋 Plan Created
> **Created**: 2026-07-19
> **CodeOps Skills Version**: 3.10.0

## Objective

Flex-eliminate the `@jsvision/files` dialog family — `FileDialog`, `ChDirDialog`, `errorBox` — and
**delete** the bespoke grow-mode resize engine (`grow-dialog.ts` + `grow.ts`) that absolute placement
required. Behavior is invariant; only child geometry may diverge from Turbo Vision, under the
recorded RD-01 policy.

The payoff is deletion: **−2 source files**, −3 `onResized()`/`growItems` members, and two dialogs
whose resize reflow becomes a property of the layout engine instead of hand-replayed rect math.

## Prerequisite

Depends on **#122** (tree-order Tab traversal across flex containers), which lands in PR #123. Both
dialogs gain nested `col`/`row` Groups; without #122 their Tab traversal dead-ends in the list. Work
proceeds on `feat/files-flex-elimination`, cut from `feat/dsl-adoptation` (AR-13).

## Documents

| Doc | Contents |
|-----|----------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | ✅ Gate passed — 15 resolved items |
| [01-requirements.md](01-requirements.md) | Scope, in/out, acceptance criteria |
| [02-current-state.md](02-current-state.md) | What exists today + the verified import graph |
| [03-01-file-dialog.md](03-01-file-dialog.md) | `FileDialog` flex tree + geometry derivation |
| [03-02-chdir-dialog.md](03-02-chdir-dialog.md) | `ChDirDialog` flex tree + geometry derivation |
| [03-03-error-dialog.md](03-03-error-dialog.md) | `errorBox` wrap-aware sizing + the `wrapText` export |
| [03-04-machinery-deletion.md](03-04-machinery-deletion.md) | Deleting grow-mode; the AC-5 grep gate |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-* spec cases + the NFR-3 oracle dispositions |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, verification |

## Key decisions

- **Preserve the visual arrangement** (AR-1) — flex expresses today's composition rather than
  redesigning it. Container paddings are chosen so most children land on their current cells.
- **`errorBox` becomes content-sized** (AR-2/AR-3), fixing a latent long-message clipping bug.
- **`wrapText` becomes public ui API** (AR-4) — the one deliberate scope expansion beyond `files`.
- **A resize *invariant* oracle replaces the deleted coordinate oracle** (AR-5).

## Routing

Tagged **complex** — layout-solver semantics and a TV-derived oracle re-derivation. Per the project
CLAUDE.md routing rule, phases run inline on the session model (Opus).
