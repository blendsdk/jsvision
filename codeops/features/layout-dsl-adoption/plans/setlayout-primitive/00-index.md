# setlayout-primitive — plan index

> **Implements**: layout-dsl-adoption/GH-117 · **GitHub**: [#117](https://github.com/blendsdk/jsvision/issues/117)
> **CodeOps Skills Version**: 3.10.0
> **Status**: 📋 Plan created 2026-07-20 · not yet preflighted

## What this plan does

Adds `View.setLayout(patch)` — a shallow-merging, self-invalidating write path for layout props — and
migrates the code that most wants it: the DSL builders (which hand-roll `{ ...view.layout, … }` in 13
places) and the 7 `this.layout =` self-layout sites.

It covers the issue's **P1–P3**. **P4 — making `layout` read-only — is deliberately not attempted**
(AR-1): it needs all 138 writes gone, a solution for 11 subclass field initializers, and
`spike-data-studio` deleted. None of that is in hand, and pretending otherwise would produce a plan
that cannot finish.

## Why it matters

`view.layout = { size }` silently wipes any `direction`/`padding`/`position` already there, and never
reflows. Both defaults are the wrong one. Every merge-preserving helper in the codebase exists to
work around the first, and the second is why "set and forget" silently fails to repaint.

## Documents

| Doc | What it owns |
|---|---|
| [00-ambiguity-register](00-ambiguity-register.md) | The 9 decisions this plan rests on — ✅ gate passed |
| [01-requirements](01-requirements.md) | FR/NFR/AC, and what is explicitly out of scope |
| [02-current-state](02-current-state.md) | The measured site inventory, and the corrections to the issue body |
| [03-01-primitive](03-01-primitive.md) | The method itself (P1) |
| [03-02-migration](03-02-migration.md) | The replace-semantics audit and the 20 conversions (P3/P2) |
| [07-testing-strategy](07-testing-strategy.md) | ST-S1…S8, and which one is deliberately red-first |
| [99-execution-plan](99-execution-plan.md) | 3 phases, 17 tasks |

## Three things a reader should know before starting

1. **The issue's numbers are stale.** It was filed at 225 writes / 29 reads; the adoption epic has
   since removed 39% of them. Measured today: **138 writes, 24 reads, 7 self-layout sites**
   ([02 §5](02-current-state.md)).
2. **The issue's P1 is not implementable as written.** It pairs `setLayout` with a `get layout()`,
   but 11 subclasses set layout as a **field initializer**, and a class field cannot override a
   base-class accessor. The getter belongs to P4 (AR-7) — and the issue never mentions those 11
   subclasses, which are P4's real blocker.
3. **The audit runs before the migration, not after.** The issue orders them P2→P3. An audit that
   runs after the conversion can only ratify it (03-02 §audit-first).

## Scale

20 conversions across 6 files, 8 spec tests, 3 phases. One deliberate behaviour change — DSL taggers
gain auto-invalidation (AR-5) — recorded, argued, and pinned by ST-S5.
