# Execution Plan: Global Clipboard & Selection

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-12 23:24
> **Progress**: 43/50 tasks (86%)
> **CodeOps Skills Version**: 3.4.1

## Overview

Implement framework-wide `Ctrl+A/C/X/V` across `@jsvision/ui`, spec-first, in six phases that mirror
the layers in the `03-*` specs: keymap plumbing → global copy/cut + select-all → in-app paste →
cross-widget consistency → polish/config/story → cleanup + supersede #5. Each phase gains the highest
value first and stays independently verifiable.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 0 | Commands & default-keymap plumbing | 11 |
| 1 | Global copy/cut + select-all wiring (dual-sink write) | 9 |
| 2 | Global paste via the app-local buffer | 8 |
| 3 | Cross-widget consistency (Editor↔Input) | 6 |
| 4 | Polish, config & kitchen-sink story | 9 |
| 5 | Cleanup & supersede #5 | 7 |

**Total: 50 tasks across 6 phases** (scope bounded by the task-size criteria — each task is a small,
independently testable unit).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp —
>    `- [~] 0.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 0.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and Last Updated after EVERY task — never batch.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.
>
> **Immutable-oracle rule:** a failing `*.spec.test.ts` means the implementation is wrong — fix the
> code, not the test. The ONE sanctioned exception in this plan is Phase 5's removal of the retired
> `clipboardChord()` unit oracles (authorized by AR-5 — the behavior moved to alias bindings, guarded
> by ST-16); no other spec expectation may be edited.

---

## Phase 0: Commands & default-keymap plumbing

Governs: [03-01](03-01-keymap-and-commands.md). Delivers the outer layer — the default keymap, the
`clipboardKeys` config, and `Commands.selectAll` — with no widget behavior change yet.

### Step 0.1: Specification tests (BEFORE implementation)

**Reference**: 07 ST-1..ST-7 · AR-3, AR-4, AR-9

- [x] 0.1.1 Write default-keymap spec tests (ST-1..ST-6) — `packages/ui/test/event.default-keymap.spec.test.ts` ✅ (completed: 2026-07-12 21:44)
- [x] 0.1.2 Extend packaging spec for `Commands.selectAll` + `buildKeymap`/`ClipboardKeys` exports (ST-7) — `packages/ui/test/event.packaging.spec.test.ts` ✅ (completed: 2026-07-12 21:44)
- [x] 0.1.3 Run spec tests — verify they FAIL (red phase) ✅ (completed: 2026-07-12 21:44 — 6 fail: "buildKeymap is not a function")

### Step 0.2: Implementation

**Reference**: 03-01 §Implementation Details

- [x] 0.2.1 Add `Commands.selectAll` + rewrite the clipboard JSDoc block (plain language, no banned IDs) — `packages/ui/src/status/commands.ts` ✅ (completed: 2026-07-12 21:52)
- [x] 0.2.2 Create `default-keymap.ts` — modern/classic binding records + `buildKeymap(clipboardKeys, userKeymap)` (compose-at-lookup, user wins) + `ClipboardKeys` type — `packages/ui/src/event/default-keymap.ts` ✅ (completed: 2026-07-12 21:52)
- [x] 0.2.3 Add `EventLoopOptions.clipboardKeys` + call `buildKeymap(opts.clipboardKeys, opts.keymap)` in the loop constructor — `packages/ui/src/event/types.ts`, `packages/ui/src/event/event-loop.ts` ✅ (completed: 2026-07-12 21:52)
- [x] 0.2.4 Add `ApplicationOptions.clipboardKeys` + thread it to the loop — `packages/ui/src/app/application.ts` ✅ (completed: 2026-07-12 21:52)
- [x] 0.2.5 Barrel re-export `buildKeymap` + `ClipboardKeys` — `packages/ui/src/event/index.ts`, `packages/ui/src/index.ts` ✅ (completed: 2026-07-12 21:52)
- [x] 0.2.6 Run spec tests — verify they PASS (green phase) ✅ (completed: 2026-07-12 21:52 — ST-1..ST-7 green)

> **Phase 0 → Phase 1 transient (expected).** Enabling the default keymap globalizes `Ctrl+A`, so
> 11 pre-existing widget tests that use `Ctrl+A` as a *select-all setup step* go red between Phase 0
> and Phase 1 (`Commands.selectAll` is not wired into `Input`/`Editor` until tasks 1.2.2/1.2.3). All
> 11 trace to that one cause (no genuine collisions, no immutable-oracle conflict, no test edits
> needed) and go green after Phase 1 — which is exactly the swallow-the-raw-chord invariant Phase 1
> exists to close. The joint full-suite `yarn verify` is therefore run at the end of Phase 1 (task
> 1.3.2); Phase 0's own spec tests (ST-1..ST-7) are green now.

### Step 0.3: Implementation tests & hardening

- [x] 0.3.1 Write impl tests (compose-at-lookup internals, odd modifier order, `'none'`+user) — `packages/ui/test/event.default-keymap.impl.test.ts` ✅ (completed: 2026-07-12 21:53 — 6 green)
- [x] 0.3.2 Full verification ✅ (completed: 2026-07-12 22:20 — joint with task 1.3.2; feature fully green)

**Verify**: `yarn verify`

---

## Phase 1: Global copy/cut + select-all wiring (dual-sink write)

Governs: [03-02](03-02-clipboard-buffer-seam.md) (write side) + [03-03](03-03-widget-integration.md)
(select-all, copy/cut). Satisfies the swallow-the-raw-chord invariant so select-all does not regress.

### Step 1.1: Specification tests

**Reference**: 07 ST-8, ST-9, ST-10, ST-13, ST-14, ST-16, ST-18, ST-21 · AR-2, AR-4, AR-9

- [x] 1.1.1 Write Input command spec tests (ST-8 dual-sink copy, ST-9 cut, ST-10 empty no-op, ST-13 bracketed-paste regression, ST-14 select-all, ST-16 classic alias, ST-18 non-editable no-op) — `packages/ui/test/controls.global-clipboard.spec.test.ts` ✅ (completed: 2026-07-12 22:05)
- [x] 1.1.2 Write Editor select-all spec test (ST-21) — `packages/ui/test/editor.global-clipboard.spec.test.ts` ✅ (completed: 2026-07-12 22:05)
- [x] 1.1.3 Run spec tests — verify they FAIL (red phase) ✅ (completed: 2026-07-12 22:05 — 5 wiring-dependent oracles red; ST-10/13/18 already hold)

### Step 1.2: Implementation

**Reference**: 03-02 §Dual-sink, 03-03 §Input/§Editor

- [x] 1.2.1 Loop owns `clipboardText`; dual-sink `setClipboard` writes the in-memory buffer **and** the OS clipboard — `packages/ui/src/event/event-loop.ts` ✅ (completed: 2026-07-12 22:05 — **also pulled the `readClipboard()` read seam forward from task 2.2.1** across the four sites, since the immutable ST-8 oracle Phase 1 places asserts `readClipboard()`; read+write are one buffer unit. See runtime note AR-18.)
- [x] 1.2.2 `Input.onEvent` handles `Commands.selectAll` → `selectAll(true)` — `packages/ui/src/controls/input.ts` ✅ (completed: 2026-07-12 22:05)
- [x] 1.2.3 `Editor` command branch handles `Commands.selectAll` → `execute('selectAll')` — `packages/ui/src/editor/editor-events.ts` ✅ (completed: 2026-07-12 22:05)
- [x] 1.2.4 Run spec tests — verify they PASS (green phase) ✅ (completed: 2026-07-12 22:05 — 8/8 new specs green; full suite 1555/1556, the 10 Ctrl+A-setup transients fixed)

> **Blocker surfaced (1 test — the AR-8 WordStar collision).** Wiring select-all fixed the 10 transient
> regressions but exposed `editor.impl.test.ts > "keyBindings:'wordstar' … Ctrl+C = pageDown, not
> copy"`. WordStar binds Ctrl+C→pageDown, but the global default (`'both'`) swallows Ctrl+C→`Commands.copy`;
> with select-all now working, Ctrl+A selects all → Ctrl+C copies the buffer → the WordStar assertion
> breaks. This is precisely the AR-8 documented limitation (auto-detecting WordStar editors was
> explicitly rejected); its resolution is that WordStar apps opt out via `clipboardKeys`. Awaiting the
> user's decision on the test fix before full verify (task 1.3.2).

### Step 1.3: Implementation tests & hardening

- [x] 1.3.1 Write impl tests (wide-glyph selection copy; caret after cut; OS sink still fires headless-no-op boundary) — `packages/ui/test/controls.global-clipboard.impl.test.ts` ✅ (completed: 2026-07-12 22:20 — 3 green)
- [x] 1.3.2 Full verification ✅ (completed: 2026-07-12 22:20)

**Verify**: `yarn verify`

> **Phase 0+1 verify result (2026-07-12 22:20).** The feature is fully green: `@jsvision/ui` typecheck +
> build + **full unit suite 1559/1559** + check:docs (every public export has an `@example`, no banned
> refs); every ui-dependent package green (examples 160 · files 148 · web 41 · docs-site 53 ·
> theme-designer 52); `check-plugin` PASS; prettier + eslint clean on all changed files. The AR-8
> WordStar collision (runtime AR-19) was resolved by opting that test out via `clipboardKeys: 'none'`.
> **Two PRE-EXISTING, release-induced repo failures remain, unrelated to this feature** (present on the
> base branch after the v0.2.0 `[skip ci]` release, and NOT in this feature's changeset): (1) prettier
> drift on the generated `*/CHANGELOG.md` + `RELEASE_NOTES.md`; (2) core `packaging.spec` ST-3 (`npm pack`
> now includes `CHANGELOG.md`, which the allow-list `{package.json, README.md, LICENSE}` omits). These
> are surfaced for a separate chore; folding them into this feature would be unrelated scope.

---

## Phase 2: Global paste via the app-local buffer

Governs: [03-02](03-02-clipboard-buffer-seam.md) (read seam) + [03-03](03-03-widget-integration.md)
(Input paste). Makes `Ctrl+V` functional on every terminal — no OSC-52 read.

### Step 2.1: Specification tests

**Reference**: 07 ST-11, ST-12, ST-15, ST-17, ST-20 · AR-4

- [x] 2.1.1 Extend Input spec (ST-11 paste from buffer, ST-12 empty no-op, ST-15 validator/maxLength drop, ST-17 ComboBox/History inherit, ST-20 raw-`Ctrl+A` fallback under `'none'`) — `packages/ui/test/controls.global-clipboard.spec.test.ts` ✅ (completed: 2026-07-12 22:36)
- [x] 2.1.2 Extend packaging spec for `readClipboard` on `DispatchEvent` (ST-7) — `packages/ui/test/event.packaging.spec.test.ts` ✅ (completed: 2026-07-12 22:36)
- [x] 2.1.3 Run spec tests — verify the new cases FAIL (red phase) ✅ (completed: 2026-07-12 22:36 — ST-11/15/17 red; ST-12/20 already held)

### Step 2.2: Implementation

**Reference**: 03-02 §readClipboard seam, 03-03 §Input.2

- [x] 2.2.1 Add `readClipboard()` across the four sites — `RouteContext` + `ev2` enrichment (`dispatch.ts`), `routeContext()` (`event-loop.ts`), and `DispatchEvent` (`view/types.ts`) ✅ (completed: 2026-07-12 22:05 — **done in Phase 1 task 1.2.1**, per runtime AR-18)
- [x] 2.2.2 `Input.runClipboard('paste')` reads `ev.readClipboard?.() ?? ''` and inserts via the existing `pasteText`/`applyPaste` path — `packages/ui/src/controls/input.ts` ✅ (completed: 2026-07-12 22:36)
- [x] 2.2.3 Run spec tests — verify they PASS (green phase) ✅ (completed: 2026-07-12 22:36 — 12/12 spec green)

### Step 2.3: Implementation tests & hardening

- [x] 2.3.1 Write impl tests (paste through picture/filter/range validators; caret placement; unit-constructed event → undefined seam no-op) — `packages/ui/test/controls.global-clipboard.impl.test.ts` ✅ (completed: 2026-07-12 22:36 — 4 added, 7 total green)
- [x] 2.3.2 Full verification ✅ (completed: 2026-07-12 22:36 — ui 1568 unit + typecheck + check:docs; all ui-dependent pkgs green)

**Verify**: `yarn verify`

---

## Phase 3: Cross-widget consistency (Editor↔Input)

Governs: [03-03](03-03-widget-integration.md) §Editor.3. Editor **copy** already fills the shared
buffer via the wired `mirrorSink` (AR-6); this phase adds the Editor **paste** fallback + the modal
scope guard.

### Step 3.1: Specification tests

**Reference**: 07 ST-19, ST-22, ST-23 · AR-6, AR-15

- [x] 3.1.1 Write cross-widget + modal-scope spec tests (ST-22 Editor→Input, ST-23 Input→Editor, ST-19 copy-in-dialog → paste-after-close) — `packages/ui/test/editor.global-clipboard.spec.test.ts` ✅ (completed: 2026-07-12 22:45)
- [x] 3.1.2 Run spec tests — verify they FAIL (red phase) ✅ (completed: 2026-07-12 22:45 — ST-23 red; ST-22/19 already held via the loop buffer)

### Step 3.2: Implementation

**Reference**: 03-03 §Editor.3

- [x] 3.2.1 Thread `ev.readClipboard` → `ed.clipboardRead` in `handleEditorEvent` (mirror of the `mirrorSink` line); `editorPaste` falls back to the loop buffer when the clipboard editor yields `''` — `packages/ui/src/editor/editor-events.ts`, `packages/ui/src/editor/editor-clipboard.ts` ✅ (completed: 2026-07-12 22:45)
- [x] 3.2.2 Run spec tests — verify they PASS (green phase) ✅ (completed: 2026-07-12 22:45 — 4/4 editor global-clipboard specs green)

### Step 3.3: Implementation tests & hardening

- [x] 3.3.1 Write impl tests (precedence: an injected clipboard editor beats the loop buffer when both are set; paste is one undo step) — `packages/ui/test/editor.global-clipboard.impl.test.ts` ✅ (completed: 2026-07-12 22:45 — 2 green)
- [x] 3.3.2 Full verification ✅ (completed: 2026-07-12 22:48 — ui 1573 unit + typecheck + check:docs; all ui-dependent pkgs green; check-plugin PASS)

**Verify**: `yarn verify`

> **Cross-feature oracle conflict — RESOLVED (runtime AR-20, user-chosen).** The cross-widget Editor
> paste fallback (R4/R12/AR-6, required by ST-23 whose paste target is a *bare* Editor; 03-03 §Editor.3
> specifies falling back when the clipboard editor is "absent **or** empty") deliberately supersedes the
> RD-08 oracle `editor.spec.test.ts > ST-17`'s "bare Editor paste is a no-op" clause (TV null-clipboard,
> RD-08 PA-2). It was the ONLY editor regression. Resolved by updating that one RD-08 assertion
> (`bare.getText()` `'c'`→`'abc'`) + its comment/title, marked in-code as the deliberate global-clipboard
> supersession. Suite green 1573/1573.

---

## Phase 4: Polish, config & kitchen-sink story

Governs: [03-03](03-03-widget-integration.md) §Input.5 + §Kitchen-sink story. Enable-gating +
the mandatory showcase story.

### Step 4.1: Specification tests

**Reference**: 07 ST-24, ST-25 · AR-7, AR-12

- [x] 4.1.1 Write `Input.hasSelection()` spec test (ST-24) — `packages/ui/test/controls.global-clipboard.spec.test.ts` ✅ (implemented: 2026-07-12 23:15)
- [x] 4.1.2 Confirm the kitchen-sink smoke covers the new story (ST-25) — `packages/examples/kitchen-sink/test/kitchen-sink.smoke.spec.test.ts` (generic registry loop picks it up; no new file) ✅ (implemented: 2026-07-12 23:15)
- [x] 4.1.3 Run spec tests — verify the new/uncovered cases FAIL (red phase) — ST-24 was red before `hasSelection`; the smoke's registry loop had no `controls/clipboard` entry ✅ (implemented: 2026-07-12 23:15)

### Step 4.2: Implementation

**Reference**: 03-03 §Input.5, §Kitchen-sink story

- [x] 4.2.1 Add `Input.hasSelection(): boolean` **and** a reactive `hasSelection: Signal<boolean>` updated on every selection change (`selectAll`, shift-extend, drag/double-click select, collapse/delete) — the mirror of the Editor's `hasSelection` (`Input` has no selection signal today). The app binds it for menu/status greying — `packages/ui/src/controls/input.ts` ✅ (implemented: 2026-07-12 23:15)
- [x] 4.2.2 Add the `clipboard` story (two `Input`s + a `Memo`, live bound-state echo, copy/cut/paste/select-all across widgets, keyboard+mouse, hints) + register it — `packages/examples/kitchen-sink/stories/clipboard.story.ts`, `packages/examples/kitchen-sink/stories/index.ts` ✅ (implemented: 2026-07-12 23:15)
- [x] 4.2.3 Add `@example` JSDoc to every new public export; confirm no banned CodeOps/TV IDs in shipped comments — `packages/ui/src/**` ✅ (implemented: 2026-07-12 23:15)
- [x] 4.2.4 Run spec + smoke tests — verify they PASS (green phase) — controls.global-clipboard.spec 13/13, kitchen-sink.smoke 52/52 ✅ (implemented: 2026-07-12 23:15)

### Step 4.3: Implementation tests & hardening

- [x] 4.3.1 Write impl tests / story polish (no clipped text; bound-state echo updates) — added the reactive `hasSelection` fires-on-selection-only-change impl test (8/8 green); tightened the story's hints + `Notes` label so nothing clips at ~72 cols — `packages/ui/test/controls.global-clipboard.impl.test.ts`, `packages/examples/kitchen-sink/stories/clipboard.story.ts` ✅ (implemented: 2026-07-12 23:24)
- [x] 4.3.2 Full verification + `yarn check:docs` + kitchen-sink smoke — ui 1575/1575, examples 161/161, check:docs clean, typecheck/build green. Refactor note: `hasSelection` pushed `input.ts` to 518 lines (over the ≤500 controls-file oracle ST-13/ST-15); extracted the pure `draw()` paint body to `input-render.ts` as `paintInput` → 497, oracle green. Out-of-scope pre-existing/environmental core failures (untouched by this feature): `packaging.spec` ST-3 (CHANGELOG.md not in the pack allow-list, v0.2.0 `[skip ci]` release drift) + `perf-budget.spec` ST-1 (timing test, flaky under the parallel turbo fan-out; passes 2/2 in isolation; never gates) ✅ (implemented: 2026-07-12 23:24)

**Verify**: `yarn verify` && `yarn workspace @jsvision/examples test`

---

## Phase 5: Cleanup & supersede #5

Governs: [03-03](03-03-widget-integration.md) §Retire path + `01` acceptance criteria 15 (close #5 +
`CHANGELOG.md`). Removes the now-redundant classic classifier and finalizes governance.

### Step 5.1: Regression guard (BEFORE removal)

**Reference**: 07 ST-16 · AR-5

- [ ] 5.1.1 Confirm ST-16 (classic `Ctrl+Insert` → `Commands.copy` via alias → Input copies) is green **before** touching `clipboardChord()`, so the removal is proven safe by behavior — `packages/ui/test/controls.global-clipboard.spec.test.ts`

### Step 5.2: Implementation

**Reference**: 03-03 §Retire path & barrel

- [ ] 5.2.1 Delete `clipboardChord()` + its call site + now-unused imports — `packages/ui/src/controls/input-clipboard.ts`, `packages/ui/src/controls/input.ts`
- [ ] 5.2.2 Migrate/remove the obsolete `clipboardChord` unit oracles — the classic-chord behavior is now guarded by ST-16 at the command layer (AR-5-authorized removal) — `packages/ui/test/controls.input-clipboard.spec.test.ts`, `packages/ui/test/controls.input-clipboard.impl.test.ts`
- [ ] 5.2.3 Update `CHANGELOG.md` (Unreleased → Added: global clipboard & selection; note the `Ctrl+C`-consumed behavioral change + `clipboardKeys`) — `CHANGELOG.md`
- [ ] 5.2.4 Run affected tests — verify green

### Step 5.3: Wrap-up

- [ ] 5.3.1 Full verification + relevant `test:e2e` — `yarn verify` && `yarn test:e2e`
- [ ] 5.3.2 Close #5 as superseded, linking this plan / #73 (`gh issue close 5`) — verify the acceptance-criteria checklist in `01-requirements.md` is fully satisfied

**Verify**: `yarn verify` && `yarn test:e2e`

---

## Dependencies

```
Phase 0 (keymap + commands + config)
    ↓
Phase 1 (dual-sink write + select-all wiring)   ← highest value, no read seam
    ↓
Phase 2 (read seam + Input paste)
    ↓
Phase 3 (cross-widget Editor↔Input)             ← needs the buffer + read seam
    ↓
Phase 4 (enable-gating + story)                 ← polish; depends on Input selection API
    ↓
Phase 5 (retire clipboardChord + CHANGELOG + close #5)   ← last, once aliases proven (ST-16)
```

Phases 1–2 deliver the core acceptance criteria; 3–5 complete the Should-Haves and governance.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (`yarn verify` + relevant `test:e2e` + kitchen-sink smoke)
3. ✅ No warnings/errors
4. ✅ No dead code — `clipboardChord()` retired; no unused params/imports
5. ✅ Security hardened — buffer in-memory only; paste sanitized via existing validator/`mapPasteChar`; OS write via the existing capability gate; no OSC-52 read
6. ✅ Documentation updated — `@example` on every new public export; `CHANGELOG.md`; JSDoc rewritten; `yarn check:docs` green
7. ✅ Acceptance criteria in `01-requirements.md` all checked
8. ✅ `#5` closed as superseded
9. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
