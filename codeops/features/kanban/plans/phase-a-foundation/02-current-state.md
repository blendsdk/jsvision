# Current state: Kanban Phase A Foundation

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Observed**: 2026-08-03
> **CodeOps Artifact Schema**: 1

## Repository baseline

There is no `packages/kanban/` directory or `@jsvision/kanban` workspace today. The root already uses
`packages/*`, so adding the directory automatically joins the Yarn workspace and Turborepo graph. The
repository is a Node 22+, ESM TypeScript monorepo whose specialist-package precedents are Data Grid and
Code Editor.

| Concern | Grounded precedent | Phase A implication |
|---|---|---|
| Package metadata | `packages/datagrid/package.json`, `packages/code-editor/package.json` | Copy publish metadata/script conventions; add main/testing/locale exports; defer Zod peer to RD-10 |
| TypeScript | Specialist `tsconfig.json`, `tsconfig.typecheck.json` | Use NodeNext-compatible build/typecheck and public declarations |
| Tests | Package Vitest unit/E2E projects | Create specification and implementation suites by concern |
| Component shell | `packages/ui/src/view/group.ts`, `packages/ui/src/view/dsl/flex.ts` | `KanbanBoard` extends `Group` and composes ordinary bands through `row`/`col`/`grow`/`fixed` |
| Scrolling | `packages/ui/src/scroll/scroller.ts` | Reuse framework scrolling/event conventions, but keep virtualized two-axis metrics in the viewport leaf |
| Drawing safety | `packages/ui/src/view/draw-context.ts`, `packages/core/src/engine/safety/sanitize.ts` | Paint through clipped/sanitizing APIs and measure sanitized terminal cells |
| Reactivity | Existing `View.bind` and reactive getter conventions | Public source/session values use getter methods; cached descriptors own bounded reactive scopes |
| Theme locality | Code Editor and Data Grid package-local theme modules | Publish `KanbanTheme`/roles without expanding Core theme names |

## Missing package surface

Phase A must create all of the following from zero:

- package manifest, license, README, changelog, TypeScript and Vitest configuration;
- public and testing barrels plus ten locale modules;
- IDs, revisions, limits, errors, observations, semantic query values, source/session/cursor contracts;
- eager source, deterministic testing sources, cards/descriptors/theme/renderer contracts;
- width/vertical projection solvers, board state coordinator, viewport, and board shell; and
- package-local specification, implementation, E2E, packaging, and documentation checks.

No migration or backward-compatible runtime adapter is required because no prior public Kanban API
exists. Compatibility risk instead comes from freezing the first public SDK surface too narrowly.

## Explicit integration points

The repository does not discover every package dynamically. Implementation must update the applicable
registries instead of assuming `packages/*` is sufficient.

| Registry/check | Current behavior | Required Phase A change |
|---|---|---|
| `tools/i18n-locale-exports.json` | Enumerates official localized packages and symbol prefixes | Add Kanban; generate ten locale entry points |
| `tools/i18n-translation-reviews.json` | Stores one approved digest-bound record per non-English official catalog | Add nine reviews for the complete Phase A vocabulary |
| `scripts/check-i18n-reviews.mjs` | Rejects missing, duplicate, unapproved, stale, and unexpected reviews | Keep invariant unchanged; do not add a provisional exemption |
| `scripts/gen-plugin-api.mjs` | Uses an explicit public package/category inventory | Add Kanban API generation/category/routing |
| `tools/jsvision-plugin-impact.json` | Maps source changes to canonical skill references | Map Kanban sources and review every reported reference |
| `packages/docs-site/src/api/packages.mjs` | Lists packages included in generated API docs | Add `@jsvision/kanban` |
| `packages/docs-site/scripts/gen-api.mjs` | Has explicit auxiliary locale package handling | Add Kanban locale entry points |
| Install/package inventory specifications | Assert the supported package set | Add Kanban without prematurely introducing RD-10's Zod peer |
| `scripts/check-performance.mjs` | Owns explicit controlled benchmark registration | Defer Kanban wall-clock registration to Phase E; use deterministic read/allocation bounds now |

Adding Kanban to the official i18n registry without review evidence would make the accepted local gate
fail. PAR-24 therefore requires current reviews in the same Phase A integration change.

## Existing capabilities to reuse

- Core already supplies terminal sanitization, display-cell width behavior, capability profiles,
  colors, theme resolution helpers, signals, and safe drawing primitives.
- UI already supplies `View`, `Group`, layout DSL, focus/event plumbing, clipping, surfaces, and
  scrolling conventions.
- i18n already supplies catalog composition and fallback behavior.
- Forms consumes caller-provided Zod object schemas but does not expose a reusable generic schema
  adapter. Phase A therefore keeps any runtime standard-card validator Kanban-owned and Forms-compatible;
  `@jsvision/forms` is added only when later editor/dialog code imports its public APIs.
- Package scripts already exist for native dependency scans, JSDoc checks, locale generation/checks,
  API generation, plugin synchronization, and changed-file verification.

## Constraints and risks

| Risk | Consequence | Plan response |
|---|---|---|
| Public API overfit to eager arrays | Later windowed sources require a breaking rewrite | Make session/cursor contracts authoritative; eager is one adapter |
| Query retains mutable caller objects | Stale cache/session semantics and unsafe prototypes | Validate, copy, sort, and deep-freeze bounded semantic JSON |
| View per card | 100,000-card source exhausts memory/work | One viewport leaf and bounded descriptor projection |
| Width apportionment jumps during resize | Visually unstable columns and anchors | Monotone tiered progressive waterfill |
| Cursor or reactive-scope leak | Late publication and retained sensitive card data | Generation ownership, explicit retention classes, strict disposal order |
| Descriptor cache is under-keyed | Stale titles/status/styles | Require source/presentation revisions and key every semantic input |
| Docs/plugin drift | Published SDK exists but agents/API docs cannot discover it | Update canonical inventories and generated plugin in the same phase |
| Partial-RD overclaim | Roadmap falsely closes future work | Use plan-local card/column slice nodes; keep RD-04/RD-05 preflighted |

## Worktree care

Planning began with unrelated/pre-existing repository changes and Kanban requirements/docs artifacts.
Execution must baseline the tree, preserve unrelated edits, and restrict each phase to its declared
modification set. No plan task authorizes a commit, push, destructive reset, or broad cleanup.
