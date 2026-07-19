# Plan: Focus-Traversal Primitive (tree-order Tab across flex containers)

> **Feature**: layout-dsl-adoption · **Plan**: focus-traversal-primitive
> **Implements**: layout-dsl-adoption/RD-01 (enabler for FR-2/FR-3) · **Kind**: Primitive (companion to #117)
> **Status**: Ready to execute
> **Created**: 2026-07-19
> **CodeOps Skills Version**: 3.9.0

## Why this plan exists

The layout-DSL flex-elimination (RD-01) assumed the TV dialogs are "structurally flex" and can be
rebuilt with `col`/`row` while keeping behavior invariant (FR-2/FR-3). A live investigation found that
assumption is **false as written** for any dialog with multiple focusable regions:

- `col`/`row` build **nested `Group`s** (`view/dsl/flex.ts:87`).
- Tab traversal is **group-scoped** — `advance()` (`event/focus.ts:145`) cycles only within the focused
  leaf's parent group and never crosses into a sibling group. The trap is **emergent behavior** of the
  group-scoped `advance()`, **not asserted by any spec oracle** (AR-7: no existing oracle asserts the
  deep cross-group exit) — so it can be fixed additively.
- An **empirical probe** confirmed the consequence: on today's code, Tab in `FileDialog`/`ChDirDialog`
  moves `input → list` and then **dead-ends in the list forever** — the buttons are not Tab-reachable
  at all. `formDialog` is structurally identical (traps in its body).

So flex-composing these dialogs would *relocate/worsen* the trap — a keyboard-UX regression dressed up
as "divergence." The maintainer chose to **fix the root cause first**: make Tab traversal tree-ordered
across group boundaries (bounded by the active modal/window scope). This turns a latent defect into a
fix, makes `col`/`row` usable for interactive dialogs, and unblocks #115 + #120 together.

## Documents

- [00-ambiguity-register.md](00-ambiguity-register.md) — Zero-Ambiguity Gate (✅ passed, 12 items)
- [01-requirements.md](01-requirements.md) — scope, in/out, success criteria
- [02-current-state.md](02-current-state.md) — the focus manager + scope machinery as they are today
- [03-01-focus-traversal.md](03-01-focus-traversal.md) — the traversal algorithm + wiring spec
- [07-testing-strategy.md](07-testing-strategy.md) — surviving witnesses + new DFS spec cases (ST-F#)
- [99-execution-plan.md](99-execution-plan.md) — phases + task checklist

## The change in one paragraph

In `advance(direction, scope)`, replace "wrap within the active group" with "try the next focusable
sibling in `direction`; if the active group has none left, **bubble to its parent** and retry, until a
sibling is found or the **`scope` ceiling** is reached — at the ceiling, wrap." Forward descent reuses
`focusInto` (restore-or-first); reverse descent uses a new `descendLast` (restore-or-last) so Shift-Tab is
the exact inverse of Tab. Continuous Tab **resets the memory of every group it climbs out of**, so a wrap
re-enters at the tree end (not the last-visited child) — pure tree order, no relocated trap — while
container **restore** survives for non-Tab entry (click / `focusView` / window switch), which never runs
the climb. `FocusManager.focusNext`/`focusPrev` gain a `scope: View | null` parameter; the event loop
passes `scopeRoot()` (`modal.topView()` while a modal is open, else the mounted root). The change is
confined to `focus.ts` (rewrite `advance()` + add `descendLast`; `focusInto` untouched); every existing
focus oracle passes unedited.

## PR & verification

One PR against `@jsvision/ui` (core event system). Spec-first. Before the PR-bound push: `yarn lint:fix`
then `yarn verify` green (`TUI_SKIP_PERF=1`), `yarn bench` no-regression. Tracked by a new companion
GitHub issue (Primitive; prerequisite of #115 + #120).
