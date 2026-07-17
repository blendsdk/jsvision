# 99 — Execution Plan

> **Feature**: jsvision-forms/RD-05 — Comprehensive Forms Showcase
> **CodeOps Skills Version**: 3.8.0
> **Progress**: 10/10 tasks (100%)
> **Last Updated**: 2026-07-17

Specification-first ordering is non-negotiable within the phase: **spec oracle → verify red →
implement → verify green → hardening → full verify**. `kitchen-sink.smoke.spec.test.ts` is an
immutable oracle — a red ST-SS1 after the story is written means the **story** is wrong, not the
oracle. Completion marks are two-stage: `[~]` when implemented (timestamp), `[x]` only after its
verify passes.

**Verify command** (every Verify line, AR-PL6): `yarn verify`. Commits via **/gitcmp** (commit +
push) — never raw git. Commit subjects start lowercase (commitlint); body lines ≤100 chars. Before
the final push run `yarn lint:fix` and commit anything it changes (repo prime directive).

**Scope reminder** (AR-PL7): changes are confined to `packages/examples/kitchen-sink/**` +
`packages/examples/test/kitchen-sink.smoke.spec.test.ts`. No `@jsvision/forms`/ui/core edit; no new
dependency. A `git diff --stat` at the end must show only those paths.

---

## Phase 1 — Flagship `forms/showcase` story + ST-SS1 smoke oracle ([03-01](03-01-showcase-story.md))

### Spec (write the oracle first)

- [x] **1.1** Append **ST-SS1** to `packages/examples/test/kitchen-sink.smoke.spec.test.ts`
      (`find 'forms/showcase'` → registered · `category==='Forms'` · truthy title/blurb ·
      `paintedCells>0` · painted matches `/showcase|inspector/i`, `/right/i`, `/below/i`,
      `/privileged|<\s*1024/i`) — [07](07-testing-strategy.md). _(implemented 2026-07-17)_
- [x] **1.2** Verify **red**: `yarn workspace @jsvision/examples test` — ST-SS1 fails (story
      unregistered → `find` returns `undefined`). _(red confirmed 2026-07-17: 1 failed / 198 passed;
      `expected undefined to be truthy`)_

### Implement

- [x] **1.3** _(implemented 2026-07-17)_ Create `stories/forms-showcase.story.ts`: the module JSDoc + `@example`, the schema
      (name/host/port/tls/mode/features) + `createForm` with `asyncValidators.host` + `asyncDebounceMs`,
      the `sleep(ms, signal)` helper (copy the sibling idiom), and all widget binds
      (`Input`/`Switch`/`bindRadio`/`bindCheck`/`bindField`) — [03-01](03-01-showcase-story.md) §Schema/§Layout.
- [x] **1.4** _(implemented 2026-07-17)_ Build the `col`/`row` DSL frame (form `grow` │ inspector `fixed`), placed via the
      merge-absolute-rect trick; add the **errors right/below toggle** (`RadioGroup` + `errPlace`
      signal) with the **two-error-slot** design (self-blanking `errRight`/`errBelow` per field) —
      §Layout / §Field rows. _(Toggle placed above the inspector, not in the form column: a 2-item
      `RadioGroup` renders 2 rows tall, so hosting it in the fixed-26 right column keeps the 6-field
      form + inspector inside the 16-row canvas. Right/below reflow applies to the three text fields
      name/host/port; `tls` has no error message and the mode/features groups keep an inspector-count
      surface — the reflow demonstration is on the fields where "beside vs below" is meaningful.)_
- [x] **1.5** _(implemented 2026-07-17)_ Add the **state inspector** panel (reactive `Text` rows: `isValid`/`dirty`/`validating`/
      `loading`/`errors` count/`values`/`raw`) with its caption — §State inspector (AC-3).
- [x] **1.6** _(implemented 2026-07-17)_ Add the **amber privileged-port advisory** (`Text.severity:'warning'`, self-blank unless
      `1 ≤ port < 1024`) and the **always-painted hint** line carrying the demo literals — §Amber
      advisory / §Headless degrade (AC-4, AC-8).
- [x] **1.7** _(implemented 2026-07-17)_ Wire the **actions row**: Submit (the `form.submit` gate), **Load defaults**
      (`form.load(loadRecord)` + `loading()`-disabled), **Open as dialog…** (`ctx.execView` guard →
      the no-op-desktop host shim verbatim → `formDialog` on a 2-field dialog schema) — §Actions (AC-6, AC-7).
- [x] **1.8** _(implemented 2026-07-17)_ Register the story in `stories/index.ts` (import `formsShowcaseStory` after
      `formsDialogStory`; append to the `STORIES` array).

### Harden + verify

- [x] **1.9** Verify **green**: `yarn workspace @jsvision/examples test` — ST-SS1 + the full smoke
      suite pass (rebuild `@jsvision/forms` first if running the workspace test directly; `yarn verify`'s
      turbo `test dependsOn build` handles it). _(green confirmed 2026-07-17: 200 passed / 27 files;
      inspector `raw`/`values` clipped to the panel width so long JSON stays on one visible line)_
- [x] **1.10** Full **verify**: `yarn lint:fix` (commit any reformat), then `yarn verify` green;
      confirm `git diff --stat` touches only `packages/examples/kitchen-sink/**` + the smoke test
      (AR-PL7). Commit via **/gitcmp** (`feat(examples): forms/showcase comprehensive kitchen-sink story`).
      _(2026-07-17: `yarn lint:fix` reformatted the story; `yarn verify` green — 26/26 turbo, examples
      200 passed, check-plugin PASS; `git status` scope = only `packages/examples` story + index +
      smoke test, no engine/dep change. **Commit pending user decision — default ask-commit mode.**)_

---

## Definition of done (whole plan)

- [x] All 10 tasks `[x]`; every AC (1–9) satisfied per the [07](07-testing-strategy.md) coverage map.
- [x] `yarn verify` green; ST-SS1 + full smoke pass; `check:deps` green.
- [x] `@jsvision/core`/`@jsvision/ui`/`@jsvision/forms` unchanged; `packages/examples` gained no
      dependency; the four existing forms stories untouched (AR-PL7, AR-PL2).
- [x] Roadmap synced: RD-05 → `Executing` (🔄) on start, `Done` (✅) on completion; portfolio row
      cascaded (nested-layout mandate). jsvision-forms → **9/9 done**.

## Estimated effort

Phase 1 ~2.5–3.5 h (one story file + one oracle; the design is fully pinned). Total ~2.5–3.5 h.
