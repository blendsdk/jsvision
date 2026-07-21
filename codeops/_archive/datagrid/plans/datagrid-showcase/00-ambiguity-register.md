# Ambiguity Register: DataGrid Showcase App (plan)

> **Status**: ✅ GATE PASSED — all 9 plan-level items resolved
> **Plan**: datagrid-showcase (implements datagrid/RD-15)
> **Created**: 2026-07-15
> **CodeOps Skills Version**: 3.7.0

This register holds the **plan-level** decisions (execution structure, file layout, tooling). The
**product-level** decisions are already resolved in the RD register — `requirements/00-ambiguity-register.md`
AR #33–#41 (location, scope, shell strategy, placeholder style, demo inventory, naming, test tiers,
"shine" bar) — and in the preflight report `requirements/00-preflight-report.md` Iteration 3
(PF-020…PF-023). Those are referenced, not re-litigated.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Ordering / Sequencing | How to phase the execution plan | Thin-slice-first (7 phases) · cluster-sequential (8) · **big-bang content** (fewest phases) | Big-bang content — the fewest phases: Phase 1 infra + shell + spec oracle + placeholders + a seed demo (green); Phase 2 all 38 demos + push-down source + gate reconciliation + full verify | ✅ Resolved |
| 2 | Tooling / Quality | Is the showcase typechecked? | Add `datagrid-showcase` to `packages/examples/tsconfig.json` `include` · follow the kitchen-sink tsx-only precedent (not typechecked) | Add it to the typecheck include — `tsc --noEmit` covers every demo (catches the known createTheme/RenderRoot-style demo mismatches); datagrid builds first via turbo `^build` | ✅ Resolved |
| 3 | File structure | Granularity of the story files | One file per demo (cluster subdirs) · one file per cluster (grouped stories) | One `*.story.ts` per demo under `stories/<cluster>/`, matching the kitchen-sink "one story = one file" contract and the RD layout | ✅ Resolved |
| 4 | Tooling | The verify command every task runs | Detected `yarn verify` (CLAUDE.md) — lint + turbo `typecheck build test check:docs` | `yarn verify` — the project-established gate used by RD-01…RD-06; per-file loop `yarn workspace @jsvision/examples vitest run --project unit <file>` | ✅ Resolved |
| 5 | File structure | Where the shared demo data + the bespoke push-down source live | A `stories/lib/` module (typed demo rows + a spy `GridDataSource` implementing `setSort`/`setFilter`) · inline per demo | A `stories/lib/` module — one shared demo-data file + one `spy-source.ts` (in-memory `GridDataSource` exposing the optional push-down seams), reused by the Sorting §5.5 and Filtering §6.6 demos (PF-020) | ✅ Resolved |
| 6 | Testing | Which vitest project + file kind the two test tiers use | `*.spec.test.ts` under the examples `unit` project (headless, no TTY) · e2e project | `*.spec.test.ts` under the `unit` project — `examples` `test` = `vitest run --project unit`; both the smoke registry-oracle and the shell walkthrough run headless there | ✅ Resolved |
| 7 | Architecture | Shell provenance | Dedicated copy of the kitchen-sink shell, focused for datagrid | Dedicated copy — inherited from RD AR #35 (isolated; zero risk to the general kitchen-sink); the copy surface is `@jsvision/ui` + `window.ts`/`story.ts`/`stories/index.ts` | ✅ Resolved (ref RD AR #35) |
| 8 | Ordering / Risk | De-risking the big-bang: is a real grid mounted before Phase 2? | Placeholders-only Phase 1 · include one Foundation seed demo in Phase 1 | Include one Foundation seed demo (read-only render) in Phase 1 so a real `EditableDataGrid` is proven to mount in the shell before the 38-demo bang | ✅ Resolved |
| 9 | Convention | Reconciling the NON-NEGOTIABLE kitchen-sink-gate | Explicit Phase-2 task editing `codeops/kitchen-sink-gate.md` + retain the ui `DataGrid` story | Explicit task — inherited from PF-022; route datagrid stories to this app, keep `kitchen-sink/stories/data-grid.story.ts` (ui read-only grid, a different component) | ✅ Resolved (ref PF-022) |

## Resolution Notes

**AR #1–#3, #8:** Resolved 2026-07-15 via three AskUserQuestion forks (phasing / typecheck / file
layout) plus the de-risk decision. The user chose **big-bang content** — the fewest phases — knowing
the trade-off (a large surface at the final verify); AR #8 mitigates it with a Phase-1 seed demo that
proves a real grid mounts before the 38-demo bang.

**AR #4:** `yarn verify` detected from CLAUDE.md and confirmed by convention (every prior datagrid
exec_plan used it). The single-file loop for fast iteration is
`yarn workspace @jsvision/examples vitest run --project unit <file>`.

**AR #5–#7, #9:** Grounded plan-structure decisions. AR #5/#9 implement the preflight notes (PF-020
bespoke push-down source; PF-022 gate reconciliation). AR #6 is grounded in `examples`'s
`test: vitest run --project unit`. AR #7 inherits RD AR #35.

## Preflight amendments (Iteration 1 — 2026-07-15)

Plan preflight (codebase-grounded) ran 2026-07-15 and PASSED — 1 MAJOR + 2 minor + 2 observation, all
resolved (see [`00-preflight-report.md`](00-preflight-report.md)). The MAJOR reshaped the walkthrough
tier: the copied shell exposes only `{ app, run }` with a private `showStory` and a TTY-asserting
`run()`, and the cited `runWalkthrough` is a pure-model render precedent, not a shell-navigation one.
Resolution (PF-001, Option B): the dedicated shell returns `{ app, run, disposedCount }`; the walkthrough
drives the **real** command path via `app.loop.emitCommand(story.id)` (never `run()`) and asserts on the
render-root buffer, with `disposedCount()` proving the dispose-previous lifecycle (ST-9). Minors: entry
count 47→46 (PF-002), roadmap task count 24→22 (PF-003); observations: `data-grid.story.ts` path (PF-004),
story-id `<dir-slug>` convention (PF-005).
