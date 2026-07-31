# Course Authoring: Guide Course System

> **Document**: 03-02-course-authoring.md
> **Parent**: [Index](00-index.md)

## Overview

Every course is authored from verified public behavior, not from the placeholder it replaces.
Before prose or examples, the phase audits the catalog entry, prerequisites, public exports,
types, defaults, tests, theme roles, host boundaries, existing component/specialist pages, API
reference, and the canonical agent-neutral JSVision skill.

## Course Production Workflow

1. Convert each catalog learning outcome into a learner question and observable evidence.
2. Record the reader's assumed starting knowledge and the useful result they will reach.
3. Map claims to public source/tests and assign ownership links for adjacent subjects.
4. Write specification tests from the catalog and this plan before changing the course.
5. Confirm the new expectations fail, or record why a re-audited pilot already satisfies them.
6. Author the course from mental model through practice and next steps.
7. Build or reuse only laboratories whose interactions directly prove the stated objective.
8. Add implementation/hardening coverage and promote the catalog stage only after focused checks
   pass.

This workflow applies independently to every route (AR-10).

## Page Structure

A full `course` profile uses:

1. frontmatter and search-oriented title;
2. audience, prerequisites, motivating problem, and final capabilities;
3. the smallest accurate mental model;
4. first useful public-API snippet;
5. primary live laboratory;
6. core lessons in dependency order;
7. composition with adjacent JSVision concepts;
8. advanced lifecycle, scaling, customization, authorization, or host behavior;
9. symptom/cause/correction/evidence failure diagnosis;
10. best practices with consequences and decision boundaries; and
11. practice, related courses, specialist hubs, and generated API links.

Orientation and integration profiles may compress sections only when the subject genuinely lives
outside an embedded terminal. Their page must still teach an end-to-end task, show authentic code
or configuration, explain failures, and direct the learner onward (AR-5).

## Snippet Contract

- Import only supported public package entry points.
- Isolate one concept and keep only setup that affects that concept.
- Use source-verified names, types, defaults, return values, ownership, async flow, and cleanup.
- Place each snippet beside its lesson; never copy a live-example module into Markdown.
- Clearly label intentionally broken snippets and immediately show the correction.
- Explain invariants, failure boundaries, authorization, or cleanup rather than narrating syntax.
- Compile snippets where practical; otherwise parse and validate their referenced public symbols.

## Authentic Substitutes for Zero-Lab Courses

| Course | Embedded-lab exception | Required substitute |
|---|---|---|
| Install & packages | Installation and module resolution happen at build time | Minimal package manifest/module setup plus verified import or doctor output |
| Codex plugin | Installation and host integration happen outside docs runtime | Canonical install/invocation transcript and plugin-source boundary check |
| Testing headlessly | The behavior is the test harness itself | A real headless test module and deterministic rendered-frame assertion |
| Crash safety | Process signals and terminal restoration cannot be simulated honestly in the browser lab | Lifecycle/restore test and annotated failure/recovery trace |
| In production | Deployment, observability, and process supervision are operational concerns | Verified production checklist/configuration and bounded diagnostic output |

The substitute is evidence, not an excuse to omit practical teaching.

## Failure and Production Coverage

Each course selects relevant failures from lifecycle cleanup, focus loss, clipping, invalid input,
capability degradation, cancellation, stale async work, unsafe text, host denial, or resource
ownership. Security and accessibility are integrated into the lesson where the boundary occurs;
they are not postponed to a closing paragraph.

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Source and existing docs disagree | Source/tests win; correct the course and link the owning API/component material | AR-1 |
| Prerequisite does not teach assumed knowledge | Fix the assumption or prerequisite metadata before continuing | AR-4 |
| A lesson duplicates another surface | Reduce to necessary context and link to the owner | AR-1, AR-3 |
| A snippet cannot be verified | Remove or replace it; do not publish speculative APIs | AR-9 |
| Profile cannot justify an omitted backbone section | Restore the section before stage promotion | AR-5 |

## Testing Requirements

- One specification file per Guide route, derived from catalog outcomes and profile contract.
- Markdown assertions for frontmatter, prerequisite links, lessons, snippets, failures, practice,
  and owning-surface links.
- Snippet compilation or public-symbol validation where practical.
- One implementation file per Guide route for internal parsing, layout, and hardening details.
