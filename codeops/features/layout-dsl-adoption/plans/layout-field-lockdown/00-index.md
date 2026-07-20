# Layout Field Lockdown Implementation Plan

> **Feature**: Give `packages/examples` a real typecheck gate, make `View.layout` a read-only
> field so `setLayout()` is its only writer, and finish the Tier-3 canvas adoption — in that
> order, because each step is the oracle for the next.
> **Status**: Planning Complete · ✅ Zero-Ambiguity Gate passed (16/16) · ✅ Preflight applied
> (25 findings, all resolved — see [00-preflight-report.md](00-preflight-report.md))
> **Created**: 2026-07-20
> **Implements**: GH [#132](https://github.com/blendsdk/jsvision/issues/132) →
> [#117](https://github.com/blendsdk/jsvision/issues/117) (P4) →
> [#129](https://github.com/blendsdk/jsvision/issues/129) (issue-driven; #129's canvas work is
> governed by RD-01 FR-6 + RD-02. GH [#131](https://github.com/blendsdk/jsvision/issues/131) is
> explicitly **out** — see AR-11)
> **CodeOps Skills Version**: 3.11.0

## Overview

Three issues that look independent are one dependency chain, and the chain runs in the opposite
direction to their issue numbers.

`View.layout` is a public mutable field. Anything can replace it wholesale — silently dropping
every prop it omits and never reflowing — or mutate its `rect` in place. `setLayout()` exists to be
the safe writer, but nothing enforces it. #117-P4 closes that hole.

The obstacle is not the conversion. It is that **the compiler cannot see most of the code that
would break**. `packages/examples/tsconfig.json` names six directories; 148 of its 255 `.ts` files
never typecheck, and 56 write sites hide there. So #132 comes first — not for hygiene, but because
it is the instrument the rest of the plan measures with.

#129 comes last for the same reason inverted: its canvases are largely inside that blind spot, and
its work is per-file *design* rather than mechanical substitution, so it wants both the compiler and
a render control behind it.

The blind spot turned out to be far wider than one package. **No package except `datagrid`
typechecks its tests** — 743 test files, 395 of them `*.spec.test.ts` oracles, holding **703**
further write sites. Because `readonly` is erased at runtime and vitest never typechecks, a
lockdown scoped to `src/` would have passed every acceptance check while enforcing nothing in 254
test files (AR-13). `datagrid` already carries the fix worth copying (AR-14).

| Phase | Issue | What it does | Size |
|---|---|---|---|
| 1 | #132 + the repo-wide gap | Turn on typechecking for `examples` and every `test/`; clear the errors it exposes | 229 errors / ~126 files |
| 2 | #117-P4 | Convert every write to `setLayout()`, migrate everything that *teaches* the idiom, then flip the field read-only | ~810 sites / ~311 files |
| 3 | #129 | Tier-3 canvas adoption + retire 5 name shadows | 18 sites + 5 shadows |

**What preflight added.** The spike that produced these numbers asked *"what stops compiling?"* and
never asked *"what stops passing?"*. Four things inside `yarn verify` break on the flip without
being type errors: the `@example` compile ratchet (`jsdoc-examples.spec.test.ts`), the committed
plugin API-ref snapshot, two impl tests that assert the replace contract by name, and 16
documentation snippets. Phase 2 now carries all four (FR-13), and the `@ts-expect-error` ratchet
moved next to the flip so the ~810 conversions do not run with `verify` dark.

## Documents

| Document | Contents |
|---|---|
| [00-ambiguity-register.md](00-ambiguity-register.md) | The 16 gate decisions and their measured evidence |
| [00-preflight-report.md](00-preflight-report.md) | The 25 audit findings, their evidence, and the resolutions applied |
| [01-requirements.md](01-requirements.md) | Functional requirements, scope boundaries, acceptance criteria |
| [02-current-state.md](02-current-state.md) | The measured baseline — every count, and how it was obtained |
| [03-01-typecheck-coverage.md](03-01-typecheck-coverage.md) | #132 — the include, the 53 errors, the `.mjs` declaration seam |
| [03-02-layout-field-lockdown.md](03-02-layout-field-lockdown.md) | #117-P4 — the site inventory, the escape hatches, `setLayout`'s backing, and what the flip breaks that is not a type error |
| [03-03-canvas-adoption.md](03-03-canvas-adoption.md) | #129 — the 8 canvases, the 5 shadows, the render control |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-1…ST-11 specification cases |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, progress |

## The finding that shaped this plan

The counts here were not derived by reading code. The field was flipped to `readonly` in a spike,
`ui` was rebuilt so downstream packages saw the new `.d.ts`, and `tsc --noEmit` ran per package;
the tree was then restored. That mattered, because three separate traps each produce a
confidently wrong answer:

1. **`readonly` is shallow.** `readonly LayoutProps` and `readonly Readonly<LayoutProps>` both
   reported *exactly 21 errors* — adding `Readonly<>` appeared to change nothing.
2. **Ten subclasses silently re-open the field.** `override layout: LayoutProps` without
   `readonly` restores write access with no diagnostic. Closing those hatches took the count from
   21 to 31 and revealed every in-place `rect` mutation.
3. **Turbo halts at the first failing package**, and downstream packages typecheck against
   `ui/dist`, not `ui/src`. Without rebuilding, four packages report zero.

4. **`rootDir` decides whether test typechecking means anything.** Widening `include` while
   `rootDir` is `"src"` emits 606 phantom `TS6059`; omitting `rootDir` makes `ui` report **1**
   error because `TS2209` aborts resolution and hides **80**.

5. **A type-clean flip is not a green build.** Three shipped `@example` blocks assign `layout.rect`
   and are compiled by a ratcheted guard; the plugin API-ref snapshot records the field's type; two
   impl tests assert the object is *replaced*. None of these is a `TS2540`, and all of them are in
   `yarn verify`.

Naive flip: **21 sites**. Truth: **~810**, plus four non-compiler artifacts. Every miss looks like
success — which is the specific reason Phase 1 exists.
