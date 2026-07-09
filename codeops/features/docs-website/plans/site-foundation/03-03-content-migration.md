# 03-03 · Content Migration (absorb `docs/`)

> **Document**: 03-03-content-migration.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-01 Must-Have 7 (absorb existing `docs/` techdocs)
> **CodeOps Skills Version**: 3.3.2

## What moves, what stays (AR-2)

**Move** (pure website content) into `packages/docs-site/`:

| From | To (in `packages/docs-site/`) | Site section |
|------|-------------------------------|--------------|
| `docs/architecture/*.md` | `reference/architecture/*.md` | Reference → Architecture |
| `docs/decisions/*.md` (index + ADR-001…009) | `reference/decisions/*.md` | Reference → Decisions (ADRs) |
| `docs/guides/*.md` | `reference/guides/*.md` (or `guide/` — see below) | Reference/Guide |
| `docs/index.md` | folded into the site (its `techdocs:true` intro → the Architecture landing) | Reference → Architecture |
| `docs/.vitepress/config.ts` | superseded by the new `packages/docs-site/.vitepress/config.ts` (nav/sidebar merged) | — |

**Stays put** (load-bearing, AR-2): `docs/acceptance-gate.md` — the oracle for
`packages/core/test/gate.spec.test.ts` + `scripts/gate.mjs`; README/CLAUDE links unchanged. Optionally
surfaced in the new site via an external/relative link, but the **file does not move**.

> After the move, `docs/` retains only `acceptance-gate.md` (plus whatever tooling references). Do
> **not** delete the `docs/` directory.

## Redirect / mapping table

A checked-in `packages/docs-site/redirects.md` (or a small `_redirects`/meta-refresh data file) maps
each old path to its new route, e.g. `/architecture/system-overview` → `/reference/architecture/system-overview`.
Purpose: (a) an auditable "no page lost" record (ST-11), (b) resolve any external deep links. Since
the old `docs/` was never deployed, hard redirect infrastructure is optional; the mapping table is
the required artifact.

## Reference integrity (must not break)

- `docs/acceptance-gate.md` untouched → `packages/core/test/gate.spec.test.ts` still passes (ST-12).
- `scripts/gate.mjs`, README L15/L395, CLAUDE.md L46 still resolve (they point at
  `docs/acceptance-gate.md`, which stays).
- The only stale reference to a **moved** file is in `JSDOC-CLEANUP-PLAN.md` (ephemeral planning doc,
  `docs/guides/development.md`) — updated or noted, non-blocking.

## Sidebar wiring

The new `.vitepress/config.ts` Reference sidebar lists the migrated Architecture / Decisions / Guides
pages (replacing the old standalone `docs/.vitepress` nav). ADR frontmatter/titles are preserved
verbatim (content is not rewritten in RD-01 — RD-08 expands it).

## Ordering

This is the **last** phase (Phase 5) so the site shell, deploy, IA, and SEO are all proven before
content moves — a broken move is then isolated and obvious, and `yarn verify` (shipped packages) is
run to confirm the spec oracle is intact.
