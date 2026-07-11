# Testing Strategy: API Reference (TypeDoc)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

The feature is a generation pipeline + site integration + a drift gate. Its testable core splits
two ways (AR-15): **pure helpers** get classic `.spec.test.ts` oracles in the docs-site vitest `unit`
project (run by `yarn verify`); the **end-to-end** guarantees (coverage, leakage, determinism,
link-resolution, search) are asserted by `check-docs-build.mjs` after `docs:build`. Both are
derived-from-AC oracles; neither is edited to match the implementation.

| Code type | Target |
| --------- | ------ |
| Pure helpers (barrel extraction, back-link injection, map validation) | 90% |
| Generation config / scripts (glue) | verified via the e2e gate, not unit % |
| Site integration (sidebar import, links) | e2e link-resolution |

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from RD-06 (§Acceptance / §Functional) and the plan's `03-*` specs + the
> Ambiguity Register. Immutable oracles — if the implementation disagrees, the implementation is wrong.
> When an ST becomes a test, its in-code traceability comment states the behavior in **plain
> language**, never an `ST-`/`AC`/`AR` id or a `codeops/` path (per the JSDoc/comment ban).

### Pure helpers (vitest `unit` — run in `yarn verify`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `barrelExports(fixture)` where the fixture barrel does `export { A, B }` and `export * from './sub'` (sub exports `C`) | Returns `['A','B','C']` (sorted, star-re-export followed) | 03-03 §helpers / AR-2 |
| ST-2 | `barrelExports(fixture)` where the fixture also declares a **non-exported** `internalHelper` and an `/** @internal */` export | Neither appears in the result (only public exports) | RD-06 §Tech (excludeInternal) / AR-2 |
| ST-7 | `injectBackLink(md, link)` on a generated page with frontmatter but no note | Returns md with `> **Documented in:** [<page>](<componentPage>)` inserted immediately after the frontmatter block; applying it again returns the string **unchanged** (idempotent) | 03-02 §back-links / AR-4 |
| ST-12 | `validateApiMap([...])` with a duplicate `symbol` and one `apiPath` not under `/api/` | Returns a non-empty violations list naming both; a well-formed map returns `[]` | 03-02 §map / AR-4 |

### End-to-end (asserted in `check-docs-build.mjs` — post-`docs:build`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-3 | After `yarn docs:api`, for each entry (`core`/`ui`/`files`/`web`) compare `barrelExports(entry)` to the generated pages | **Every** exported symbol has a generated page (coverage; zero missing) | RD-06 AC-1 |
| ST-4 | Same comparison, other direction | **No** generated page for a symbol not in `barrelExports(entry)` (no internal/private leakage) | RD-06 AC-7 |
| ST-5 | Read the generated page for `createApplication` (`@jsvision/ui`) | It contains the signature, each parameter, the return type, the JSDoc description, and the `@example` block | RD-06 AC-3 |
| ST-6 | Run `yarn docs:api` twice on the same checkout; diff `packages/docs-site/api/<pkg>/**` | Byte-identical across runs | RD-06 AC-4 |
| ST-8 | Open a built generated symbol page in `dist/` | It renders inside the VitePress shell (site theme/nav/sidebar), not as a standalone TypeDoc page | RD-06 AC-2 |
| ST-9 | Inspect the built local search index | Generated API pages are indexed (searchable) | RD-06 AC-2 |
| ST-10 | From a tree with **no** pre-generated `api/<pkg>/`, run `yarn docs:build` | The API pages exist in the output (proves `docs:build` chains `docs:api` before `vp:build`) | RD-06 AC-5 / AR-14 |
| ST-11 | For every `API_MAP` row, resolve `apiPath` in the built site; for every mapped component page, find its forward "API reference →" link | All `apiPath`s resolve; every mapped component page carries the link (no dead links) | RD-06 AC-5 / AR-4 |
| ST-13 | Run `yarn check:deps` after the pipeline lands | Green for every shipped package — TypeDoc/plugin/theme did not enter any runtime dependency graph | RD-06 AC-6 |

> **⚠️ AUTHORING RULE:** Expectations come from RD-06's acceptance criteria and the `03-*` specs, not
> from imagined TypeDoc output. `createApplication` (ST-5) is RD-06's own representative symbol.

## Test Categories

### Specification Tests (from ST-cases above)

| Test File / Location | ST Cases | Component |
| -------------------- | -------- | --------- |
| `test/api-barrel-exports.spec.test.ts` | ST-1, ST-2 | barrel extraction |
| `test/api-back-links.spec.test.ts` | ST-7 | back-link injector |
| `test/api-map.spec.test.ts` | ST-12 | map validation |
| `scripts/check-docs-build.mjs` (checks) | ST-3, ST-4, ST-5, ST-6, ST-8, ST-9, ST-10, ST-11 | e2e gate |
| CI/`check:deps` | ST-13 | dependency policy |

### Implementation Tests (edge cases, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `test/api-barrel-exports.impl.test.ts` | Re-export aliasing (`export { X as Y }`), type-only exports, empty barrel | Med |
| `test/api-back-links.impl.test.ts` | Missing frontmatter, CRLF, an already-noted page, non-ASCII page titles | Med |

### Fixtures Needed

- `test/fixtures/api/barrel/` — a tiny package-like tree: an entry with `export {…}` + `export *`, a
  sub-module, a non-exported symbol, and an `@internal` export (ST-1/ST-2).
- `test/fixtures/api/page.md` — a sample generated page with frontmatter (ST-7).

### Mock Requirements

None — real files/fixtures throughout. The e2e checks run against the real generated tree.

## Verification Checklist

- [ ] All ST cases have concrete input/output pairs (above).
- [ ] Every ST traces to an RD-06 AC or a `03-*`/AR entry.
- [ ] Pure-helper spec tests written and red BEFORE implementation.
- [ ] e2e checks written and failing (no generated tree yet) BEFORE the pipeline is wired.
- [ ] All spec tests green after implementation; no regressions in the existing 47 docs-site tests.
- [ ] `check:deps` green; determinism re-run clean.
