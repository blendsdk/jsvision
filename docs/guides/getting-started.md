# Getting started

> **Last Updated**: 2026-08-03

## Current status

The Kanban package is fully specified but not implemented. Do not add `@jsvision/kanban` to consumer
code yet. The requirement set, roadmap, and ADRs are inputs to preflight and implementation planning.

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

| Task                         | Command                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| Changed-file gate            | `yarn verify:local`                                          |
| Kanban package typecheck     | `yarn workspace @jsvision/kanban typecheck` once implemented |
| Kanban package tests         | `yarn workspace @jsvision/kanban test` once implemented      |
| Plugin synchronization check | `yarn plugin:check`                                          |
| Product docs build           | `yarn docs:build`                                            |
| Architecture docs build      | `yarn techdocs:build`                                        |

CI owns the authoritative full `yarn verify` gate. Local development adds only the smallest relevant
package or docs checks to `yarn verify:local`.

## Next steps

1. Preflight the Kanban requirements.
2. Create a specification-first implementation plan for the foundation RDs.
3. Read the [system overview](/architecture/system-overview) and [decision log](/decisions/) before
   choosing public types or source boundaries.
