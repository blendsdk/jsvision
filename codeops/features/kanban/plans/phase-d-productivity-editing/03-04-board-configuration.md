# Board Configuration: Phase D

> **Document**: 03-04-board-configuration.md
> **Parent**: [Index](00-index.md)

## Overview

Applications receive pure programmatic request builders and may invoke package-provided responsive
dialogs for columns and explicit swimlanes. Both paths produce the same validated proposals and enter
the existing authority coordinator only when the caller requests dispatch (AR-D08).

## Programmatic builders

Export builders for add, update, reorder, and delete of columns/swimlanes. Builders receive the current
structural snapshot, revisions, capabilities, application operation-ID policy, and semantic position.
They validate immutable IDs, labels, widths, WIP/DoD, styles, application fields, destination policies,
and stable neighbors. They never open UI, confirm, mutate, or dispatch.

Display names sanitize terminal controls, trim, normalize with NFKC, then use fixed `en-US` lowercase
for locale-independent collision keys, matching existing grouping behavior. Empty or duplicate keys
reject. Duplicate opt-in requires a non-empty visible disambiguator. IDs remain immutable and are never
silently regenerated.

## Dialogs

Column dialogs support name, width constraints, WIP min/max/mode, DoD summary/details, and registered
application fields. Swimlane/grouping dialogs support grouping field, presentation variant, group
order/name/disambiguator/visibility/collapse/style, and only capability-supported structure controls.
Reorder is available through keyboard/buttons and pointer drag with identical proposals.

Dialogs use the editor-session lifecycle, DSL-first scrolling/measurement, current structural revision,
and result-only/shared-dispatch modes. Open dirty drafts become stale on relevant publication; Reload or
Cancel is always available and an application merge policy is explicit (AR-D06/D07).

## Deletion policy

| State | Standard result |
|---|---|
| Empty and deletable | Localized destructive confirmation, then one delete proposal |
| Non-empty, no policy | Disabled with authoritative count/reason; zero requests |
| Non-empty, reassign | Require valid destination; one atomic delete+reassign proposal |
| Non-empty, archive | Require configured archive destination; one atomic proposal |
| Non-empty, custom | Application builder produces one validated atomic extension/standard proposal |
| Count unknown | Fail closed until authoritative policy/count is available |

No standard builder creates card cascade deletion or partial bulk reassignment. Direct programmatic
builders do not show confirmation; the caller owns its UX. Hiding/collapse/width/grouping/presentation
are RD-09 view transitions, not structural requests.

## Focus and access

Dialogs are invocable functions used by commands, menus, status/palette routes, or application UI.
Headers expose context/action routes without permanent gear buttons. After authoritative deletion,
focus resolves to next survivor, previous survivor, or board in that order; no hidden/unmounted focus.

## Target modules

`src/configuration/types.ts`, `validation.ts`, `builders.ts`, `deletion.ts`, `session.ts`,
`column-dialog.ts`, `swimlane-dialog.ts`, `delete-dialog.ts`, and action integration.

## Testing requirements

ST-DC-01…DC-17 cover pure builders, cancel, rename identity, duplicate names, view-only versus
structure operations, confirmation, non-empty/unknown deletion, atomic reassignment/archive/custom,
no cascade, derived-group capability, stale/rejected drafts, post-delete focus, responsive geometry,
context routes, keyboard/button/pointer reorder parity, and hostile text.
