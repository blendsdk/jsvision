# Requirements: API Reference (TypeDoc)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-06](../../requirements/RD-06-api-reference.md) — the OWNING requirements doc

## Scope of this plan (delta view)

RD-06 is the owning requirements doc; this plan implements it in full. The delta is the plan-local
decisions the RD left open (AR-4…AR-17) — resolved in [00-ambiguity-register.md](00-ambiguity-register.md).

### In this plan

- **All five Must-Haves** — TypeDoc + markdown plugin scoped to public entries (RD-06 §Must); output
  into the routed `api/` dir; a deterministic `yarn docs:api` run before the VitePress build; per-symbol
  signature/params/return/description/`@example`; **bidirectional** component↔reference cross-linking
  (AR-4).
- **All three Should-Haves** — group by package + kind (AR-12); GitHub source links (AR-11); a
  hand-written "how to read this" preface (AR-13).
- **Security/technical requirements** — public-surface-only scope (no internal leakage); TypeDoc/plugins
  are docs-site devDeps only (`check:deps` unaffected); determinism (AR-9).

### Deferred / out of this plan

- Multi-version API docs — RD-06 §Won't (AR-3 / RD-06 AR-18).
- Hand-written narrative/component docs — RD-05 owns them; this plan only adds forward links into
  existing component pages and back-links into generated pages.
- Documenting non-public internals — deliberately excluded (public surface = the barrel).

## Plan-local decisions

Only decisions **not** already fixed by RD-06 (full detail + rationale in the register):

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Cross-linking depth | Bidirectional via a symbol↔page map (forward link + injected back-link) | AR-4 |
| Generated output lifecycle | Gitignored; regenerated before every build | AR-5 |
| Package coverage | All four; ui/files/web badged pre-release | AR-6 |
| Plugin stack | `typedoc-plugin-markdown` + `typedoc-vitepress-theme` | AR-7 |
| Config & entry source | One `typedoc.json`; TS-source entry points | AR-8 |
| Determinism | Byte-identical output; commit-pinned source links | AR-9 |
| Path scheme / subpaths | `/api/<pkg>/`; exclude `web/browser-stubs` | AR-10 |
| Script wiring | `docs:api` + root `docs:build` chain | AR-14 |
| Gate placement | Pure helpers in vitest; e2e in `check-docs-build.mjs` | AR-15 |
| Verify command | `yarn verify` + the API gate chain | AR-16 |

## Acceptance Criteria

The RD owns the seven acceptance criteria (RD-06 §Acceptance 1–7). This plan's ST cases in
[07-testing-strategy.md](07-testing-strategy.md) are the concrete oracles for them:

- RD-06 AC-1 (coverage: every barrel export present, no non-export) ↔ ST-3, ST-4.
  - **Reading of AC-1's "`src/index.ts`" (AR-21):** taken as "each package's **public entry point**".
    `@jsvision/core` has no `src/index.ts` — its public entry is `src/engine/index.ts` (AR-8) — so the
    ST-3/ST-4 oracle compares against the public entry, not a literal `src/index.ts`.
- RD-06 AC-2 (renders inside the VitePress site, in local search) ↔ ST-8, ST-9.
- RD-06 AC-3 (a representative symbol shows signature/params/return/description/`@example`) ↔ ST-5.
- RD-06 AC-4 (byte-identical on re-run) ↔ ST-6.
- RD-06 AC-5 (CI runs `docs:api` before build; a component "API" link resolves) ↔ ST-10, ST-11, ST-12.
- RD-06 AC-6 (`check:deps` still passes) ↔ ST-13.
- RD-06 AC-7 (no symbol outside the public surface — leakage check) ↔ ST-4.
