# Guide Course System Implementation Plan

> **Feature**: Complete the docs-site Guide curriculum as beginner-to-production courses
> **Status**: Planning Complete
> **Created**: 2026-07-29
> **Implements**: docs-website/RD-08
> **CodeOps Artifact Schema**: 1

## Overview

This plan completes the Guide-specific slice of RD-08. It turns the confirmed 31-entry curriculum
into 29 authored Guide routes, with Data Grid and Code Editor remaining authoritative specialist
courses under Components. Every Guide route is completed as an independently reviewable teaching
phase, ordered by the prerequisite graph recorded in `packages/docs-site/guides.json`.

The course system teaches framework mental models and complete workflows rather than reproducing
component or API pages. Each phase audits public source and tests, writes specification evidence
before implementation, builds concept-focused snippets and authentic live laboratories, verifies
the page at the standard browser terminal viewport, and updates the catalog stage only after its
completion gate passes. The final phases verify specialist cross-links and the curriculum as one
coherent learning path (AR-1, AR-3, AR-4, AR-10).

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Ten confirmed scope, structure, and execution decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | RD-08 Guide-slice delta |
| 02 | [Current State](02-current-state.md) | Existing courses, placeholders, examples, and gaps |
| 03-01 | [Curriculum Contract](03-01-curriculum-contract.md) | Catalog, profiles, stages, prerequisites, and boundaries |
| 03-02 | [Course Authoring](03-02-course-authoring.md) | Source audit, teaching structure, snippets, and artifacts |
| 03-03 | [Laboratories and Evidence](03-03-laboratories-and-evidence.md) | Template1 labs, registration, accessibility, and evidence |
| 03-04 | [Curriculum Sequence](03-04-curriculum-sequence.md) | Route-by-route delivery order and objectives |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification cases and verification tiers |
| 99 | [Execution Plan](99-execution-plan.md) | Thirty-one verified phases and task checklist |

## Quick Reference

### Course completion flow

```text
catalog outcome
  → source-backed lesson specification
  → failing specification test
  → page + snippets + laboratories
  → passing specification and implementation tests
  → docs build + catalog stage complete
```

### Key Decisions

| Decision | Outcome |
|---|---|
| Documentation ownership | Guide teaches framework thinking; Components teach widgets; API owns signatures; Reference owns trust evidence (AR-1) |
| Curriculum | All 31 entries are cataloged, including seven newly identified courses (AR-2) |
| Specialist courses | Data Grid and Code Editor remain component hubs and are not duplicated (AR-3) |
| Navigation | Validated `guides.json` metadata projects the Guide sidebar (AR-4, AR-7) |
| Course depth | Orientation, integration, course, and specialist profiles share one quality contract (AR-5) |
| Execution | One verified phase per Guide route, then specialist-boundary and integration phases (AR-10) |

## Related Files

- `AGENTS.md`
- `packages/docs-site/guides.json`
- `packages/docs-site/guide/`
- `packages/docs-site/examples/guides/`
- `packages/docs-site/src/example-fixtures/`
- `packages/docs-site/src/example-registry/guides.ts`
- `packages/docs-site/test/guide-catalog.spec.test.ts`
- `packages/docs-site/test/*-guide.spec.test.ts`
- `packages/docs-site/test/*-guide.impl.test.ts`
- `codeops/features/docs-website/requirements/RD-08-reference-trust.md`
