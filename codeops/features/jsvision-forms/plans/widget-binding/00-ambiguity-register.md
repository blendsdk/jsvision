# Ambiguity Register — widget-binding plan

> **✅ GATE PASSED (2026-07-15)**
> Implements `jsvision-forms/RD-03`. The design-level ambiguity was resolved in the requirements
> register (`../../requirements/00-ambiguity-register.md`, AR-01…AR-24) and the 2026-07-13/14 grill;
> those enter here as ✅ Resolved. Plan-level items (PA-1…PA-9) surfaced during current-state
> analysis; PA-1 and PA-2 were decided by the user on 2026-07-15, the rest are recommended
> resolutions the user confirmed by proceeding.

## Inherited (requirements register — all ✅ Resolved)

The load-bearing RD-03 decisions, resolved in `../../requirements/00-ambiguity-register.md`:

- **AR-01** value model — `field.value` = the raw editing `Signal<T>`; native type for choice
  fields (`string` for text). Direct bind rides it.
- **AR-05** touched trigger — flips on **first blur** (focus-leave after focus); `submit()` marks all.
- **AR-08** choice binding — domain-valued adapters `bindRadio(field, options)` → `Signal<number>`,
  `bindCheck(field, options)` → `Signal<boolean[]>` with `field.value` = `Signal<T[]>` (selected
  values). Text/`Switch` bind directly.
- **AR-09** touched wiring — `bindField(field, view)` hooks `View.focusSignal()` + `state.focused`.
  One primitive for every widget.
- **AR-14** field-handle shape (locked) — `name` / `value` / `error()` / `touched()` / `dirty()`;
  no `disabled`/`readonly`. **The touched write seam must not widen this** (⇒ PA-1).
- **AR-15** owner-free store — the only effects (touched-wiring) live in the *view* scope, never the
  store (⇒ PA-2).
- **AR-21** stable handles — `field(name)` is memoized, so `bindField` and the UI observe the same
  touched signal.
- **AR-22** security posture — the engine never bypasses the widgets' control-byte sanitization; the
  store holds only what the app puts in. Binding adds no new input surface.

## Plan-level items

| PA | Item | Resolution | Status |
|----|------|------------|--------|
| PA-1 | **Touched write seam.** The public `Field<T>` exposes only `touched()` (a getter); `touchedSignals` is store-internal (`create-form.ts:77,81,94-98`) and the handle is a plain literal (`:118-124`). `bindField` needs a way to *set* touched **without** widening the locked handle shape (AR-14). | A package-internal `WeakMap<object, () => void>` registry (`src/internal.ts`, **not** barrel-exported): `create-form.ts` registers `handle → () => touchedSignal(key).set(true)` at handle memoization; `bindField` looks it up by handle identity and calls it on focus-leave; a miss (foreign handle) throws `FormFieldError`. Public `Field` unchanged; **no cast, no `any`** — keying by `object` sidesteps `Signal<T>` invariance. (User decision 2026-07-15.) | ✅ Resolved |
| PA-2 | **Where the touched effect runs** so it is owned by, and torn down with, the view (AR-15 keeps the store owner-free). | The **public** seam `view.onMount(() => view.bind(reader))` (`view.ts:228-240`). Uses only public `@jsvision/ui` API; the effect is owned by the view's scope and disposed at unmount (`view.ts:355-357`). Accepted cost: one redundant repaint request per focus flip — benign, because `focusLeaf` already repaints the view on every focus change (`focus.ts:109,113`). (User decision 2026-07-15; the rejected alternative — `runWithOwner(view.scope, effect)` — avoids the repaint but reaches the `@internal` `view.scope`.) | ✅ Resolved |
| PA-3 | **Idempotency per (field, view)** (FR-3.2 "must not double-fire"). | A module-level `WeakMap<View, Set<object>>` guard in `bind-field.ts`: a repeat `bindField(field, view)` is a no-op. A `view.onCleanup` deletes the pair on unmount, so a **later** `bindField(field, view)` re-call can rewire — the `onMount` callback does **not** itself re-fire on remount (`pendingMounts` is spliced empty, `view.ts:344-349`), so binding is not auto-restored; the guard-delete just unblocks an explicit re-call. (Keyed by `object` to avoid invariance friction.) | ✅ Resolved |
| PA-4 | **`bindField` type parameter.** RD-03 drafts `bindField(field: Field<any>, view)`; `any` fails the repo's `no-explicit-any`, and `Field<unknown>` would *reject* a `Field<string>` (because `Signal<T>` is invariant). | Make it **generic**: `bindField<T>(field: Field<T>, view: View): void`. Accepts any concrete field, lint-clean, no cast. (The same class of correction as the shipped `z.ZodObject<z.ZodRawShape>` fix.) | ✅ Resolved |
| PA-5 | **Module breakdown** for the new code. | `src/internal.ts` (the `touchedSinks` registry) · `src/bind-field.ts` (`bindField`) · `src/bind-choice.ts` (`bindRadio` + `bindCheck`). Barrel `src/index.ts` adds `bindField`/`bindRadio`/`bindCheck` (not the registry). One-line edit to `create-form.ts` to register sinks. All ≤500 lines. | ✅ Resolved |
| PA-6 | **`bindRadio.set(i)` out of range** — `options[i]` is `undefined` when `i` is `-1` or `≥ length`. | **No defensive guard** — mirror `RadioGroup`'s contract (it only ever sets `0..n-1`; `radio-group.ts:54,58`). Documented in the JSDoc: seed a valid `initial` so the first read isn't `-1`. Avoids speculative surface. | ✅ Resolved |
| PA-7 | **Verify command.** | Per-task fast: `yarn workspace @jsvision/forms test`. Phase-final gate: `yarn verify`. From the project CLAUDE.md; nothing invented. | ✅ Resolved |
| PA-8 | **Focus-leave detection ordering** — does the effect read a fresh or stale `state.focused`? | Load-bearing fact (not a choice): `focusLeaf` sets `state.focused` **before** poking `focusTick` (`focus.ts:103-115`). So the effect, re-run by the poke, reads the settled flag. Leave = `was === true && state.focused === false`. The spec test drives focus through a **real `EventLoop.focusView`** for fidelity (never by hand-poking), so it can't encode a mis-decode of this order. | ✅ Resolved |
| PA-9 | **Kitchen-sink story.** The NON-NEGOTIABLE showcase gate — does RD-03 need a `forms/*` story? | **Deferred to RD-04 by design.** RD-03 ships binding *helper functions*, not new visual components (the widgets it binds — `Input`/`Switch`/`RadioGroup`/`CheckGroup` — already have stories). A meaningful `forms/*` story is a rendered form, which RD-04 owns. Consistent with the form-store plan's conscious deferral. | ✅ Resolved |

## Gate status — PASSED (2026-07-15)

- [x] Inherited AR-01…AR-24 resolved with explicit user decisions (requirements register).
- [x] PA-1 (touched seam) and PA-2 (effect seam) decided by the user 2026-07-15.
- [x] PA-3…PA-9 are recommended resolutions grounded in the current code (`file:line` cited);
      low-stakes, confirmed by the user proceeding to plan authoring.
- [x] Zero deferred *within-scope* items — every in-scope ambiguity has a concrete answer.

## Preflight follow-ups (2026-07-15)

Preflight (`00-preflight-report.md`) passed with notes; the doc fixes (PF-001/003/004/005) are applied
in place. One item is carried to execution:

- **PF-002** — `bindField` throws `FormFieldError` on a foreign handle (PA-1's decided type). At T1.5/
  T1.10, broaden `FormFieldError`'s JSDoc to name this second trigger (a handle not produced by this
  form's `createForm`) — its current doc covers only an unknown schema key, so the `Unknown form
  field "…"` message would otherwise mislead. Type unchanged; docs-only.
