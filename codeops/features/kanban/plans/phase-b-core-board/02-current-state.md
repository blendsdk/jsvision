# Current State: Kanban Phase B Core Board

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists

Phase A publishes a verified `@jsvision/kanban` package with generic/eager/windowed data contracts,
application-authority seams, a DSL-composed `KanbanBoard`, one virtualized `KanbanViewport`, bounded
descriptor validation/caching, basic title/status cards, ordered workflow columns, responsive widths,
two-axis scrolling, ten locale entry points, semantic theme roles, and package/API/plugin integration.

The foundation already reserves swimlane cell addresses, header metadata, descriptor sections/actions,
interaction cues, selected/focused identity hints, honest count qualities, and application request
authority. Phase B should extend these seams rather than introduce parallel models (PAR-B05/PAR-B20).

### Relevant files

| File | Current purpose | Phase B change |
|---|---|---|
| `src/card/descriptor.ts` | Bounded renderer-neutral rows, sections, actions, regions, cues | Add resolved presentation budgets and Phase B state/section validation |
| `src/card/standard-renderer.ts` | Two-row title/status renderer | Compose metadata, labels, summaries, checklist, feedback, and degradation |
| `src/card/adapter.ts`, `standard-card.ts` | Basic card snapshots and optional standard shape | Add bounded typed fields/checklists/summaries/style revisions |
| `src/source/types.ts` | Columns, swimlanes, cells, counts, headers, cursors | Add validated workflow/group presentation and policy metadata without mutation authority |
| `src/board/viewport-source.ts` | Retains visible/overscan column-only cells | Retain normalized visible 2-D cells and preserve collapsed chrome |
| `src/board/viewport-projector.ts` | Hard-coded standard renderer and ungrouped column projection | Build canonical scene, choose renderer/policy, and emit actionable non-drag targets |
| `src/layout/vertical-projector.ts` | Fixed-density card stacking and gaps | Consume sparse variable-height anchors and one-row insertion-space reservation only later |
| `src/board/kanban-viewport.ts` | Wheel input, scroll/reveal/anchors, rendering lifecycle | Delegate Phase B interaction, async navigation, hit testing, and sparse-height correction |
| `src/board/board-bindings.ts` | Detached identity signal and deletion pruning | Integrate the stable interaction facade, default/factory controller, and seed-only legacy identity |
| `src/board/kanban-board.ts` | DSL shell, navigator, raw request seam | Expose durable interaction state/transitions and handler without later mutation UI |
| `src/layout/hit-map.ts` | Inspection regions and retry-only action targets | Add bounded closed-scope card/header/state actions while retaining source-owned retry; no insertion/drag targets |
| `src/card/theme*.ts`, `src/i18n/**` | Durable roles and Phase A vocabulary | Activate/add Phase B-owned roles and reviewed translations |

## Gaps Identified

### Gap 1: Rich descriptors are declared but not produced

The public descriptor already admits metadata, labels, summaries, checklist sections, actions, and
degradation, but the standard renderer always emits only title/status and empty action/region arrays.
Phase B must normalize presentation policy once and produce bounded sections through the existing
validator (03-01/03-02; PAR-B09).

### Gap 2: Source semantics are 2-D but viewport acquisition is 1-D

The source contract already exposes ordered swimlanes and `{columnId, swimlaneId?}` cells, while the
viewport currently retains and projects only ungrouped `{columnId}` cells. A canonical 2-D scene must
separate semantic membership/visibility/collapse from presentation geometry (03-03/03-04;
PAR-B07/PAR-B27).

### Gap 3: Fixed stride contradicts variable-height descriptors

Acquisition, content origins, extent estimates, reveal, and anchor restoration currently assume two
rows for compact cards and three otherwise. Valid descriptors may be substantially taller. Phase B
must introduce the sparse height/anchor index before adding variable-height card content or spatial
navigation (03-04; PAR-B26).

### Gap 4: Identity hints are not a complete interaction model

`KanbanBoardBindings` detaches an application getter into a signal and prunes authoritative deletion,
but it has no range anchor, preferred row, pending acquisition, view-hide pruning, ordered immutable
selection snapshot, or atomic transition API. A single-owner controller replaces competing live writes
while preserving construction compatibility (03-05; PAR-B06/PAR-B29).

### Gap 5: Input and hit targets are intentionally inert

The viewport handles wheel events only; action targets are empty and the public target union contains
only retry. Phase B activates card/header/swimlane/action hit targets plus keyboard/click selection and
semantic activation, while leaving capture, insertion, ghost, and drag targets absent (03-06;
PAR-B08/PAR-B18).

### Gap 6: Workflow chrome lacks policy semantics

Column/swimlane metadata currently provides identity, label, counts, and summaries but not normalized
visibility/collapse, WIP policy, DoD, transitions, presentation variants, disambiguation, or derived
group failure isolation. Pure validated models and evaluators must precede rendering (03-03; PAR-B12).

## Dependencies

### Internal dependencies

- Public Core text width, capabilities, safe rendering, key and pointer events.
- UI reactivity, ownership, event routing, focus, DSL layout, and deterministic render/event harnesses.
- I18n typed catalogs, number/date formatting, generation, review, and locale subpaths.
- Phase A Kanban source/session/cursor, authority, validation, limits, renderer, viewport, and testing
  seams.

### External dependencies

None. Phase B stays on the current Core/I18n/UI runtime graph; Forms and Zod remain RD-10-owned
(PAR-B21).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Variable heights cause scroll/reveal drift | High without correction | High | Implement SPEC-B-HEIGHT-INDEX before rich mounted rendering |
| Variant-specific pipelines diverge semantically | Medium | High | Canonical scene plus thin geometry strategies |
| Two interaction owners overwrite state | Medium | High | One board facade over one owned default/factory controller |
| Public action hook becomes temporary debt | Medium | High | Final-shaped semantic intent reused by later phases |
| Rich callbacks leak payload/control text | Medium | High | Central snapshots, bounds, sanitization, local fallback, payload-free observations |
| Swimlane cells multiply cursor work | Medium | High | Occupied-only eager index plus optional aggregate windowed row hints; never allocate the theoretical matrix |
| Phase boundary is overstated | Medium | High | Slice-specific tests and criterion-honest roadmap/traceability |
| Existing viewport reaches the file-size ceiling | High | Medium | Extract controllers/projectors; do not extend the 696-line view monolithically |
