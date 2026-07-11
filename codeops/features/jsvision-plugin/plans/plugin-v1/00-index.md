# jsvision-plugin Implementation Plan

> **Feature**: A Claude Code plugin whose skills make Claude an expert jsvision TUI application developer — able to scaffold, build, run, verify, and extend jsvision apps at an expert level.
> **Status**: Planning Complete
> **Created**: 2026-07-11
> **CodeOps Skills Version**: 3.3.2

## Overview

jsvision is a rich, complete terminal-UI SDK (`@jsvision/ui` — a single-import widget framework
over `@jsvision/core`, plus `@jsvision/web` for the browser and `@jsvision/files` for file
dialogs). Its developer-facing on-ramp, however, is thin: the "build your first app" guide is a
placeholder, and the real expertise lives in code (the `tvision-demo`, the kitchen-sink stories,
the docs-site `defineExample` modules, and `@example`-enforced JSDoc). The gap between "knows the
API" and "builds working apps" is a set of ~12 concrete footguns and a run/verify discipline.

This feature packages that expertise as a **Claude Code plugin** (`tools/claude-plugin/`, id
`jsvision-plugin`). It bundles: a knowledge skill (`jsvision`) with progressive-disclosure
reference files; a deterministic scaffolder skill (`jsvision-new-app`) that emits a complete,
runnable app package; four verified recipe apps spanning the app spectrum (data-driven, forms,
file tools, live/dashboard); and a widget-authoring path for extending the framework. Every recipe
is a **real, smoke-tested module** in `packages/examples/` that the plugin's docs quote, so the
taught code can never silently drift from the SDK.

The plugin is designed for use **inside this monorepo** (apps are built as `packages/<app>/`, where
`@jsvision/ui` resolves via yarn workspaces), and its knowledge is written publish-agnostic so a
future move to standalone/published apps is a one-spot scaffolder change (AR-2, AR-15).

## Document Index

| #   | Document                                             | Description                                 |
| --- | ---------------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate decisions (audit trail) |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)                   | Feature requirements and scope              |
| 02  | [Current State](02-current-state.md)                 | Analysis of the SDK + existing assets       |
| 03-01 | [Plugin Package](03-01-plugin-package.md)          | Manifest, structure, distribution, install  |
| 03-02 | [Knowledge Base](03-02-knowledge-base.md)          | The `jsvision` skill + reference files       |
| 03-03 | [Recipes & Examples](03-03-recipes-and-examples.md)| The 4 recipe apps + example custom widget    |
| 03-04 | [Scaffolder](03-04-scaffolder.md)                  | `jsvision-new-app` skill + generator script  |
| 07  | [Testing Strategy](07-testing-strategy.md)           | Spec test cases and verification            |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases and task checklist                   |

## Quick Reference

### Usage Examples (what the finished plugin enables)

```bash
# Load the plugin locally while developing it
claude --plugin-dir tools/claude-plugin

# Scaffold a new runnable app (manual skill) — creates packages/expense-tracker/
/jsvision-new-app expense-tracker
```

```text
# Then, with the `jsvision` skill active, a prompt like:
"Build a TUI app that browses a list of servers and shows details for the selected one."
# → Claude reaches for the master-detail recipe, wires reactive signals, avoids the 12 gotchas,
#   runs it headless, and confirms the smoke test is green.
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Plugin scope | Build apps **and** author widgets | AR-3 |
| Where apps live | `packages/<app>/` in this monorepo (publish-agnostic) | AR-2 |
| Recipe archetypes | All four (data-driven · forms · files · live) | AR-4 |
| Recipe code home | Real modules in `packages/examples/`, quoted by recipe docs | AR-5 |
| Scaffolder mechanism | Deterministic Node script wrapped by a manual skill | AR-8 |
| Verification | `scripts/check-plugin.mjs` invoked directly by `yarn verify` | AR-10, AR-11 |
| Plugin source | `tools/claude-plugin/` | AR-13 |
| Subagent | Deferred to a later version | AR-6 |

## Related Files

**Created:** `tools/claude-plugin/**` (plugin manifest, `jsvision` + `jsvision-new-app` skills,
references, templates), `marketplace.json` (repo root), `scripts/check-plugin.mjs`,
`packages/examples/recipes/**` (recipe apps + example widget) with tests under
`packages/examples/test/`.

**Modified:** root `package.json` (`verify` script gains the check-plugin step, AR-10); the
portfolio roadmap `codeops/00-roadmap.md` and the new feature roadmap
`codeops/features/jsvision-plugin/00-roadmap.md`.
