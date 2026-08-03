# RD-06: Focus, Navigation, and Selection

> **Document**: RD-06-focus-navigation-selection.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-03, RD-05
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Every board action must be reachable without a mouse, while pointer users receive familiar selection
behavior. Focus, selection, range anchors, and logical grab state use stable identities independent of
virtualization. Navigation is spatial and deterministic across cards, columns, swimlanes, filters,
collapse, unloading, resize, and authoritative deletion.

---

## Functional Requirements

### Must Have — Complexity L

- [ ] Establish deterministic initial focus: first visible card, then first visible column header, then
  the board/no-results state.
- [ ] Navigate cards vertically within a cell and spatially to the nearest card in neighboring columns;
  expose header, swimlane, page, home/end, and board traversal commands.
- [ ] Keep focused card visible by minimal scrolling and preserve its stable key through source/view/layout
  updates when it remains eligible.
- [ ] Reconcile vanished/hidden focus in deterministic local-to-global order.
- [ ] Support single, toggle, range, and loaded-visible-matching select-all semantics with non-color cues.
- [ ] Make single click singly focus/select, double-click open, Primary-click toggle, right-click focus
  then open actions, and Space toggle keyboard selection.
- [ ] Limit Shift range extension to one column/swimlane cell and preserve an explicit range anchor.
- [ ] Prune selection made invisible by filter/hide/view changes with feedback, while preserving identity
  across window unloading.
- [ ] Expose selection/focus state and commands through public typed APIs without direct set mutation.

### Should Have — Complexity M

- [ ] Preserve nearest visual row when moving horizontally between cards of different heights.
- [ ] Provide an optional application-supplied server-wide selection model distinct from client loaded
  selection.
- [ ] Expose a concise localized interaction help surface and active-selection count.

### Won't Have (Out of Scope)

- Cross-cell Shift ranges or implicit selection of unloaded cards.
- Browser DOM focus semantics or screen-reader claims not supported by the terminal host.
- Selection based on array index rather than stable identity.

---

## Technical Requirements

### Focus model — Complexity L

Focus targets are discriminated identities: board state, column header, swimlane header, or card key
with structural address. The model retains the last preferred visual center row for spatial movement.
Only mounted/visible/enabled logical targets receive active focus paint, but virtualized focused identity
may trigger bounded loading/reveal before falling back.

Reconciliation order when a card ceases to be eligible:

1. next visible card in the same cell;
2. previous visible card in the same cell;
3. nearest visible card in the next then previous workflow column at the preferred row;
4. containing/nearest visible column header;
5. board, no-results, or minimum-size state.

Clearing a filter does not steal focus back to a previously hidden card. Authoritative deletion uses the
fallback once; page unload retains identity and attempts reload/reveal within source policy.

### Navigation semantics — Complexity M

- Up/down choose previous/next visible card in the current cell; at boundaries move to header/adjacent
  swimlane according to documented command.
- Left/right choose the nearest card by visual center in the adjacent visible column, preserving the
  swimlane when possible; otherwise choose its header.
- Home/End operate in the current cell; Primary+Home/End operate on first/last visible board target.
- Page commands move by viewport height while retaining a deterministic anchor.
- In focused-column mode, left/right column commands use the one-row navigator and retain nearest row.
- Navigation into an unloaded known range requests bounded acquisition and displays pending navigation;
  unavailable/failed acquisition leaves focus unchanged with feedback.

### Selection semantics — Complexity L

- Single click or unmodified selection command replaces selection with the focused card.
- Primary-click and Space toggle a card without changing other membership; the focused card remains
  the range anchor unless a range action establishes another anchor.
- Shift navigation selects the contiguous visible loaded range between anchor and focused card within
  one cell. Crossing a cell ends range extension and performs ordinary spatial navigation.
- Primary+A selects loaded, visible, matching cards only and visibly announces scope/count.
- An application may provide a separate explicit server-wide selection token/model; the standard
  selected-key set never implies unseen cards.
- View changes prune now-invisible selections and report the removed count. Cursor unloading alone does
  not prune. Destructive/bulk actions use the current visible eligible selection snapshot.

### Pointer/keyboard interaction — Complexity M

Pointer-down focuses the hit card. Selection is finalized on click or drag-threshold crossing so a
dragged selected card preserves the selection, while dragging an unselected card replaces it at the
threshold unless a toggle modifier applies. Double-click routes the same Open/Edit command as Enter.
Right-click does not silently retain actions on a different focused card.

`Primary` uses RD-12's semantic host binding: Command on capable macOS browser hosts and Ctrl on other
browser hosts and native terminals. Pointer toggle detection uses the same normalized semantic modifier.

Esc handling is layered: cancel drag/grab/menu/dialog first; when no transient interaction exists, clear
multi-selection while preserving focus; a singly selected focused card may remain the implicit action
target according to documented selection mode.

### Focus and state cues — Complexity S

Focus, selection, range anchor, keyboard grab, pending, and invalid states each have semantic theme roles
and non-color marker/glyph/text fallbacks. Cues do not consume an extra permanent toolbar or one marker
column per state; compatible states combine through a documented precedence table.

---

## Integration Points

- **RD-03** provides reveal/scroll and exact card/header geometry.
- **RD-05** supplies visible/collapsed/hidden group structure.
- **RD-07** uses selection snapshots and focus during pointer drag.
- **RD-08** uses deterministic selected-card order for atomic bulk requests.
- **RD-09** triggers focus/selection reconciliation after query changes.
- **RD-12/RD-13** define commands/keymaps/help and accessible cues.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Initial focus | Card / header / board cascade | Deterministic cascade | Useful empty and populated states | AR #31 |
| Horizontal navigation | Index / spatial nearest | Spatial nearest | Variable card heights | AR #19, #31 |
| Selection | Loaded / logical hidden | Loaded visible by default | Honest windowed scope | AR #37 |
| Range | Whole board / one cell | One cell | Avoid ambiguous 2-D ranges | AR #31 |
| Invisible items | Retain / prune | Prune on view hide, retain on unload | Safe destructive scope | AR #37 |

---

## Security Considerations

- Bulk/destructive actions capture only current eligible selected IDs; stale or invisible membership
  cannot silently expand destructive scope.
- Server-wide selection is an explicit application token and requires dispatcher authorization; the
  component does not enumerate or claim its membership.
- Focus/selection diagnostics contain stable IDs/counts, not card values.
- Pointer modifiers and synthesized events pass through normal capability and request validation.
- No clipboard or host-selection access is implied by selection terminology.

---

## Acceptance Criteria

1. [ ] Initial focus chooses the first visible card; with no visible cards it chooses the first visible
   column header; with zero columns it chooses the board state surface.
2. [ ] Horizontal navigation between unequal-height card stacks chooses the card whose visual center is
   nearest the prior preferred center row.
3. [ ] Filtering out the focused card applies the documented next/previous/neighbor/header fallback and
   clearing the filter does not steal focus back.
4. [ ] Authoritative deletion of focus applies fallback once; unloading its page retains identity and
   triggers bounded reveal/loading rather than selecting an unrelated card immediately.
5. [ ] Single click creates a one-card selection, Primary-click toggles without clearing others, and
   double-click invokes the same Open/Edit command as Enter exactly once.
6. [ ] Right-click first focuses the card under the pointer and its menu actions target that card/eligible
   selection, never the previously focused card.
7. [ ] Space toggles focused selection; Shift navigation selects only a contiguous visible loaded range
   in the same cell and cannot cross into another cell.
8. [ ] Primary+A on a partial cursor selects exactly loaded visible matching keys and displays a scope
   message that does not claim the logical total.
9. [ ] Applying a filter/hide change that removes three selected cards prunes those keys and reports
   `3`; page unload/reload reports `0` pruned.
10. [ ] In focused-column mode, previous/next column navigation preserves the preferred row and reveals
    the destination column/card without a hidden focused target.
11. [ ] Failed acquisition during navigation leaves focus on its prior target and renders retry/error
    feedback; late success after cancellation does not move focus.
12. [ ] Esc first cancels an active drag/menu; only a later Esc clears multi-selection, while focus remains.
13. [ ] Monochrome/ASCII frames distinguish focused-only, selected-only, focused+selected, range anchor,
    grab, pending, and invalid states through documented non-color precedence.
14. [ ] Selection APIs preserve key type so numeric `1` and string `'1'` can both be selected independently.
15. [ ] A bulk action receives an immutable ordered snapshot of eligible IDs/revisions; later selection
    changes do not alter the in-flight request.
