# 00 — Index: Comprehensive Forms Showcase

> **Implements**: jsvision-forms/RD-05
> **CodeOps Skills Version**: 3.8.0
> **Status**: Plan Created — ready for `exec_plan comprehensive-showcase`
> **Last Updated**: 2026-07-16

The last remaining slice of **jsvision-forms** (feature 8/9 → 9/9): a single flagship kitchen-sink
story, `forms/showcase`, that ties the whole shipped forms engine together in one realistic form —
a live **state inspector**, an **amber app-advisory** warning, **right/below error-layout variants**
via the `col`/`row` DSL, and an inline **async / load / dialog** tour. Purely example code
(`packages/examples`); **no `@jsvision/forms`/core/ui change** (AR-PL7).

## Why this exists

RD-06…09 each shipped a focused capability + its own capability story. RD-05 is the curation: the
"everything together" grand tour that shows a developer how the pieces compose into a real edit form.
Its scope was disambiguated directly into this plan (RD-05 has no standalone RD doc — AR-PL1); the
Zero-Ambiguity Gate register (`00-ambiguity-register.md`) is the decision record.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — all 8 items Resolved (✅ GATE PASSED). |
| [01-requirements.md](01-requirements.md) | Scope, acceptance criteria (AC-1…9), out-of-scope. |
| [02-current-state.md](02-current-state.md) | The existing Forms suite + the engine surface the story consumes. |
| [03-01-showcase-story.md](03-01-showcase-story.md) | Technical spec for `forms-showcase.story.ts` (layout, inspector, advisory, toggle, async/load/dialog). |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-SS1 smoke oracle + the AC→oracle coverage map + verify. |
| [99-execution-plan.md](99-execution-plan.md) | One phase, spec-first task checklist (the single progress source of truth). |

## Scope at a glance

- **IN**: one new story `forms/showcase` (category `Forms`, `rd: 'RD-05'`) + its registry line +
  the ST-SS1 smoke oracle.
- **OUT**: any change to `@jsvision/forms`/`@jsvision/ui`/`@jsvision/core`; any change to the four
  existing forms stories; a new dependency; the GH #89 backlog items.

## Verify

`yarn verify` (turbo `test dependsOn build` rebuilds `@jsvision/forms` first — examples import it by
name → dist). Commits via **/gitcmp**; commit subjects start lowercase.
