# Execution Plan: DX Ergonomics Pass

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-08 11:23
> **Progress**: 26/26 tasks (100%)
> **CodeOps Skills Version**: 3.3.2

## Overview

Three additive, backward-compatible DX improvements to `@jsvision/ui` (Proposals 2, 3, 4 of
`DX-ASSESSMENT.md`), plus a flagship-demo proof phase. Each feature phase follows spec-first
ordering; the phases are independently shippable and ordered P2-caps → P3-onCommand → P4-modals →
demo so the demo can exercise all three at the end.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Proposal 2 — caps 'auto' & core re-exports | 8 |
| 2 | Proposal 3 — onCommand handler API | 8 |
| 3 | Proposal 4 — async modal helpers | 7 |
| 4 | Flagship proof & governance | 3 |

**Total: 26 tasks across 4 phases**

> **⚠️ EXECUTION RULE:** The task checkboxes below are the single source of truth for progress.
> Mark `[~]` (implemented, timestamp) then `[x]` (verified, timestamp); update the Progress header
> after every task. Timestamps via `date '+%Y-%m-%d %H:%M'`. Resume at the first `[~]`, else first `[ ]`.
>
> **Spec-first is non-negotiable** (`_shared/spec-first-ordering.md`): spec tests → red → implement →
> green → impl tests → verify. A failing spec test means the code is wrong, never the test.

**Verify command (every Verify line):** `yarn lint` → touched package `yarn workspace <pkg> typecheck`
→ `yarn verify` (per AR / confirmed). For P1–P3 the package is `@jsvision/ui`; P4 also touches `@jsvision/examples`.

---

## Phase 1: Proposal 2 — caps 'auto' & core re-exports

### Step 1.1: Specification Tests
**Reference**: [03-01](03-01-caps-and-reexports.md) · 07 §Proposal 2 · AR-3, AR-4

- [x] 1.1.1 Write spec tests for ST-1…ST-5 (caps default/'auto'/explicit; the 7 re-exports value+type) — `packages/ui/test/app-caps.spec.test.ts`, `packages/ui/test/ui-reexports.spec.test.ts` (2026-07-08 10:18)
- [x] 1.1.2 Run the two spec files — verify they FAIL (red phase) (2026-07-08 10:18)

### Step 1.2: Implementation
**Reference**: [03-01](03-01-caps-and-reexports.md) §Implementation Details

- [x] 1.2.1 Widen `ApplicationOptions.caps` to `CapabilityProfile | 'auto'` (optional) + add `resolveCaps()` and resolve once at the top of `createApplication`, threading the concrete profile to `createEventLoop` and `runApplication` — `packages/ui/src/app/application.ts` (2026-07-08 10:20)
- [x] 1.2.2 Add the 7 re-exports (`resolveCapabilities`, `resolveCapabilitiesAsync`, `createKeymap`, `Attr` values; `CapabilityProfile`, `Style`, `Keymap` types) — `packages/ui/src/index.ts` (2026-07-08 10:20)
- [x] 1.2.3 Update `createApplication` JSDoc `@example` to the zero-config, single-package form; drop "Only `caps` is required" — `packages/ui/src/app/application.ts` (2026-07-08 10:20)
- [x] 1.2.4 Run spec tests ST-1…ST-5 — verify they PASS (green phase) (2026-07-08 10:20)

### Step 1.3: Implementation Tests & Hardening

- [x] 1.3.1 Impl test: `'auto'`/undefined never leak past `createApplication` (loop receives a real profile object) — `packages/ui/test/app-caps.impl.test.ts` (2026-07-08 10:21)
- [x] 1.3.2 Full verification (2026-07-08 10:21)

**Deliverables**: [x] caps optional + resolved · [x] 7 re-exports · [x] all P1 tests + `check-jsdoc` green · [ ] commit via /gitcm
**Verify**: `yarn lint` → `yarn workspace @jsvision/ui typecheck` → `yarn verify`

---

## Phase 2: Proposal 3 — onCommand handler API

### Step 2.1: Specification Tests
**Reference**: [03-02](03-02-oncommand.md) · 07 §Proposal 3 · AR-5…AR-9

- [x] 2.1.1 Write spec tests for ST-6…ST-12 + ST-20 (register/multi/unsubscribe/consume; app forward; quit still ends `run()`; quit-with-open-modal cascade; **ST-20: quit with a numeric arg resolves that exit code**) — `packages/ui/test/event.oncommand.spec.test.ts`, `packages/ui/test/app-oncommand.spec.test.ts`. ST-11/ST-12/ST-20 pin the CURRENT quit behavior (incl. the numeric exit code) before the refactor. (2026-07-08 10:38)
- [x] 2.1.2 Run the two spec files — verify they FAIL (red phase; ST-11/12/20 pass pre-refactor — they guard against regression) (2026-07-08 10:38)

### Step 2.2: Implementation
**Reference**: [03-02](03-02-oncommand.md) §Implementation Details

- [x] 2.2.1 Declare `onCommand(command, handler): () => void` on the `EventLoop` interface — `packages/ui/src/event/types.ts` (2026-07-08 11:06)
- [x] 2.2.2 Add the general `CommandSink` (`Map<command, Set<(arg?)=>void>>`, fires all + `ev.handled=true`, snapshot iteration, **per-handler try/catch isolation**, internal `registerInternal` typed path alongside public `register`) and `EventLoopImpl.onCommand`. **Runtime AR-14: the loop owns the sink but sweeps it directly in `route()` gated on `!modal.isActive()` — NOT mounted into `root.children`** (placement (a) mutated the caller's Group + broke `@jsvision/files`; direct-sweep is behaviorally identical) — `packages/ui/src/event/event-loop.ts` (2026-07-08 11:06)
- [x] 2.2.3 Generalize quit: the loop registers `Commands.quit` **internally via `registerInternal`, reading the numeric exit-code `arg`** (public `onCommand` stays `() => void`), driven by a new `EventLoopOptions.onQuit` seam; remove the bespoke `QuitCommandSink`; `createApplication` supplies `onQuit: (code) => quitState.resolve?.(code)`; add `Application.onCommand` (+ its type on the `Application` interface) forwarding to `loop.onCommand` — `packages/ui/src/app/application.ts`, `packages/ui/src/event/event-loop.ts`, `packages/ui/src/event/types.ts` (2026-07-08 11:06)
- [x] 2.2.4 Run spec tests ST-6…ST-12 + ST-20 — verify they PASS (green phase) (2026-07-08 11:06)

### Step 2.3: Implementation Tests & Hardening

- [x] 2.3.1 Impl tests: a throwing handler is isolated in its own try/catch (siblings still fire, command stays consumed), double-unsubscribe idempotent, self-unsubscribe during fire, multi-handler all-fire — `packages/ui/test/event.oncommand.impl.test.ts` (2026-07-08 11:06)
- [x] 2.3.2 Full verification (existing app-shell + event + files suites all green — 1365 ui tests) (2026-07-08 11:07)

**Deliverables**: [x] `loop.onCommand` + `app.onCommand` · [x] quit via the one mechanism · [x] all P2 tests green · [ ] commit via /gitcm
**Verify**: `yarn lint` → `yarn workspace @jsvision/ui typecheck` → `yarn verify`

---

## Phase 3: Proposal 4 — async modal helpers

### Step 3.1: Specification Tests
**Reference**: [03-03](03-03-modal-helpers.md) · 07 §Proposal 4 · AR-10…AR-12

- [x] 3.1.1 Write spec tests for ST-13…ST-19 (`messageBox` ok/okCancel; `confirm` yes→true / no·esc→false; `inputBox` value/null; editor `infoBox`/`confirmBox` return contract) — `packages/ui/test/message-box.spec.test.ts` + extend `packages/ui/test/editor-dialogs.spec.test.ts`. ST-19 pins the CURRENT editor behavior before the refactor. (2026-07-08 11:12)
- [x] 3.1.2 Run the spec files — verify they FAIL (red; ST-19 passes — guards regression) (2026-07-08 11:12)

### Step 3.2: Implementation
**Reference**: [03-03](03-03-modal-helpers.md) §Implementation Details

- [x] 3.2.1 Create `messageBox`/`confirm`/`inputBox` + `ModalDialogHost` + a shared `runDialog` engine — `packages/ui/src/dialog/message-box.ts`; export them from `packages/ui/src/dialog/index.ts` and the `@jsvision/ui` barrel `packages/ui/src/index.ts` (2026-07-08 11:16)
- [x] 3.2.2 Refactor editor `infoBox`→`messageBox` delegation; `runDialog` moved to `dialog/message-box.ts` (module-internal, imported by the remaining editor builders); `EditorDialogHost` aliased to `ModalDialogHost` (DRY); `confirmBox`/`findDialog`/`replaceDialog`/`replacePrompt` keep their contracts, now calling the shared `runDialog` — `packages/ui/src/editor/dialogs.ts` (2026-07-08 11:16)
- [x] 3.2.3 Run spec tests ST-13…ST-19 — verify they PASS (green phase) (2026-07-08 11:16)

### Step 3.3: Implementation Tests & Hardening

- [x] 3.3.1 Impl tests: sizing edges, `inputBox` validator vetoes OK + refocuses, `messageBox` OK-only Esc resolves `'cancel'` (box closes, does not stay open) — `packages/ui/test/message-box.impl.test.ts` (2026-07-08 11:17)
- [x] 3.3.2 Full verification (existing editor suite stays green — 1379 ui tests) (2026-07-08 11:18)

**Deliverables**: [x] 3 helpers + host type exported · [x] editor delegates · [x] all P3 tests + `check-jsdoc` green · [ ] commit via /gitcm
**Verify**: `yarn lint` → `yarn workspace @jsvision/ui typecheck` → `yarn verify`

---

## Phase 4: Flagship proof & governance

**Reference**: 01 R13 · AR-13 · CLAUDE.md (API governance, `tvision-demo`)

- [x] 4.1 Update `tvision-demo`: dropped the `caps` prologue (zero-config) + both `main.ts`/`widgets.ts` now import only from `@jsvision/ui` (`Attr`/`Style` via the new re-exports); replaced the invisible `CommandSink` with `app.onCommand('about', …)`; replaced the raw About-box ceremony (`AboutDialog`+`execView`/`endModal`) with `messageBox(app, …)`; removed the now-dead `CommandSink`/`AboutDialog` classes — `packages/examples/tvision-demo/{main,widgets}.ts` (2026-07-08 11:23)
- [x] 4.2 Add a `CHANGELOG.md` entry documenting the three additive APIs (caps `'auto'` + re-exports, `onCommand`, modal helpers) under the unreleased section — `CHANGELOG.md` (2026-07-08 11:23)
- [x] 4.3 Full verification incl. `@jsvision/examples` typecheck + full e2e/smoke suite green; demo loads + runs its non-TTY guard path (single-package import graph confirmed) (2026-07-08 11:23)

**Deliverables**: [x] demo uses all three, single-package · [x] CHANGELOG updated · [x] full green · [ ] commit via /gitcm
**Verify**: `yarn lint` → `yarn workspace @jsvision/ui typecheck` → `yarn workspace @jsvision/examples typecheck` → `yarn verify`

---

## Dependencies

```
Phase 1 (caps + re-exports)
    ↓                        (independent, but P4 demo imports rely on P1's single-package barrel)
Phase 2 (onCommand)
    ↓                        (P4 demo 'about' wiring uses P2)
Phase 3 (modal helpers)
    ↓                        (P4 demo About uses P3; P3 barrel export also single-packages the demo)
Phase 4 (flagship proof + CHANGELOG)
```

Phases 1–3 are each independently shippable and verifiable; Phase 4 depends on all three.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 26 tasks completed
2. ✅ `yarn lint` + touched-package `typecheck` + `yarn verify` passing
3. ✅ No warnings/errors; `check-jsdoc.mjs` green (every new public export has an `@example`, no banned IDs)
4. ✅ No dead code (the bespoke `QuitCommandSink` is removed, not left orphaned)
5. ✅ Security: no new unvalidated input path (modal text/field flow through existing `sanitize`/validator)
6. ✅ `tvision-demo` compiles/runs using all three APIs and imports only `@jsvision/ui`
7. ✅ Backward compatibility: every pre-existing call site (explicit `caps`, editor `infoBox`/`confirmBox`) still works
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
