# Redirects / migration map

When the repository-root `docs/` techdocs were absorbed into this site, every website page moved under
`/reference/`. This table is the auditable "no page lost" record and the source for resolving any
external deep links. (The old `docs/` set was never deployed, so no live redirect rules are required —
this mapping is the required artifact.)

The load-bearing `docs/acceptance-gate.md` did **not** move; it stays at the repository root because it
is the oracle for the core acceptance-gate spec test.

| Old path (repo-root `docs/`)                    | New site route                                            |
| ----------------------------------------------- | --------------------------------------------------------- |
| `/index` (Technical Architecture landing)       | `/reference/architecture/`                                |
| `/architecture/system-overview`                 | `/reference/architecture/system-overview`                 |
| `/architecture/api-design`                      | `/reference/architecture/api-design`                      |
| `/architecture/security`                        | `/reference/architecture/security`                        |
| `/decisions/` (Decision Log)                    | `/reference/decisions/`                                   |
| `/decisions/ADR-001-esm-zero-dependency`        | `/reference/decisions/ADR-001-esm-zero-dependency`        |
| `/decisions/ADR-002-capability-auto-config`     | `/reference/decisions/ADR-002-capability-auto-config`     |
| `/decisions/ADR-003-pure-core-injectable-seams` | `/reference/decisions/ADR-003-pure-core-injectable-seams` |
| `/decisions/ADR-004-no-node-pty`                | `/reference/decisions/ADR-004-no-node-pty`                |
| `/decisions/ADR-005-sanitize-boundary`          | `/reference/decisions/ADR-005-sanitize-boundary`          |
| `/decisions/ADR-006-informational-perf-bench`   | `/reference/decisions/ADR-006-informational-perf-bench`   |
| `/decisions/ADR-007-monorepo-restructure`       | `/reference/decisions/ADR-007-monorepo-restructure`       |
| `/decisions/ADR-008-layout-engine`              | `/reference/decisions/ADR-008-layout-engine`              |
| `/decisions/ADR-009-bun-runtime-support`        | `/reference/decisions/ADR-009-bun-runtime-support`        |
| `/guides/getting-started`                       | `/reference/guides/getting-started`                       |
| `/guides/development`                           | `/reference/guides/development`                           |
