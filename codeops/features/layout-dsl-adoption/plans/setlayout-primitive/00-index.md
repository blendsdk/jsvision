# setlayout-primitive — plan index

> **Implements**: layout-dsl-adoption/GH-117 · **GitHub**: [#117](https://github.com/blendsdk/jsvision/issues/117)
> **CodeOps Skills Version**: 3.10.0
> **Status**: ✅ **DONE 2026-07-20** (exec_plan 22/22) · preflighted 2026-07-20 (35 findings over 2 iterations, all resolved — [`00-preflight-report.md`](00-preflight-report.md)) · post-phase review: 10 findings (1 major), all resolved

## What this plan does

Adds `View.setLayout(patch)` — a shallow-merging, self-invalidating write path for layout props — and
migrates the code that most wants it: the DSL builders (which hand-roll `{ ...view.layout, … }` in 9
of their 14 layout writes) and the 9 self-layout sites.

It covers the issue's **P1–P3**. **P4 — making `layout` read-only — is deliberately not attempted**
(AR-1): it needs the remaining 59 writes gone, a solution for 10 subclass field initializers, a
solution for 9 in-place property mutations a getter would not stop, and `spike-data-studio` deleted.
None of that is in hand, and pretending otherwise would produce a plan that cannot finish.

## Why it matters

`view.layout = { size }` silently wipes any `direction`/`padding`/`position` already there, and never
reflows. Both defaults are the wrong one. Every merge-preserving helper in the codebase exists to
work around the first, and the second is why "set and forget" silently fails to repaint.

## Documents

| Doc | What it owns |
|---|---|
| [00-preflight-report](00-preflight-report.md) | The audit: 21 findings, the resolutions, and what was cleared |
| [00-ambiguity-register](00-ambiguity-register.md) | The 9 decisions this plan rests on — ✅ gate passed, 6 amended post-preflight |
| [01-requirements](01-requirements.md) | FR/NFR/AC, and what is explicitly out of scope |
| [02-current-state](02-current-state.md) | The measured site inventory, the corrections to the issue body, and the grep patterns that actually work |
| [03-01-primitive](03-01-primitive.md) | The method itself (P1) |
| [03-02-migration](03-02-migration.md) | The 23-row replace-semantics audit and the conversions (P3/P2) |
| [07-testing-strategy](07-testing-strategy.md) | ST-S1…S5 + S9 (spec) · ST-I1/I3/I4/I5 (impl), which one is deliberately red-first, and which planned tests were retired as already-covered |
| [99-execution-plan](99-execution-plan.md) | 3 phases, 22 tasks |

## Four things a reader should know before starting

1. **The issue's numbers are stale, and so was this plan's first draft.** The issue was filed at
   225 writes / 29 reads. Measured today, counting only *executable* code: **82 writes, 17 reads,
   14 DSL sites, 9 self-layout sites, 10 field initializers** (across 9 classes). A raw
   `grep ".layout = "` gives ~144 because it counts the ~64 `.layout = …` lines inside JSDoc
   `@example` blocks — and it still misses `dsl/flex.ts:217`, whose assignment wraps. Every figure in
   [02](02-current-state.md) now ships with the command that reproduces it.
2. **The issue's P1 is not implementable as written.** It pairs `setLayout` with a `get layout()`,
   but 10 subclasses set layout as a **field initializer**, and a class field cannot override a
   base-class accessor. The getter belongs to P4 (AR-7) — and even there it is insufficient, since it
   would not stop the 9 in-place `layout.rect = …` mutations.
3. **The audit runs before the migration, not after.** The issue orders them P2→P3. An audit that
   runs after the conversion can only ratify it (03-02 §audit-first). The audit table's decisive
   column is **"mounted at call time?"** — not the spread-vs-replace shape.
4. **The tagger behaviour change fixes nothing today; one *other* conversion does change behaviour.**
   Converting the taggers makes them auto-invalidate (AR-5), and no tagger site observes that — both
   genuine tagger-on-a-mounted-view paths already reflow, one through its `bind({relayout:true})` and
   one through `Group.add`/`remove`. It is kept as a **correctness default for future callers**; the
   first draft claimed it repaired a live defect at `filter-popup.ts:285`, and that claim was wrong
   and is withdrawn. Separately, **`window.ts:161` genuinely does gain a reflow** — `commitPlacement()`
   does not invalidate today and runs on a mounted window at gesture start. Benign, but recorded
   (FR-4a, [02 §3a](02-current-state.md)). The property that decides all of this is *mounted at call
   time*, never the statement's shape.

## Scale

23 conversions across 11 files, **6 spec tests + 4 impl tests** (of which one is the single genuinely
new migration witness — six existing suites cover the rest), 3 phases, 22 tasks. Two behaviour
changes, both recorded and argued: the DSL taggers gain auto-invalidation (AR-5, pinned by ST-S5,
observed by nothing today) and `window.ts:161` gains one real, benign reflow (FR-4a).
