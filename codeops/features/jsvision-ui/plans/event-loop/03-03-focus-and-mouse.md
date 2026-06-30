# Focus Manager & Mouse Hit-Testing

> **Document**: 03-03-focus-and-mouse.md
> **Parent**: [Index](00-index.md)

## Overview

The per-group `current` focus chain (Tab/Shift-Tab + `focusView`/`getFocused` + save/restore +
repaint-on-flip) and the top-most-first mouse hit-test (+ focus-on-click). Covers AC-3, AC-4, AC-5,
AC-6, AC-7, AC-8.

## Architecture

### Focus model (`event/focus.ts`)

Global focus is the **root→leaf path of `current` pointers** (AR-48): each `Group.current` names its
focused child; following `current` from the root yields the focused leaf. The focus manager is a
loop-owned object over the mounted root `View`.

**Focusable predicate (AR-56, AR-65):**
```
isFocusable(view):
  return view.state.visible && !view.state.disabled && view.focusable
         && noBlockingAncestor(view)              # no !visible / disabled ancestor
isFocusableContainer(group): some descendant d has isFocusable(d)   # a Group is focusable iff …
```
`noBlockingAncestor` walks `view.parent` up; any `!visible` or `disabled` ancestor makes the view
ineligible (subtree semantics, AR-65). `focusable` defaults `false` (AR-65) — decorative by default.

**Setting focus to a leaf (`focusLeaf(view)`):**
```
focusLeaf(view):
  old = getFocused()
  set current pointers along view's ancestor chain so root→…→view  (AR-48)
  if old !== view:
     if old: old.state.focused = false; old.invalidate()           # repaint old (AR-6/AR-48)
     view.state.focused = true; view.invalidate()                  # repaint new
```
Exactly two views' `focused` flip + invalidate, coalescing into one frame (AC-6). `getFocused()`
follows `current` from the root to the leaf, or returns `null` if none.

**`focusView(view)` (public, AR-48, PA-5):** if `isFocusable(view)` → `focusLeaf(view)`; otherwise
a **no-op** (PA-5 — a focus request to a non-focusable view changes nothing).

**Tab / Shift-Tab (`focusNext`/`focusPrev`, AR-57):**
```
focusNext():
  determine the active group = the parent Group of the focused leaf (or root if none)
  among that group's focusable children (child order), advance current to the next (wrap at end)
  if the chosen child is a Group → descend: focus its current (or its first focusable) (AR-57)
  else focusLeaf(child)
focusPrev(): symmetric (previous; wrap at start)
```
Traversal is deterministic child-order; non-focusable children are skipped (AC-4). With no focusable
view anywhere, `focusNext`/`focusPrev` are no-ops.

> **Tick ownership (PA-11/PF-001).** The functions here (`focusLeaf`, `focusNext`/`focusPrev`,
> `focusView`) are the focus manager's **pure mutations** — they set `current` pointers, flip two
> `focused` flags, and `invalidate()`, but they do **not** flush. The loop's public
> `EventLoop.focusNext`/`focusPrev`/`focusView` wrap each in a `runTick` (03-01) so a standalone call
> produces exactly one coalesced frame; the built-in Tab handler (03-02) calls the manager mutation
> directly because it already runs inside the dispatch tick. This is what makes ST-06's "coalesces
> into one frame" hold for a standalone `focusView()` without relying on `serialize()`'s side-effect.

**Save/restore (AR-48, AR-53):** because focus is encoded **in** the `current` pointers, a group
that loses then regains the active path keeps its `current` — re-entry restores the previous child,
not the first. Modal open/close (03-04) saves/restores the outer focused leaf around the modal.

### Mouse hit-testing (`event/hit-test.ts`)

```
hitTestRoute(ev):                                  # ev.event is MouseEvent | WheelEvent
  (x0, y0) = (ev.event.x - 1, ev.event.y - 1)      # 1-based → 0-based (AR-63)
  hit = topMost(scopeRoot, absOrigin0, x0, y0)     # scopeRoot = top modal subtree if modal, else root
  if hit is null: return                           # click on empty space / outside modal → no-op (PA-6)
  if ev.event is MouseEvent and kind 'down': focusOnClick(hit)     # AR-50, AR-57
  local = { x: x0 - hitAbsX, y: y0 - hitAbsY }     # view-local coords on the envelope
  deliver(hit, { ...ev, local })                   # onEvent sees ev.local (AR-50)
```

> **Note (PF-007).** `{ ...ev, local }` builds a **new** envelope (DispatchEvent.local is readonly),
> so a handler that sets `handled` mutates this copy, not the original `ev`. Fine today — mouse/wheel
> skip the 3-phase bubble, so nothing re-reads `handled` after delivery. If wheel/mouse bubbling is
> ever added, carry `handled` back so the consumed flag isn't silently dropped.

**`topMost` walk (AR-50):** recurse the tree tracking each view's absolute origin and the
ancestor-clip rect (`intersect`, reused from `view/geometry.ts`); test children **last-first**
(reverse `Group.children` = front-to-back paint Z-order) so the on-top sibling wins overlaps; skip
any `!visible`/`disabled` subtree (AR-65); a point hits a view iff it lies in the view's absolute
bounds ∩ ancestor clip. Returns the deepest top-most hit (or `null`).

**`focusOnClick(hit)`:** climb from `hit` to the nearest `isFocusable` view (itself or an ancestor);
if one exists, `focusLeaf(it)`; otherwise leave focus unchanged (a click outside any focusable view
steals no focus, AC-8).

## Implementation Details

### Integration Points
- **Geometry:** reuse `intersect`/`contains`/`translate` + `Point` from `view/geometry.js` (no new
  geometry — same as RD-03 compose, AR-37).
- **Dispatch (03-02):** `route` sends mouse/wheel to `hitTestRoute`; key Phase 2 uses the focus
  chain.
- **Repaint:** focus flips call `view.invalidate()` (RD-03 `ViewHost`), coalesced by the loop's
  single per-tick flush (AC-6).
- **Modal (03-04):** `scopeRoot` is the top modal subtree when a modal is active.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| `focusView` on a non-focusable view | no-op (no flag change) | PA-5 |
| Hit-test point outside every view / off-tree | `topMost` returns null → dispatch no-op (never throw) | AR-50, RD-04 Security § |
| `focusNext` with zero focusable views | no-op | AR-57 |
| Disabled/hidden ancestor over a `focusable` leaf | leaf ineligible (subtree semantics) | AR-65 |
| Click outside the active modal subtree | `scopeRoot` excludes it → null hit → ignored | AR-53, PA-6 |

> **Traceability:** see [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements
- **Spec (ST-03,04,05,06):** focusing a leaf sets `current` at every ancestor + `getFocused` +
  exactly that leaf `focused`; Tab/Shift-Tab wrap + skip non-focusable; predicate incl. ancestor
  subtree semantics + Group-focusable-iff-descendant; focus flip invalidates exactly old+new (one
  frame).
- **Spec (ST-07,08):** 1-based→0-based hit-test delivers to the top-most overlapping view with
  view-local `ev.local`; mouse-down focuses the hit's chain; empty-space click steals no focus.
- **Impl:** save/restore on group re-entry; descend-into-Group focuses its `current`/first; reverse
  z-order overlap resolution; hidden subtree skipped in both focus traversal and hit-test;
  `focusView` no-op path.
