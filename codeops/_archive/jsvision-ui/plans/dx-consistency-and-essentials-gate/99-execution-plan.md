# Execution plan — DX consistency & essentials gate

> **Type**: Feature plan (no RD) · **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.3.2
> **Source**: `DX-ASSESSMENT.md` (Proposals 6 + 7) · **Gate**: ✅ PASSED (see `00-ambiguity-register.md`)
> **Last Updated**: 2026-07-08 14:00
> **Progress**: 15/15 tasks (100%)

Marking is two-stage: `[~]` (implemented, timestamp) → `[x]` (verified, timestamp). Bump the Progress
counter + Last Updated as each task lands. Spec-first per phase: **spec tests → red → implement →
green → impl tests → verify**. `*.spec.test.ts` assertions are immutable; only the removed-API call
**syntax** in existing specs changes (AR-5).

**Verify (every task/phase):**
`yarn verify` · `yarn lint` · `yarn workspace @jsvision/ui typecheck`

---

## Phase 1 — P6: constructor normalization + callback taxonomy

Spec → 03-01. Delivers FR-1…FR-5 (ST-1…ST-6, IT-1/IT-2).

- [x] **1.1 Spec tests (red).** ✅ (completed: 2026-07-08 13:47) New `controls.options.spec.test.ts` (ST-1/2/3); extend
  `color-swatch.spec.test.ts` for the `onInput`/`onChange` split (ST-4) + a `ColorPicker` commit-close
  case (ST-5); add the packaging/grep oracle for "no `onCommit`" + the two new option exports (ST-6).
  Run — confirm they fail red against the current API.
- [x] **1.2 Implement `RadioGroup`/`CheckGroup` options.** ✅ (completed: 2026-07-08 13:47) Add + export `RadioGroupOptions`/
  `CheckGroupOptions`; replace the positional constructors with the options-object form; re-export both
  types from `controls/index.js` and the package barrel (`index.ts:91`). No positional overload (AR-1).
- [x] **1.3 Implement color callback rename.** ✅ (completed: 2026-07-08 13:47) `ColorSwatch`: `onCommit`→`onChange`, live
  `onChange`→`onInput`; fix the three fire sites (`setLive`→`onInput`, `close`→`onChange`,
  `select`→both). `ColorPicker`: create the swatch with `onChange: () => commit()`; refresh the
  popup-close JSDoc. Verify no `onCommit` remains in color source.
- [x] **1.4 Migrate all call sites.** ✅ (completed: 2026-07-08 13:47) Source `editor/dialogs.ts:66,117`; examples (`controls-demo`,
  `controls-live`, kitchen-sink `checkgroup`/`radiogroup` stories); impl tests (`accelerator-reveal`,
  `controls.cluster.impl`, `controls.hardening.impl`); and the **spec** call sites
  (`controls.cluster.spec`, `controls.focus.spec`, `controls.hardening.spec`, `color-swatch.spec`) —
  syntax only, assertions unchanged (AR-5).
- [x] **1.5 Verify green (ST-1…ST-6).** ✅ (completed: 2026-07-08 13:47) Run the trio; ST-1…ST-6 pass; the `controls`/`color`
  kitchen-sink smoke still mounts.
- [x] **1.6 Impl tests + docs (IT-1/IT-2).** ✅ (completed: 2026-07-08 13:47) Add IT-1 (migrated call sites build) + IT-2 (drag =
  per-cell `onInput`, release = single `onChange`); add/refresh `@example` on every changed public
  symbol; `yarn workspace @jsvision/ui check:docs` clean.
- [x] **1.7 Full verify (Phase 1).** ✅ (completed: 2026-07-08 13:47) `yarn verify` + `yarn lint` + ui `typecheck` all green.
- [x] **1.8 Commit** via /gitcm ✅ (completed: 2026-07-08 13:53) — `feat(ui): normalize RadioGroup/CheckGroup options + unify color onInput/onChange`.

---

## Phase 2 — P7: essentials gate in `run()`

Spec → 03-02. Delivers FR-6…FR-8 (ST-7…ST-9, IT-3/IT-4).

- [x] **2.1 Spec tests (red).** ✅ (completed: 2026-07-08 13:53) New `app-essentials-gate.spec.test.ts`: ST-7 (default → non-TTY double
  throws `EssentialsNotMetError`, message has "interactive TTY", host never started), ST-8
  (`requireTty:false` → no throw), ST-9 (TTY double → no throw). Run — confirm red.
- [x] **2.2 Implement the gate.** ✅ (completed: 2026-07-08 13:53) Add `ApplicationOptions.requireTty?` (default true); thread it into
  the assembled `RunContext`; add `RunContext.requireTty?`; import `assertEssentials`/`detectTty` in
  `run.ts` and call the gate (guarded on `ctx.requireTty ?? true`) immediately before `host.start()`.
- [x] **2.3 Opt out the headless harness.** ✅ (completed: 2026-07-08 13:53 — verified no-op, AR-6)
  Empirically unnecessary: the app-shell doubles (`CaptureStream`/`FakeInput`) report `isTTY: true`, so
  the default gate passes and all `run()`-driving suites (`app-shell.lifecycle/integration/adapt`,
  `app-oncommand`) stay green with the gate in place and no opt-out. No redundant config added.
- [x] **2.4 Verify green (ST-7…ST-9).** ✅ (completed: 2026-07-08 13:53) ST-7…ST-9 pass and the full app-shell suite stays green.
- [x] **2.5 Impl tests + docs (IT-3/IT-4).** ✅ (completed: 2026-07-08 13:53) IT-3 (degradations don't gate a TTY run) + IT-4 (throw
  leaves streams untouched, pre-`start` ordering); `@example` on `requireTty`; `check:docs` clean.
- [x] **2.6 Full verify (Phase 2).** ✅ (completed: 2026-07-08 13:53) `yarn verify` + `yarn lint` + ui `typecheck` all green.
- [x] **2.7 Commit** via /gitcm ✅ (completed: 2026-07-08 13:53) — `feat(ui): gate run() on an interactive TTY (requireTty, default on)`.

---

## Post-completion

- [x] Update `CHANGELOG.md` (Unreleased / Changed): ✅ (2026-07-08) the `RadioGroup`/`CheckGroup` constructor change +
  the color `onInput`/`onChange` rename (breaking, pre-release) and the new `requireTty` gate.
- [x] Roadmap: record as a DONE follow-up on `codeops/features/jsvision-ui/00-roadmap.md` (+ portfolio
  cascade), mirroring the `dx-ergonomics` entry. ✅ (2026-07-08)
- [ ] Optionally re-run `/analyze_project` if the public surface note in `CLAUDE.md` needs the new
  option types.
