# Current State: Guide Course System

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists

The docs site now has a validated 31-entry curriculum catalog and projects the visible Guide
sidebar from that source. The learner-facing index shows complete, upgrade, and planned stages.
The repository-level Guide directive defines the course backbone, snippet contract, template1 lab
contract, documentation boundaries, and completion gate.

Two full-course pilots are complete: Layout and Reactive state. Each has two registered Guide labs
and separate specification and implementation coverage. Twenty Guide routes exist at `upgrade`
stage; fifteen of those pages are still 13-line placeholders, while Introduction, Install &
packages, Codex plugin, Keyboard & clipboard, and Internationalization contain more substantial
material but do not yet satisfy the final course contract. Seven planned routes have catalog
entries but intentionally have no placeholder page (AR-2, AR-7).

### Inventory

| Stage/profile | Count | Current treatment | Required change |
|---|---:|---|---|
| Complete Guide pilots | 2 | Layout and Reactive state, four labs total | Re-audit against the final directive |
| Upgrade Guide routes | 20 | Existing pages; fifteen are placeholders | Replace or upgrade into profile-complete courses |
| Planned Guide routes | 7 | Catalog and curriculum map only | Add real pages, labs/evidence, tests, then navigation |
| Complete specialist hubs | 2 | Data Grid and Code Editor component hubs | Validate cross-links and prevent duplicated Guide pages |

### Relevant files

| File | Purpose | Changes needed |
|---|---|---|
| `AGENTS.md` | Non-negotiable Guide course directive | Treat as governing contract; amend only for proven omissions |
| `packages/docs-site/guides.json` | Curriculum, dependencies, stages, outcomes, lab targets | Add real example IDs and promote stages atomically |
| `packages/docs-site/src/guides/guide-catalog.mjs` | Catalog validation and navigation projection | Harden graph and completion validation where integration tests expose gaps |
| `packages/docs-site/guide/index.md` | Learner-facing learning path | Keep stage and route presentation synchronized |
| `packages/docs-site/guide/*.md` | Twenty-two existing Guide routes | Re-audit two; upgrade twenty |
| `packages/docs-site/examples/guides/*.ts` | Four existing Guide laboratories | Add focused labs for course outcomes |
| `packages/docs-site/src/example-registry/guides.ts` | Guide example registry family | Register every new lab as `kind: 'app'` |
| `packages/docs-site/test/guide-catalog.spec.test.ts` | Curriculum-level contract | Extend for cycles, stages, routes, and cross-links |
| `packages/docs-site/test/*-guide.*.test.ts` | Per-course evidence | Add one specification and one implementation file per route |

## Gaps Identified

### Gap 1: Most Guide routes are not courses

**Current behavior:** Fifteen routes contain only a title, description, a short paragraph, and
links.
**Required behavior:** Every route teaches its outcomes using the profile-appropriate course
contract.
**Fix required:** Replace placeholders and rework partial pages in prerequisite order (AR-5,
AR-10).

### Gap 2: Seven cross-cutting subjects have no route

**Current behavior:** They appear as Planned in the curriculum and stay out of navigation.
**Required behavior:** Each becomes a real, verified page before its stage changes.
**Fix required:** Create the page, source-backed lessons, labs, registry entries, and focused
tests atomically (AR-2, AR-7).

### Gap 3: Course evidence is not yet systematic

**Current behavior:** Layout and Reactive state have strong focused tests, while other routes
largely reuse unrelated application demos or have no outcome assertions.
**Required behavior:** Every learning outcome and lab objective has specification evidence.
**Fix required:** Apply the shared specification/implementation test split and the lab harness to
each route (AR-4, AR-9).

### Gap 4: Cross-course coherence is unverified

**Current behavior:** Catalog prerequisites are checked for unknown IDs but not yet verified as
one acyclic, fully linked learner path.
**Required behavior:** Prerequisite order, next-step links, stages, navigation, and specialist
boundaries agree across the curriculum.
**Fix required:** Add curriculum integration assertions and run the final full gate.

## Dependencies

### Internal dependencies

- RD-03 live-example runtime, registry, and `PlayExample`.
- RD-05 component pages and specialist Data Grid/Code Editor hubs.
- RD-06 generated API reference for next-step links.
- `@jsvision/web` browser runtime and `Template1Dialog`.
- Public JSVision package exports, tests, themes, host seams, and agent-neutral skill references.

### External dependencies

- VitePress and xterm.js as already integrated by the docs-site package.
- Node 22+, Yarn 1 workspaces, and Turborepo.

## Domain Lenses

The **web application** lens applies because every laboratory is rendered through the browser docs
runtime and must respect browser capability and authorization boundaries. Universal CodeOps
categories cover content scope, lifecycle, failures, security, accessibility, and verification.
No financial, compiler, distributed, or durable data-migration behavior is introduced by this plan.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Course prose invents API behavior | Medium | High | Source/test audit before authoring; snippets and claims checked by focused specifications |
| Labs become decorative or duplicate component demos | Medium | High | One explicit objective per lab; specialist ownership checks |
| 80×24 clipping or inaccessible actions | Medium | High | Shared lab harness, keyboard evidence, resize/maximize/restore tests |
| Catalog stage advances before evidence exists | Medium | High | Stage and example completeness validation; atomic phase task |
| Repetition across 29 pages | High | Medium | Prerequisite links, boundary review, curriculum integration phase |
| Full verification cost hides local defects | Medium | Medium | Focused phase checks plus one authoritative final `yarn verify` |
