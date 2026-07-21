# Ambiguity Register — async-loading (RD-07 plan)

> **Zero-Ambiguity Gate for the RD-07 implementation plan.** The *behavioral* design is already
> resolved and preflighted in the requirements (`../../requirements/00-ambiguity-register.md`,
> AR-46…AR-53; `../../requirements/00-preflight-report-rd-07.md` — PASSED). This register imports
> those as pre-resolved context and records only the **plan-level** decisions surfaced while planning
> the implementation. AR-PL1/PL2 are explicit user decisions (2026-07-16, AskUserQuestion); AR-PL3…PL8
> are recommendations derived from them, from the codebase, and from the shipped RD-06 plan's
> precedent, confirmed on register review.

## Imported (resolved in the RD, not re-litigated here)

| RD AR | Decision (summary) |
|-------|--------------------|
| AR-46 | `form.load(loader): Promise<boolean>` **method** (re-invokable; no I/O in the constructor). |
| AR-47 | Loader resolves the **full raw record** `Promise<I>`; on success **replace every value + rebase the whole baseline** in one `batch()`. Raw (not coerced) is forced — no inverse of `z.coerce`. |
| AR-48 | A successful load leaves the form **pristine** — `touched` + submit-attempted cleared; `dirty()` false via rebase. |
| AR-49 | Loader rejection → `load` **resolves `false`**, state untouched, `loading()`→false; **no `loadError()`** surface. |
| AR-50 | `baseline` (`create-form.ts:99`, seeded `:103`) is the single **mutation point**; `fieldDirty` (`:142`)/`reset` (`:174`) unchanged. Revises AR-12. |
| AR-51 | **Generation counter + `AbortController`** for load-vs-load; **disposal guarded separately by a `disposed` flag** (dispose bumps no generation) — preflight PF-001. |
| AR-52 | Form-level **`loading()`** only (no per-field); independent of `isValid()`/`submit()` (app composes). Load fires each async field's trigger effect (a value change). |
| AR-53 | Kitchen-sink load story + smoke; loaded strings render through the existing control-byte sanitisation (no new render path). |

## Plan-level decisions (this register)

| AR | Decision | Resolution | Status |
|----|----------|------------|--------|
| AR-PL1 | **Code placement** of `load()`/`loading()` | **Inline in `create-form.ts`** (buildForm), not a new module. The flow reads 5 buildForm locals (`valueSignal`, `touchedSignal`, `baseline`, `submitAttempted`, the new `loading` signal); inlining avoids threading them, matches the RD's "additive to `create-form.ts`", and grows the file only ~215→~265 lines (< 500 ceiling). A `src/load.ts` factory mirroring `async.ts` was considered and rejected — a module boundary + 5 threaded seams is disproportionate for a ~40-line method with no standing effect. | ✅ Resolved (user) |
| AR-PL2 | **`load()` on an already-disposed form** | **Early-return `false`** via an `if (disposed) return false` guard at load entry: never sets `loading()`, never invokes the loader. Prevents stranding `loading()===true` on a torn-down form and makes a stray post-dispose call safe. (Distinct from AC #10's in-flight-during-dispose path, which the mid-flight `disposed` checks cover.) Chosen over leaving it undefined per AR-44. | ✅ Resolved (user) |
| AR-PL3 | **Dispose seam** (how `disposed`+abort attach) | **`onCleanup` in the root body**: register `onCleanup(() => { disposed = true; loadController?.abort(); })` in `buildForm` and leave `dispose: disposeScope` unchanged. It fires on **any** teardown — a direct `form.dispose()` *or* an enclosing scope disposing the form's nested child scope (`createForm` nests its `createRoot` under the active owner, `create-form.ts:86`; a parent `dispose()` recurses into children and fires their cleanups, `owner.ts:168,185`). A returned `dispose` **wrapper** was considered and **rejected** (preflight PF-201): a wrapper sets `disposed`/aborts only on an explicit `form.dispose()`, so an in-flight load under an enclosing scope torn down without that call is left un-aborted and its late settle writes to a dead form. `onCleanup` mirrors the async layer's own teardown (`async.ts:138-143`); `disposeScope` is RD-06's `createRoot` disposer (`create-form.ts:213`). | ✅ Resolved (derived; revised per PF-201) |
| AR-PL4 | **Test layout + ST prefix** | New `load.spec.test.ts` (immutable oracles **ST-L1…ST-L12**), `load.impl.test.ts` (internals/edges), and `load-security.spec.test.ts` (the render-and-scan control-byte oracle **ST-L-SEC**, mirroring `async-security.spec.test.ts`). Prefix **`ST-L*`** — one namespace per slice (store=ST-01…, async=ST-A*, load=ST-L*). Reuses the `deferredValidator` + fake-timers idiom (`async.spec.test.ts:27`) for the controllable-loader oracles. | ✅ Resolved (derived) |
| AR-PL5 | **Kitchen-sink story** | New `forms-load.story.ts` — `id: 'forms/load'`, `category: 'Forms'`, `rd: 'RD-07'` — mirroring `forms-async.story.ts`; smoke oracle **ST-LS1** added to `kitchen-sink.smoke.spec.test.ts`. A separate story (not an extension of `forms/form`), matching how `forms/async` got its own. | ✅ Resolved (derived) |
| AR-PL6 | **Verify command** | **`yarn verify`** (root; = `yarn lint` then turbo `typecheck build test check:docs`) per phase and at the final gate, per `CLAUDE.md`. The banned-CodeOps/TV-ref check is done by a **plain `grep` over `packages/forms/src`** in addition to `check:docs` (the scanner has a known coverage gap). No git commands in this plan — commits go through `/gitcm` · `/gitcmp`. | ✅ Resolved (derived) |
| AR-PL7 | **Barrel / surface / async.ts** | **No barrel or `async.ts` change.** `load`/`loading` are new **`Form` methods** (type-only surface in `types.ts`), not runtime barrel exports — `surface.impl.test.ts`'s 5-value lock stays green (a deliberate regression check). The async re-validation on load is automatic: load writes each `valueSignal`, and the existing per-field trigger effect (`async.ts:111-144`) reacts — no call into the async layer. | ✅ Resolved (derived) |
| AR-PL8 | **Async-on-load micro-edge** (changed-fields-only) | Signals **skip an equal write** (`Object.is`, `signal.ts:52`), so the async trigger re-fires only for fields whose loaded value **differs** from the current value; an unchanged async field keeps its prior `asyncError` (consistent with the value-verdict model and AR-52's "a value change"). The ST-L11/ST-L12 oracles therefore load a **differing** value. Not a defect — a documented consequence; load does **not** force-reset async state for all fields. | ✅ Resolved (derived) |

## Gate status — ✅ GATE PASSED (2026-07-16)

- [x] Behavioral design imported from the preflighted RD-07 (AR-46…53) — not re-litigated.
- [x] The two pivotal plan-level forks (AR-PL1 placement, AR-PL2 load-after-dispose) resolved by
      explicit user decision (AskUserQuestion, 2026-07-16).
- [x] Derived items (AR-PL3…PL8) recorded with codebase-grounded rationale (`file:line`) and RD-06-plan
      precedent.
- [x] Zero deferred items — every plan-level ambiguity has a concrete answer.
- [x] Verify command confirmed (`yarn verify`, AR-PL6).
- [x] User reviewed and confirmed the complete register.

## Preflight (async-loading plan) — ✅ PASSED (2026-07-16)

Plan preflight (`00-preflight-report.md`) — same-session review + 1 independent challenger. 8 findings,
all applied (user: "apply all 8"):

- **PF-201 (MAJOR)** — AR-PL3 revised above: root-body `onCleanup` replaces the `dispose` wrapper so teardown
  fires on enclosing-scope disposal too (not only explicit `form.dispose()`).
- **PF-202 (MAJOR)** — the `03-01` §C reference block now carries plain-language shipped comments only (the
  `check:docs` scanner misses `AR-PL*`/`AC #n`); AR-/PF-/AC- traceability moved to prose. Grep pattern pinned
  in AR-PL6 / task 2.7.
- **PF-203 (MINOR)** — §C clones **twice** (baseline + value independent), matching the seed (`:103-104`) + RD
  step 4; array-field aliasing avoided.
- **PF-204 (MINOR)** — §A drops the per-interface-member `@example` instruction (gate needs it only on `createForm`).
- **PF-205 (MINOR)** — ST-L1's `loading()` assertion moved to ST-L8; ST-L1 is a pure pre-existing-surface
  regression oracle that genuinely stays green at red.
- **PF-206 (MINOR)** — ST-L9 gains `loading()` assertions across the supersede/settle.
- **PF-207 (OBS)** — ST-L5 worded to verify only `touched()` (submit-attempted is write-only, unobservable).
- **PF-208 (OBS)** — file-size estimate corrected to ~265; the impl size check asserts a range, not ≈255.
