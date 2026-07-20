# Testing Strategy: layout-field-lockdown

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## What proves what

| Claim | Proven by |
|---|---|
| The examples gate exists and works | ST-1, ST-2 |
| Tests are typechecked repo-wide | ST-3 |
| `setLayout` is the only writer | ST-4…ST-7 + AC-3 grep + AC-5 spike |
| The escape hatches are shut | ST-8 |
| Conversions preserved behaviour | the existing suites + ST-9 + the render control |
| Canvases still render correctly | ST-10 + the per-canvas render diff |
| No name shadows a DSL builder | ST-11 |

> **The compiler is the primary oracle for Phases 1–2.** These ST cases pin the *contract*; the
> 816 conversions are verified by `tsc` and the existing suites, not by new per-site tests.

## Specification test cases

| ID | Setup | Expected | Source |
|---|---|---|---|
| ST-1 | `packages/examples` after FR-1 | `tsc --listFiles` covers all 255 `.ts`; `yarn typecheck` green | FR-1 |
| ST-2 | Inject a type error into a previously-unchecked demo entry (`view-demo/main.ts`) | `yarn typecheck` **fails**, naming that file; revert restores green | FR-4 |
| ST-3 | Each package's `typecheck` script | Resolves a config whose `include` contains `test`; `tsc --listFiles` includes `test/` files | FR-1, AR-14 |
| ST-4 | `const v = new Group(); v.setLayout({ direction: 'col' }); v.setLayout({ padding: 1 })` | Both props present — `setLayout` merges, never replaces | FR-6 |
| ST-5 | A mounted view with a host double counting `markRelayout`; one `setLayout` call | `markRelayout` called exactly **once** | FR-6 |
| ST-6 | `const before = v.layout; v.setLayout({ padding: 1 })` | `v.layout === before` — the object is mutated in place, identity preserved (the `Object.assign` contract) | AR-2 |
| ST-7 | Type-level: `v.layout = {}` and `v.layout.rect = r` in a `// @ts-expect-error` fixture | Both are compile errors; the fixture compiles **only** because the errors are expected | FR-5, AR-1 |
| ST-8 | Type-level, for a subclass declaring `override readonly layout` (e.g. `Window`) | `w.layout.rect = r` is a compile error — the hatch is shut | AR-3 |
| ST-9 | `applyMove` on a window via the gesture path | Rect updates **and** a reflow is requested, with no separate `invalidateLayout()` call in the source | FR-7, AR-4 |
| ST-10 | Each converted canvas, rendered 80×24 before and after | Cell-exact diff (glyph + fg/bg + attrs + width): byte-identical, or a recorded and accepted delta | FR-11, AR-9 |
| ST-11 | Grep for local `at`/`row` bindings across `packages/**` | Zero shadows of a DSL builder name | FR-10, AC-7 |

> ST-7 and ST-8 are **type-level** cases. They must be written so that the fixture compiles only
> because the error is expected — a `@ts-expect-error` that stops being an error is itself a
> failure, which is exactly the ratchet wanted here. Without them, a future edit could drop
> `readonly` from the base or a subclass and every runtime test would stay green, because
> `readonly` is erased at runtime. **This is the single most important pair in this document.**

## Implementation tests

| File | Covers |
|---|---|
| `packages/ui/test/view.set-layout.impl.test.ts` (extend) | `Object.assign` backing: identity, shallow-merge of the `size` union, reflow count |
| Per-package existing suites | Behaviour preservation across all 816 conversions — no new per-site tests |

## Non-goals

- No new test per converted site. `tsc` proves the conversion compiles; the existing suite proves
  behaviour. 816 bespoke tests would be noise.
- No committed render baselines (AR-9 rejected promoting them) — the control is a working step,
  reviewed per canvas.

## Verify

`yarn verify` at every phase boundary (AR-12). The prime directive applies separately: `yarn
lint:fix` before any PR-bound push, with its changes committed.
