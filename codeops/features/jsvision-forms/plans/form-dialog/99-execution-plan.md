# 99 — Execution Plan

> **Feature**: jsvision-forms/RD-08 — `formDialog()` + modal submit-gate
> **CodeOps Skills Version**: 3.8.0
> **Progress**: 15/18 tasks (83%) — Phases 1–2 complete ✅
> **Last Updated**: 2026-07-16

Specification-first ordering is non-negotiable within every phase: **spec tests → verify red →
implement → verify green → impl tests → full verify**. A `*.spec.test.ts` is an immutable oracle — a
red spec after implementation means the code is wrong, not the test. Completion marks are two-stage:
`[~]` when implemented (timestamp), `[x]` only after its verify passes. No task is `[x]` with a failing
verify.

**Verify command** (every Verify line, AR-PL6): `yarn verify` — plus, before the final commit, a plain
banned-ref grep over `packages/forms/src` (`RD-`/`AR-`/`codeops/` + TV/C++ provenance) since
`check-jsdoc.mjs` has scanner gaps. Commits via **/gitcmp** (commit + push) — never raw git. Commit
subjects start lowercase (commitlint); body lines ≤100 chars.

**Phase order rationale**: `submitting()` (Phase 1) is the store dependency the dialog's seal + OK
`disabled` read, so it lands first and is locked by its own oracles. `formDialog` (Phase 2) builds on it.
The story (Phase 3) consumes the finished public surface.

---

## Phase 1 — `form.submitting()` signal ([03-02](03-02-submitting.md))

Spec oracles: ST-D-SUB1…3 ([07](07-testing-strategy.md)). Touches `create-form.ts` + `types.ts` only —
the barrel/surface lock is unchanged in this phase (`submitting()` is a type-only method).

- [x] **1.1** Write the spec oracles ST-D-SUB1…3 in `packages/forms/test/form-dialog.spec.test.ts`
      (assert `submitting()` on `form.submit()` directly, with a deferred-promise `onValid` helper) — AR-PL2. _(2026-07-16)_
- [x] **1.2** Verify **red**: `yarn workspace @jsvision/forms test` — ST-D-SUB1…3 fail (`submitting` absent). _(3/3 red: `form.submitting is not a function`)_
- [x] **1.3** Implement `submitting`: seed `const submitting = signal(false)` beside `submitAttempted`
      (`create-form.ts:121`); wrap `submit()` (`:213-230`) in `set(true)` at entry + a `try/finally` that
      `set(false)` on every path incl. a re-throw; expose `submitting: () => submitting()` on the returned
      object (`:266-279`) — [03-02](03-02-submitting.md). _(2026-07-16)_
- [x] **1.4** Add `submitting(): boolean` to `interface Form` (`types.ts`, between `validating()` and
      `loading()`) with prose JSDoc (no per-member `@example`) — [03-02](03-02-submitting.md). _(2026-07-16)_
- [x] **1.5** Verify **green**: ST-D-SUB1…3 pass. _(3/3 green)_
- [x] **1.6** Full **verify**: `yarn verify` green. _(26/26 turbo tasks; all tests + check:docs/check-plugin green)_
- [x] **1.7** Commit via **/gitcmp** (`feat(forms): add form.submitting() in-flight signal`). _(0f750377, pushed 2026-07-16)_

---

## Phase 2 — `formDialog()` + the `FormDialog` subclass ([03-01](03-01-form-dialog.md))

Spec oracles: ST-D1…D10 + ST-D-SEC ([07](07-testing-strategy.md)) → RD-08 AC #2–#11, #13. Adds the new
module + the barrel export + the surface-lock bump.

- [x] **2.1** Append the spec oracles ST-D1…D10 to `form-dialog.spec.test.ts` and write ST-D-SEC in
      `form-dialog-security.spec.test.ts`, using the `createEventLoop` headless host (AR-PL5,
      [07](07-testing-strategy.md)). Update `surface.impl.test.ts` to expect **6** runtime values
      (add `'formDialog'`, prose 5→6) — AR-PL3. _(2026-07-16)_
- [x] **2.2** Verify **red**: the ST-D* oracles + the surface lock fail (`formDialog` absent). _(13 failed / 3 passed — the ST-D-SUB oracles stay green)_
- [x] **2.3** Create `packages/forms/src/form-dialog.ts`: the `FormDialogOptions<S, I>` interface, the
      internal `class FormDialog extends Dialog` overriding `handleTerminating` / `resolveCancel` /
      `valid` + the async OK gate (try/caught `await form.submit`, `captured`, `endModal`), and the
      `formDialog` factory (create form → build subclass + body + OK(direct)/Cancel → `addWindow` →
      `execView` → map command → `finally { removeWindow; form.dispose() }`) — [03-01](03-01-form-dialog.md),
      AR-PL1/PL7. _(2026-07-16; PF-001 mounted-guard finally, PF-002 public result() applied)_
- [x] **2.4** Export from the barrel (`index.ts`): `formDialog` (runtime) + `FormDialogOptions` (type) —
      [03-02](03-02-submitting.md), AR-PL3. _(2026-07-16)_
- [x] **2.5** Add the class/function-level `@example`s to `formDialog` + `FormDialogOptions` (open → edit
      → OK-with-values / Cancel-null) for `check:docs` — RD-08 AC #14, [03-01](03-01-form-dialog.md). _(formDialog @example; FormDialogOptions is a type → check:docs-exempt)_
- [x] **2.6** Verify **green**: ST-D1…D10 + ST-D-SEC + the updated surface lock pass. _(16/16)_
- [x] **2.7** Impl tests: `form-dialog.impl.test.ts` for internals/edges not covered by spec (button
      placement/`default` flag, first-focusable focus, the re-entrancy seal internals) — [07](07-testing-strategy.md). _(3 impl tests; 18/18 total)_
- [x] **2.8** Full **verify**: `yarn verify` green **+** banned-ref grep over `packages/forms/src` clean. _(26/26 turbo; grep clean; prettier auto-fixed form-dialog.ts wrapping)_
- [ ] **2.9** Commit via **/gitcmp** (`feat(forms): formDialog() modal submit-gate bridge`).

---

## Phase 3 — Kitchen-sink `forms/dialog` story ([03-03](03-03-story.md))

Spec oracle: ST-DS1 ([07](07-testing-strategy.md)) → RD-08 AC #12.

- [ ] **3.1** Write the smoke oracle ST-DS1 in `kitchen-sink.smoke.spec.test.ts` (mounts `forms/dialog`,
      unique id + required metadata) — [03-03](03-03-story.md).
- [ ] **3.2** Verify **red**: ST-DS1 fails (story unregistered).
- [ ] **3.3** Create `stories/forms-dialog.story.ts` (`id: 'forms/dialog'`, `rd: 'RD-08'`; live path via
      `ctx.execView`; headless degrade to launch button + echo + always-painted hint) and register it in
      `stories/index.ts` (import + array entry) — [03-03](03-03-story.md), AR-PL4. Resolve the
      `ModalDialogHost` desktop-wiring against the current `StoryContext`; if it needs a runtime call,
      record it in the register with a `(runtime)` tag.
- [ ] **3.4** Verify **green**: ST-DS1 passes (rebuild `@jsvision/forms` first — examples import by
      name → dist; `yarn verify`'s turbo `test dependsOn build` handles it).
- [ ] **3.5** Full **verify**: `yarn verify` green (whole workspace, incl. `check:docs`).
- [ ] **3.6** Commit via **/gitcmp** (`feat(examples): forms/dialog kitchen-sink story`).

---

## Definition of done (whole plan)

- [ ] All 18 tasks `[x]`; every RD-08 AC (1–14) satisfied per the [07](07-testing-strategy.md) coverage map.
- [ ] `yarn verify` green + banned-ref grep clean; `@jsvision/core`/`@jsvision/ui` still zero-dep; `zod`
      still the only peer dep.
- [ ] Roadmap synced: RD-08 → `Executing` (🔄) on start, `Done` (✅) on completion; portfolio row
      cascaded (nested-layout mandate).

## Estimated effort

Phase 1 ~1.5–2 h · Phase 2 ~3–4 h · Phase 3 ~1–1.5 h. Total ~5.5–7.5 h across 3 phases.
