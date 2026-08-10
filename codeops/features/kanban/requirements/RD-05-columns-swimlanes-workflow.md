# RD-05: Columns, Swimlanes, and Workflow Policy

> **Document**: RD-05-columns-swimlanes-workflow.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-02, RD-03, RD-04
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Workflow columns define the board's mandatory vertical stages. An optional horizontal swimlane axis
groups cards by one field such as team, project, epic, sprint, priority, or an application-defined
dimension. This document defines structure, WIP policy, definitions of done, grouping, visibility,
collapse, summaries, presentation variants, and structural empty/error behavior without nested grouping.

---

## Functional Requirements

### Must Have — Complexity L

- [ ] Support zero or more application-owned ordered workflow columns with stable IDs, localized names,
  per-lane start/center header alignment, width preferences, visibility, collapse, definition of done,
  and min/max WIP policy.
- [ ] Support no grouping or exactly one active swimlane grouping dimension per view.
- [ ] Support explicit and derived swimlane groups with stable IDs, names, order, visibility, collapse,
  styling, counts, summaries, and application capabilities.
- [ ] Render hybrid (default), separator, band, rail, and custom bounded swimlane presentations.
- [ ] Keep workflow/WIP counts authoritative and unaffected by filters; visibly qualify unknown/partial
  data.
- [ ] Support informational, advisory, and blocking WIP min/max modes through application validation.
- [ ] Support arbitrary application-approved transitions, definitions of done, and forward/backward moves.
- [ ] Distinguish true empty, filtered empty, loading, partial, collapsed, hidden, and error states.
- [ ] Permit reversible hide/collapse independent of structural deletion.

### Should Have — Complexity M

- [ ] Display application-provided numeric summaries at column or swimlane headers when width permits.
- [ ] Temporarily auto-expand a collapsed swimlane during valid drag hover without changing saved state.
- [ ] Support custom group order and style resolvers with bounded failure isolation.

### Won't Have (Out of Scope)

- Nested swimlane grouping, split columns, component-owned backlog, or a second slice axis.
- Component-side WIP bypass or state transition persistence.
- Deleting cards when a structural entity is removed.

---

## Technical Requirements

### Column model — Complexity M

Every column carries a bounded string ID, display name, order, optional start/center header alignment,
optional width bounds, visible/collapsed view state, optional definition-of-done summary/details, WIP
policy, and capability metadata. Header alignment defaults to start and changes only the label's
horizontal placement, not card geometry. IDs remain stable across rename and must not be inferred from
labels. The board accepts zero columns and renders a valid no-columns state; standard UI policy for
deleting the final empty column is application configured.

### WIP policy — Complexity L

WIP supports optional minimum and maximum non-negative integer limits plus mode:

| Mode | Board behavior |
|---|---|
| Informational | Shows count/limit and violation; request remains eligible |
| Advisory | `canDrop` reports warning and confirmation policy; app may accept/reject |
| Blocking | `canDrop` rejects when authoritative policy says the proposed count is invalid |

Unknown authoritative counts cannot be treated as safe under blocking policy; the source/application
must provide a decision or reject with an honest unavailable reason. Filters never reduce WIP. Done
columns may define whether completed cards count, but this is explicit application policy.

### Definition of done and transitions — Complexity M

Column headers expose a compact non-cluttering DoD indicator when configured; full text appears in
focus/help/action surfaces. A pure synchronous eligibility resolver receives source/target, card IDs,
counts, DoD/transition context, and revisions. It returns allowed, warning, blocked, or unavailable with
a localized reason code. Final authorization and async validation occur in RD-08's dispatcher.

### Swimlane grouping — Complexity L

- A saved view selects zero or one registered grouping field.
- Explicit grouping reads source-supplied groups; derived grouping uses a pure registered resolver.
- Each card resolves to exactly one semantic group, whether that group is visible or hidden. Missing or
  unmapped values alone resolve to the configurable bounded `unassigned` group; view projection then
  omits hidden groups without remapping their cards.
- Group IDs are semantic strings, not localized labels. Duplicate normalized display names reject by
  default; applications may allow them only with a visible disambiguator.
- Derived group add/delete/rename/reorder actions are disabled unless the application advertises the
  corresponding capability and request mapping.
- Hidden groups are omitted and never auto-revealed by drag. Collapsed groups retain header/count and
  may auto-expand temporarily after the configured drag-hover delay.

### Presentation variants — Complexity M

- **Hybrid default**: one compact titled separator plus a subtly themed card region.
- **Separator**: title/count on a dividing row; no band fill.
- **Band**: one header row with themed group region.
- **Rail**: bounded left label rail assigned by responsive layout; it collapses to hybrid when it would
  reduce a card column below effective minimum.
- **Custom**: validated descriptor within one header/separator region and declared style budget.

Separators may use a line, background, or both. Titles on dividing lines ellipsize safely. None doubles
as a card insertion target.

### State surfaces and collapse — Complexity M

State surfaces are scoped to a board, column, swimlane, or cell and use DSL composition. Collapse hides
card regions but preserves semantic counts/header/actions. Filtering to zero produces a Clear Filters
action; true empty may expose Add Card when writable. Loading/partial/error messages never masquerade as
empty. Retry is scoped and bounded.

---

## Integration Points

- **RD-02** provides structure, counts, groups, summaries, state, and completeness.
- **RD-06/RD-07** navigate/hit-test headers, collapsed groups, and real insertion gutters.
- **RD-08** validates WIP/transitions and atomically requests moves/configuration.
- **RD-09** persists hide/collapse/grouping/presentation as view semantics.
- **RD-11** supplies package configuration UI.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Axes | Columns only / two axes / nested | Columns + one swimlane axis | Useful grouping without TUI clutter | AR #6, #7 |
| Workflow | Basic / WIP+DoD+transitions | Full policy seams | Mainstream best features | AR #15 |
| Presentation | One / several / custom | Hybrid default + variants | Different TUI grouping needs | AR #7 |
| Counts | Filtered / authoritative | Distinct authoritative | Honest policy | AR #15, #37 |
| Hide/delete | Same / distinct | Distinct | Reversible view vs structural mutation | AR #33 |

---

## Security Considerations

- Structural IDs, names, DoD text, summary labels, reason messages, and custom group descriptors are
  validated, sanitized, and bounded.
- Capabilities do not enforce authorization; dispatcher validation repeats all WIP/transition and
  structural policies against current authoritative data.
- A custom grouping/style/summary resolver cannot access implicit host resources and failures are local.
- The component never cascade-deletes cards or treats filtered absence as authorization to delete.
- Remote count/group acquisition remains subject to application endpoint authorization/rate limiting.

---

## Acceptance Criteria

1. [ ] A zero-column source renders a valid localized no-columns surface and no invalid card/header hit
   regions; the component remains focusable as a board.
2. [ ] Renaming a column changes its label while card placement, saved-view reference, and focus continue
   to use the unchanged ID.
3. [ ] With an active filter hiding half the cards, WIP count/violation equals the authoritative unfiltered
   count and matching count remains separately labeled.
4. [ ] Informational WIP shows a violation but allows proposal; advisory returns a warning path; blocking
   rejects before async dispatch when authoritative counts prove the limit would be exceeded.
5. [ ] Blocking WIP with unknown authoritative count does not silently allow a move and displays an
   unavailable/retry reason.
6. [ ] An arbitrary backward transition is allowed when the application resolver allows it and rejected
   with its reason when it does not.
7. [ ] Exactly zero or one grouping field can be active; attempting two rejects the view configuration.
8. [ ] A derived card with no group value appears in the configured unassigned group rather than being
   omitted.
9. [ ] A card belonging to a hidden semantic group is omitted with that group and never appears in
   `unassigned`; revealing the group restores the card to its original group.
10. [ ] Duplicate normalized swimlane names reject by default; enabling duplicates requires distinct
   visible disambiguators.
11. [ ] Hybrid, separator, band, and rail fixtures show the same groups/cards/counts and differ only in
    bounded presentation; rail degrades when it would violate 18-cell minimum.
12. [ ] Clicking a swimlane header toggles collapse when capable and never reports a card drop target.
13. [ ] Drag hover temporarily expands a collapsed visible group after the configured delay, leaving it
    restores collapse, and a successful drop does not persist expanded state.
14. [ ] A hidden group never auto-reveals during navigation, search, or drag.
15. [ ] True empty, filtered empty with Clear Filters, loading, partial, collapsed, and error/retry frames
    have distinct semantic state codes and visible non-color evidence.
16. [ ] A throwing grouping/summary/style resolver produces a sanitized local fallback and observation
    while other groups remain usable.
17. [ ] No structural operation removes a card from application data without an accepted application
    request and authoritative publication.
18. [ ] A populated fixture renders three non-empty workflow columns in source order with stable header
    IDs and cards in their authoritative cells; changing only the published column order reorders the
    columns without changing card identity or mounting one view per logical card.
19. [ ] A column defaults to start-aligned header text, accepts centered header text through its reactive
    structure policy, and rejects unsupported alignment strings without corrupting neighboring lanes.
