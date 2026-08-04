# Cards and Styling: Kanban Phase B Core Board

> **Document**: 03-02-cards-styling.md
> **Parent**: [Index](00-index.md)

## Overview

This specification owns the standard Phase B descriptor pipeline. It converts a validated adapter
snapshot, resolved presentation budget, interaction/workflow state, theme, capabilities, and formatting
context into bounded rows/regions. It never mutates the card or opens a host resource
(PAR-B04/PAR-B17).

## Snapshot before layout

`snapshotKanbanCardPresentation` invokes each configured getter at most once per card presentation
revision and creates a detached immutable snapshot containing mandatory title/status, optional ordered
fields, labels, summaries, checklist groups, card selection, and semantic style selection. Stable IDs
are validated before values; display values are sanitized before measurement. Throwing optional
getters become section-local fallback/omission with one payload-free observation. Failure of mandatory
identity/title/status uses the existing bounded card fallback (PAR-B16).

The viewport accepts an optional `KanbanCardRenderer<TCard>` and renderer revision. The standard
renderer is only the default; custom output always passes `validateKanbanCardDescriptor`. The internal
`KanbanDescriptorCacheKey` retains its Phase A members and adds
`presentationPolicyRevision: KanbanRevision`,
`presentationSelectionFingerprint: string`, and optional `styleRevision: KanbanRevision`. Renderer,
card-presentation, policy, selection, and style revisions participate in deterministic cache equality;
reactive dependency tracking remains complementary rather than replacing those inputs
(PAR-B15/PAR-B20/PAR-B31).

## Standard section composition

The standard renderer composes sections in the RD-04 order and assigns stable section IDs:

1. combined non-color marker plus title;
2. status with configured type/priority subset;
3. ordered metadata and label rows;
4. ordered bounded summaries;
5. checklist progress or preview;
6. compact pending/invalid/rejected feedback.

Mandatory title, status, focus/selection, and active feedback are never removed. Optional sections are
selected within the resolved view maxima, then degraded in the policy order. The renderer records every
omitted semantic kind exactly once in `degradation.omittedSections` (PAR-B09).

Card spacing remains scene geometry, not descriptor height. The DSL mandate is expressed through pure
section relationships and common cell-measurement helpers; the viewport flattens the result into the
existing descriptor rows because one live view per card is prohibited (PAR-B05/PAR-B19).

## Metadata, labels, dates, and summaries

- Fields retain source order after policy selection, then use priority only for degradation.
- Labels wrap only within the configured row budget; otherwise they ellipsize and report omission.
- Empty optional values add no rows.
- Dates pass unchanged to the injected formatter. No timezone conversion or locale loading occurs.
- Non-checklist summaries render one bounded label/value/count row per selected section. Child labels
  are never enumerated by the standard renderer.
- All clipping uses terminal display cells, removes control/bidi text, preserves combining sequences as
  supported by Core, and never splits a wide glyph (PAR-B16/PAR-B17).

## Checklist rendering

`KanbanChecklistGroup` and `KanbanChecklistItem` use bounded stable IDs and source order. Duplicate
group/item IDs reject the affected checklist snapshot. The modes are:

| Mode | Standard output |
|---|---|
| `hidden` | No checklist rows or empty frame |
| `progress` | Completed/total evidence and semantic progress cue |
| `preview` | Progress plus at most the resolved item limit, default two, across configured groups |

Preview includes completed and incomplete items in source order, optional group title only when budget
permits, and `+N` omitted evidence. At narrow/compact geometry it degrades to progress, then hidden,
before mandatory rows clip. Long item text ellipsizes by display cells. Preview regions are read-only
and map activation to the standard editor semantic intent; they never toggle completion
(PAR-B09/PAR-B11).

Publication with unchanged group/item IDs reuses semantic identity even if completion/text/order
changes. No card-local draft exists in Phase B.

## Reactive styles and cue precedence

`styleOf` selects allowlisted semantic roles for title, status, optional text, surface, border/marker,
and optional glyph family. `textRole` is the fallback for optional field, label, summary, and checklist
text while built-in section roles remain defaults. It cannot return raw colors or escape sequences. Its
revision and every visible reactive read participate in card-local invalidation (PAR-B15/PAR-B17).

Each retained descriptor-cache entry owns one bounded reactive computation that observes adapter,
selection, style, renderer, and formatting dependencies. A dependency change rebuilds and validates
only that frozen descriptor, reports local fallback safely, and invalidates its exact damage region.
Re-entrant invalidation is coalesced by descriptor generation; stale work cannot publish. The
computation is disposed before its cursor/retention owner. The central `retainedDescriptors` limit
defines cache and computation capacity and caps projection before descriptor creation, so reactive work
never follows logical card count. If visible plus overscan demand exceeds the resolved limit, source-
ordered projection emits an honest partial/limit state for omitted demand, removes stale hit regions,
and never throws or leaves a blank actionable card. Explicit presentation/renderer/card revisions remain
cache equality inputs but are not a substitute for dependency tracking.

Production cache maps, reactive owners, and canonical keys remain private. The testing-only package
subpath exposes the real cache through the complete semantic key, narrow invalidation selector, and a
counter-only harness:

```ts
export interface KanbanDescriptorCacheKey {
  readonly generation: number;
  readonly address: KanbanCellAddress;
  readonly cursorRevision: KanbanRevision;
  readonly cardKey: CardKey;
  readonly rendererRevision: KanbanRevision;
  readonly presentationRevision?: KanbanRevision;
  readonly presentationPolicyRevision: KanbanRevision;
  readonly presentationSelectionFingerprint: string;
  readonly styleRevision?: KanbanRevision;
  readonly width: number;
  readonly rowBudget: number;
  readonly density: KanbanCardDensity;
  readonly themeRevision: KanbanRevision;
  readonly capabilityRevision: KanbanRevision;
  readonly interactionRevision: KanbanRevision;
}

export interface KanbanDescriptorInvalidation {
  readonly generation?: number;
  readonly address?: KanbanCellAddress;
  readonly cardKey?: CardKey;
  readonly rendererRevision?: KanbanRevision;
  readonly presentationPolicyRevision?: KanbanRevision;
  readonly presentationSelectionFingerprint?: string;
  readonly styleRevision?: KanbanRevision;
  readonly themeRevision?: KanbanRevision;
  readonly capabilityRevision?: KanbanRevision;
  readonly interactionRevision?: KanbanRevision;
}

export interface KanbanDescriptorCacheTestSnapshot {
  readonly retained: number;
  readonly created: number;
  readonly rebuilt: number;
  readonly disposed: number;
  readonly invalidations: number;
  readonly activeComputations: number;
}

export interface KanbanDescriptorCacheTestHarness {
  readonly getOrCreate: (
    key: KanbanDescriptorCacheKey,
    factory: () => KanbanCardDescriptor,
  ) => KanbanCardDescriptor;
  readonly retain: (keys: readonly KanbanDescriptorCacheKey[]) => void;
  readonly invalidate: (selector?: KanbanDescriptorInvalidation) => number;
  readonly snapshot: () => KanbanDescriptorCacheTestSnapshot;
  readonly dispose: () => void;
}

export function createKanbanDescriptorCacheTestHarness(options: {
  readonly maximumEntries: number;
  readonly onDescriptorInvalidated?: (key: Readonly<KanbanDescriptorCacheKey>) => void;
}): KanbanDescriptorCacheTestHarness;
```

Inspection snapshots and callback keys are detached/frozen and contain no record payload. The harness
must prove one-card rebuild, unchanged neighbor descriptor identity, exact invalidation, and computation
disposal on retain, eviction, and harness disposal. It exposes no flush operation unless the actual UI
scheduler later proves synchronous observation impossible (PAR-B31).

The non-color precedence is deterministic:

1. invalid/rejected;
2. pending/grabbed;
3. focused+selected;
4. focused;
5. selected/range anchor;
6. read-only;
7. ordinary status marker.

Compatible cues remain listed in descriptor metadata even when one visible marker represents the
highest priority. Monochrome, `NO_COLOR`, and ASCII profiles preserve distinct marker/glyph/attribute or
text-prefix evidence. Phase B activates only focus, selection, range anchor, read-only, navigation
pending, and workflow-invalid cues; later operation states may be rendered by deterministic fixtures
without claiming their producers (PAR-B01/PAR-B22).

## Degradation algorithm

`composeStandardKanbanCard` first builds candidate semantic sections, then repeatedly removes the
lowest-retention optional section until total rows fit. Checklist preview items reduce one at a time,
then preview becomes progress, before the checklist disappears. Metadata and summaries remove by
priority/source-order tie break. A final mandatory projection always fits the validated minimum width;
otherwise the existing safe fallback is used. The algorithm is pure, deterministic, and independent of
viewport scroll position (PAR-B09/PAR-B16).

## Action regions

The whole card is a card target; descriptor action regions take precedence within it. Checklist
preview uses one section region linked to the standard open-editor action identity. Region/action IDs
remain bounded/non-overlapping and are converted to viewport targets only after clipping. No card gap,
separator, or swimlane divider becomes an insertion target in Phase B (PAR-B08/PAR-B18).

## Testing requirements

- Widths 18–32, all preset/custom budgets, mandatory-row invariants, and deterministic degradation.
- Hidden/progress/preview checklist modes, multiple groups, empty groups, omitted counts, long wide text,
  stable identities, and activation-without-toggle.
- Summary non-enumeration with 100 child labels; date input immutability; field/style/formatter failure.
- Reactive card-local style/content invalidation and unchanged neighboring descriptor identity.
- Truecolor/256/16/mono/`NO_COLOR`/ASCII semantic cue coverage without relying on raw ANSI snapshots.
