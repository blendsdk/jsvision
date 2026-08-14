# Saved Views: Phase D

> **Document**: 03-02-saved-views.md
> **Parent**: [Index](00-index.md)

## Overview

Saved views are application-stored, package-defined semantic JSON. Parsing, migration,
reconciliation, and application are separate pure stages so hostile or incompatible input cannot
partially change the live board (AR-D04/D13).

## Version-1 envelope

```ts
export interface KanbanSavedViewV1 {
  readonly kind: 'jsvision-kanban-view';
  readonly version: 1;
  readonly name?: string;
  readonly view: KanbanDurableViewStateV1;
  readonly extensions?: Readonly<Record<KanbanExtensionId, KanbanSemanticValue>>;
}
```

Durable state includes ordered/visible/collapsed columns and swimlanes, bounded width overrides,
grouping, registered filters and quick filters, sort, density, card presentation, and package display
options. Raw search text is excluded unless the controller's explicit durable search policy permits it.
Focus, selection, hover, scroll, pending operations, editor drafts, functions, cache pages, placement
tokens, and runtime capabilities are forbidden.

Every durable reference has an effective missing policy after parse. The serialized `onMissing` member
is optional and defaults by exact category:

| Reference category | Omitted default |
|---|---|
| Missing current filter, sort, or grouping field/group | `drop` whole dependent directive plus diagnostic; preserve raw |
| Missing operator, quick-filter implementation, comparator, or custom renderer | `reject`; only schema-declared optional reference may explicitly `drop` |
| Column/swimlane order, visibility, collapse, width, and alignment identity | `drop` plus diagnostic; preserve raw |
| Ordered card field, summary field, checklist presentation field/group identity | `drop` plus diagnostic; preserve raw |
| Built-in density, grouping variant, checklist mode, presentation, or required package display option | Unknown discriminator/key rejects during exact parse |
| Schema-declared optional package display option | Drop from resolved state plus diagnostic; preserve raw |
| Optional namespaced extension | Preserve inertly; package never resolves or executes it |

An explicit policy may select `drop` only for schema-declared optional references; active executable
semantics cannot weaken their default. New current structures append by current default/order.

## Processing stages

1. `parseKanbanSavedView` parses unknown JSON/text into an exact bounded detached envelope.
2. `migrateKanbanSavedView` applies every version step exactly once to a detached copy. Package steps
   run in order, followed by bounded application adapters at the documented seam.
3. `reconcileKanbanSavedView` resolves stable IDs against current registries/data/capabilities, returns
   a complete `{ raw, resolved, provenance }` artifact plus sanitized diagnostics, and preserves safe
   optional unknown extension JSON.
4. `applyKanbanSavedView` performs one controller replacement only after all prior stages succeed.
5. `captureKanbanSavedView` snapshots durable state plus raw provenance per stable facet identity.
   Reconciled width provenance remains raw through ordinary view edits, including width adjustment,
   until explicit resave writes current resolved values. Canonical serialization
   uses one shared Unicode code-point comparator, preserves arrays, defines lone-surrogate ordering, and
   reuses semantic finite-number/string encoding.

Unknown top-level fields, executable-like values, missing required semantics, or newer versions reject.
Missing references follow their encoded policy; no category is implicitly both optional and required.
New current columns append in deterministic current order/default state. Runtime width clamps never
rewrite retained raw width until the user explicitly resaves.
The same envelope plus registries/data/capabilities yields equal resolved state.

## Store integration

Capture/apply remain pure/local. Save, rename, and delete use existing saved-view request variants and
the board authority. Package dialogs may collect a view name and invoke those proposals; applications
own IDs, storage, sharing, authorization, lists, and access errors (AR-D08). Delete retains the board's
destructive-confirmation policy; neither the pure store helper nor its request proposal is evidence that
the user already confirmed the operation.

## Limits and security

Add classified limits for encoded bytes, depth, keys, arrays, migrations, diagnostics, registered IDs,
and extensions. Validation inspects descriptors without invoking accessors, rejects unsafe keys and
non-plain prototypes, never evaluates paths/regex/code, and redacts sensitive filter values. Canonical
fingerprints accelerate lookup but never replace semantic equality (AR-D13).

## Failure handling

| Failure | Result | Live state |
|---|---|---|
| Malformed/oversized/unknown top-level input | `invalid-view` diagnostic | Unchanged |
| Unknown newer version | `unsupported-version` with supported range | Unchanged |
| Migration throws/returns invalid shape | `migration-failed` without raw error | Unchanged |
| Missing optional current IDs | Resolved state plus bounded diagnostics | Applied only on explicit apply |
| Unknown required registry ID | Reconciliation failure | Unchanged |
| Application store request rejects | Dialog retains draft/name and feedback | View state unchanged |

## Target modules

`src/view/saved-view-types.ts`, `saved-view-codec.ts`, `saved-view-migration.ts`,
`saved-view-reconcile.ts`, `saved-view-store.ts`, and focused testing fixtures/fuzz seeds.

## Testing requirements

ST-DS-01…DS-20 cover capture exclusions, canonical semantic equality, hostile bounds, versions,
sequential migration, input immutability, missing/new IDs, width clamp/raw retention, sensitive
redaction, remote typed queries, idempotence, extension round-trip, atomic failure, and store requests.
