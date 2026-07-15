# Preflight Report — widget-binding plan

> **Artifact**: `codeops/features/jsvision-forms/plans/widget-binding/` (jsvision-forms/RD-03)
> **Date**: 2026-07-15 · **CodeOps Skills Version**: 3.7.0
> **⚠️ SAME-SESSION REVIEW** — this plan was authored in the same session that is reviewing it.
> Findings were produced against the **actual code** (every `file:line` re-verified), and the
> `bindField` focus algorithm was adversarially re-scrutinised three times to counter same-agent
> bias. A fresh-session re-review remains the strongest independence check.

## Outcome

**✅ PREFLIGHT PASSED WITH NOTES** — 0 critical, 0 major, 2 minor, 3 observations.
No finding blocks execution. The plan is codebase-accurate and executable as written; the notes are
polish (a misleading comment, an error-message contract, three doc/citation clarifications).

## Codebase Context Summary

The plan targets `@jsvision/forms` (shipped store, RD-01/02) and rides existing `@jsvision/ui` seams.
Reconnaissance confirmed every referenced seam behaves exactly as the plan assumes:

- **Store side** (`packages/forms/src/`): `Field<T>` exposes `touched()` as a **getter only**
  (`types.ts:10-21`); `touchedSignals` is store-internal and the handle is a plain literal
  (`create-form.ts:77,81,94-98,118-125`); `reset()`/`submit()` drive the same touched signals
  (`:135,143`). ⇒ the plan's package-internal `WeakMap` write seam (PA-1) is the right shape.
- **Reactive contract**: `Signal<T>` = `()`/`set`/`update`/`peek` (`reactive/types.ts:19-28`); the
  stock `signal()` is `Object.assign(read,{peek,set,update})` (`reactive/signal.ts:63-67`) — the lens
  mirrors it exactly.
- **Focus seam** (the load-bearing one): `focusSignal()` **lazily** creates `focusTick` as
  `signal(undefined,{equals:()=>false})` (`view.ts:136-137`); `focusLeaf` sets `state.focused`
  **before** poking `focusTick?`, for **both** the leaving view (`focus.ts:108,110`) **and** the
  entering view (`:112,114`). So the plan's `view.focusSignal()` is the correct public entry to the
  `focusTick` the manager pokes — **no naming defect**. `view.bind` runs an owned effect immediately +
  on every dep change, invalidating each run (`view.ts:228-240`); it is disposed at unmount
  (`:355-357`). `onMount`/`onCleanup` require a mounted scope (`:283-289,298-306`).
- **Widget consumption**: `RadioGroup` uses only `value()`/`value.set(i)`
  (`radio-group.ts:44,46,54,58`); `CheckGroup` only `value()`/`value.set(fullLengthArray)`
  (`check-group.ts:46,50,53-59`) — a strict subset of the `Signal` surface the lenses provide, so the
  lenses drop in. `Input`(`input.ts:35`)/`Switch`(`switch.ts:38`) take `Signal<string>`/`Signal<boolean>`
  — direct bind (FR-3.1) is valid.
- **Deps/commands**: `@jsvision/ui` is already a `forms` dependency; `bind-field.ts`/`bind-choice.ts`
  add only type-only `View`/`Signal` + same-package value imports ⇒ **no new dependency**. Per-task
  `yarn workspace @jsvision/forms test` and `… check:docs` both exist (forms `package.json`). The
  spec test idiom (`createEventLoop`/`loop.mount`/`loop.focusView`/`loop.dispatch`) is real and both
  `createEventLoop` and `resolveCapabilities` are on the `@jsvision/ui` barrel (`ui/src/index.ts:20,57`).

## Findings

### 🟡 PF-001 (MINOR) — "remount rebinds" comment overstates the mechanism

`03-01-bind-field.md` §B (and register PA-3) says the `view.onCleanup` guard-delete lets *"a
remounted view rebind"*. Verified against `view.ts`: `bindField` registers **one** `onMount` callback;
`onMount` queues into `pendingMounts` (`view.ts:283-289`); `runPendingMounts` **splices it empty**
(`:344-349`); on unmount `mountFired` resets but `pendingMounts` is already empty (`:333`). ⇒ the
onMount callback does **not** re-fire on unmount→remount, so the effect is **not** auto-re-established.
The guard-delete only lets a *subsequent explicit* `bindField(field, view)` call take effect (without
it, the idempotency early-return would silently no-op the re-call).

- **Impact**: none on the shipped behaviour or any test (ST-03 tests only disposal, not
  auto-rewire). Purely a misleading design note that could seed a wrong test or a wrong mental model
  during execution.
- **Options**: (a) reword the comment to "clears the guard so a later `bindField` re-call rewires;
  remount does not auto-rewire" **[recommended]**; (b) leave as-is and rely on execution catching it.
- **Recommendation**: (a). One-line wording fix in `03-01` §B + the PA-3 register cell.

### 🟡 PF-002 (MINOR) — `FormFieldError` reused for the foreign-handle throw stretches its contract

`bindField` throws `FormFieldError(field.name)` on a handle not registered in `touchedSinks`
(`03-01` §B step 1). But `FormFieldError`'s JSDoc + message are scoped to *unknown schema field name*:
`Unknown form field "${field}"` (`errors.ts:1-27`). A foreign handle's `.name` may be a perfectly
valid field name from a **different** `createForm` (the registry is module-global, so a real
cross-form handle actually resolves; only a hand-rolled object misses) — so the message would read
`Unknown form field "name"` when the name is fine and the *handle provenance* is the problem.

- **Impact**: low — the throw is a fail-fast for programmer error / test mocks, not a runtime path.
  But a developer who hits it gets a misleading message.
- **Note**: PA-1 (user-decided) chose *to throw `FormFieldError`*; this finding is about the
  **message/JSDoc contract**, not the error type — it does not re-litigate PA-1.
- **Options**: (a) broaden the `FormFieldError` JSDoc to name the second trigger ("or a handle not
  produced by this form's `createForm`") and keep the type **[recommended]**; (b) throw with a
  distinct message; (c) accept as-is.
- **Recommendation**: (a) — cheapest, preserves the single error type PA-1 chose, removes the
  contract mismatch. Decide at execution (T1.5/T1.10).

### 🔵 PF-003 (OBSERVATION) — "never hand-poke focus" claim contradicts ST-03's own unmount step

`07-testing-strategy.md` frames all focus as driven "through a **real `EventLoop.focusView`** …
never by hand-poking" (intro + PA-8), yet ST-03's *cleaned-up-on-unmount* sub-case hand-pokes
(`inputA.state.focused = false; inputA.focusSignal().set(undefined)`). This is **defensible** (a
removed view can't be loop-focused, so hand-poking is the only way to prove the effect is gone), but
the absolute phrasing invites confusion.

- **Recommendation**: scope the claim — "focus **leave-detection** is driven through the real loop;
  the post-unmount check hand-pokes deliberately, because a detached view has no focus manager."

### 🔵 PF-004 (OBSERVATION) — `bindCheck` silently drops domain values outside `options`

`bindCheck.set` writes `field.value.set(options.filter((_,i)=>flags[i]))`, so any selected value not
in `options` is dropped on the first widget write-back — the multi-select analogue of PA-6's
out-of-range `-1` for `bindRadio`. `03-02-choice-adapters.md` documents the radio case but not this
symmetry.

- **Impact**: none when the field is modelled as `z.array(z.enum([...options]))` (out-of-options is
  invalid by construction, which AR-08 assumes).
- **Recommendation**: add a one-line JSDoc/`03-02` note mirroring PA-6 ("keep `options` equal to the
  enum; values outside `options` are not round-tripped").

### 🔵 PF-005 (OBSERVATION) — line-citation drift for the create-form registration

`99-execution-plan.md` T1.4 anchors the registration at "`create-form.ts:118`"; the actual insertion
point is **after** `handles.set(key, handle)` (`create-form.ts:125`), which `03-01` §A shows
correctly. (`:118-124` is the handle *literal*.) Minor imprecision; harmonise T1.4 to the `03-01`
anchor.

## Adversarial checklist (same-session safeguard)

- **Could `bindField` miss a leave?** No — `focusLeaf` pokes `focusTick` after `state.focused=false`
  for the leaving view (`focus.ts:108,110`); the reader subscribes via `focusSignal()` and reads the
  settled flag. Verified.
- **Could it fire on enter/mount?** No — `was===now` on the mount-time first run and on enter
  (`false→true` is `!(was && !now)`). Verified against both call orders (bindField before *and* after
  focus).
- **Stale `state.focused`?** No — it's a plain field read fresh each effect run; the only trigger is
  the focusTick poke, always emitted after the mutation.
- **Lens surface incomplete?** No — widgets touch only `value()`/`value.set()`; lens supplies all
  four `Signal` members.
- **Module cycle / new dep?** No — `bind-field→internal→types`, `create-form→internal→types` acyclic;
  imports are type-only + same-package.

**Confidence**: high on the codebase-alignment verdict (every citation re-read against source).
**Hardening**: in-context adversarial re-scrutiny only; no independent challenger spawned — justified
because zero findings reached CRITICAL/MAJOR (the challenger trigger). A fresh-session re-review is
the recommended residual check given same-session authorship.
