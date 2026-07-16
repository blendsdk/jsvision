# Preflight Report: form-dialog (RD-08 implementation plan)

> **Status**: ✅ PASSED — all 3 findings resolved (fixes applied + re-scanned; iteration 2 clean)
> **Iteration**: 2 (re-scan after fixes)
> **Artifact**: implementation plan at `codeops/features/jsvision-forms/plans/form-dialog/` (9 docs)
> **Codebase Grounded**: 14 source files examined; ~40 `file:line` references verified
> **Last Updated**: 2026-07-16
> **Review independence**: NOT same-session — the plan was authored in a prior session (commit
>   `c99b7616`); this preflight ran fresh.
> **Findings 1–3**: 1 MAJOR + 2 MINOR, all applied per recommendation and verified in iteration 2.

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero
runtime deps (`zod` is `@jsvision/forms`'s only peer dep).
**Architecture:** foundation-first layering — `@jsvision/core` (engine) → `@jsvision/ui` (widgets,
reactive core, modal machinery) → `@jsvision/forms` (headless `createForm` store). `formDialog` is a
new `@jsvision/forms` helper that composes over the **public** `@jsvision/ui` modal seams; no
`@jsvision/ui` change.
**Key Files Examined:** `packages/forms/src/{create-form,types,index}.ts`,
`packages/forms/test/surface.impl.test.ts`, `packages/ui/src/dialog/{dialog,message-box,buttons,
button}.ts`, `packages/ui/src/event/{event-loop,modal,types}.ts`, `packages/ui/src/status/commands.ts`,
`packages/files/src/openers.ts` + `dialog/error-dialog.ts`, `packages/files/test/openers.impl.test.ts`,
`packages/examples/kitchen-sink/{story,shell}.ts` + `stories/file-dialog.story.ts`, RD-08.

**Reference verification:** every load-bearing claim in `02-current-state.md` holds against source —
`create-form.ts` submit (`:213-230`), the returned object (`:266-279`, no `submitting`), `isValidForm`
(`:201`), the un-try/caught `await onValid` re-throw (`:228`), `field()`'s synchronous `FormFieldError`
throw (`:143`); `dialog.ts` `valid`/`handleTerminating`/`resolveCancel`/`modalHost`/`isCommandEnabled`;
`ModalDialogHost` (`message-box.ts:22-27`, **includes `bounds`**); the quit-veto seam
(`event-loop.ts` `cascadeQuit` → `isQuitVetoed` → `view.valid(command)`); modal auto-focus
(`modal.ts:55-60` `focusInto` — so the plan's "standard focus path" for focusing the first body view
is real, not hand-waving). The plan is unusually well-grounded.

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 1 | ✅ resolved |
| 🟡 MINOR | 2 | ✅ resolved |
| 🔵 OBSERVATION | 0 | — |

---

### PF-001: Factory leaks the form if `options.body(form)` throws 🟠 MAJOR

**Dimension:** 4 Completeness Gaps / 3 Logical Contradictions / 13 Codebase Alignment (Impact Blindness)
**Location:** `03-01-form-dialog.md` — "The factory" (the `dlg.add(options.body(form))` line sits
outside the async IIFE's `try/finally`); prose claim at "Disposal on every path".
**Codebase Evidence:** `create-form.ts:143,178` — `form.field(name)` throws `FormFieldError`
**synchronously** for an unknown key, so a caller body that calls `form.field('typo')` throws in the
factory's synchronous prelude. `create-form.ts:136-139` — only `dispose()`/scope-cleanup aborts an
in-flight `load()` and tears down the standing async effects.

**The Problem:** The factory creates the form and builds the body *before* the returned async IIFE:

```ts
const form = createForm({...});
const dlg   = new FormDialog({...}, form, options.onSubmit);
dlg.add(options.body(form));        // ← synchronous; can throw (e.g. form.field('typo'))
host.desktop.addWindow(dlg);
return (async () => { try { … } finally { removeWindow(dlg); form.dispose(); } })();
```

If `options.body(form)` throws synchronously, the exception escapes `formDialog` **before the IIFE is
ever constructed** — so the `finally` never runs and `form.dispose()` never fires. The live
`createRoot` scope (async-validation effects + any in-flight `load`'s `AbortController`) leaks. This
**contradicts the plan's own prose** ("an exceptional `execView`/body throw all dispose exactly once")
— it conflates an `execView` throw (inside the try, covered) with a synchronous body throw (in the
prelude, not covered). It also **contradicts RD-08 AC #10 and the immutable spec oracle ST-D9**, which
explicitly drives "a body … that throws" and asserts `form.dispose()` ran. Implemented as written,
ST-D9 is red; per CLAUDE.md the spec is immutable, so the factory structure is the defect.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (guarded) | Move form creation + body build + `addWindow` **inside** the IIFE's `try`; single `finally` does `if (mounted) removeWindow` + `form.dispose()`; track a `mounted` flag set true right after `addWindow`. | One teardown site — literally ST-D9's "same `finally` as `removeWindow`"; covers OK/cancel/execView-throw/**body-throw** uniformly; `formDialog` always returns a promise (rejected on body-throw), the correct shape for a `Promise`-returning factory; no timing regression (async IIFE runs sync up to the first `await`, so the dialog is still mounted before the promise is returned — the headless harness relies on this). | Slightly more structure; needs the `mounted` guard so `removeWindow` isn't called on a never-mounted dialog (or dispose-before-removeWindow ordering). |
| B | Keep the sync prelude, wrap it in `try { … } catch (e) { form.dispose(); throw e; }` before returning the IIFE. | Minimal edit; no `mounted` flag (a body-throw runs only the sync catch; `addWindow` never ran, so no `removeWindow` needed); surfaces a bad field name as a synchronous throw at the call site. | Two dispose sites to keep in sync (maintenance hazard); literal deviation from ST-D9's "same `finally`" wording. |

**Recommendation:** **Option A (guarded)** — collapse to a single `finally` teardown covering every
path, with the `mounted` guard. It matches ST-D9's structural intent, gives `formDialog` a clean
always-async contract, and removes the two-dispose-sites hazard. Update the 03-01 prose so it no longer
claims the current structure disposes on a body throw.
*Confidence: High — the trace is unambiguous and backed by the immutable oracle. Hardening: an
independent challenger converged (~0.95 the defect is real) and contributed the `mounted`-guard
refinement now folded into Option A. Challenger: converged. The A-vs-B tie-breaker is the exact ST-D9
assertion text (both pass if it only checks "disposed once + no dev warning"); A is preferred
regardless for the single teardown path.*

**User Decision:** ✅ Resolved — user accepted the recommendation (Option A, guarded). Applied to
`03-01-form-dialog.md`: form creation + `body(form)` build + `addWindow` moved inside the promise's
`try`; single `finally` does `if (mounted) removeWindow` + `form.dispose()`; prose corrected. Verified in
iteration 2.

---

### PF-002: Factory reads `dlg.captured`, a `private` field, from outside the class 🟡 MINOR

**Dimension:** 6 Feasibility / 13 Codebase Alignment (Convention/type reality)
**Location:** `03-01-form-dialog.md` — the async OK gate declares `private captured: z.output<S> | null
= null` on `FormDialog`; the factory then reads `command === Commands.ok ? dlg.captured : null`.
**Codebase Evidence:** `packages/files/src/openers.ts:75` — the precedent reads the payload via a
**public** accessor: `command === Commands.ok ? dlg.result()` (`FileDialog.result()` is public).

**The Problem:** TypeScript `private` is class-scoped, not module-scoped. `formDialog` is a sibling
function in the same module, not a member of `FormDialog`, so `dlg.captured` fails typecheck (TS2341,
"Property 'captured' is private and only accessible within class 'FormDialog'"). It would surface at the
Phase-2 `yarn verify` (typecheck green) gate, but the plan's core pseudocode as written does not
compile. Note RD-08's own orchestration sketch used a closure-`let captured` + "stash for the outer
factory" phrasing — the plan drifted to a `private` field and introduced the access violation.

**Options:** Only one resolution is genuinely viable (a trivial visibility fix); the sub-choice is
cosmetic:
- Expose the captured values via a **public accessor** on `FormDialog` — either a `result()` method
  (mirrors `FileDialog.result()` exactly) or a non-`private` `@internal`-tagged field — and have the
  factory read that. (A closure-captured `let` written by the subclass is the other shape, but it needs
  a callback seam and is more machinery than the accessor.)

**Recommendation:** Mirror `FileDialog.result()`: give `FormDialog` a public `result(): z.output<S> |
null` returning the captured values, and read `dlg.result()` in the factory. Grounded in the openers
precedent and keeps the `private` field encapsulated behind a public read.
*Confidence: High.*

**User Decision:** ✅ Resolved — user accepted the recommendation. Applied to `03-01-form-dialog.md`:
`FormDialog` keeps `private captured` and exposes a public `result(): z.output<S> | null`; the factory
reads `dlg.result()`. Subclass intro updated to list the new member. Verified in iteration 2.

---

### PF-003: Story live-path host wiring references a non-existent `ctx.desktop` and would double-mount 🟡 MINOR

**Dimension:** 1 Ambiguities / 13 Codebase Alignment (Phantom Reference)
**Location:** `03-03-story.md` — "Live path" snippet:
`{ loop: { execView: ctx.execView }, desktop: ctx.desktop /* from the shell */ }`.
**Codebase Evidence:** `packages/examples/kitchen-sink/story.ts:21-34` — `StoryContext` exposes only
`caps`, `width`, `height`, and `execView?`; there is **no `desktop`**. `shell.ts:198-206` — the
`execModal` wired into `StoryContext.execView` **already self-mounts**: `addWindow(modal)` →
`execView(modal)` → `removeWindow(modal)` in a `finally`. `message-box.ts:22-27` — `ModalDialogHost`
requires `desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>` (**includes `bounds`**).

**The Problem:** The illustrative live-path snippet passes `desktop: ctx.desktop`, which does not exist
— pasted as-is it fails typecheck. More subtly, because `ctx.execView` (the shell's `execModal`)
already does its own `addWindow`/`removeWindow`, supplying a *real* desktop to `formDialog`'s
`ModalDialogHost` would mount the dialog **twice** (once by `formDialog`'s `host.desktop.addWindow`,
once inside `ctx.execView`). The plan flags this as an exec-time caveat and offers "a minimal desktop
shim OR demo:kitchen-only", but does not pin the actual correct shape. This does **not** affect the
smoke oracle ST-DS1 (headless degrade: `execView === undefined` → launch button only) nor any `ST-D*`
contract oracle — it only affects the live `demo:kitchen` modal, which is the showcase (the
NON-NEGOTIABLE "selling point" per CLAUDE.md).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Pin the shim in 03-03: `ModalDialogHost` = `{ loop: { execView: ctx.execView }, desktop: { addWindow: () => {}, removeWindow: () => {}, bounds: { x:0, y:0, width: ctx.width, height: ctx.height } } }` — **no-op** add/remove (execView self-mounts) + a `bounds` stub to satisfy the type. Drop `ctx.desktop`. | Live modal actually works in `demo:kitchen`; no double-mount; typechecks; keeps the showcase whole. | The no-op desktop is a small idiom the story comment should explain. |
| B | Drive the live modal through `demo:kitchen` wiring only and keep the story's `build` to the headless-degrade shape (launch button + echo + hint), like `file-dialog.story.ts` defers its flow to `demo:files`. Drop the `ctx.desktop` snippet either way. | Simplest; matches the `file-dialog` precedent exactly; ST-DS1 still passes. | The `forms/dialog` story never opens a real modal in the kitchen sink — weaker demo than RD-08 AC #12's "opens the dialog … valid-OK-closes-with-values" live flow. |

**Recommendation:** **Option A** — pin the no-op-desktop-shim shape (and delete the `ctx.desktop`
reference). RD-08 AC #12 and the kitchen-sink gate both want a working live "edit in a modal" demo, and
A delivers it with a two-line shim that the executor would otherwise have to rediscover (including the
non-obvious "execView self-mounts, so add/remove must be no-ops" fact). Fall back to B only if the shell
turns out not to expose enough for A at exec time.
*Confidence: High.*

**User Decision:** ✅ Resolved — user accepted the recommendation (Option A). Applied to
`03-03-story.md`: the live-path builds a `ModalDialogHost` with a **no-op** desktop shim
(`addWindow`/`removeWindow` no-ops, since `ctx.execView` self-mounts) + a `bounds` stub to satisfy the
type; the `ctx.desktop` reference is gone; the caveat prose now documents the shape and the reason.
Verified in iteration 2.

---

## Dimension scan coverage (all 13)

| # | Dimension | Findings | Notes |
|---|-----------|----------|-------|
| 1 | Ambiguities | PF-003 | story host wiring |
| 2 | Implicit Assumptions | — | "standard focus path" verified real (`modal.ts:55-60`) |
| 3 | Logical Contradictions | PF-001 | prose vs. structure on body-throw disposal |
| 4 | Completeness Gaps | PF-001 | body-throw disposal path |
| 5 | Dependency Issues | — | every import verified real; no new deps; `zod` peer dep unchanged |
| 6 | Feasibility | PF-002 | `private` field access |
| 7 | Testability | — | all 14 ACs map to ≥1 oracle; AC→oracle map checked |
| 8 | Security | — | ST-D-SEC render-and-scan mirrors RD-04/06/07; no new render path |
| 9 | Edge Cases | PF-001 | double-submit/quit-during-gate sealed & covered; body-throw missed |
| 10 | Scope Creep | — | RD-08 "Won't Have" carried verbatim; nothing added |
| 11 | Ordering | — | submitting → formDialog → story is the correct dependency order; spec-first within phases |
| 12 | Consistency | — | `ST-D*`/`formDialog`/`FormDialogOptions` naming consistent |
| 13 | Codebase Alignment | PF-001/002/003 | one phantom ref (`ctx.desktop`); everything else grounded |

---

## Iteration 2 — re-scan after fixes

> **Previous Iteration**: 3 findings (PF-001…003) — all resolved.
> **This Iteration**: 0 new findings.
> **Carried Forward**: none.

**Fix verification (each resolved finding actually fixed):**

- **PF-001 ✅ CONFIRMED fixed.** `03-01-form-dialog.md` factory now runs `createForm` + `dlg.add(options.
  body(form))` + `addWindow` inside the promise's `try`, with `let mounted` set true right after
  `addWindow` and a single `finally` doing `if (mounted) removeWindow(dlg)` + `form.dispose()`. A
  synchronous `body(form)` throw (e.g. `form.field('typo')`) now reaches the `finally` → `mounted` is
  `false` → `removeWindow` skipped, `form.dispose()` runs. Satisfies RD-08 AC #10 / ST-D9. The prose no
  longer contradicts the structure.
- **PF-002 ✅ CONFIRMED fixed.** `FormDialog` exposes a public `result(): z.output<S> | null`; the factory
  reads `dlg.result()` — no `private`-member access from the sibling function (no TS2341). The
  `this.captured = values` write inside `runOkGate` is unchanged and still valid (internal).
- **PF-003 ✅ CONFIRMED fixed.** `03-03-story.md` builds the `ModalDialogHost` with a no-op desktop shim +
  `bounds` stub; `ctx.desktop` is gone. No double-mount (execView self-mounts; add/remove are no-ops);
  typechecks against `ModalDialogHost`.

**Regression check (fresh 13-dimension pass over the changed sections):** no new issues.
- **Consistency (12):** the subclass intro, the `this.captured` bullet, and the factory all now agree on
  `result()` / `dlg.result()`; the "Disposal on every path" and "Result" bullets match the new structure.
- **Feasibility (6):** `let mounted` (reassigned → `let` correct, not `prefer-const`); `result()` does not
  collide with any base `Dialog` member (`dialog.ts` has none); the no-op shim satisfies
  `Pick<Desktop,'addWindow'|'removeWindow'|'bounds'>`.
- **No timing regression:** the async IIFE runs synchronously up to the first `await`, so `createForm` +
  `addWindow` still execute before the pending promise is returned — the headless harness's
  `emitCommand`-after-call pattern is unaffected. Documented inline in 03-01.

**Note (not a finding):** the plan's 03-01 factory now deliberately diverges from RD-08 §Orchestration's
*illustrative* outer-factory sketch (which shows the openFile-style `addWindow` **before** the `try`).
The divergence is required to satisfy the RD's own **binding** AC #10 / ST-D9 (body-throw must dispose),
is documented in 03-01, and does not touch the RD (already preflighted; its sketch is illustrative, the
AC governs). No RD edit made or needed.

**Docs-not-code note:** these are `codeops/` planning docs (in `.prettierignore`), so no lint/format gate
applies to the edits; the plan-source banned-ref grep scope (`packages/forms/src`) is unaffected.

---

## Final Verdict

**✅ PREFLIGHT PASSED — all 3 findings resolved (1 major, 2 minor), iteration-2 re-scan clean.**

A well-grounded plan whose one material gap (PF-001 — a real resource-leak + immutable-spec conflict) is
now closed, alongside two minor type-correctness fixes. Every RD-08 AC (1–14) maps to ≥1 oracle;
spec-first ordering, dependency ordering (submitting → formDialog → story), and layering constraints all
hold. Ready for `exec_plan`.
