# RD-07: Async Loading + Baseline Rebase

> **Document**: RD-07-async-loading-baseline-rebase.md
> **Status**: Draft
> **Created**: 2026-07-16
> **Project**: jsvision Forms
> **Depends On**: RD-01 (Form & Field Store), RD-02 (Validation & Error Surfacing), RD-06 (Async
>   Validation — reuses its plain-Promise + generation stale-guard + `AbortSignal` + `dispose()` seam).
>   Soft-consumes RD-09's styled `Text` in its demo story (not an engine dependency).
> **CodeOps Skills Version**: 3.8.0

---

## Feature Overview

Add **asynchronous record loading with baseline rebase** to `@jsvision/forms` — the "open this form
to *edit an existing record*" case, as distinct from the "fill in a blank form" case the first slice
already serves. Today a form's baseline is fixed at creation: the seeded `baseline` snapshot
(`create-form.ts:99,103`) is written once and never again, so `field.dirty()` (`create-form.ts:142`)
and `reset()` (`create-form.ts:174`) always compare against the original `initial` values. There is
no way to say "checking…"/"loading…" while a record is fetched, and after a record *is* fetched and
poured into the fields, every field reads as **dirty** (its value now differs from the blank
`initial`) and `reset()` would wipe the loaded record back to blank — both wrong for an edit form.

This RD adds an **imperative `form.load(loader)` method** that runs an author-supplied async loader,
and on success **replaces every field value and rebases the whole baseline to the loaded record**, in
one `batch()`. After a successful load the form is **pristine** — untouched, not-submitted, and
`dirty()` is `false` — so `dirty()` now means "changed since it was loaded" and `reset()` returns to
the loaded record. A form-level `loading()` signal drives the "Loading…" swap. Concurrency,
cancellation, and teardown reuse RD-06's ratified idioms verbatim (a monotonic generation counter, an
`AbortSignal`, and the `dispose()` scope), so a slow load for an old request can never clobber a newer
one.

**Why a method, not native construction-time prefill?** The #85 sketch modelled load as a `load:`
option on `createForm` that fires at creation. A method is re-invokable (a Reload button, or
re-loading a different record into the same form), keeps I/O out of the constructor (a store built at
module scope must not fetch), is testable in isolation, and is symmetric with `submit(onValid)`
(AR-46). **Why a full raw record, not a partial merge?** A full replace is the clean "load the record
to edit" model and avoids leaving a mixed per-key dirty/baseline state; the loader resolves the **raw
editing shape** (`I`, same as `initial`) because there is no generic inverse of `z.coerce` to turn a
server/domain record back into raw editing values — the author maps server → raw inside the loader,
exactly as they hand-write `initial` today (AR-47).

---

## Functional Requirements

### Must Have

- [ ] **`form.load(loader)` method.** `Form` gains
      `load(loader: (ctx: { signal: AbortSignal }) => Promise<I>): Promise<boolean>`. Calling it sets
      `loading()` `true`, invokes `loader` with a fresh `AbortSignal`, and — on success — applies the
      resolved raw record (below) and resolves `true`; on rejection it resolves `false` leaving state
      untouched (below). The signature mirrors `submit`'s boolean-gate shape (AR-46).
- [ ] **Full raw record, replace + rebase.** The loader resolves the **full raw editing record**
      (`Promise<I>`, the same shape as `initial`; the author maps a server/domain record → raw editing
      values inside the loader). On success the store, in a single `batch()`, **sets every field's
      `value` to the loaded value and overwrites every field's `baseline` to the same loaded value**
      (arrays defensively cloned, as at `create-form.ts:103`). After the batch, `rawValues()` equals
      the loaded record and `field.dirty()`/`form.dirty()` are `false` (AR-47, AR-50). The loader is
      contracted to resolve **every** field key (the `Promise<I>` type enforces it); the store iterates
      the schema field names, so a runtime loader that resolves a partial object sets each missing
      field — and its baseline — to `undefined` (a caller-contract violation, documented in the
      `@example`; partial-merge load is out of scope, AR-47).
- [ ] **Pristine after load.** A successful load **clears every field's `touched` and the
      submit-attempted flag** (the same fields `reset()` clears), in the same `batch()`. The loaded
      record is a clean starting point — behaviourally identical to a fresh `createForm` initialised
      with it: no error reveal, `dirty()` `false` (AR-48).
- [ ] **Rejection leaves state untouched.** If `loader` rejects or throws, `form.load` **resolves
      `false`** (never rejects), values and baseline are left exactly as they were, `touched`/
      submit-attempted are unchanged, and `loading()` returns to `false`. No `loadError()` surface is
      added — the loader owns its own try/catch and surfaces a message its own way (the `asyncValidators`
      contract, AR-34/AR-49). A caller composes `if (!(await form.load(...))) status.set('Could not
      load')`.
- [ ] **Form-level `loading()` state.** `Form` gains `loading(): boolean` — `true` from the moment a
      `load()` begins until its (non-superseded) settle. There is **no** per-field loading (a load is
      atomic/whole-form). `isValid()` and `submit()` do **not** auto-gate on `loading()`; the app
      composes the busy state (`disabled: () => form.loading()`), matching how `validating()` is left
      to the app (AR-52).
- [ ] **Load concurrency + cancellation.** A **monotonic load-generation counter plus an
      `AbortController`** (RD-06's stale-guard idiom, AR-38): a second `load()` supersedes an in-flight
      first — the prior run's `AbortSignal` is aborted and, even if the loader ignores it, the stale
      result is dropped by the generation check, so only the newest load's record is ever applied and
      `loading()` reflects the newest run (AR-51).
- [ ] **Disposal aborts an in-flight load.** `form.dispose()` (from RD-06) both **sets a `disposed`
      flag and aborts** an in-flight load's `AbortSignal`. Because `dispose()` does **not** bump the
      load-generation counter (it tears down computations only, `owner.ts:163`), the generation check is
      not what protects the dispose path — the `disposed` flag is: the load path tests it **before every
      state write, including the rejection path's `loading.set(false)`**, so a load that resolves *or*
      rejects after disposal writes no values, does not rebase, and does not clear `loading()` for a
      torn-down form. `load` adds no standing effect — only a transient controller per call — so it does
      not by itself make `dispose()` newly mandatory for a sync-only form (AR-51).
- [ ] **Kitchen-sink loading story.** A new (or extended) kitchen-sink story demonstrates
      **load → edit → `dirty()` → `reset()`-to-loaded**, shows the live `loading()` swap, and passes
      the headless smoke test (AR-53).

### Should Have

- [ ] `loading()` is cheap to read repeatedly, so a Save/Reload button can bind
      `disabled: () => form.loading()` without recomputation concerns (a plain signal read).

### Won't Have (Out of Scope)

- **Partial-record merge load** (`Promise<Partial<I>>` merging only some fields) — deferred; a full
  raw replace is the chosen model (AR-47). If a "prefill some fields, rebase only those" need lands, it
  is a separate, additive method — it does not change `load`.
- **A `load:` option on `createForm`** (auto-run at construction) — rejected in favour of the method
  (AR-46). An app that wants load-on-mount calls `form.load(...)` from its mount path.
- **A `loadError()` engine surface** — the loader owns its failure reporting (AR-49).
- **Per-field `loading()`** — a load is whole-form; there is no per-field loading state (AR-52).
- **`submitting()`** — the submit-in-flight lifecycle signal stays deferred to RD-08 (AR-45); it is
  unrelated to `loading()`.
- **Optimistic / streaming / paginated loading** — `load` is a single resolve-and-replace; no partial
  progress, no incremental application.

---

## Technical Requirements

### New public surface (`@jsvision/forms`)

```ts
interface Form<S, I> {
  // …existing: field, values, rawValues, errors, isValid, dirty, validating, submit, reset, dispose
  loading(): boolean;                                             // NEW — a load is in flight
  load(
    loader: (ctx: { signal: AbortSignal }) => Promise<I>,         // NEW — resolves the full RAW record
  ): Promise<boolean>;                                            //        true on success, false on rejection
}
```

`CreateFormOptions` is **unchanged** — load is a method, not an option (AR-46).

### Orchestration (internal — additive to `create-form.ts`)

- **State.** One form-level `loading = signal(false)`, a module-local `loadGen = 0` counter, a
  `loadController: AbortController | undefined`, and a `disposed = false` flag, seeded beside the
  existing form-level signals (`submitAttempted`, `create-form.ts:110`). No per-field state — load is
  whole-form (AR-52).
- **`baseline` becomes mutable.** The seeded `baseline` record (`create-form.ts:99`, written only in
  the seed loop at `:103`) is the single mutation point. `fieldDirty` (`:142`) and `reset` (`:174`)
  are **unchanged** — they already read `baseline[name]`; rebasing means overwriting those entries
  (AR-50). This revises AR-12's "baseline immutable this slice".
- **`load` flow.**
  1. `const g = ++loadGen; loadController?.abort(); loadController = new AbortController();
     loading.set(true);`
  2. `let record: I; try { record = await loader({ signal: loadController.signal }); } catch { if
     (!disposed && g === loadGen) loading.set(false); return false; }` — the `!disposed` guard keeps a
     post-disposal rejection from clearing `loading()` on a torn-down form.
  3. `if (disposed || g !== loadGen) return false;` — dropped if the form was disposed **or** superseded
     by a newer load; leave the newer run's / torn-down state (the generation half mirrors `async.ts:104`;
     the `disposed` half is required because `dispose()` bumps no generation).
  4. Apply in one `batch()`: for every `name`, `baseline[name] = clone(record[name]);
     valueSignal(name).set(clone(record[name])); touchedSignal(name).set(false);` then
     `submitAttempted.set(false); loading.set(false);`
  5. `return true;`
- **Reuse, don't re-invent.** The `clone`/`eq` helpers (`create-form.ts:11,16`) and the
  `batch`/`signal` primitives are already imported; the stale-guard shape is copied from
  `async.ts`'s `run` (`async.ts:93-107`). The `AbortController` is a platform global (no new
  dependency).
- **Disposal.** Wrap `dispose()` (RD-06, the `createRoot` disposer) so it **sets `disposed = true` and
  aborts `loadController`** before tearing the scope down — e.g. register both in the root body via
  `onCleanup`, which fires once at disposal (`owner.ts:141`). The generation guard is **not** sufficient
  here: `dispose()` bumps no counter, so a late settle would otherwise pass step 3 and mutate a
  torn-down form (write values, rebase, clear `loading()`). The `disposed` flag checked in steps 2–3 is
  what makes a post-disposal resolve **or** rejection a true no-op.
- **Interaction with `submit`.** `load` and `submit` are independent (each with its own in-flight
  lifecycle); the RD specifies no cross-exclusion — a `load()` fired while a `submit()` awaits `onValid`
  rebases the baseline mid-flight. As with `validating()` (AR-52), gating the two against each other
  (e.g. `disabled: () => form.loading() || form.validating()`) is the app's compositional concern; the
  `load` `@example` notes not to load while a submit is in flight.
- **Interaction with async validation.** Because step 4 writes each `valueSignal`, each async field's
  standing trigger effect (`async.ts:110-144`) fires on the change and re-validates the loaded value
  after its debounce — an accepted, documented consequence (AR-52). `asyncError` is cleared to `null`
  by that same effect (`async.ts:128`), consistent with "a changed value invalidates the prior
  verdict".

### Reactive-core & layering constraints

- `loading()` is a plain `@jsvision/ui` signal; the "Loading…" swap is the app reading it through the
  existing `Show` — no new framework primitive, no `createResource`/Suspense (the #85 guardrail).
- `@jsvision/forms` keeps `zod` as its only peer dependency; `@jsvision/core`/`@jsvision/ui` stay
  zero runtime deps. `load` uses the platform `AbortController` (no new dependency).
- The store stays headless — it draws nothing and performs no I/O; every network call lives inside the
  author's loader.

---

## Integration Points

### With RD-01 (the store it extends)
Additive and backward-compatible: a form that never calls `load()` behaves exactly as the first slice
— `loading()` is always `false`, the baseline stays at `initial`, `dirty()`/`reset()` are unchanged.
`load` is a new method; no existing accessor's behaviour changes. This RD **revises AR-12/FR-1.7**:
the baseline is immutable only until a `load()` succeeds, at which point it is the loaded record.

### With RD-06 (async validation)
Direct idiom reuse: the generation stale-guard, `AbortSignal`, and whole-scope `dispose()` are the
same mechanisms RD-06 established (AR-38/AR-44) — `load` is a second consumer of them. Loading a
record fires each async field's trigger effect (a value change), so a loaded record is re-validated;
`asyncError` is cleared on that change (`async.ts:128`).

### With RD-08 (formDialog + Modal Submit-Gate)
RD-08's dialog opens a form and (optionally) loads a record into it before showing; `loading()` drives
the dialog's initial "Loading…" body, and `dispose()` on dialog-close tears down both the async
effects (RD-06) and any in-flight load (this RD).

### With RD-05 (Comprehensive Showcase)
The showcase curates the load story: a simulated fetch, the `loading()` swap, then load → edit →
`dirty` echo → `reset`-to-loaded, alongside the async-validation and binding stories.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Load trigger surface | (a) `form.load(loader)` method · (b) `load:` option on `createForm` (auto-run at creation) | **(a) `form.load(loader): Promise<boolean>` method** | Re-invokable (Reload / re-load a different record), no I/O in the constructor, testable, symmetric with `submit`. The `#85` `load:` sketch couples I/O to construction and can't reload. | AR-46 |
| Loaded-record shape | (a) full raw record `Promise<I>` · (b) partial `Promise<Partial<I>>` merge · (c) schema-coerced record | **(a) Full raw record `Promise<I>`, replace + rebase all** | Clean "load the record to edit" model; raw (not coerced) is forced — no generic inverse of `z.coerce`, and `initial` is already raw; partial leaves a mixed dirty/baseline state. | AR-47 |
| Post-load state | (a) pristine (clear touched + submit-attempted) · (b) preserve touched | **(a) Pristine; `dirty()` false via rebase** | A freshly-loaded record showing a "touched" error reveal is the wrong default; mirrors `reset()`. | AR-48 |
| Loader rejection | (a) resolve `false`, state untouched · (b) propagate the rejection · (c) add `loadError()` | **(a) Resolve `false`; values/baseline untouched; `loading()`→false** | No unhandled-rejection footgun at every call site; no engine-minted message (loader owns its try/catch, per AR-34/AR-40); mirrors `submit`'s boolean gate. | AR-49 |
| Baseline mutability | keep immutable vs make the rebase target | **Make `baseline` mutable at one point (load success)** | The seeded `baseline` (`create-form.ts:99`) is a well-defined mutation point; `fieldDirty`/`reset` need no logic change. Revises AR-12. | AR-50 |
| Load concurrency | stale-guard only vs stale-guard + `AbortSignal` | **Generation counter (drops superseded results) + `AbortController` (cancels superseded work)** | Guarantees only the newest load applies even if the loader ignores abort; reuses RD-06's idiom (AR-38); `dispose()` aborts in-flight. | AR-51 |
| `loading()` shape + gating | per-field vs form-level; auto-gate submit/isValid vs independent | **Form-level `form.loading()` only; independent of `isValid()`/`submit()` (app composes)** | A load is atomic/whole-form; the app disables Save while loading exactly as it does for `validating()` (AR-39). | AR-52 |
| Repo gates + security | — | **Kitchen-sink load story + smoke test; no engine I/O; loaded strings sanitised on render** | Story is non-negotiable; the engine mints nothing and fetches nothing — the render-path control-byte guard already covers loaded string values. | AR-53 |

> **Traceability:** every decision references `00-ambiguity-register.md` (AR-46…AR-53).

---

## Security Considerations

- **Data sensitivity**: the loader is author-supplied and typically performs a network round-trip
  (e.g. fetch a profile). The engine passes it only an `AbortSignal` and stores only the raw record it
  resolves — it holds no credentials/PII and performs no I/O itself.
- **Input validation**: a loaded record is raw editing data poured into the field value signals; any
  **string** field so loaded renders through the existing control-byte sanitisation path
  (`ScreenBuffer.set` replaces C0/DEL, `sanitize` drops ESC/C1) exactly as typed input does — a loaded
  value carrying control bytes cannot paint a raw control cell (asserted by an oracle mirroring
  RD-04/RD-06's render-and-scan contract). The engine adds no new render path.
- **Injection risks**: none introduced — no `eval`/dynamic code; the engine builds no queries/paths.
  Any network call lives entirely inside the author's loader, which owns its own URL construction and
  escaping (documented in the `@example`).
- **Availability / abuse**: the generation stale-guard + `AbortSignal` bound concurrent loads (a newer
  load aborts and supersedes an older one). Debounce/rate-limiting of a *reload* button is the app's
  concern; server-side rate-limiting of the endpoint remains the app's responsibility (a TUI-client
  concern out of the library's control).
- **Authentication & authorization / encryption / infrastructure**: N/A — an in-process reactive
  orchestrator with no endpoints or persistence of its own.

---

## Acceptance Criteria

1. [ ] A form that never calls `load()` behaves identically to the first slice + RD-06: `loading()` is
       always `false`, the baseline stays at `initial`, and every existing accessor / `submit` / `reset`
       / `dirty` behaves exactly as before (regression-locked).
2. [ ] **Load replaces + rebases:** given `initial: { name: '', port: '8080' }`, after
       `await form.load(async () => ({ name: 'Ada', port: '9090' }))`, `rawValues()` deep-equals
       `{ name: 'Ada', port: '9090' }`, `form.dirty()` is `false`, and every `field.dirty()` is `false`.
3. [ ] **Reset targets the loaded record:** after the load in #2, editing a field then `form.reset()`
       restores the field to the **loaded** value (`'Ada'` / `'9090'`), not the original `initial`.
4. [ ] **Reload rebases again (re-invokable):** two **sequential** successful loads — e.g.
       `await form.load(async () => ({ name: 'Ada', port: '9090' }))` then
       `await form.load(async () => ({ name: 'Ben', port: '7070' }))` — leave `rawValues()`, the
       baseline, and the `reset()` target equal to the **second** record (`'Ben'` / `'7070'`); after the
       second load every `field.dirty()`/`form.dirty()` is `false`. (Locks the re-invokability that
       motivated a method over a `load:` option, AR-46.)
5. [ ] **Pristine after load:** after a load, every `field.touched()` is `false` and the
       submit-attempted flag is cleared — including a field that was `touched()` **before** the load.
6. [ ] **`load` resolves `true`** on success and its returned promise settles **after** the values +
       baseline are applied (a synchronous read of `dirty()` immediately after the `await` sees `false`).
7. [ ] **Rejection leaves state untouched:** for a loader that rejects, `await form.load(...)` resolves
       `false`, `onValid` is never involved, `rawValues()` / baseline / `touched` are unchanged from
       before the call, and `loading()` returns to `false`. The engine exposes no `loadError()`.
8. [ ] **`loading()` transitions:** `loading()` is `false` before, `true` synchronously after the call
       begins, and `false` once the (non-superseded) load settles — for both the success and rejection
       paths.
9. [ ] **Concurrency / stale-guard:** given two overlapping `load()` calls whose loaders resolve out of
       order (the older last), only the **newer** record is applied; the superseded result is dropped
       and the superseded run's `AbortSignal` is aborted (verified via a controllable deferred loader).
10. [ ] **Disposal aborts a load:** a `load()` in flight when `form.dispose()` is called has its
        `AbortSignal` aborted, and a load that **resolves _or_ rejects** after disposal applies no
        values, does not rebase, and does not clear `loading()` for the torn-down form (the `disposed`
        flag, not the generation counter, guarantees this — `dispose()` bumps no generation).
11. [ ] **`asyncError` cleared on load (unconditional):** for a form with an `asyncValidators` entry on a
        loaded field, applying the loaded value clears that field's `asyncError()` to `null` (a changed
        value invalidates the prior verdict), whether or not the loaded value is sync-clean.
12. [ ] **Async re-validation on a sync-clean loaded value:** when the loaded value for an
        `asyncValidators` field is **synchronously clean**, applying it schedules that field's async
        trigger, and after the debounce the validator runs against the loaded value — the documented
        consequence of treating load as setting new values. (A sync-invalid loaded value clears
        `asyncError` per #11 but does **not** run the validator — the `fieldSyncClean` gate.)
13. [ ] Kitchen-sink load story: shows the `loading()` swap and a load → edit → `dirty` echo →
        `reset`-to-loaded flow, has a unique id + required metadata, and passes
        `kitchen-sink.smoke.spec.test.ts`.
14. [ ] Security: a loaded **string** value containing control bytes — e.g. `'a\x00b\x1b[31mc\x9b'` —
        rendered via a widget bound to the field paints **no** cell with a code point `< 0x20`,
        `=== 0x7f`, or in `0x80–0x9f` (the same render-and-scan oracle RD-04/RD-06 use).
15. [ ] `yarn verify` is green; `yarn check:docs` passes — the new `load`/`loading` surface is covered
        by an updated `createForm` **class**-level `@example` (showing load → rebase → reset), and no
        banned CodeOps/TV references appear in shipped code.
