# Requirements: Guide Course System

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-08](../../requirements/RD-08-reference-trust.md) — the owning requirements document

## Scope of this plan (delta view)

### In this plan

- RD-08 Guide course system: complete the 29 Guide routes governed by
  `guide-course-template1`.
- RD-08 Guide Curriculum: deliver all seven planned additions and upgrade all existing
  non-complete routes.
- RD-08 acceptance criterion 1, Guide clause: maintain exactly 31 catalog entries, project only
  real pages into navigation, and avoid specialist-course duplication.
- Re-audit the completed Layout and Reactive state pilots against the final shared directive.
- Validate that the Data Grid and Code Editor specialist hubs satisfy their catalog role through
  correct prerequisite, curriculum, and next-step cross-links.

### Deferred / out of this plan

- RD-08 Architecture, Best Practices hub, FAQ, standalone Accessibility, standalone Security,
  Performance, compatibility matrix, theme gallery/designer/reference, versioning, changelog,
  roadmap content, migration notes, and contributing pages. These are Reference/trust deliverables,
  not Guide routes (AR-1, AR-8).
- Changes to the specialist Data Grid or Code Editor course content beyond broken Guide-boundary
  links. Their full content remains governed by RD-05 (AR-3).
- Generated API content, screenshot generation, `llms.txt`, and the editable playground, which
  remain owned by RD-06, RD-09, and Phase E respectively.
- External publication, GitHub issue mutation, commits, and deployment.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Course delivery unit | One independently verified phase per Guide route | AR-10 |
| Specialist validation | One cross-link and ownership phase after all Guide routes | AR-3, AR-10 |
| Final validation | One curriculum-wide integration phase ending in `yarn verify` | AR-4, AR-9, AR-10 |

## Acceptance Criteria

1. All 29 `/guide/` routes have their profile-appropriate teaching content and satisfy every
   catalog learning outcome.
2. All seven planned routes become real pages before entering navigation.
3. Layout and Reactive state pass a fresh audit against the final directive.
4. Data Grid and Code Editor remain single-source specialist courses and are reachable from the
   curriculum without duplicated chapters.
5. Every required live laboratory or approved authentic substitute has specification and
   implementation evidence.
6. Catalog, curriculum map, sidebar, pages, examples, and tests agree.
7. Focused checks, documentation build, and `yarn verify` pass before the catalog is wholly
   complete.
