# Docs & Example Modernization Implementation Plan

> **Feature**: Modernize the layout-shaped JSDoc `@example` blocks onto the layout DSL, retire the
> docs-site `at()` shadows, and land a permanent compile guard so public examples can never again
> drift from the API they document.
> **Status**: Planning Complete · 🔬 Preflighted 2026-07-20 ([report](00-preflight-report.md) — 35
> findings over 1 iteration, all resolved and applied)
> **Created**: 2026-07-20 15:12
> **Implements**: GH [#112](https://github.com/blendsdk/jsvision/issues/112) (issue-driven — the
> RD-01 FR-6 Tier-3 docs-site composition rewrite is explicitly **out**, see AR-4)
> **CodeOps Skills Version**: 3.11.0

## Overview

`@jsvision/*` public JSDoc is a contract: CLAUDE.md states that agents and humans feed on these
`@example` blocks and that every one must be *"realistic, correct, copy-pasteable"*. Today **~377**
of them exist across the six shipped packages and **nothing has ever compiled a single one** —
`check-jsdoc.mjs:132` only asserts that the `@example` tag is *present*. A feasibility probe run
during planning found four public examples that are broken right now, including three that document
`createEventLoop({ width, height })` with one argument where the real signature takes two.

This plan does three things, in that order of dependency. First it builds the missing oracle: a
permanent guard that extracts every `@example`, compiles it, and fails the build on any *new*
failure, with a committed allowlist grandfathering what already fails (AR-2, AR-5). Second, with
that guard in place, it modernizes every layout-shaped example — the two flex blocks the issue
names, the 53 `position:'absolute'` lines across 37 files that #113's `at()` builder made
expressible, and `split-view.ts:109` → `cover()` (AR-1). Third it retires the seven local `at()`
shadow helpers in `packages/docs-site/examples` — byte-identical replace-semantics twins of the
ones #114 just retired — and gives `list-box.ts` the one worked flex composition the docs-site
currently lacks (AR-3).

The guard is the point. The example sweep is worth doing on its own didactic merits, but a
37-file documentation edit with no compiler in the loop is exactly how wrong documentation ships;
building the detector first turns the rest of the plan into a verified refactor and leaves the repo
with a ratchet that keeps paying long after #112 closes.

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (16 items, all resolved) |
| PF | [Preflight Report](00-preflight-report.md) | Iteration-1 audit — 35 findings (3 🔴 / 9 🟠), all resolved |
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Scope, acceptance criteria, out-of-scope list |
| 02 | [Current State](02-current-state.md) | Measured baseline: the ~377 blocks, the corrected probe figures, the live defects |
| 03-01 | [Example Compile Guard](03-01-example-compile-guard.md) | The extract-and-typecheck harness + allowlist contract |
| 03-02 | [JSDoc Example Modernization](03-02-jsdoc-example-modernization.md) | The flex + absolute `@example` sweep and the four defect fixes |
| 03-03 | [docs-site Shadow Retirement](03-03-docs-site-shadow-retirement.md) | The 7 local `at()` helpers and the `list-box` composition |
| 07 | [Testing Strategy](07-testing-strategy.md) | ST-1…ST-14 specification cases and the verification chain |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, tasks, progress checklist |

## Quick Reference

### Usage Examples

What the sweep does to a typical widget example:

```ts
// before — the raw field write, two lines
const btn = new Button('~O~K', { onClick: () => {} });
btn.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 10, height: 2 } };

// after — the blessed builder, one line, merge-preserving
at(new Button('~O~K', { onClick: () => {} }), 1, 1, 10, 2);
```

What the guard does when someone writes an example that does not compile:

```
FAIL  jsdoc-examples: 1 example does not compile

  packages/ui/src/controls/slider.ts::Slider
    TS2554 Expected 2 arguments, but got 1

  Public @example blocks are an API contract and must compile.
  If this is intentional, it does NOT belong in the allowlist —
  the allowlist may only shrink.
```

### Key Decisions

| Decision | Outcome | AR |
|---|---|---|
| `@example` scope | Expanded past the filed flex-only slice to all 53 absolute lines + `split-view` → `cover()` | AR-1 |
| Sweep oracle | A permanent extract-and-typecheck guard, not a one-shot check | AR-2 |
| Guard scope | The six shipped packages, enumerated; committed allowlist that may only shrink | AR-5, AR-9, AR-15 |
| Allowlist key | `path/to/file.ts::SymbolName` (+ `Class.member`, + `#N` on collision) | AR-10 |
| Stale entries | Hard build failure, not a warning | AR-11 |
| Guard home | Harness in `packages/docs-site/src/api/`, oracle in `test/` — Linux-only, where CI parks heavy tooling | AR-7 |
| Block compilation | **In-memory `ts.CompilerHost`** — nothing is written to disk | AR-16 |
| Unused-local checks | Off — a doc snippet's unused local is not an API defect | AR-14 |
| Four live defects | Fixed in this plan, not allowlisted | AR-6 |
| Tier-3 docs-site composition | Out — belongs to #129, except `list-box.ts` by name | AR-4 |

## Related Files

**Created**

- **`packages/docs-site/src/api/jsdoc-examples.mjs`** — the harness itself (`collectExamples`,
  `checkExamples`, the in-memory compiler host). In `src/` so `yarn typecheck` covers it, mirroring
  `src/api/barrel-exports.mjs`
- `packages/docs-site/test/jsdoc-examples.spec.test.ts` — the guard's oracle (ST-1…ST-8, ST-13,
  ST-14) **and the standing repo gate (ST-12)**
- `packages/docs-site/test/jsdoc-examples.allowlist.json` — the grandfathered failures
- `packages/docs-site/test/fixtures/jsdoc-examples/` — spec fixtures
- `packages/docs-site/test/jsdoc-examples.impl.test.ts` — harness internals
- `packages/docs-site/test/example-at.spec.test.ts` — the `at()` builder's contract (ST-9…ST-11)

**Modified**

- `packages/docs-site/package.json` — add `@jsvision/datagrid` + `@jsvision/forms` devDependencies
  so turbo orders their builds before the guard runs (AR-15)
- 37 files across `packages/{ui,files,datagrid,forms}/src` — the `position:'absolute'` sweep (03-02)
- `packages/ui/src/view/group.ts`, `packages/ui/src/editor/indicator.ts` — the flex rewrite
- `packages/ui/src/split/split-view.ts` — `position:'fill'` → `cover()`
- `packages/ui/src/{tree/tree,tabs/tab-view,table/data-grid,app/application}.ts` — the four defects
- `packages/docs-site/examples/{containers/list-box,controls/button,controls/input,controls/form-dialog,files/file-dialog,table/data-grid,theming/preset-gallery}.ts` — shadow retirement (03-03)
