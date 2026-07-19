# 01 — Requirements

> **Plan**: layout-dsl-adoption/focus-traversal-primitive
> **Source**: [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md) (enabler for FR-2/FR-3),
> [RD-02](../../requirements/RD-02-non-functional-and-verification.md) (NFR-1/NFR-5)
> **CodeOps Skills Version**: 3.9.0

## Objective

Make keyboard focus traversal (`Tab` / `Shift-Tab`) walk the view tree in **document (tree) order
across group boundaries**, bounded by the active modal/window scope — so that a dialog composed with
the layout DSL's nested `col`/`row` containers is fully keyboard-traversable. This is the prerequisite
that lets RD-01's FR-2/FR-3 ("behavior invariant, tab order preserved") actually hold when the TV
dialogs are flex-rebuilt.

## In scope

- **R-1 — Tree-order traversal.** `advance()` walks the focus tree in `direction`: from the focused
  leaf, take the next focusable in tree order, crossing out of a fully-traversed group into its
  parent's next focusable sibling. [AR-1]
- **R-2 — Scope ceiling.** Traversal is confined to `scopeRoot()` (the top modal's subtree while a
  modal is open, else the mounted root); it wraps at that ceiling and never focuses a view outside it.
  Window switching remains a separate command. [AR-2]
- **R-3 — Direction-aware descent; restore preserved for non-Tab entry.** Forward descent reuses
  `focusInto` (restore-or-first); reverse descent uses a new `descendLast` (restore-or-last) so Shift-Tab
  is the exact inverse of Tab. Continuous Tab resets the memory of the groups it climbs out of, so a wrap
  is pure tree order (no relocated trap); container **restore** is kept for non-Tab entry (click /
  `focusView` / window switch / dialog open-close). [AR-3]
- **R-4 — Wrap + empty-start.** Wrap at the scope ends; `Tab`/`Shift-Tab` with nothing focused enter
  the scope's first/last focusable. [AR-4, AR-5]
- **R-5 — Surgical wiring.** Confine the change to `focus.ts`: rewrite `advance()` (climb + exited-group
  memory reset + prior-leaf capture) and add one `descendLast` helper; thread the scope through
  `FocusManager.focusNext(scope)`/`focusPrev(scope)`; the loop supplies `scopeRoot()`. `focusInto` and the
  other predicates are untouched; public `EventLoop.focusNext()`/`focusPrev()` stay parameterless. [AR-6]
- **R-6 — Additive tests.** Every existing focus spec/impl/hardening oracle passes **unedited**; add
  new spec oracles (ST-F#) for the cross-group DFS contract. [AR-7]
- **R-7 — Docs.** Public JSDoc on the changed traversal methods explains the tree-order + scope
  behavior with a copy-pasteable `@example`; `check:docs` green. [Docs standard]

## Out of scope

- The flex rebuild of any dialog (that is #120 files / #115 ui-forms — this plan only unblocks them).
- Window switching, `desktop.focusNextWindow`, and modal-stack semantics (unchanged). [AR-2]
- Any change to `focusInto`/`focusView`/`getFocused`/`focusedLeafIn`/`isFocusable`. [AR-6]
- Mouse hit-testing / capture, keymap binding of `tab` (an app that binds `tab` still wins — the
  built-in only fires on an unbound `tab`, `event/dispatch.ts:132`).

## Success criteria

1. A dialog whose children are nested `col`/`row` groups is fully `Tab`/`Shift-Tab` traversable in tree
   order, wrapping within the dialog with **no trap**, and Shift-Tab is the exact inverse of Tab.
   (R-1, R-4 → ST-F1, ST-F2, ST-F3, ST-F6)
2. With a modal open, traversal never focuses a view behind the modal and wraps within it. (R-2 → ST-F5)
3. Re-entering a container by a **non-Tab** path (click / `focusView` / window switch / dialog open-close)
   restores its saved child; continuous Tab is pure tree order. (R-3 → ST-F4 [non-Tab restore], witness W-5)
4. All existing focus oracles (spec + impl + hardening) pass **unedited**. (R-6 → W-1…W-9)
5. `yarn verify` green (`TUI_SKIP_PERF=1`); `check:docs` green; `yarn bench` no-regression; no new
   per-frame allocation on the traversal path. (R-7, NFR-5 → IMP-3)
