# Getting started

> **Last Updated**: 2026-08-12

## Current status

The Kanban package implements its foundation through Phase C: read sources, configurable card
presentation, workflow/swimlane structure, canonical scene geometry, mounted interaction, semantic
requests, operation lifecycle, card and structural drag, ten reviewed locale entry points, deterministic
testing helpers, cross-host evidence, and a standalone showcase. Dialogs, command registration,
saved-view codecs, the consumer component course, and release readiness remain later phases.

## Prerequisites

| Tool    | Version                   | Purpose                                     |
| ------- | ------------------------- | ------------------------------------------- |
| Node.js | 22 or newer               | Repository scripts and TypeScript tooling   |
| Yarn    | 1.22.22                   | Workspace dependency and command management |
| Git     | Current supported version | Branch and worktree workflow                |

## Repository setup

```bash
git clone https://github.com/blendsdk/jsvision.git
cd jsvision
yarn install
yarn verify:local
```

No environment file, database, service, or credential is required for the SDK repository.

## Relevant structure

```text
packages/
  core/            terminal model and rendering primitives
  ui/              reactive controls, layout DSL, windows, and input
  forms/           schema-driven forms and validation
  i18n/            catalogs, locale resolution, and accelerators
  datagrid/        specialist-package precedent
  code-editor/     specialist-package precedent
  docs-site/       consumer documentation and browser-hosted live examples
  examples/        standalone and kitchen-sink applications
codeops/features/kanban/
  requirements/    approved Kanban requirements
  00-roadmap.md    feature lifecycle tracker
docs/
  architecture/    technical design intent
  decisions/       architecture decisions
```

## Verification commands

| Task                         | Command                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Changed-file gate            | `yarn verify:local`                                                            |
| Kanban package typecheck     | `yarn workspace @jsvision/kanban typecheck`                                    |
| Kanban package tests         | `yarn workspace @jsvision/kanban test`                                         |
| Kanban host E2E              | `yarn workspace @jsvision/kanban test:e2e`                                     |
| Examples build/typecheck     | `yarn workspace @jsvision/examples typecheck`                                  |
| Kanban showcase smoke        | `yarn workspace @jsvision/examples test -- kanban-showcase.smoke.spec.test.ts` |
| Plugin synchronization check | `yarn plugin:check`                                                            |
| Product docs build           | `yarn docs:build`                                                              |
| Architecture docs build      | `yarn techdocs:build`                                                          |

CI owns the authoritative full `yarn verify` gate. Local development adds only the smallest relevant
package or docs checks to `yarn verify:local`.

## Next steps

1. Read the [system overview](/architecture/system-overview) and [API design](/architecture/api-design)
   before extending public source contracts.
2. Run `yarn workspace @jsvision/examples demo:kanban` to inspect the current standalone showcase.
3. Add immutable specification coverage before implementing the next component layer.
4. Run the package gates above and preserve the application-authority boundaries in the
   [decision log](/decisions/).
