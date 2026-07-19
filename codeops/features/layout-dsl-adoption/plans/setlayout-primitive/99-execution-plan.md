# Execution Plan — setlayout-primitive

> **Implements**: layout-dsl-adoption/GH-117 · **GitHub**: [#117](https://github.com/blendsdk/jsvision/issues/117)
> **CodeOps Skills Version**: 3.10.0
> **Progress**: 0/17 tasks (0%)
> **Last Updated**: 2026-07-20 (created)
> **Branch**: `feat/setlayout-primitive` (cut from `feat/dsl-adoptation`)
> **Verify**: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e` (AR-4 — `yarn verify` runs only the `unit` project, and `ui` reaches the demos through its built `dist`)
> **Routing**: **sensitive → Opus.** This is the layout primitive every view writes through (CLAUDE.md: core engine work is sensitive). The migration tasks are standard, but they are small and inline.

**Scope**: `View.setLayout(patch)` + 20 conversions (13 DSL internals + 7 self-layout sites).
**Out of scope**: P4 (read-only field), the ~118 composition writes, the 11 field initializers — see
[01 §out of scope](01-requirements.md).

## Phase 1 — Spec the primitive, then build it (sensitive)

Specification-first: ST-S1…S4 are written and **red** before `setLayout` exists.

- [ ] 1.1 ST-S1/S2/S3/S4 in a new `packages/ui/test/view-setlayout.spec.test.ts` — merge preserves siblings, the merge is **shallow** (no residual `cells` when `size` switches variant), a mounted view requests relayout, an unmounted one does not throw. Reuse `app-shell.fixtures.ts`'s host double for ST-S3
- [ ] 1.2 Verify **red** — all four fail because the method does not exist; record which and why
- [ ] 1.3 Implement `setLayout` on `View` (03-01): shallow merge + unconditional `invalidateLayout()`. Keep `layout` a plain settable field — **no getter, no `_layout`** (AR-7)
- [ ] 1.4 JSDoc with `@example`; add the prose sentence on the `layout` field naming `setLayout` as the preferred write path — **no `@deprecated` tag** (AR-6). No plan/issue/RD identifiers in either
- [ ] 1.5 `yarn plugin:sync --fix` — editing `View`'s JSDoc drifts the committed API-reference snapshot that `check-plugin` gates on (03-01 §snapshot)
- [ ] 1.6 Verify **green**; full verify; commit

## Phase 2 — Audit, then migrate (P3 before P2)

The audit is inverted ahead of the migration deliberately: an audit run afterwards can only ratify
what already happened (03-02 §audit-first).

- [ ] 2.1 **Complete the audit table in 03-02** — one row per site, no blanks, **no code changes in this task**. For each: what the starting object is, what a replace clears, and whether anything downstream restores it. A ⛔ verdict halts the phase and that site becomes a preserved wholesale assignment with a plain-language comment + a runtime register entry
- [ ] 2.2 ST-S6/S7/S8 written **green-first** against unmodified source — merge-preservation through `at()`, the `Dialog` rect + `position:'absolute'`, `StatusLine`/`ColorPicker` direction. Literal rects, read after a flush (07 §non-vacuity)
- [ ] 2.3 ST-S5 written and **red** — a tagger on an already-mounted view requests a reflow. **The one intentional red** in this plan (AR-5); every other ST is green-first
- [ ] 2.4 Convert the 13 DSL sites in `dsl/absolute.ts`, `dsl/flex.ts`, `dsl/stack.ts` to `setLayout`. Leave `stack.ts:153`'s trailing batched `invalidateLayout()` in place — redundant, harmless, and removing it would couple the file to `setLayout`'s internals (03-02)
- [ ] 2.5 Verify — ST-S5 now **green** (the latent bug fix landed); ST-S6 still green; the adoption plans' DSL suites green and unedited
- [ ] 2.6 Convert the 6 straightforward self-layout sites: `statusline.ts:83`, `color-picker.ts:220`, `window.ts:161`, `edit-window.ts:77`, `form-dialog.ts:82`, `filter-popup.ts:285`
- [ ] 2.7 Convert `dialog.ts:109` **last** — the only site whose safety rests on a traced argument rather than an empty starting object ([02 §4](02-current-state.md)). Rewrite the surrounding comment if the conversion makes it false
- [ ] 2.8 Verify — ST-S7/S8 green; full verify; commit

## Phase 3 — Hardening & close-out (standard)

- [ ] 3.1 Grep audit — no `{ ...view.layout` / `{ ...this.layout` spread survives in `packages/ui/src/view/dsl/`; the remaining `.layout =` writes are only the composition sites the adoption issues own and the 11 field initializers
- [ ] 3.2 `git diff --stat` — nothing under `packages/spike-data-studio` or another package's `src/` touched (AC-9, NFR-6)
- [ ] 3.3 `yarn check:deps`; `yarn bench` once, informationally — a visible layout-pass regression stops the phase (NFR-3)
- [ ] 3.4 **Record P4's preconditions** on the issue and the roadmap: the ~118 composition writes, the 11 field initializers (naming the TypeScript constraint), and `spike-data-studio`'s deletion. The point is that the next planner does not rediscover them
- [ ] 3.5 `yarn lint:fix`, full verify, open the PR (base `feat/dsl-adoptation`)

**Verify**: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e`

## Deviations

_None yet. A ⛔ audit verdict in task 2.1 is **not** a deviation — it is the audit working, and that
site becomes a preserved assignment._
