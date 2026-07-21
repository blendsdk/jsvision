# 03-01 — Component Spec: Scope-Ceilinged Tree-Order Traversal

> **Plan**: layout-dsl-adoption/focus-traversal-primitive
> **CodeOps Skills Version**: 3.9.0

Implements R-1…R-7. The only behavioral change is in `advance()`; everything else is wiring.

## Signature changes (R-5, AR-6)

- `FocusManager.focusNext(scope: View | null): void` and `focusPrev(scope: View | null): void`
  (add the `scope` parameter). `advance(direction: 1 | -1, scope: View | null)` takes the ceiling.
- `focusInto`, `focusView`, `getFocused`, `focusedLeafIn`, `isFocusable`, `canReceiveFocus`,
  `isFocusableContainer` are **unchanged** and reused. `focusInto`'s restore-or-first **contract is
  unchanged** — it is reused verbatim for forward descent.
- **New internal helper `descendLast(view)`** — a direction mirror of `focusInto` (restore-or-**last**),
  needed so reverse traversal lands on a container's *last* leaf (see the algorithm). `advance` also
  captures the previously-focused leaf before it resets any group memory (below). This keeps the change
  confined to `focus.ts` without altering `focusInto`.
- `event-loop.ts`:
  - public `focusNext()` → `this.runTick(() => this.focus.focusNext(this.scopeRoot()))`; `focusPrev()`
    symmetric.
  - `routeContext.focusNext` → `() => this.focus.focusNext(scope)` and `focusPrev` → `scope` (the
    `const scope = this.scopeRoot()` already computed at `event-loop.ts:502`).
  - `createFocusManager(() => this.root)` stays as is (the manager still reads the global root for
    `getFocused`/`focusedLeafIn`; the traversal ceiling now arrives per-call as `scope`).

## The algorithm (R-1…R-4)

`advance(direction, scope)` walks tree order, ceilinged at `scope`, wrapping there. It captures the
previously-focused leaf **first** (so the blur targets the right view even after memory is reset), climbs
from that leaf taking the first available sibling step in `direction` at each level, and — crucially —
**resets the `current` pointer of every group it climbs *out* of**. That reset is what makes continuous
Tab pure tree order: a subsequent wrap re-enters those groups at their tree end (first forward / last
reverse) instead of their last-visited child. A non-Tab focus change (`focusView`, a window switch,
opening/closing a dialog) never runs this climb, so container **restore** memory survives for those paths
(and W-5 still holds).

```
advance(dir, scope):
  if scope is null: return
  old = getFocused()                       # capture BEFORE any memory reset — the blur targets this leaf

  # Empty start (R-5): nothing focused (or focus outside scope) -> enter the scope at the end.
  if old is null or old not within scope:
    return enterEnd(scope, dir)            # dir=+1 -> first leaf; dir=-1 -> last leaf

  # Climb toward the ceiling, taking the first sibling step in `dir`; remember every group left by Tab.
  child   = old
  group   = old.parent
  target  = null                           # a sibling to step to, if the climb finds one
  exited  = []                             # groups bubbled out of; their stale memory is reset below
  while group is a Group and child is not scope:
    next = siblingCandidate(group, child, dir)   # next focusable sibling of `child` in `dir` (no wrap)
    if next is not null:
      target = next
      break
    if group is scope: break               # ceiling reached with nothing left -> wrap
    exited.push(group)                     # left this group by Tab -> its `current` is now stale
    child = group
    group = group.parent

  for g in exited: g.current = null        # reset AFTER capturing `old`; wrap/re-entry now goes tree-end

  if target is not null:
    return descend(target, dir)            # step to the sibling and descend into it
  return enterEnd(scope, dir)              # wrap: descend into scope's first/last leaf (exited memory cleared)
```

Helpers (mirroring the existing predicate + anchor-recovery logic in `focus.ts`):

- **`descend(view, dir)`** — the direction-aware descent used for every step and the wrap. `dir=+1` resolves
  the target leaf exactly as the existing **`focusInto`** does (restore-or-**first**); `dir=-1` uses the new
  **`descendLast`** (restore-or-**last**). Using `focusInto` for both directions is wrong: reverse traversal
  must land on a container's *last* leaf, or Shift-Tab stops being the exact inverse of Tab and the last
  child of every container is skipped.
  - **Flip from the captured `old`, not from `getFocused()`.** Resetting `exited` memory makes a
    mid-traversal `getFocused()` unreliable (it can no longer follow `current` down to the pre-reset leaf),
    so the old→new flip in traversal must be driven from the `old` captured at the top of `advance` — not
    recomputed inside `focusLeaf`. Concretely: factor the flip so `advance` blurs `old` and focuses the
    resolved target leaf (e.g. an internal `focusLeafFrom(old, leaf)` that `focusInto`/`descendLast` use in
    the traversal path). `focusInto`'s **external** behavior — for the non-traversal callers that keep
    self-computing `old` (click hit-test, `healFocus`, public `EventLoop.focusInto`) — is unchanged.
- **`descendLast(view)`** — identical to `focusInto` except it descends to `view.current` (restore) if still
  focusable, else the **last** `canReceiveFocus` child (`children.findLast(canReceiveFocus)`), recursing to
  a leaf. `focusInto` itself is **unchanged**.
- **`enterEnd(scope, dir)`** — `descend` into the first (`dir=+1`) or last (`dir=-1`) `canReceiveFocus`
  child of `scope`: `descend(scope.children.find(canReceiveFocus), +1)` /
  `descend(scope.children.findLast(canReceiveFocus), -1)`. Because the climb already reset the memory of the
  groups it exited, a Tab wrap descends to the tree-end leaf; a group last entered by a non-Tab path keeps
  its saved child (restore).
- **`siblingCandidate(group, child, dir)`** — among `group.children.filter(canReceiveFocus)`, the neighbour
  of `child` in `dir` (no wrap here — wrapping happens only at `scope` via `enterEnd`). Preserve the current
  **anchor-recovery** behavior (`focus.ts:161-181`): if `child` is not itself a candidate (it was
  disabled/removed), resume from the nearest candidate in tree order in `dir`, else return null so the climb
  bubbles up. `child` here is a *direct* child of `group` (either `old` at the first level or the group we
  just bubbled out of), so `group.children` is the right axis.

### Why existing oracles still pass

- **Flat wrap (ST-04):** with `scope = root` and all candidates flat, `old.parent = scope`, so the loop
  breaks at the ceiling with `exited` empty (no reset fires); `enterEnd` wraps to the first/last. Identical
  sequence.
- **Descend-first (impl `:56`, ST-05 descend):** forward `enterEnd`/`focusInto` still descends to the first
  focusable of a fresh container.
- **Restore-on-reentry (impl `:29-52`, W-5):** `sib` and `g1` are flat children of root. From `sib`,
  `siblingCandidate(root, sib, +1)` is `null` and `root` is the scope, so the loop breaks with `exited`
  **empty** — `g1` was left earlier by `focusView(sib)`, a non-Tab path that never ran this climb, so its
  `current` is untouched. `enterEnd` → `focusInto(g1)` → **restores** its saved `a2`. Identical result: the
  reset fires only for groups a *Tab* climbed out of, and W-5's exit was not one.
- **Disabled-anchor recovery (hardening `:263`):** preserved inside `siblingCandidate` (flat; no climb, no
  reset).
- **Zero-focusable / hidden-ancestor no-ops:** `canReceiveFocus`/`isFocusable` unchanged, so the climb finds
  nothing and `enterEnd` no-ops.

### The new behavior (the fix)

When `focused` is deep in a nested group and is the last candidate of that group, the climb **bubbles to the
parent**, takes the parent's next sibling (or wraps via `enterEnd` at the ceiling), and **resets the memory
of every group it left** — so continuous Tab is pure tree order with no trap: `col(row(input), row(ok,
cancel))` cycles `input → ok → cancel → input`, and Shift-Tab is its exact inverse (`descendLast` lands on
each container's last leaf in reverse). Tab exits the file list into the buttons, exits a `col`/`row`, exits
a `formDialog` body, exits a `CheckGroup`. Confined to `scope`, it never leaves an open modal. Container
**restore** still applies whenever focus enters a container by a non-Tab path (click, `focusView`, window
switch, dialog open/close), because those paths don't run the climb-and-reset.

## Modal confinement (R-2, ST-F5)

Because the loop passes `scope = scopeRoot()` and the climb `break`s when `group is scope`, traversal
can never reach a sibling of the modal (the desktop behind it). `enterEnd(scope, …)` only descends
*into* the modal subtree. With no modal, `scope = root` and behavior matches today at the root level.

## Documentation (R-7)

Update the JSDoc on `focusNext`/`focusPrev` (interface + impl) to describe **tree-order traversal bounded
by the active scope, wrapping at the scope**, that Shift-Tab is the exact inverse of Tab, and that
container **restore** applies to non-Tab entry (click / `focusView` / window switch / dialog open-close)
while continuous Tab is pure tree order. Add an `@example` showing Tab cycling a `col(row(input),
row(ok, cancel))` dialog input → ok → cancel → wrap → input (and Shift-Tab reversing it). Keep the comments
*why*-focused (why the ceiling exists: no leak out of a modal, no window switch; why exited-group memory is
reset: so a wrap is tree-order, not last-visited). No CodeOps IDs / TV-C++ refs in shipped code.

## Files touched

- `packages/ui/src/event/focus.ts` — `advance` (climb + exited-group memory reset + prior-leaf capture) +
  new `descendLast` helper + `focusNext`/`focusPrev` signatures + JSDoc. `focusInto` unchanged.
- `packages/ui/src/event/event-loop.ts` — pass `scopeRoot()` at the two call sites (public methods +
  `routeContext`).
- `packages/ui/src/event/dispatch.ts` — only if the `FocusContext` type there needs the `scope`
  threaded (verify `focusNext`/`focusPrev` there stay parameterless from the view's perspective; the
  loop supplies scope). No behavior change in `dispatch.ts`.

Target: `focus.ts` stays well under the 500-line oracle (currently ~197; `descendLast` + the climb add an
estimated ~40–60 lines → ~240–260).
