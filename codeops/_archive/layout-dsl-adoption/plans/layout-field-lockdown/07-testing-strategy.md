# Testing Strategy: layout-field-lockdown

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## What proves what

| Claim | Proven by |
|---|---|
| The examples gate exists and works | ST-1, ST-2 |
| Tests are typechecked repo-wide | ST-3 |
| `setLayout` is the only writer | ST-4…ST-7 + the widened AC-3 grep + AC-5 |
| The escape hatches are shut | ST-8 |
| Conversions preserved behaviour | the existing suites + ST-9 + the render control |
| Canvases still render correctly | ST-10 + the per-canvas render diff |
| No name shadows a DSL builder | ST-11 |
| The retired idiom is no longer taught anywhere | ST-12 (`@example` ratchet + plugin snapshot) + the doc-snippet sweep (FR-13) |

> **The compiler is the primary oracle for Phases 1–2.** These ST cases pin the *contract*; the
> ~810 conversions are verified by `tsc` and the existing suites, not by new per-site tests.

## Specification test cases

| ID | Setup | Expected | Source |
|---|---|---|---|
| ST-1 | `packages/examples` after FR-1 | `tsc --listFiles` covers all 255 `.ts`; `yarn typecheck` green | FR-1 |
| ST-2 | Inject a type error into a previously-unchecked demo entry (`view-demo/main.ts`) | `yarn typecheck` **fails**, naming that file; revert restores green | FR-4 |
| ST-3 | Every package that has **both** a `typecheck` script and a `test/` directory | `tsc --listFiles -p <the resolved config>` includes ≥1 file under `test/`. Exempt and named: `spike-data-studio` (no typecheck script, AR-6) | FR-1, AR-14 |
| ST-4 | ≡ **existing** `ui/test/view-setlayout.spec.test.ts:42` (ST-S1) — do not re-author | Both props present — `setLayout` merges, never replaces | FR-6 |
| ST-5 | ≡ **existing** `ui/test/view-setlayout.spec.test.ts:59` (ST-S3), `countingHost()` double included — do not re-author | `markRelayout` called exactly **once** | FR-6 |
| ST-6 | `const before = v.layout; v.setLayout({ padding: 1 })` | `v.layout === before` — mutated in place, identity preserved (the `Object.assign` contract). **Inverts** committed ST-I1/ST-I4 in `view-setlayout.impl.test.ts`, which must be updated in the same task | AR-2 |
| ST-7 | Type-level: `v.layout = {}` and `v.layout.rect = r` in a `// @ts-expect-error` fixture | Both are compile errors; the fixture compiles **only** because the errors are expected | FR-5, AR-1 |
| ST-8 | Type-level, for a subclass declaring `override readonly layout` (e.g. `Window`) | `w.layout.rect = r` is a compile error — the hatch is shut | AR-3 |
| ST-9 | `applyMove` on a window via the gesture path | Rect updates **and** exactly one reflow is requested. The *"no separate `invalidateLayout()` in the source"* half is a **source** assertion, not a runtime one — express it as a scoped grep over `desktop/gestures.ts`, or drop it and rely on the reflow count | FR-7, AR-4 |
| ST-10 | Each converted canvas **that has a headless witness**, rendered 80×24 before and after | Cell-exact diff (glyph + fg/bg + attrs + width): byte-identical, or a recorded and accepted delta. Witness-less canvases (`inspector-panel`, and `playground`/`controls-live` unless a harness is built) get a recorded review verdict instead | FR-11, AR-9 |
| ST-11 | For each file importing a DSL builder, grep for a local binding of a name **it imports** | Zero shadows. Unqualified, this can never pass: the DSL exports 15 names and harmless local `row`/`col`/`at`/`center`/`stack`/`place` bindings exist in `core/src/engine/render/buffer.ts:187`, `datagrid/src/row-mutations.ts:113`, `tree/tree.ts:203`, `desktop/arrange.ts:16`, `dialog/dialog.ts:104` and more | FR-10, AC-7 |
| ST-12 | `yarn verify` after the flip | `jsdoc-examples.spec.test.ts` green (the 3 rewritten `@example` blocks + the re-verified `Desktop` allowlist entry) and `check-plugin` green (regenerated API-ref snapshot) | FR-13, AC-9 |

> ST-7 and ST-8 are **type-level** cases. They must be written so that the fixture compiles only
> because the error is expected — a `@ts-expect-error` that stops being an error is itself a
> failure, which is exactly the ratchet wanted here. Without them, a future edit could drop
> `readonly` from the base or a subclass and every runtime test would stay green, because
> `readonly` is erased at runtime. **This is the single most important pair in this document.**
>
> **Author them immediately before the flip, not at the head of Phase 2.** An *unused*
> `@ts-expect-error` is `TS2578` — a hard compile error, not a failing assertion — and
> `turbo.json` makes `test` depend on `build`, so a red `ui` typecheck aborts the whole verify run.
> Authored nine tasks early, they would leave all ~810 conversions landing with `yarn verify` dark:
> exactly the condition AR-7 rejected option (b) for, re-created through the spec task instead of
> the field. Spec-first is preserved by keeping author → red → flip → green inside one task
> boundary. ST-6 has the same shape at runtime and moves with them.

## Implementation tests

| File | Covers |
|---|---|
| `packages/ui/test/view-setlayout.impl.test.ts` (extend **and correct**) | `Object.assign` backing: identity, shallow-merge of the `size` union, reflow count. ST-I1's identity assertion is inverted and ST-I4 deleted — they pin the replace contract this plan supersedes |
| Per-package existing suites | Behaviour preservation across all ~810 conversions — no new per-site tests |

## Non-goals

- No new test per converted site. `tsc` proves the conversion compiles; the existing suite proves
  behaviour. ~810 bespoke tests would be noise.
- No committed render baselines (AR-9 rejected promoting them) — the control is a working step,
  reviewed per canvas.

## Verify

`yarn verify` at every phase boundary (AR-12). The prime directive applies separately: `yarn
lint:fix` before any PR-bound push, with its changes committed.
