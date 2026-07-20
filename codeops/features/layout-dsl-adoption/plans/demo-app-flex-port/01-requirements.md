# Requirements: demo-app-flex-port

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md) — the OWNING requirements doc · [RD-02](../../requirements/RD-02-non-functional-and-verification.md) — verification
> **Re-scoped**: 2026-07-20 (preflight PF-001 → AR-15)

## Scope of this plan (delta view)

### In this plan

- **GH #114**, the reachable slice — the two exported shadow `at()` helpers plus the four remaining
  local placers / `row` text-helpers in `@jsvision/examples`. [AR-6, AR-13]
- **RD-01 FR-6** (Tier 3) applies as the sanctioning requirement: examples are didactic material, so
  they should model the recommended idiom rather than a hand-rolled copy of it.
- **RD-02** verification, adapted: behaviour-preservation proven by the audit table plus before/after
  buffer diffs rather than new permanent oracles. [AR-7]

### Deferred / out of this plan

- **GH #110 and GH #111 in full** — the five converted example demos, `drill-down.story.ts`, and the
  theme-designer panels + 3-pane workspace. **Already implemented in PR #127**
  (`feat/canvas-flex-adoption`, plan set `plans/canvas-flex-adoption/`), which **merged into
  `feat/dsl-adoptation` on 2026-07-20**.
  Dropped here rather than duplicated. [AR-15]
- **RD-01 FR-6 maximal** — the 411 `at()` call sites across 84 story files, and the deliberate
  absolute demo canvases (`containers`, `dropdowns`, `themes`, `color`, `date`, `tabs`, `playground`,
  `controls-live`, `status-bar.story`). A follow-up plan; each is a per-file design decision, and
  RD-01 AC-8 attaches a manual showcase quality pass to every converted story. [AR-1, AR-2]
- **`.layout.rect =` window placement** (~20 sites) — already RD-01 **FR-4** keep-absolute. [AR-3]
- **`@jsvision/docs-site`** — belongs to GH #112. [AR-5]
- **The five surviving local `at()` / `row` name shadows outside this plan's touched set** —
  `theme-designer/src/view/gallery.ts:32` and `.../inspector-panel.ts:55` (both `at(g, view, x, y, w, h)`,
  a different signature that also adds to the group), `examples/keyboard-mouse-playground/main.ts:126`
  (`row`), `examples/amiga-clock/analog-clock.ts:70` (`at`, a polar-plot helper), and
  `examples/kitchen-sink/stories/layout.story.ts:30` (`const row = new Group()` — a variable, not a
  helper). Retiring the theme-designer pair is a real conversion rather than a re-export, and that
  package's only headless vehicle does not render the inspector. All five are on the follow-up issue
  rather than silently ignored. [AR-16]

  *Count corrected at close-out:* the register originally said three. The acceptance grep surfaced
  `amiga-clock` and `layout.story` as well; both are genuine name shadows and were added. The same
  grep's other hits are false positives (a placement-*mode* selector, a `Placed[]` data array, several
  `const row = …` data variables, and `placeholders.ts` sharing a prefix) and are recorded as cleared
  on the issue so they are not re-flagged.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Retirement mechanism for the shadow `at()` | Audit first, then re-export the real builder from `story.ts` — 411 call sites unchanged | AR-6 |
| Unused `LayoutProps` type imports after the shadow bodies are deleted | Dropped | AR-11 |
| `tabs-demo`'s `placed()` | Converted, despite not literally shadowing a DSL name | AR-13 |
| #110 / #111 scope | Dropped — owned by PR #127 | AR-15 |
| Shadows outside the touched set | Deferred to the follow-up issue, explicitly named | AR-16 |
| Verify command | `yarn verify` | AR-8 |

## Acceptance Criteria

Plan-local only — RD-01 and RD-02 own their own criteria.

1. [ ] `packages/examples/kitchen-sink/story.ts` and `packages/examples/datagrid-showcase/story.ts`
       contain no local `at` **body**; both re-export the `@jsvision/ui` builder. All 411 call sites
       type-check unchanged under the one-shot `tsc --noEmit` sweep of task 1.5.1 — the package
       `tsconfig.json` does **not** include `kitchen-sink`, the demos, or `test/`, so the standing
       build is not by itself evidence for this. (AR-6)
2. [ ] The replace→merge audit table in [03-01](03-01-shadow-retirement.md) is filled in, every row
       carries a verdict, and any ⛔ row is either excluded with a stated reason or has its divergence
       neutralised before conversion. (AR-6)
3. [ ] `grep -rn "function place\|const place\|function placed\|function at\|const at = \|const row = " packages/examples --include=*.ts`
       returns no absolute-placement or field-row helper in a file this plan touches, and every
       remaining hit is one of the five deferred shadows named on the follow-up issue, or one of the
       false positives cleared there.
       (AR-6, AR-13, AR-16)
4. [ ] Each of the four touched demos (`wizard-demo`, `themes-demo`, `tabs-demo`, plus the
       kitchen-sink `wizard` story) has a recorded before/after full-screen serialization that is a
       **zero diff**. (AR-7)
5. [ ] Phase-1 evidence for the 411-site swap is: the audit table complete with every row ruled, the
       kitchen-sink shell and datagrid-showcase walkthrough screens zero-diff, and
       `kitchen-sink.smoke.spec.test.ts` green and unedited. A per-story buffer sweep is the optional
       stronger form. (AR-7)
6. [ ] Zero existing test files edited — `git diff --name-only` shows no `*.e2e.test.ts`,
       `*.smoke.spec.test.ts`, or `*.walkthrough.spec.test.ts` path. (AR-7)
7. [ ] A follow-up issue exists covering the FR-6 maximal and the five deferred shadows, and is
       referenced from the #114 close-out comment. (AR-1, AR-16)
8. [ ] `yarn verify` green; `yarn lint:fix` run before the PR-bound push. (AR-8, CLAUDE.md prime directive)
9. [ ] No `codeops/`, `plans/`, `requirements/`, or `RD-`/`AR-`/`ST-` reference appears in any added
       code or doc comment. (CLAUDE.md documentation directive)
