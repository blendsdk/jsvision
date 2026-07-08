# Preflight Report — `dx-ergonomics` (full plan)

> **Status**: ✅ PASSED — all 9 findings resolved (fixes applied to the plan docs 2026-07-08)
> **Iteration**: 1 (full-plan scan; supersedes the earlier 03-02-only scan)
> **Artifact**: implementation plan at `codeops/features/jsvision-ui/plans/dx-ergonomics/`
> **Scanned**: 2026-07-08 · fresh session (independent of the authoring session)
> **Codebase Grounded**: 12 source files examined, all doc references mapped
> **Findings**: 9 (3 major, 5 minor, 1 observation) — all resolved

## Resolution — user accepted all recommendations (2026-07-08)

The user accepted every recommendation (Option A on the three majors; the stated recommendation on
each minor/observation). Fixes were applied to the plan docs:

| Finding | Decision | Applied to |
|---|---|---|
| PF-001 (MAJOR) | Resolved — Option A: public `onCommand` stays `() => void`; exit code via the sink's internal `registerInternal` path; add ST-20 | `03-02` (CommandSink + quit block + exit-code note), `07`/`01`/`99` (ST-20) |
| PF-002 (MINOR) | Resolved — stale `ST-9`/`AR-9` refs replaced (the exit-code sub-point now cites ST-20) | `03-02` |
| PF-003 (MINOR) | Resolved — placement **(a)** chosen (loop owns + mounts the sink; no new public seam) | `03-02`, `99` (2.2.2/2.2.3) |
| PF-004 (MINOR) | Resolved — per-handler try/catch (log-and-continue); error table + impl tests updated | `03-02`, `07`, `99` |
| PF-005 (MINOR) | Resolved — Integration Points qualified with the modal-open limitation | `03-02` |
| PF-006 (OBS) | Resolved — `Application.onCommand` added to the New Types block | `03-02` |
| PF-007 (MAJOR) | Resolved — Option A: `Attr` moved to the value re-export line; ST-4 guards it as a value, ST-5 drops it | `03-01`, `07`, `00-ambiguity-register` (AR-4) |
| PF-008 (MAJOR) | Resolved — Option A: OK-only `messageBox` resolves `'cancel'` on Esc/close; doc + impl test corrected | `03-03`, `07`, `99` (3.3.1) |
| PF-009 (MINOR) | Resolved — `runDialog` move enumerates all editor callers; kept module-internal | `03-03`, `99` (3.2.2) |

Findings below are retained as the audit trail.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM-only (NodeNext strict), yarn 1.x + Turborepo monorepo, zero runtime deps, vitest.
**Architecture:** `@jsvision/ui` widget framework on `@jsvision/core`; single-barrel public surface (`packages/ui/src/index.ts`).
**Scope:** the three additive proposals (P1 caps/re-exports · P2/P3 onCommand · P4 modal helpers) + a demo/governance phase.

**Key files examined & verified:**
- `packages/ui/src/app/application.ts` — `caps` required `:25`, threaded to `createEventLoop` `:211` + `runApplication` `:272`; `QuitCommandSink` `:82-102` reads `inner.arg` as exit code `:96-97`; `Application` iface `:62-72` (no `onCommand` today).
- `packages/ui/src/app/run.ts` — `QuitState.resolve: ((code:number)=>void)` `:27-29`; `run()` returns "exit code carried by 'quit' (0 if none)" `:56`. Grep: nothing emits quit with a numeric arg → exit code is always 0 in practice (latent capability).
- `packages/core/src/engine/index.ts` — `resolveCapabilities`/`Async` values `:15`, `createKeymap` value `:35`; `CapabilityProfile` `:17`/`Keymap` `:48`/`Style` `:74` are `export type`; **`Attr` is a VALUE** `:55` (`export const Attr = {…}`, `render/types.ts:40`), used as `Attr.bold`/`Attr.none` in custom `draw()`.
- `resolveCapabilities(options = {})` `index.ts:87` defaults `env ?? process.env`, `platform ?? toPlatform(process.platform)` → the zero-arg `.profile` path is sound.
- `packages/ui/src/dialog/dialog.ts` — modal `Dialog`, `closable=true` by default; `onEvent` resolves the modal to **`cancel` on Esc `:175-178` and the frame close-box `:181-188` unconditionally** (independent of hosted buttons).
- `packages/ui/src/editor/dialogs.ts` — private `runDialog` `:49` (used by `findDialog`/`replaceDialog`/`confirmBox`/`infoBox`/`replacePrompt`); `EditorDialogHost` seam `:30-35`; `infoBox` `:179` (no title, OK-only), `confirmBox` `:158` (Yes/No/Cancel).
- `packages/ui/src/window/frame.ts:147` — the frame title draws only `if (state.title.length > 0)`, so `title:''` renders **identically** to no-title (the infoBox→messageBox delegation is safe — not a finding).
- `packages/ui/src/reactive/types.ts:27` — `Signal.peek()` exists (the `inputBox` `value.peek()` reference is valid).
- `packages/ui/src/dialog/buttons.ts` — `okButton`/`cancelButton`/`yesButton`/`noButton`/`okCancelButtons`/`yesNoButtons` all exist as specified.
- `packages/ui/src/event/{event-loop,dispatch}.ts` (P3, prior scan) — `deliver()` try/catch `:392-398` isolates the loop not per-handler; `scopeRoot()` `:330-332` = modal top view while a modal is open (root sink out of scope during a modal).

### Summary by Severity

| Severity | Count | Status |
|---|---|---|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 3 | PF-001, PF-007, PF-008 — ✅ resolved |
| 🟡 MINOR | 5 | PF-002, PF-003, PF-004, PF-005, PF-009 — ✅ resolved |
| 🔵 OBSERVATION | 1 | PF-006 — ✅ resolved |

### Summary by Phase

| Phase | Findings |
|---|---|
| P1 — caps 'auto' & re-exports | 🟠 PF-007 |
| P2/P3 — onCommand | 🟠 PF-001 · 🟡 PF-002/003/004/005 · 🔵 PF-006 |
| P4 — modal helpers | 🟠 PF-008 · 🟡 PF-009 |

**Recommendation hardening:** the 3 MAJOR findings were batched to one independent challenger (per the challenger-budget rule). It **converged** on Option A for all three. Confidence per finding below.

---

## 🟠 PF-007 (MAJOR) — `Attr` is re-exported as a type but is a runtime value; the single-package `draw()` use case would import `undefined`

**Dimension:** Codebase Alignment (stale assumption) / Consistency
**Location:** `03-01-caps-and-reexports.md` §Integration Points (lines 64-65); `00-ambiguity-register.md` AR-4; `07-testing-strategy.md` ST-5; `01-requirements.md` R3.
**Codebase Evidence:** `packages/core/src/engine/index.ts:53-55` exports `Attr` in a **value** block; `packages/core/src/engine/render/types.ts:40` `export const Attr = { none, bold, underline, … }`; used as a value in `view/render-root.ts:97`, `menu/builders.ts:25`, examples' `draw()`s (`{ attrs: Attr.bold }`).

**The Problem:** The re-export block writes
```ts
export { resolveCapabilities, resolveCapabilitiesAsync, createKeymap } from '@jsvision/core';
export type { CapabilityProfile, Attr, Style, Keymap } from '@jsvision/core';
```
`export type { Attr }` is a **type-only** re-export — it emits no runtime binding — but `Attr` is a `const` object a custom `draw()` needs as a **value** (`Attr.bold`). Following the plan literally, `import { Attr } from '@jsvision/ui'` is `undefined` at runtime → `Attr.bold` throws. This directly defeats Gap 1's own motivation ("a custom `draw()` needs `Attr`/`Style`"). `Style`/`CapabilityProfile`/`Keymap` are genuinely types (correct); only `Attr` is misclassified. The plan's "executor confirms each symbol's kind" note is a weak backstop, because **ST-4 guards only `resolveCapabilities`/`Async`/`createKeymap` as values and ST-5 type-imports `Attr`** — so the spec suite stays green even with the broken re-export.

**Failure scenario:** Executor follows 03-01/AR-4/ST-5 verbatim → ships `export type { Attr }`; a consumer's `import { Attr } from '@jsvision/ui'; style.attrs = Attr.bold` compiles (type present) but crashes at runtime (`Cannot read properties of undefined`); all ST tests pass.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A (Recommended)** | Move `Attr` to the **value** export line; keep `CapabilityProfile`/`Style`/`Keymap` as `export type`; add a spec assertion that `Attr` value-imports from `@jsvision/ui` (`typeof Attr === 'object'`), extending ST-4. | Correct kinds; closes the test gap that let the bug hide; smallest surface. | Requires editing 03-01, AR-4, ST-4/ST-5. |
| B | Leave as written; rely on the "executor confirms kind at impl time" note. | No doc edits. | The spec (ST-5) still asserts the wrong kind; nothing guards the value; high chance of shipping the bug. |
| C | Re-export the whole core barrel: `export * from '@jsvision/core'`. | Never gets a kind wrong. | Abandons the curated 7-symbol surface; leaks the entire core namespace through the UI barrel (collision + governance risk). |

**Recommendation:** **Option A.** Confidence: **High** — `Attr` is unambiguously a `const`; `export type` erasure is definitional TS behavior. `Challenger: converged.`

---

## 🟠 PF-008 (MAJOR) — OK-only `messageBox` Esc/close is NOT inert: `Dialog` always resolves a modal to `cancel` on Esc and the close-box

**Dimension:** Logical Contradiction / Codebase Alignment (stale assumption) / Edge Cases
**Location:** `03-03-modal-helpers.md` §Behavior (line 96) + Error Handling row 3 (line 128); `07-testing-strategy.md` Impl list `message-box.impl.test.ts` ("messageBox OK-only Esc inert", line 82); `99-execution-plan.md` 3.3.1.
**Codebase Evidence:** `packages/ui/src/dialog/dialog.ts:175-178` (Esc → `resolveCancel`), `:181-188` (frame close-box → `resolveCancel`), `resolveCancel` → `endModal(Commands.cancel)` `:209-216`; `packages/ui/src/window/window.ts:105` `closable = true` by default.

**The Problem:** For the default OK-only box the plan says "Esc pressed → No Cancel to resolve to; box stays until OK (matches infoBox)" and lists an impl test asserting that. But `Dialog` resolves the modal to `cancel` on **both** Esc and the frame close-box **unconditionally**, regardless of which buttons it hosts, and every dialog is `closable` by default. So an OK-only `messageBox` does **not** stay open on Esc — `execView` resolves `'cancel'`, and the box has a live `[×]` close-box too. (Today's `infoBox` behaves the same way; it simply ignores the returned command, so the "matches infoBox" clause is half-right — infoBox *does* close on Esc, it just doesn't observe it.) The plan's claim is counterfactual, and the impl test as described asserts behavior the underlying `Dialog` cannot produce.

**Failure scenario:** Executor writes `message-box.impl.test.ts` "OK-only Esc inert" per the doc → the test dispatches Esc and asserts the promise has not resolved → it *has* resolved to `'cancel'` → red, with no code bug to fix (the spec is wrong). Or the executor adds Esc-swallowing/`closable=false` logic not in the plan to make the doc true, silently diverging from `infoBox`.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A (Recommended)** | Accept the real behavior: an OK-only `messageBox` resolves `'cancel'` on Esc/close-box. Correct 03-03 (drop "Esc inert / stays open"), note `messageBox` may return `'cancel'` even with only OK, and rewrite the impl test to assert the `'cancel'` resolution. | Doc/test/code agree; "Esc = dismiss" is the faithful message-box semantic; matches today's infoBox. | Callers of an OK-only box can receive `'cancel'` (mild footgun — but they usually ignore the return, as infoBox does). |
| B | Make the OK-only box modal-locked: `closable=false` + swallow Esc so it truly stays until OK. | Matches the doc's original wording. | New behavior, extra logic not in the plan, diverges from infoBox, breaks the universal "Esc dismisses" expectation. |
| C | Keep exact infoBox parity (closable, closes on Esc) and just delete the incorrect "Esc inert" wording; change no behavior or return contract. | Minimal. | Leaves the `'ok'|'cancel'` return contract for the OK-only case under-specified. |

**Recommendation:** **Option A** — the honest, fully-specified version of C. Confidence: **Med-High** — the code is unambiguous; the only judgment is whether returning `'cancel'` from an OK-only box is acceptable (it is; callers ignore it). `Challenger: converged.`

---

## 🟠 PF-001 (MAJOR) — Exit-code resolution contradicts the declared `() => void` handler and is guarded by a test that does not exist

**Dimension:** Logical Contradiction / Completeness / Testability
**Location:** `03-02-oncommand.md` exit-code sub-point (lines 88-105) vs the `EventLoop.onCommand` signature (line 49) + R4/R6; `07-testing-strategy.md` ST-9.
**Codebase Evidence:** `application.ts:96-97` (`QuitCommandSink` reads `inner.arg` as the exit code); `run.ts:27-29,56` (`run(): Promise<number>` returns that code); `07` ST-9 = the `app.onCommand` **forward** test; grep — no spec asserts a non-zero exit code (ST-11/12 only assert `run()` resolves).

**The Problem:** The exit-code sub-point recommends widening the handler to `(arg?: unknown) => void` (option (i)) — but the plan's own `onCommand` signature and every ST/example pin it to `() => void`; option (ii) (hardcode 0) narrows the documented `Promise<number>` exit-code feature. Both are said to "keep ST-9 (quit exit code) green," but ST-9 is the app-forward test and **no spec asserts a non-zero exit code**, so either resolution ships unguarded — (ii) would silently drop the exit code with nothing red.

**Failure scenario:** Executor picks (ii) → `run()` always resolves `0` even when a caller emits `emitCommand(Commands.quit, 3)`; all tests green; the `Promise<number>` contract silently broken. Or picks (i) → public `onCommand` becomes `(arg?)=>void`, diverging from R4/the interface/every ST/example.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A (Recommended)** | Keep the public handler `() => void`; preserve the exit code via a **private** typed quit path (the sink passes the command event to its own quit closure, or the loop keeps a private typed quit hook) — not the public signature. Add a spec test emitting `quit` with a numeric arg asserting `run()` resolves that code. | Clean public API; feature preserved; fills the ST gap this finding exposes. | Two quit paths — the added spec test is load-bearing to prove exactly one owns the code. |
| B | Adopt (i): widen the public handler to `(arg?: unknown) => void` and update R4/R6/the interface/ST-6…12/examples to match. | Consistent. | Widens every handler's public surface for a latent-only feature. |
| C | Adopt (ii): accept exit code always 0 and explicitly drop the `Promise<number>`-nonzero promise (after user sign-off). | Simplest code. | Removes a documented feature. |

**Recommendation:** **Option A.** Confidence: **High.** `Challenger: converged.` Fix the wrong "ST-9 (quit exit code)" / "AR-9 notes" references regardless (PF-002).

---

## 🟡 PF-002 (MINOR) — Stale ST/AR cross-references in the exit-code sub-point

**Dimension:** Consistency / Codebase Alignment (phantom refs)
**Location:** `03-02-oncommand.md` lines 92, 105.
Line 92 ("keeps ST-9 (quit exit code) green; see AR-9 notes") and line 105 cite the wrong artifacts: **ST-9** in `07` is the `app.onCommand` forward test, not an exit-code test; **AR-9** is the *preProcess dispatch-phase* decision, nothing about exit codes. **Recommendation:** replace with correct references (there is no exit-code ST today — PF-001 Option A adds one) and drop "see AR-9 notes". Confidence: High.

---

## 🟡 PF-003 (MINOR) — Recommended placement (b) needs a seam the doc doesn't declare

**Dimension:** Codebase Alignment (architecture mechanism) / Feasibility
**Location:** `03-02-oncommand.md` lines 30-34 (option (b)) vs lines 79-83 (`private readonly commandSink`).
**Codebase Evidence:** `dispatch.ts` `collectSweep` walks the scopeRoot subtree, so the sink must be in the root tree; but the `EventLoop` interface exposes only `onCommand` — no accessor for `createApplication` to obtain the private sink instance and `root.add(...)` it. As written, (b) isn't implementable without an undeclared addition. **Recommendation:** either declare the seam (an internal `loop.commandSink`/`mountInto(root)` hook) or pick option (a) (the loop mounts the sink in `mount()`), and state the exact mechanism. Confidence: High.

---

## 🟡 PF-004 (MINOR) — "Handler throws" isolation is weaker than the table implies

**Dimension:** Edge Cases / Completeness
**Location:** `03-02-oncommand.md` error table line 124.
**Codebase Evidence:** `event-loop.ts:392-398` `deliver()` only stops the *loop* crashing. Because all handlers run inside the sink's single `onEvent` (`for (const fn of [...set]) fn()`, line 74) and `ev.handled = true` runs after (line 75), a throwing handler (a) skips every remaining handler and (b) leaves the event unconsumed, so it falls through to focus/postProcess — the opposite of "fire every handler, then consume." **Recommendation:** decide semantics explicitly — wrap each `fn()` in its own try/catch (log-and-continue) — and say so in the doc + impl-test list (line 132 already names "handler-throws isolation"). Confidence: High.

---

## 🟡 PF-005 (MINOR) — "Routes through it first anywhere" is false while a modal is open

**Dimension:** Codebase Alignment (impact) / Completeness
**Location:** `03-02-oncommand.md` Integration Points lines 108-109.
**Codebase Evidence:** `event-loop.ts:331` `scopeRoot()` becomes the modal subtree while a modal is open, so a root-mounted `preProcess` sink is not swept during a modal; a general `app.onCommand('x', fn)` will not fire while a `Dialog`/modal is open. Quit still works only via `cascadeQuit`'s special case (`:204-211`). Matches today's behavior (not a regression) but the blanket claim overstates it. **Recommendation:** qualify the sentence ("…except while a modal owns the dispatch scope") and note the modal-open limitation of general handlers. Confidence: High.

---

## 🟡 PF-009 (MINOR) — Moving the private `runDialog` touches more editor call sites than the task list enumerates

**Dimension:** Codebase Alignment (impact blindness) / Completeness
**Location:** `03-03-modal-helpers.md` §Proposed Changes (line 111) + `99-execution-plan.md` task 3.2.2.
**Codebase Evidence:** `runDialog` is currently a private helper in `editor/dialogs.ts:49` used by **five** builders: `findDialog:85`, `replaceDialog:139`, `confirmBox:166`, `infoBox:185`, `replacePrompt:211`. The plan moves it to `dialog/message-box.ts` and mentions only `infoBox`→`messageBox` and `confirmBox`→"reuse the shared runDialog." After the move, `findDialog`/`replaceDialog`/`replacePrompt` also lose their local `runDialog` and must import the moved one. **Recommendation:** enumerate that task 3.2.2 updates the imports for all remaining `runDialog` callers (or keep a thin local re-export), and confirm the moved `runDialog` is module-internal (imported via `../dialog/message-box.js`, not surfaced on the `dialog/` barrel — so `check-jsdoc` doesn't demand an `@example` for an internal helper). Low blast radius (a typecheck error would catch it), but worth stating so the executor imports rather than duplicates. Confidence: High.

---

## 🔵 PF-006 (OBSERVATION) — Doc-completeness nits (P3)

- The **`Application` interface** gains `onCommand` (shown only as a runtime forward, `03-02` line 95); the doc's "New Types/Interfaces" declares only the `EventLoop` change. The exec plan (2.2.3) does capture "+ its type on the `Application` interface" — a doc-symmetry gap, not a scope gap; add it to the New Types block.
- The error-handling table's **AR column** cites AR-5/6/7 for error-isolation, self-unsubscribe, and double-unsubscribe idempotency — behaviors those register entries don't actually cover (AR-5 = multiplicity, AR-6 = consume, AR-7 = surface+unsubscribe). Reasonable defaults, but the citations imply a recorded decision that isn't there.

## Dimension coverage

All 13 scanned, code-grounded. Clean: Ambiguities (1), Dependencies (5), Feasibility (6), Security (8 — `inputBox` flows through the existing `Input`/validator/`sanitize`; no new input surface), Scope Creep (10), Ordering (11). Findings concentrate in Implicit Assumptions (2: PF-007/008/001), Contradictions (3: PF-001/008), Completeness (4: PF-009/004), Testability (7: PF-001/007), Edge Cases (9: PF-008/004/005), Consistency (12: PF-002/007), and Codebase Alignment (13: PF-007/008 stale assumptions, PF-003 mechanism, PF-009 impact).

**Verified non-findings** (checked, sound): the zero-arg `resolveCapabilities().profile` path; `title:''` frame parity (`frame.ts:147`); `Signal.peek()`; the `{loop,desktop}` host seam matches `EditorDialogHost`; all button presets exist.
