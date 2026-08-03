# RD-11: Board Configuration APIs and Dialogs

> **Document**: RD-11-board-configuration-dialogs.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-05, RD-08, RD-09, RD-10
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Applications need both programmatic workflow configuration and package-provided themed localized UI that
collects the same request data. Column and swimlane dialogs edit isolated drafts and dispatch one atomic
application request. Hide/collapse remain reversible view settings; structural deletion never cascades
cards and requires an explicit application policy for non-empty structures.

---

## Functional Requirements

### Must Have — Complexity L

- [ ] Expose typed programmatic request builders/commands for column and explicit-swimlane add, edit,
  reorder, hide/show, collapse/expand, and delete.
- [ ] Provide invocable package dialogs for create/edit/reorder/personalize and localized confirmations;
  applications choose whether to use or replace them.
- [ ] Keep stable structural IDs immutable through rename/edit and validate normalized names/duplicates.
- [ ] Edit an isolated configuration draft and emit one atomic request on Apply/OK; Cancel/Esc leaves
  application data and current view unchanged.
- [ ] Treat hide/collapse as reversible saved-view operations separate from structural deletion.
- [ ] Confirm empty structural deletion and block non-empty deletion by default.
- [ ] Permit applications to configure one atomic non-empty deletion policy: reassignment destination,
  archive destination, or custom dispatcher workflow.
- [ ] Never cascade-delete cards and never accept partial reassignment/archive success.
- [ ] Gate derived-swimlane structural operations by explicit application capabilities.
- [ ] Keep draft/dialog open with values/errors after async rejection and handle stale structure revisions.
- [ ] Apply deterministic focus fallback after accepted structural publication.

### Should Have — Complexity M

- [ ] Provide preview/read-only summaries of affected card counts, WIP, and destination before destructive
  confirmation when authoritative data is available.
- [ ] Support reordering through keyboard/buttons and pointer drag with identical request semantics.
- [ ] Provide standard view-personalization entry points for widths, visibility, grouping, and saved views.

### Won't Have (Out of Scope)

- Component-owned workflow persistence, card deletion, partial bulk migration, derived-group mutation
  without app mapping, or forced UI confirmation for direct programmatic request builders.
- Inline workflow-header editing or permanent gear buttons on every header.

---

## Technical Requirements

### Programmatic request API — Complexity M

Public typed builders create RD-08 request variants using current IDs/revisions and application-provided
operation IDs/factory. Builders validate shape and capability but do not mutate/dispatch unless the
caller invokes the shared dispatcher convenience. Direct programmatic requests do not display package
confirmations; the application owns the calling UX and dispatcher authorization.

### Standard dialogs — Complexity L

Dialogs are exported from the main package, receive host/i18n/theme, current structural snapshot,
capabilities, form schema overrides, and dispatcher or result-only mode. Interiors use responsive DSL,
measured action groups, and a growing scrollable list/form. They preserve one-cell content inset in docs
`Template1Dialog` shells but do not depend on docs-site code.

Column fields include name, optional width bounds, WIP min/max/mode, DoD summary/details, and configured
application fields. Swimlane/grouping dialogs include grouping field, presentation variant, group
order/name/disambiguator/visibility/collapse/style, and only capability-supported structure controls.

### Name and identity validation — Complexity M

IDs are immutable after creation and satisfy RD-01 bounds. Display names trim and normalize for duplicate
checking using documented locale-independent normalization. Empty names reject. Duplicate normalized
names reject by default; application opt-in requires a non-empty visible disambiguator. The package does
not silently regenerate IDs after validation failure.

### Deletion policy — Complexity L

| Structure state | Standard behavior |
|---|---|
| Empty, deletable | Show destructive confirmation; dispatch one delete request |
| Non-empty, no policy | Disable/block with count and explanation |
| Non-empty, reassign | Require valid destination; dispatch one delete+reassign atomic request |
| Non-empty, archive | Require configured archive destination; dispatch one atomic request |
| Non-empty, custom | Invoke application request builder; still one atomic dispatcher outcome |
| Count unknown | Block until authoritative policy/count can decide |

No option creates a card cascade-delete request. The application decides whether standard UI permits
deleting the final empty column; the component itself supports authoritative zero-column state.

### Stale/rejected configuration — Complexity M

Draft captures structural revision. Any relevant external publication marks stale; Apply is disabled
until Reload/Cancel/application merge policy. During submit, keep draft and pending feedback. Rejection
maps field/form errors. Accepted result awaits authoritative structure publication. On publication,
focus remains on stable survivor or falls to next/previous column, then board state.

### Invocability and uncluttered access — Complexity S

Applications invoke dialogs through functions, commands, menus, or their own UI. Standard headers expose
context menu/command routes; they do not show permanent gear controls. A one-cell collapse indicator and
conditional Add affordance are allowed within RD-03 width budgets.

---

## Integration Points

- **RD-05** defines structural models, capabilities, WIP/DoD/grouping states.
- **RD-08** dispatches every configuration mutation atomically.
- **RD-09** owns view-only personalization and saved-view capture/apply.
- **RD-10** supplies forms/draft/validation/dialog lifecycle.
- **RD-12/RD-13** supply commands, menus, events, messages, and theme roles.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Configuration ownership | App UI / package mutate / package dialog+app request | Package UI + app request | Reusable localized UX and authority | AR #8 |
| Hide/collapse/delete | Same / distinct | Distinct | Reversible view state vs structure | AR #33 |
| Non-empty deletion | Cascade / block / policy | Block default, atomic policy | No data loss/partial state | AR #33 |
| Programmatic confirm | Always / caller-owned | Caller-owned | Non-UI workflows | AR #33 |
| Derived groups | Always mutable / capability | Capability | Derived IDs may not map to structure | AR #33 |

---

## Security Considerations

- UI capability and confirmation are not authorization; dispatcher revalidates current structure,
  affected cards, destination, and permissions atomically.
- Names, DoD, IDs, disambiguators, reasons, and application fields are sanitized/bounded. Destructive
  confirmation displays authoritative counts without card payloads.
- Unknown counts/revisions fail closed for destructive standard workflows.
- No cascade-delete request exists in the standard union. Custom extensions remain namespaced and
  application-authorized.
- Dialog errors/observations do not expose card records, placement tokens, or custom sensitive values.

---

## Acceptance Criteria

1. [ ] Programmatic add/edit/reorder/delete builders return validated typed requests without changing
   source data or opening a confirmation.
2. [ ] Invoking the standard Add Column dialog, entering valid data, and applying produces one request;
   Cancel/Esc produces zero and leaves the current structure/view byte-semantically unchanged.
3. [ ] Renaming preserves the column ID in cards, focus, saved views, requests, and events.
4. [ ] Empty/whitespace and duplicate normalized names reject; duplicate opt-in remains invalid until a
   visible non-empty disambiguator is supplied.
5. [ ] Hide/show and collapse/expand alter only view state and never dispatch structural delete or move
   card requests.
6. [ ] Deleting an empty structure through package UI requires a destructive confirmation and dispatches
   exactly one request only after confirmation.
7. [ ] Non-empty deletion with no policy or unknown count is blocked with reason and zero dispatcher calls.
8. [ ] Reassign/archive/custom deletion sends one atomic request containing all affected scope/destination
   semantics; a partial result is rejected and leaves all cards/structure authoritative state unchanged.
9. [ ] No standard deletion path constructs a cascade card-delete request.
10. [ ] Derived swimlane edit/delete controls are disabled/absent according to explicit capability and
    programmatic construction receives the same eligibility result.
11. [ ] Async rejection retains every draft value, focus, dirty state, and mapped error for correction.
12. [ ] Relevant structural publication marks an open dirty draft stale and blocks ordinary Apply until
    Reload/Cancel/application policy.
13. [ ] Accepted deletion publication moves focus to next, previous, or board in documented order with no
    hidden/unmounted focus.
14. [ ] At narrow geometry, all fields/actions remain reachable through responsive layout/scroll and no
    ordinary dialog control uses raw absolute placement.
15. [ ] Header context menu and command routes can open configuration; no fixture requires a permanent
    per-header gear button.
16. [ ] Hostile names/DoD/error text are safe on screen and absent unredacted from diagnostics.
