# Execution Plan — setlayout-primitive

> **Implements**: layout-dsl-adoption/GH-117 · **GitHub**: [#117](https://github.com/blendsdk/jsvision/issues/117)
> **CodeOps Skills Version**: 3.10.0
> **Progress**: 0/22 tasks (0%)
> **Last Updated**: 2026-07-20 (revised after preflight — [`00-preflight-report.md`](00-preflight-report.md))
> **Branch**: `feat/setlayout-primitive` (cut from `feat/dsl-adoptation`)
> **Verify**: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e` (AR-4 — `yarn verify` runs only the `unit` project, and `ui` reaches the demos through its built `dist`; the env prefix only works after task 1.0)
> **Routing**: **sensitive → Opus.** This is the layout primitive every view writes through (CLAUDE.md: core engine work is sensitive). The migration tasks are standard, but they are small and inline.

**Scope**: `View.setLayout(patch)` + **23 conversions** (14 DSL internals + 7 self-layout sites + 2
inherited from the closed #109) across 11 files, plus `view.ts` for the primitive.
**Out of scope**: P4 (read-only field), the remaining 59 composition writes, the 10 field
initializers — see [01 §out of scope](01-requirements.md).

## Phase 1 — Spec the primitive, then build it (sensitive)

Specification-first: ST-S1…S4 are written and **red** before `setLayout` exists.

- [ ] 1.0 Add `"globalPassThroughEnv": ["TUI_SKIP_PERF"]` to `turbo.json` — without it Turborepo's strict environment mode strips the prefix and every phase gate silently runs the perf assertions it claims to skip (AR-4). `CI` needs no entry: turbo already passes it through in strict mode. Two expected consequences, neither a regression: editing `turbo.json` changes every task hash, so the next run is a **one-time full cache miss across the monorepo**; and the default system passthroughs (`PATH`, `HOME`) are unaffected by declaring the key. Confirm by running the gate command and observing the perf tests actually skip
- [ ] 1.1 ST-S1, ST-S2, ST-S3 and ST-S4 in a new `packages/ui/test/view-setlayout.spec.test.ts` — merge preserves siblings, the merge is **shallow** (no residual `cells` when `size` switches variant), a mounted view calls `markRelayout`, an unmounted one does not throw. **Seam: a two-line inline `ViewHost` literal on the public `view.host` field** — there is no existing double to reuse, and the counting-scheduler pattern cannot distinguish relayout from repaint (07 §seam)
- [ ] 1.2 Verify **red** — run `yarn workspace @jsvision/ui test view-setlayout` to see the assertions fail. Note `yarn typecheck` also fails at this point (the method does not exist yet); that is expected and is not the evidence being recorded
- [ ] 1.3 Implement `setLayout` on `View` (03-01): shallow merge + unconditional `invalidateLayout()`. Keep `layout` a plain settable field — **no getter, no `_layout`** (AR-7)
- [ ] 1.4 JSDoc with `@example`, covering the three things a caller cannot infer: why the merge is shallow, that an explicit `undefined` **resets** the prop (FR-2a), and that a `setLayout` call in a constructor is erased by a subclass `override layout` initializer. Add the prose sentence on the `layout` field naming `setLayout` as the preferred write path — **no `@deprecated` tag** (AR-6). No plan/issue/RD identifiers in either. Note `check:docs` does **not** gate a method's `@example` (NFR-5) — this is a review obligation
- [ ] 1.5 `yarn plugin:sync --fix` — **adding a public member** to `View` drifts the committed API-reference snapshot that `check-plugin` gates on (03-01 §snapshot). Also update the hand-written `tools/claude-plugin/skills/jsvision/references/widget-authoring.md:30`, which still tells widget authors to call `invalidateLayout()` after a layout change; `plugin:sync` does not touch it
- [ ] 1.6 ST-S9 in the spec file (explicit-`undefined` reset — a contract derived from FR-2a, so it belongs in the spec tier), plus ST-I1, ST-I3 and ST-I4 in a new `packages/ui/test/view-setlayout.impl.test.ts` — empty patch, coalescing across a loop, replace-not-mutate identity (07 §impl). ST-I5 is written later, in task 2.2, because it witnesses a conversion rather than the primitive
- [ ] 1.7 Verify **green**; full verify; commit

## Phase 2 — Audit, then migrate (P3 before P2)

The audit is inverted ahead of the migration deliberately: an audit run afterwards can only ratify
what already happened (03-02 §audit-first).

- [ ] 2.1 **Complete the audit table in 03-02** — 23 rows, **no code changes in this task**. Three rows are pre-filled (traced); fill the rest. For each: the starting object, what a replace clears, whether anything downstream restores it, and **whether the view is mounted at call time** — the column whose absence let a misclassification survive the first draft. A ⛔ verdict halts the phase and that site becomes a preserved wholesale assignment with a plain-language comment + a runtime register entry
- [ ] 2.2 Record the existing witnesses green **pre-migration** — `dsl-absolute.spec.test.ts`, `dsl-hardening.impl.test.ts`, `dialog.dsl-shape.impl.test.ts`, `dialog.centering.impl.test.ts`, `layout-dsl-stack.spec.test.ts`, and `app-shell.composition.spec.test.ts` (ST-W1 covers `application.ts:343`/`:347`; **ST-W4 is the mechanical guard that `:333` stays a clobber**). These already assert merge-preservation, the `Dialog` end state and the shell composition more strongly than new witnesses would (07 §migration witnesses), and must stay green **and unedited** through the phase. Then write the **one** genuinely new witness, **ST-I5** (`StatusLine`/`ColorPicker` `layout.direction === 'row'`) in `view-setlayout.impl.test.ts` — green-first, before the task-2.6 conversion it witnesses
- [ ] 2.3 ST-S5 written and **red** — a tagger on an already-mounted view calls `markRelayout`. The one deliberate red in this phase (AR-5). It **specifies new behaviour**; it does not witness a bug fix — no site in the codebase observes the change today
- [ ] 2.4 Convert the **14** DSL sites in `dsl/absolute.ts`, `dsl/flex.ts`, `dsl/stack.ts` — including `flex.ts:217` (`spacer()`), whose wrapped assignment no `.layout = ` grep can see. Leave `stack.ts:153`'s trailing batched `invalidateLayout()` in place — redundant, harmless, and it invalidates through the Stack's host where `setLayout` invalidates through the layer's (03-02)
- [ ] 2.5 Verify — ST-S5 now **green**; the five witness suites still green and unedited
- [ ] 2.6 Convert the 6 straightforward `this.layout =` sites: `statusline.ts:83`, `color-picker.ts:220`, `window.ts:161`, `edit-window.ts:77`, `form-dialog.ts:82`, `filter-popup.ts:285`. **`window.ts:161` is the one conversion that adds a reflow** (FR-4a): `commitPlacement()` does not invalidate today and runs on a mounted window at gesture start. Benign — it writes `bounds` back into `layout.rect`, so the extra reflow recomputes identical geometry — but confirm the window/desktop suites stay green and unedited. Rebuild `ui` before any scoped inner-loop run — a bare `yarn workspace @jsvision/datagrid test` bypasses turbo's `^build` and asserts against a stale dist
- [ ] 2.7 Convert `application.ts:343` and `:347` — the two sites the widget-adoption plan handed to #117 by name and that were orphaned when #109 closed. **Do not touch `:333`**: it is an intentional wholesale replace the sibling plan preserved deliberately (02 §3)
- [ ] 2.8 Convert `dialog.ts:109` **last** — the only site whose safety rests on a traced argument rather than an empty starting object ([02 §4](02-current-state.md)). Rewrite the surrounding comment if the conversion makes it false
- [ ] 2.9 Verify — the existing dialog suites green and unedited; full verify; commit

## Phase 3 — Hardening & close-out (standard)

- [ ] 3.1 Grep audit, both patterns run verbatim from [02 §8](02-current-state.md), each returning **0**: `grep -rnE "^\s*[A-Za-z_.]+\.layout\s*=([^=]|$)" packages/ui/src/view/dsl/` and `grep -rnE "this\.layout\s*=([^=]|$)" packages/{ui,forms,datagrid}/src`. **The `([^=]|$)` tail is load-bearing** — the `[^=]`-only form silently misses `flex.ts:217`. Confirm the remaining `.layout =` writes are only the composition sites the adoption issues own and the 10 field initializers
- [ ] 3.2 `git diff --stat` — nothing under `packages/spike-data-studio` or another package's `src/` touched (AC-9, NFR-6); `turbo.json`, `packages/ui/test/**` and the regenerated `tools/claude-plugin/**` snapshot are the expected out-of-`src` entries
- [ ] 3.3 `yarn check:deps`. Kitchen-sink + `layout-dsl-playground` smoke suites green **and unedited** — no story is required (`setLayout` is non-visual layout math per `codeops/kitchen-sink-gate.md` §Scope), but FR-4 changes tagger runtime behaviour, so the smoke suites are the check that it did not disturb them. **`yarn bench` is not run**: it measures `@jsvision/core`'s frame bench and cannot observe a `ui` layout-pass regression (NFR-3)
- [ ] 3.4 **Reconcile #117 and both roadmaps.** On the issue: correct the stale `225 writes / 29 reads` to the measured `82 writes / 17 reads`, correct the "P1 + the getter" design (a class field cannot override an accessor — 02 §5.2), and tick P1/P2/P3. Record **P4's preconditions**: the 59 remaining executable writes (46 once the spike is deleted), the 10 field initializers, the **9 in-place `layout.rect = …` mutations a getter would not close**, the test/example write population, and `spike-data-studio`'s deletion. In `codeops/features/layout-dsl-adoption/00-roadmap.md`: update the #117 row's stage and the header progress line, **and rewrite the four stale figures its #117 row still carries** ("13 DSL internals" → 14, "11 subclass field initializers" → 10, "138 writes / 24 reads" → 82 / 17, "~118 composition writes" → 59, of which 46 after the spike); also correct the #109 row, which names the handed-over sites as `:347`/`:353` when they are now `:343`/`:347`. In `codeops/00-roadmap.md` (portfolio): update the layout-dsl-adoption row's sequencing sentence and issue count
- [ ] 3.5 `yarn lint:fix`, full verify, open the PR (base `feat/dsl-adoptation`). Note **PR #127 targets the same base and also edits `codeops/features/layout-dsl-adoption/00-roadmap.md` and `codeops/00-roadmap.md`** — whichever lands second rebases both files

**Verify**: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e`

## Deviations

_None yet. A ⛔ audit verdict in task 2.1 is **not** a deviation — it is the audit working, and that
site becomes a preserved assignment._

## Post-preflight revisions (2026-07-20)

Applied from [`00-preflight-report.md`](00-preflight-report.md); recorded here because they changed
this plan's shape, not just its prose:

- **+1 DSL site** — `flex.ts:217` (`spacer()`), missed because its assignment wraps (PF-005).
- **+2 conversions** — `application.ts:343`/`:347`, handed to #117 by name and orphaned by #109's
  closure (PF-007).
- **+3 tasks** — 1.0 (`turbo.json` env passthrough, PF-010), 1.6 (impl tests, PF-013), and the split
  of the old 2.6 into 2.6/2.7/2.8.
- **−2 tests** — the old ST-S6/ST-S7 are already covered verbatim by existing suites (PF-006); task
  2.2 now runs those suites instead of duplicating them.
- **Corrected counts** — 82 executable writes (not 138), 17 reads (not 24), 10 field initializers
  (not 11), 9 spreads + 5 fresh (not 8 + 5). The old figures came from a raw grep that counted ~64
  JSDoc `@example` lines as call sites (PF-009).
- **Withdrawn claim** — AR-5's "latent bug fix at `filter-popup.ts:285`". That site already reflows
  via `bind({relayout:true})`; no site observes the change (PF-001).
