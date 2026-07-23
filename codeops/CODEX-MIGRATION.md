# Claude CodeOps to Codex CodeOps migration

> **Migrated:** 2026-07-23
> **Codex CodeOps:** 0.2.0-beta.4
> **Artifact schema:** 1

## Scope

This migration preserves jsvision's existing nested CodeOps layout and all
user-authored requirements, decisions, plans, progress marks, roadmaps, and
archives. It changes the active guidance and artifact control plane:

- `AGENTS.md` is the canonical project instruction file;
- `CLAUDE.md` is a compatibility entry point;
- `codeops/codeops.json` owns strict mode, review, capability routing, and local
  metrics policy;
- active Markdown artifacts carry schema-1 stamps while retaining their Claude
  CodeOps producer version; and
- every active feature has a schema-1 `traceability.json`.

`codeops/_archive` is intentionally untouched. Codex CodeOps 0.2.0-beta.4
excludes archived graphs and plans from live readiness and task counts.

## Translation decisions

- Claude model names and executor names were removed. Routing is based on risk,
  capability, effort, and independent review.
- Legacy telemetry was not copied. Codex outcome metrics are content-free,
  local, and disabled until explicitly enabled.
- The marker's `integrationBranch: develop` was preserved because changing the
  integration branch is a product decision, not a format migration.
- Active references to the canonical agent guide now name `AGENTS.md`. Archived
  references remain historical.
- Underscored Claude skill names were translated to Codex hyphenated skill names
  in active artifacts.

## Traceability granularity

The initial graph maps each active RD and its acceptance-criteria section,
every ambiguity-register row, and each active plan at plan-level specification,
test strategy, execution, implementation, and verification granularity. Existing
task checkboxes remain authoritative and byte-preserved. A future active plan
run may expand plan-level task nodes into individual task nodes when that detail
is operationally useful.

Statuses were derived without lifecycle advancement:

- `RD Drafted` remains `draft` and blocks readiness;
- planned, preflighted, executing, or completed RDs are `approved`;
- a plan with unchecked tasks is `pending`;
- a plan with `[~]` work is `implemented` but not verified; and
- a plan with all tasks checked is `verified` with passing verification evidence.

## Expected readiness after migration

Structural validation passes. Global execution readiness remains closed because
the following work was already draft or incomplete before migration:

- bun-runtime RD-01;
- create-jsvision RD-01 through RD-08;
- docs-website RD-04, RD-05, and RD-07 through RD-10;
- three outstanding site-foundation deployment checks; and
- one implemented-but-unverified live-example-remediation browser check.

Those gates must be resolved through normal CodeOps review; the migration does
not approve them silently.

## Verification

```bash
python3 ~/.codex/plugins/cache/codeops-marketplace/codeops/0.2.0-beta.4/scripts/codeops_state.py validate --root .
python3 ~/.codex/plugins/cache/codeops-marketplace/codeops/0.2.0-beta.4/scripts/codeops_state.py readiness --root .
CI=1 yarn verify
yarn workspace @jsvision/ui vitest run --project unit test/editor-perf.spec.test.ts
```

The isolated performance oracle enforces its 35 ms budget. The full non-CI
parallel monorepo run can contend for CPU and remains informational for that
oracle, matching the repository's established CI behavior.
