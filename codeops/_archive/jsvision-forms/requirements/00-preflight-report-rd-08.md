# Preflight Report — RD-08 (formDialog() + Modal Submit-Gate)

> **Artifact**: `requirements/RD-08-form-dialog-modal-submit-gate.md`
> **Date**: 2026-07-16
> **Reviewer**: preflight (13-dimension, codebase-grounded)
> **⚠️ SAME-SESSION REVIEW** — RD-08 was authored in this same session. To counter authoring blind
>   spots, an **independent challenger** (fresh general-purpose agent) adversarially re-verified every
>   code claim and the async-interception feasibility against the real `@jsvision/ui` modal machinery.
>   Its findings are reconciled below; the two MAJORs and several MINORs are things the challenger
>   caught that the author's pass had missed.
> **PF numbering**: RD-07 preflight used PF-0xx; the async-loading plan PF-1xx/2xx. This report uses
>   **PF-3xx** to keep the sequence collision-free across the feature.

## Codebase Context Summary

RD-08 targets a new `formDialog()` bridge in `@jsvision/forms` over `@jsvision/ui`'s modal machinery.
Recon (Explore agent + challenger, cited to `file:line`):

- **`Dialog`** (`packages/ui/src/dialog/dialog.ts`): `valid(command): boolean` (`:164`) is **synchronous**
  and un-awaited; `handleTerminating` (`:219`, `protected`, overridable) runs `valid()` (`:222`) then
  `endModal` in the same tick and nulls `this.modalHost` (`:225`, not `:224`). `modalHost` is `protected`
  (`:83`), accessible to a subclass. `resolveCancel` (`:233`) handles Esc/close-box. A rect is applied
  **only when both `width` and `height` are defined** (`:102-109`).
- **Event loop** (`event-loop.ts`): `execView` injects the `ModalHost` into any `ModalHostAware` view
  (`:359-364`); `endModal → runTick` starts a fresh tick if not draining (`:370-373, 408-425`) — so an
  **off-tick `endModal` (after an `await`) works**. `cascadeQuit`/`isQuitVetoed` (`:318, 332-336, 43-46`)
  call the top view's `valid(command)` **synchronously** with the loop's `quitCommand` (default `'quit'`).
- **Modal helpers** (`message-box.ts`): `ModalDialogHost` (`:22-27`, barrel-exported at `ui/src/index.ts:148`)
  is `{ loop: Pick<EventLoop,'execView'>; desktop: Pick<Desktop,'addWindow'|'removeWindow'|'bounds'> }`.
  `runDialog` (`:77`), `messageBox`/`inputBox` build their **own** body (so they know its width).
- **Buttons** (`buttons.ts`): `okButton()`/`okCancelButtons()` hardcode `'~O~K'` and pass **no** `disabled`
  (`:33-35, 88-90`); `Button` label/command/disabled are `readonly`, constructor-only (`button.ts:57-83`),
  but the constructor **does** accept a reactive `disabled` getter (`button.ts:28, 84-95`). Every OK source
  (mouse, Enter-on-default, `emitCommand`) emits the `ok` command and reaches a `postProcess` dialog.
- **`form.submit()`** (`create-form.ts:213`, post-RD-07): awaits `onValid(coerced)` with **no** try/catch
  (`:228`) → a rejecting `onValid` makes `submit()` **reject**, not return `false`. `submitAttempted` is
  `signal(false)` at `:121`, `loading` at `:127`. No test locks the returned Form object's key-set (only
  the **barrel** surface-lock `surface.impl.test.ts:16-20`).
- **Harness** (`files/test/openers.impl.test.ts:24-60`): `createEventLoop` + a fake `{loop, desktop:
  {addWindow, removeWindow}}` host + `loop.emitCommand(Commands.ok/cancel)` drives the terminating path
  headlessly — the ACs are testable this way.

**Design soundness — verified, NOT defects (the core mechanism holds):**
- Async OK-interception is mechanically sound: `handleTerminating` overridable, off-tick `endModal` works,
  nothing else calls `valid('ok')` (only `cascadeQuit` with `'quit'`), the `valid()→cancel||isValid()`
  repurpose is coherent, and every OK source reaches the gate uniformly (headlessly testable).
- `submitting()` is low-risk/feasible (no Form-object key-set lock; try/finally around `submit()`'s
  awaited section doesn't change existing outcomes) — **not** scope creep.
- Ownership/lifecycle reasoning is correct (the form's root scope is independent of the dialog view, so the
  helper must dispose both; `dispose()` aborts an in-flight load via `onCleanup`).

## Findings

### 🟠 MAJOR

**PF-301 — Concurrent Cancel/Esc/quit during the in-flight `submit()` gate is unhandled (double-close /
save-after-cancel), and the "capture the host ref" rationale is mis-diagnosed.**
While `await form.submit()` is in flight the dialog is still mounted and modal, so the loop keeps
dispatching. An Esc/close-box (`dialog.ts:233`) or the Cancel button (base `handleTerminating`,
`dialog.ts:219-225`) ends the modal → `execView` resolves `'cancel'` → the outer `finally` runs
`form.dispose()`. When `submit()` later resolves `true`, the interceptor's **captured** `modalHost` calls
`endModal(Commands.ok)` on an already-popped frame — `modal.end` pops whatever is now on top (a no-op or a
wrong-modal close, `modal.ts:63-69`) — and `onSubmit` (the save) has been running against a form disposed
by the cancel. The RD's re-entrancy guard (Tech-Req step 1; AC #8) only covers a **second `ok`**, nothing
guards the cancel/quit path. Compounding it, Tech-Req step 2 justifies the captured ref as "the base
`handleTerminating` nulls `this.modalHost` after `endModal`" — but on the **intercepted OK** path the
subclass never calls super for `ok`, so that nulling (`dialog.ts:225`) never runs for OK; the cited
mechanism is irrelevant to the path it defends, and holding a stale ref is exactly what enables the bad
`endModal`.
**Recommendation:** lock/ignore Cancel + Esc + quit while `submitting()` is `true` (the modal is fully
sealed during the async gate), OR gate the interceptor's `endModal` on a "modal still active" flag; drop
the mis-stated capture rationale; add an explicit AC for cancel-during-submit. *(Confirmed by the
challenger; matches the author's own candidate PF-301/PF-306.)*

**PF-302 — The OK-gate snippet cannot handle an `onSubmit` rejection as written (unhandled rejection; AC
#7 unachievable).**
`submit()` awaits `onValid(coerced)` with **no** try/catch (`create-form.ts:228`), so a rejecting
`onSubmit` makes `submit()` **reject**, not resolve `false`. The RD's `const ok = await
form.submit(...)` interceptor (Tech-Req steps 3-4) then throws out of the fire-and-forget handler →
`unhandledRejection`, and step 4's "`false` **or** an `onSubmit` rejection → do nothing" is wrong because
`ok === false` never covers the reject case. AC #7 (rejection keeps the dialog open, promise unresolved)
is only achievable if the interceptor wraps the gate `await` in `try/catch`.
**Recommendation:** revise Tech-Req to wrap the gate `await` in `try/catch` (on catch: do nothing — dialog
stays open, OK re-enables once `submitting()` clears); state that `submit()`'s `submitting()` try/finally
clears state but still re-throws, so the interceptor must catch. Tighten AC #7 accordingly. *(Challenger
finding; missed by the author's pass.)*

### 🟡 MINOR

**PF-303 — `okText` + reactive `disabled` cannot be applied to the `okCancelButtons()` presets.**
`okButton()`/`okCancelButtons()` hardcode label `'~O~K'` and pass no `disabled` (`buttons.ts:33-35,
88-90`); `Button`'s label/command/disabled are `readonly`, set only in the constructor, with no label
setter (`button.ts:57-83`). So the Tech-Req/AR-60 claim ("`okCancelButtons()` … `okText` overrides the OK
label; OK `disabled: () => form.submitting()`") is infeasible as worded.
**Recommendation:** build the OK button directly — `new Button(options.okText ?? '~O~K', { command:
Commands.ok, default: true, disabled: () => form.submitting() })` (the constructor **does** accept a
reactive `disabled` getter, `button.ts:28`); use `cancelButton()` for Cancel. Correct Tech-Req + AR-60.

**PF-304 — AC #9 cites a non-existent command `Commands.quit-terminating`.**
`cascadeQuit` passes the loop's `quitCommand` (default `'quit'` = `Commands.quit`) to `valid()`
(`event-loop.ts:332-336, 43-46`); there is no `Commands['quit-terminating']` (`commands.ts:12-56`). The
concept works (the repurposed `valid('quit') => form.isValid()`), but the literal is wrong/untestable.
Also unstated: on a **valid** form the non-veto path is `modal.end('quit')`, which **closes** the dialog
resolving `null` (`'quit' !== 'ok'`).
**Recommendation:** reword AC #9 to `valid('quit')` / the loop's `quitCommand`, and note the valid-form
quit-closes-with-`null` consequence. *(Challenger + author candidate PF-303.)*

**PF-305 — The RD redeclares `ModalDialogHost`, dropping `desktop.bounds`.**
The real `ModalDialogHost` is `{ loop: Pick<EventLoop,'execView'>; desktop:
Pick<Desktop,'addWindow'|'removeWindow'|'bounds'> }` (`message-box.ts:22-27`) and is barrel-exported
(`ui/src/index.ts:148`). The RD's Tech-Req interface omits `bounds`, making a divergent look-alike rather
than "the existing seam."
**Recommendation:** import the exported `ModalDialogHost` (with `bounds`), or state plainly that a
narrower structural host is intended and why `bounds` is unused.

**PF-306 — "Sized to fit" is unachievable for an opaque caller-built `body` when `width`/`height` are
omitted.**
`Dialog` applies a layout rect **only when both** `width` and `height` are defined (`dialog.ts:102-109`);
`messageBox`/`inputBox` always compute a width from their known text (`message-box.ts:104, 159`).
`formDialog`'s `body` is an opaque `View`, so no fit can be derived — yet the FR lists `width`/`height` as
"optional geometry overrides" while the Overview promises "sized to fit."
**Recommendation:** require `width`/`height` (drop "optional"), OR specify a concrete default geometry, OR
require the body to be a measured/sized Group. *(Challenger + author candidate PF-302.)*

**PF-307 — Two off-by-one / wrong-range citations.**
(a) "the base nulls `modalHost` after `endModal` (dialog.ts:224)" — the assignment `this.modalHost = null`
is **line 225**; 224 is the comment. (b) "seeded beside `loading`/`submitAttempted` (create-form.ts:110-118)"
— that range is the seed loop; `submitAttempted` is **:121**, `loading` is **:127**.
**Recommendation:** correct both citations.

**PF-308 — Cross-doc staleness with RD-07.**
RD-07's Integration-Points note still says "`loading()` drives the dialog's initial 'Loading…' body,"
which RD-08 makes out-of-scope (AR-59). RD-08's integration section notes the correction, but RD-07's text
is stale.
**Recommendation:** add a one-line "superseded by RD-08 (AR-59)" pointer to RD-07's RD-08-integration note,
or accept as documented-in-RD-08. *(Author candidate PF-304.)*

**PF-309 — Initial focus on dialog open is unspecified.**
The RD doesn't say what receives focus when the dialog opens (first field vs the OK button).
`messageBox`/`inputBox` focus a sensible default; the shell focuses the first focusable.
**Recommendation:** specify (e.g., the first focusable view in the body), consistent with the shell/openers.
*(Author candidate PF-305.)*

## Decisions

| Finding | Severity | Decision | Applied where |
|---------|----------|----------|---------------|
| PF-301 | 🟠 MAJOR | ✅ applied | FR "sealed during the gate" bullet · Tech-Req async-gate step 1 · AC #8 · AR-56/AR-60 |
| PF-302 | 🟠 MAJOR | ✅ applied | FR OK-gate bullet · Tech-Req async-gate steps 2/5 · AC #7 · AR-56 |
| PF-303 | 🟡 MINOR | ✅ applied | Tech-Req Buttons bullet · Scope-Decisions/AR-60 |
| PF-304 | 🟡 MINOR | ✅ applied | AC #9 (`valid('quit')` + valid-form-quit→null) · `valid()` override bullet |
| PF-305 | 🟡 MINOR | ✅ applied | Tech-Req interface (imports `ModalDialogHost` with `bounds`) |
| PF-306 | 🟡 MINOR | ✅ applied | `FormDialogOptions` (`width`/`height` required) · FR-1 · Overview |
| PF-307 | 🟡 MINOR | ✅ applied | Tech-Req citations (`:225`, `:121`/`:127`); the `:224` ref removed with the mis-diagnosis |
| PF-308 | 🟡 MINOR | ✅ applied | RD-07 §"With RD-08" — marked superseded by AR-59 |
| PF-309 | 🟡 MINOR | ✅ applied | FR-1 (focus the first focusable view in the body) |

> **Tier**: ✅ **PASSED** — all 9 findings applied (2 MAJOR · 7 MINOR), 2026-07-16. The core design was
> verified workable by the independent challenger (no CRITICAL); the two MAJORs were behavior gaps closed
> by the seal (PF-301) and the try/catch gate (PF-302), both now pinned by acceptance criteria.

**Confidence**: High — every finding is grounded in `file:line` evidence and cross-checked by an
independent challenger; the core design was affirmatively verified workable (no CRITICAL). **Hardening**:
same-session authorship countered by one independent adversarial challenger; the two MAJORs (PF-301,
PF-302) and three MINORs (PF-303/305/307) were caught by the challenger, not the author's pass — the
safeguard did its job.
