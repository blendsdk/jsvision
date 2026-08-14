# Requirements: Kanban Phase D Productivity and Editing

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Sources**: [RD-09](../../requirements/RD-09-search-filters-saved-views.md), [RD-10](../../requirements/RD-10-card-schema-editor-dialogs.md), [RD-11](../../requirements/RD-11-board-configuration-dialogs.md), [RD-12](../../requirements/RD-12-commands-events-capabilities.md)

## Scope of this plan (delta view)

### In this plan

- Complete RD-09: semantic view pipeline, search/filter/sort/grouping/personalization, honest counts,
  saved-view v1 capture/parse/migrate/reconcile/apply, and optional standard view UI.
- Complete RD-10: Zod-free generic editor schema, standard mainstream schema/adapter, isolated draft
  lifecycle, responsive create/view/edit dialogs, custom replacement, and inspector seam.
- Complete RD-11: programmatic column/swimlane request builders, package configuration dialogs,
  validation, reorder, hide/collapse personalization, and explicit non-empty deletion policies.
- Complete RD-12: action IDs, keymap validation, one routing path, capabilities/read-only mode,
  normalized events, status/help feedback, and application-owned undo/redo integration.
- Keep public JSDoc, locale overlays, package README, architecture docs, generated plugin references,
  GitHub showcase behavior, and the permanent Kanban kitchen sink aligned with shipped behavior
  without claiming RD-15 completion (AR-D02).

### Deferred / out of this plan

- RD-13 complete locale/theme/accessibility audit and final cross-theme translated geometry matrix.
- RD-14 final scale/security/resilience certification and controlled benchmark publication.
- RD-15 component course, full live-lab set, distribution/release proof, and final Reddit showcase.
- Component-owned persistence, authorization, shared-view access control, record history stacks,
  nested grouping, inline card editing, rich-text/comments/attachments, and global app palette.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Phase boundary | Implement all four roadmap RDs in dependency order | AR-D01 |
| Internal topology | Dedicated concern modules composed by the board | AR-D03–D11 |
| Dependency shape | Generic editor types remain Zod-free; standard adapter uses Forms and Zod peer | AR-D05 |
| Responsive UI | DSL-first, scrollable, measured, narrow-safe dialogs/chrome | AR-D07 |
| Public topology | Main barrel and existing locale/testing subpaths only | AR-D14 |
| Verification | Changed-file gate plus focused workspace checks, comprehensive phase closure | AR-D15–D16 |
| Query availability | Candidate session must publish valid state before replacing the usable session | AR-D17 |
| Search publication | Immediate chrome draft; atomic committed state/query/revision after debounce | AR-D18 |
| Host input | Core Primary/Meta and Web DOM pointer/dedupe prerequisite before Kanban routing | AR-D20 |
| Record ownership | Editors resolve authoritative record/revision through an application adapter | AR-D21 |
| Performance | Deterministic work bounds plus controlled 16 ms median evidence | AR-D24 |

## Plan-local acceptance criteria

1. [ ] Every RD-09–RD-12 acceptance criterion maps to at least one concrete ST case.
2. [ ] Existing construction using a query getter remains source-compatible and behaviorally unchanged
   when no Phase D controller/chrome/editor/action options are supplied.
3. [ ] Every mutation producer reaches the existing request coordinator; no dialog, command, event,
   or history path mutates application records directly.
4. [ ] New public APIs are documented, bounded, exported through supported entry points, and reflected
   in plugin/API generation.
5. [ ] Phase D examples typecheck, smoke-import, and remain responsive at 80×24, focused-column geometry, resize,
   maximize/restore, multiple themes, keyboard-only operation, and mouse operation.
6. [ ] The execution verification matrix in 03-07 passes; CI remains authoritative for full
   repository `yarn verify`.
