# 07 — Testing Strategy

> **Implements**: jsvision-forms/RD-05
> Spec-first: the smoke oracle is written and RED before the story exists; a red oracle after the
> story is written means the **story** is wrong (immutable oracle).

## Test inventory

| Test | Kind | File | Gates |
|------|------|------|-------|
| **ST-SS1** | Specification (immutable) | `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | AC-1, AC-8 |

One oracle, matching the sibling single-oracle pattern (ST-N1/AS1/LS1/DS1). No impl test — a story
encapsulates its form (no public seam to poke), and the reactive affordances (advisory-on-`<1024`,
the reflow toggle, the inspector) are exercised live in `demo:kitchen` and guarded **structurally**
by the always-painted hint literals + the toggle/inspector labels the oracle asserts (AR-PL6). The
two generic registry oracles already in the file (`the registry is non-empty…`, `story ids are
unique`) extend to the new story for free.

## ST-SS1 — the comprehensive showcase story is registered and paints its characteristic strings

Derived from AC-1 + AC-8 (the showcase contract), not the story internals.

- **Input**: `STORIES.find((s) => s.id === 'forms/showcase')`, then build + mount at 72×16 (the file's
  `WIDTH`/`HEIGHT`) via the established `createRoot` → `at(build(...))` → `createRenderRoot` →
  `mount` → reconstruct painted text harness.
- **Expected**:
  - the story is registered (`toBeTruthy`);
  - `story.category === 'Forms'`; `title` and `blurb` truthy;
  - `paintedCells > 0` (something drew);
  - painted text matches **`/showcase|inspector/i`** (the flagship's identity — the inspector caption
    or blurb), **`/right/i`** and **`/below/i`** (the error-layout toggle labels), and
    **`/privileged|<\s*1024/i`** (the advisory demonstration hint). These come from the
    **always-painted hint + static labels** (AR-PL8), so the assertion is deterministic regardless of
    live reactive state.

Expectation source = the showcase contract (a registered, metadata-complete story that renders its
distinctive affordances headlessly), never imagined implementation output.

## AC → oracle coverage map

| AC | Covered by |
|----|-----------|
| AC-1 (registered + metadata) | ST-SS1 + the two generic registry oracles |
| AC-2 (bound form, no glue) | Structural — the story compiles against the real binding API (`yarn typecheck` in verify); rendered live in `demo:kitchen` |
| AC-3 (state inspector) | ST-SS1 (inspector caption paints) + live demo |
| AC-4 (amber advisory `<1024`) | ST-SS1 (advisory hint literal) + live demo (reactive on the port value) |
| AC-5 (right/below toggle) | ST-SS1 (`/right/`+`/below/` labels) + live demo (the reflow) |
| AC-6 (async/load/dialog inline) | Structural (compiles against `asyncValidators`/`form.load`/`formDialog`) + live demo |
| AC-7 (submit gate) | Structural + live demo |
| AC-8 (headless degrade) | ST-SS1 mounts with **no `execView`** and still matches |
| AC-9 (verify green, zero-dep) | `yarn verify` (typecheck+build+test+check:docs+check:deps+check-plugin) |

## Verify

- **Command**: `yarn verify` (AR-PL6). Turbo `test dependsOn build` rebuilds `@jsvision/forms` first
  (examples import it by name → dist), so ST-SS1 sees the shipped barrel.
- **Red gate**: before the story exists, ST-SS1 fails on `find(... 'forms/showcase')` → `undefined`.
- **Green gate**: ST-SS1 + the full smoke suite + `yarn verify` all pass.
- **Guardrail check**: `check:deps` stays green (no native dep); confirm `packages/examples` gained no
  new dependency and `@jsvision/forms`/core/ui are untouched (AR-PL7) — a `git diff --stat` scoped to
  `packages/` should show only `packages/examples/kitchen-sink/**` + the smoke test.
