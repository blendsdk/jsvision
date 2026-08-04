# Development workflow

> **Last Updated**: 2026-08-04

## Branch and package conventions

`develop` is the integration branch and `master` is the remote default branch. Work is performed on
feature branches using Conventional Commits. Public SDK packages live under `packages/`, use ESM
TypeScript, target Node.js 22+, and expose only supported package entry points.

The Kanban implementation lives in `packages/kanban/`. Its package shell, authority contracts, and
revisioned eager/windowed source layer are implemented. Later presentation, locale, dialog, and docs
work follows the Data Grid and Code Editor precedents while retaining Kanban's own public contracts.

## Specification-first sequence

1. Derive immutable `*.spec.test.ts` behavior from the approved requirement acceptance criteria.
2. Run focused tests and observe the expected red state.
3. Implement only the behavior needed for the current phase.
4. Make specification tests green, then add `*.impl.test.ts` coverage for internal boundaries.
5. Run package typecheck/tests, `yarn verify:local`, and `yarn plugin:check`.
6. Update architecture docs incrementally when implementation introduces or challenges a decision.

## Architecture guardrails

| Concern       | Required pattern                                                | Consequence of bypassing it                                   |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| Layout        | Public DSL for ordinary composition; one measured viewport leaf | Bespoke geometry becomes brittle and unresponsive             |
| Records       | Application-owned `TCard` plus bounded adapters                 | Component storage couples UI to one domain                    |
| Reads         | Revisioned session and sparse cursors                           | Large boards require full materialization or show false edges |
| Writes        | One discriminated dispatcher                                    | Mouse, keyboard, dialogs, and history diverge                 |
| Authorization | Application rechecks every request                              | UI capabilities can be mistaken for security                  |
| Rendering     | Stable-key windowing and descriptors                            | A view per logical card cannot meet scale targets             |
| Accessibility | Keyboard parity and non-color cues from the first phase         | Late retrofits break interaction contracts                    |

## Documentation and example workflow

Kanban consumer documentation belongs in `packages/docs-site/` and must follow the project’s
`component-page-template1` and `template1` directives. Each live lab is a complete `demoApp` hosted
inside a responsive `Template1Dialog`, registered as `kind: 'app'`, and tested at the standard 80×24
viewport plus resize/maximize/restore states.

The package also requires:

- a Kanban-specific kitchen sink;
- a polished standalone showcase suitable for public demonstration;
- locale/theme/color-depth/ASCII and pointer/keyboard interaction labs;
- plugin source-impact review followed by `yarn plugin:update` when mapped; and
- `yarn plugin:check` before completion.

## Design-intent preservation

Accepted ADRs are the architectural source of intent. If implementation differs, do not edit the
architecture description to normalize the divergence. Either fix the code, document a justified
exception, or obtain approval for a new ADR that supersedes the old decision.
