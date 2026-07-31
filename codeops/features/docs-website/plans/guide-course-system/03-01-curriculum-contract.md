# Curriculum Contract: Guide Course System

> **Document**: 03-01-curriculum-contract.md
> **Parent**: [Index](00-index.md)

## Overview

`packages/docs-site/guides.json` is the curriculum source of truth. It records both published and
planned learning units so curriculum design is visible before placeholder pages exist. VitePress
navigation is a projection of validated, non-planned entries rather than an independently edited
list (AR-4, AR-7).

## Catalog Invariants

Each entry owns:

- a stable ID, learner-facing title, group, route, profile, stage, and within-group order;
- prerequisite IDs that must exist and form an acyclic graph;
- at least two observable learning outcomes;
- a non-negative live-example target;
- an explicit exception when a full course intentionally has no embedded terminal lab; and
- registry IDs for the examples that prove a completed course.

IDs and routes are unique. Sidebar positions are unique within a group. A `planned` entry is shown
in the learner-facing map but excluded from the sidebar. An `upgrade` or `complete` entry must
resolve to a real Markdown route. A `complete` entry must meet or exceed its lab target, and every
declared ID must exist in the example registry (AR-4, AR-7).

## Profiles

| Profile | Purpose | Required depth |
|---|---|---|
| `orientation` | Establish context or setup and move the reader to the next productive course | Audience, task flow, accurate snippets/artifacts, failure guidance, next steps |
| `integration` | Teach a host/tool boundary that partly lives outside the browser terminal | Task workflow, authorization/setup boundary, diagnostic evidence, next steps |
| `course` | Teach a framework concept or application workflow from beginner to production judgment | Full backbone, required labs or approved substitute, failures, practice |
| `specialist` | Point into an authoritative multi-page component curriculum | Accurate prerequisites, learning outcomes, route, and Guide cross-links; no duplicated chapters |

Profiles change appropriate depth, not correctness or evidence requirements (AR-5).

## Stage Transitions

```text
planned ── real route + evidence ──> complete
upgrade ── contract + evidence ───> complete
complete ── source change/gap ─────> upgrade
```

There is no placeholder stage. Promotion to `complete` happens in the same verified course phase
that supplies the page, examples or authentic substitutes, outcome specifications, focused
implementation tests, resolved links, and required catalog metadata. A source change that makes a
claim stale returns the entry to `upgrade`.

## Ownership Boundaries

- Guide courses own framework mental models, cross-cutting workflows, failure diagnosis, and
  production action.
- Component pages own widget construction and everyday component behavior.
- Data Grid and Code Editor component hubs are the specialist course implementations.
- Generated API pages own exhaustive symbol signatures.
- Reference/trust pages own architecture, benchmark, compatibility, security-posture, and policy
  evidence.

A Guide may summarize only the context needed to use another surface and must link to the owner
(AR-1, AR-3).

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Unknown or cyclic prerequisite | Reject catalog validation with the offending course ID/path | AR-4 |
| Duplicate ID, route, or sidebar position | Reject catalog validation before VitePress config loads | AR-4 |
| Planned entry appears in navigation | Fail curriculum specification coverage | AR-7 |
| Non-planned route is missing | Fail curriculum specification coverage | AR-7 |
| Complete entry lacks labs/evidence | Reject completion and keep the prior stage | AR-4 |
| Specialist route points into `/guide/` | Fail the specialist-boundary specification | AR-3 |

## Testing Requirements

- Parser specifications for valid catalog projection and every invalid invariant.
- Integration coverage against the real VitePress sidebar, Markdown routes, curriculum map, and
  registry.
- Acyclic prerequisite traversal and stable topological execution order.
- Stage-completion assertions for every Guide phase.
