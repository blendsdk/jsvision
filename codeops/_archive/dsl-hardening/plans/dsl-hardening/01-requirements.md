# Requirements: DSL Hardening

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Close the concrete gaps in the `@jsvision/ui` layout DSL that block or degrade the codebase-wide
adoption tracked by epic GH #108. Each gap surfaced from a full sweep of `.layout = {…}` sites
cross-referenced against `packages/ui/src/view/dsl.ts`. The plan adds only the gaps with a real
consumer, refactors the DSL into a module folder, and proves S1 by migrating `split-view.ts`.

## Functional Requirements

### Must Have

- [ ] **R1 (S1)** `grow()`/`fixed()` and the `col`/`row` `grow` shorthand can carry a `min` floor,
  forwarding the engine's existing `Size.fr.min`. Shape per AR-2 — see `03-02 §grow/fixed`.
- [ ] **R2 (S2)** A blessed absolute-placement builder `at()` — positional + `Rect` overload,
  merge-preserving, returns the view, pure. See `03-03 §at`.
- [ ] **R3 (S4, via S2)** An `at()`-placed view used as a child of `col`/`row`/`stack` is honored
  as an out-of-flow absolute child (no new machinery — the engine already excludes `absolute` from
  flow; this is a spec-locked guarantee + doc). See `03-03 §absolute-child`.
- [ ] **R4 (S3)** Standalone `cover(view)` and `center(view, w, h)` that set `position:'fill'` /
  centered-absolute directly and return the view — no `stack()` wrapper. The builder is named
  `cover`, not `fill`: a standalone `fill` export is banned by the packaging oracle and collides
  with the `Flex.fill` (grow:1) shorthand (AR-4, revised by preflight PF-001). See
  `03-03 §cover-center`.
- [ ] **R5 (S3)** `centered()`/`place()` emit a dev-only warning (no throw) when their tagged view
  is never adopted by a `stack()`. See `03-04 §dev-warn`.
- [ ] **R6 (S5)** `Placement` gains optional `hOffset`/`vOffset` integer-cell offsets applied after
  the start/center/end position. See `03-04 §offsets`.
- [ ] **R7 (S7)** `col`/`row`/`stack` skip `null`/`undefined`/`false` children. See `03-02 §falsy`.
- [ ] **R8 (arch)** `dsl.ts` is refactored into `dsl/{flex,stack,absolute}.ts` + `dsl/index.ts`;
  the `view/index.ts` and `@jsvision/ui` public exports are byte-identical. See `03-01`.
- [ ] **R9 (proof)** `split-view.ts` panes adopt `grow(v, w, { min })`; behavior (spec oracle)
  unchanged. See `03-05`.

### Should Have

- [ ] **R10** Every new/changed public export carries a copy-pasteable JSDoc `@example`; `check:docs`
  stays green (AR-13).

### Won't Have (Out of Scope)

- **S6** runtime-direction `flex(direction, …)` builder — no clean consumer (AR-1); tracked GH #113.
- **S8** Group-subclass container composition — no consumer (AR-1); tracked GH #113.
- A `max` size option — no engine support / no consumer (AR-10).
- Migrating any consumer other than `split-view.ts` (demos, ui widgets, dialogs) — those are the
  port issues #109–#115 (AR-9).

## Technical Requirements

### Performance
- No regression to the layout hot path. The new builders only set `.layout` props at construction;
  the reflow pass is unchanged. Falsy-child filtering is an O(n) guard over builder args (AR-7).

### Compatibility
- **Additive only.** Existing `grow`/`fixed`/`col`/`row`/`stack`/`place` call sites behave
  identically (the `min` arg and offset fields are optional; falsy filtering only removes values
  that crash today). ESM-only, **zero runtime dependencies** (`check:deps` must pass).

### Security
- No user-input, network, fs, or eval surface (a pure in-process layout-builder library). No new
  attack surface. Degenerate numeric inputs already clamp via `toCells`/`normalizeSize`.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| In-scope gaps | all S1–S8 · consumer-backed subset | S1,S2,S3,S5,S7 (+S4 free) | build only what a real consumer needs; defer S6/S8 | AR-1 |
| `size.min` API | options object · positional | options object | extensible, readable | AR-2 |
| `at()` signature | positional · rect · both | positional + rect overload | matches convention + covers internal sites | AR-3 |
| fill/center naming | new standalone · overload `centered` | new `cover`/`center` | avoid dual-mode `centered`; `fill` name banned + clashes with `Flex.fill` | AR-4 |
| File structure | split now · keep one file | split to `dsl/` | crosses the size target | AR-8 |
| Consumer migration | none · split-view | split-view only | S1 proof without broad blast radius | AR-9 |

> **Traceability:** every scope decision references its Ambiguity Register entry. See `00-ambiguity-register.md`.

## Acceptance Criteria

1. [ ] R1–R9 implemented; all ST-cases in `07-testing-strategy.md` pass.
2. [ ] `@jsvision/ui` public export surface unchanged except the additions `at`, `cover`, `center`
   (verified by the packaging spec).
3. [ ] `split-view` spec oracle green unchanged; a new impl test proves `min` reaches the panes.
4. [ ] `yarn verify` green (lint · typecheck · build · test · check:docs); `check:deps` green.
5. [ ] No dead code; every new export documented with an `@example` (AR-13).
