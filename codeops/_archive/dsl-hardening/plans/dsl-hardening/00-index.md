# DSL Hardening Implementation Plan

> **Feature**: Harden the `@jsvision/ui` layout DSL so the codebase-wide adoption (epic GH #108) can land — add the missing builders/props each real port needs, and refactor `dsl.ts` into a `dsl/` module folder.
> **Status**: Planning Complete
> **Created**: 2026-07-18
> **CodeOps Skills Version**: 3.9.0

## Overview

The layout DSL (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`/`place`/`centered`/…) shipped as a
thin declarative layer over `Group`/`View`. A full sweep for the adoption follow-up (GH #108)
found that a large share of `.layout = {…}` sites can't move to the DSL because of concrete gaps
in the builders — not because absolute/flex placement is impossible, but because the DSL has no
ergonomic form for it. This plan closes the gaps that have a **real consumer**.

Scope (per AR-1): **S1** `size.min` on the size shorthands, **S2** a blessed absolute `at()`
builder (which also makes an absolute child inside a `col`/`row` work — "S4" — for free), **S3**
standalone `cover()`/`center()`, **S5** placement offsets, and **S7** skipping falsy children.
Two thinner gaps (S6 runtime-direction `flex()`, S8 Group-subclass containers) are **deferred** —
no consumer yet (tracked in GH #113). `dsl.ts` (442 lines) is refactored into a `dsl/` folder so
the additions land in cohesive sub-500-line modules with the public API unchanged. Finally,
`split-view.ts` adopts the new `min` form as a real-world proof of S1.

All changes are **additive and behavior-preserving** for existing callers, zero runtime deps.

## Document Index

| #   | Document                                       | Description                                 |
| --- | ---------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail) |
| 00  | [Index](00-index.md)                           | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)             | Feature requirements and scope              |
| 02  | [Current State](02-current-state.md)           | Analysis of the current DSL + call sites    |
| 03-01 | [Module Split](03-01-module-split.md)        | Refactor `dsl.ts` → `dsl/` folder           |
| 03-02 | [Flex Sizing](03-02-flex-sizing.md)          | S1 `size.min` + S7 falsy children           |
| 03-03 | [Absolute Builders](03-03-absolute-builders.md) | S2 `at()` + S3 `cover()`/`center()` (+ S4) |
| 03-04 | [Placement Offsets](03-04-placement-offsets.md) | S5 offsets + S3 dev-warn                  |
| 03-05 | [Split-View Migration](03-05-split-view-migration.md) | Adopt `min` in `split-view.ts` (S1 proof) |
| 07  | [Testing Strategy](07-testing-strategy.md)     | Spec test cases (ST-*) and verification     |
| 99  | [Execution Plan](99-execution-plan.md)         | Phases and task checklist                   |

## Quick Reference

### Usage Examples

```ts
import { col, row, grow, fixed, at, cover, center, place } from '@jsvision/ui';

// S1 — a growing pane that never shrinks below 12 cells
row(grow(sidebar, 1, { min: 12 }), grow(main, 3));

// S2 — one blessed absolute placement (merge-preserving); also works as an out-of-flow col child
col(header, grow(body), at(overlay, 0, 0, 80, 24));

// S3 — cover/center a single child without a stack() wrapper
cover(canvas);
center(dialog, 40, 12);

// S5 — place one cell above the bottom
place(okButton, { h: 'center', v: 'end', vOffset: 1, width: 10, height: 2 });

// S7 — conditional children just work
col(showMenu && fixed(menu, 1), grow(body), showStatus && fixed(status, 1));
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| In-scope gaps | S1, S2 (+S4), S3, S5, S7 build; S6, S8 defer | AR-1 |
| `size.min` shape | options object `grow(v, w, { min })` | AR-2 |
| `at()` signature | positional + `Rect` overload, merge-preserving, pure | AR-3 |
| fill/center naming | standalone `cover()`/`center()`, distinct from `centered()` and `Flex.fill` | AR-4 |
| File structure | split `dsl.ts` → `dsl/` folder | AR-8 |
| Consumer migration | migrate `split-view.ts` only | AR-9 |

## Related Files

- `packages/ui/src/view/dsl.ts` → refactor to `packages/ui/src/view/dsl/{flex,stack,absolute,index}.ts`
- `packages/ui/src/view/dsl/stack.ts` — `Placement` offset fields `hOffset`/`vOffset` (S5; no engine / `layout/types.ts` change)
- `packages/ui/src/split/split-view.ts` — adopt `grow(v, w, { min })` (S1 proof)
- `packages/ui/src/view/index.ts` / `packages/ui/src/index.ts` — barrel exports (`at`, `cover`, `center`)
- `packages/ui/test/dsl-*.spec.test.ts` / `.impl.test.ts` — new spec + impl suites
