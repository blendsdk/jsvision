# Ambiguity Register — jsvision-forms (first slice)

> The hard gate for the forms-engine first slice. Every semantically-weighted decision is listed,
> resolved, and attributed. Grill-resolved items (2026-07-13/14 session) enter as ✅ Resolved with
> an explicit user decision; structuring surfaced a handful of NEW items (AR-18…AR-24).
>
> Source grill record: `../plans/_draft/grill-notes-forms-first-slice.md`.

## Scope

**First slice:** headless form/field store + **synchronous** Zod validation + binding to the
existing `Input` / `Switch` / `RadioGroup` / `CheckGroup` widget signal seams. Delivered as a new
package `@jsvision/forms`. Async validation, async loading, the `formDialog` helper, and the
`Input` placeholder are **named follow-on slices**, out of scope here.

## Resolved by the grill (explicit user decisions)

| AR | Decision | Resolution | Status |
|----|----------|------------|--------|
| AR-01 | Value model | `field.value` = the raw editing `Signal<T>` the store owns (string for text; native for choice); `form.values()` = Zod-coerced typed output. One coercion source. | ✅ Resolved |
| AR-02 | Validation library | **Zod used directly** — the schema param is a Zod object schema; validation is `schema.safeParse(raw)`; `zod` is a **required peer dependency**; forms imports zod. No Standard-Schema abstraction, no inlined interface. | ✅ Resolved |
| AR-03 | Error timing / ownership | Composable — `error()` is always-live, `touched()` is exposed, the **app composes** the reveal (`touched() && error()`). Validation is eager (one lazy computed). `isValid()` = actual whole-object validity, independent of touched. | ✅ Resolved |
| AR-04 | Error surface per field | `error()` returns the **first** issue for the field (`ZodIssue \| null`). Plural `errors()` per field deferred. | ✅ Resolved |
| AR-05 | Touched trigger | Flips on **first blur** (focus-leave after focus); `submit()` marks all fields touched. | ✅ Resolved |
| AR-06 | `values()` when invalid | `form.values()` → `z.output<S> \| null` (null when invalid); `form.rawValues()` returns the raw snapshot **always**. No throwing in a reactive read. | ✅ Resolved |
| AR-07 | Submit gate | `form.submit(onValid: (values) => void \| Promise<void>): Promise<boolean>` — marks all touched, validates, awaits `onValid` only if valid, resolves true/false. `submitting()` deferred. | ✅ Resolved |
| AR-08 | Choice binding | Domain-valued adapters: `bindRadio(field, options)` → `Signal<number>`, `bindCheck(field, options: T[])` → `Signal<boolean[]>` with `field.value` = `Signal<T[]>` (selected values). Text/`Switch` bind directly. | ✅ Resolved |
| AR-09 | Touched wiring | `bindField(field, view)` hooks `View.focusSignal()` + `state.focused` to set touched on focus-leave. One primitive for every widget. | ✅ Resolved |
| AR-10 | Coercion constraint | A non-string field edited through a string `Input` **must** use `z.coerce.*` (or a transform) in its schema; a bare `z.number()` rejects the string. Documented contract. | ✅ Resolved |
| AR-11 | Cross-field validation | Schema-level `.refine`/`.superRefine` only. Issues with a `path` route to that field; path-less issues → `form.errors()` (array). No sibling-reading per-field validator this slice. | ✅ Resolved |
| AR-12 | Dirty / baseline | `field.dirty()` = raw value ≠ baseline; `form.dirty()` = any field dirty. Baseline = `initial`, **immutable this slice**. Equality: `===` for string/number/boolean, element-wise for arrays. | ✅ Resolved |
| AR-13 | Reset | `form.reset()` restores every field to baseline in one `batch()`, clears `touched` and the submit-attempted flag. Per-field `field.reset()` deferred. | ✅ Resolved |
| AR-14 | Field-handle shape | `name` / `value` / `error()` / `touched()` / `dirty()`. `disabled`/`readonly` deferred (a UI concern the app sets on the widget). | ✅ Resolved |
| AR-15 | Store lifecycle | `createForm` is **owner-free** — pure signals + lazy computeds (nothing to dispose). The only effects (touched-wiring) live in the view scope via `bindField`. | ✅ Resolved |
| AR-16 | Packaging | `@jsvision/forms`: dep `@jsvision/ui` + peer `zod`; ESM-only, NodeNext `.js` specifiers, single barrel `src/index.ts`. Core/UI stay zero-dep. | ✅ Resolved |
| AR-17 | Out of scope | async validation; async loading + baseline rebase; `formDialog()` + submit-as-modal-gate; `Input` placeholder + 4 wrappers; `errors()` plural; warnings severity; `disabled`/`readonly`; per-field reset; nested/array-of-object fields; runtime schema introspection. | ✅ Resolved (deferred) |

## New — surfaced during structuring (confirmed by the user 2026-07-14)

| AR | Decision | Recommended resolution | Weight |
|----|----------|------------------------|--------|
| AR-18 | **Typing contract** — how do raw and coerced types stay precise? | `createForm<S extends z.ZodObject<any>, I extends Record<keyof z.output<S>, unknown>>({ schema: S; initial: I })`. `field<K extends keyof I>(name: K): Field<I[K]>` (raw type from `initial`), `values(): z.output<S> \| null` (typed from schema), `rawValues(): I`. So `initial`'s **keys are checked against the schema** but its **value types are the raw editing types you supply** (`port: '8080'` → `Signal<string>`). | **Medium** — shapes the public type contract |
| AR-19 | **`field()` unknown key** at runtime (TS blocks it via `keyof`, but a cast/dynamic string could slip through) | **Throw** a descriptive `FormFieldError: unknown field "xyz"` — fail fast on a dev error. | Low |
| AR-20 | **Exposed issue type** | **Pass `ZodIssue` through** as `error()`'s return (`ZodIssue \| null`) — zero mapping, richer info (`message`/`path`/`code`); accepts the Zod coupling since we already depend on Zod. (Alternative considered: map to a minimal `FormIssue {message, path}` to decouple — rejected as needless indirection given the Zod commitment.) | Low |
| AR-21 | **Field-handle identity** | `form.field(name)` returns a **stable memoized handle** per name — every call gets the same `value`/`touched`/`dirty` signals (correctness: `bindField` and the UI must observe the same touched signal). | Low (correctness) |
| AR-22 | **Security posture** (mandatory non-functional) | Validation/sanitization is the app's responsibility via Zod at the boundary; the engine **never bypasses** the widgets' existing control-byte sanitization (`Input` writes through the sanitizing `ScreenBuffer.set`); no `eval`/dynamic code; the store holds only what the app puts in; no secrets/PII handling in the library. TUI context ⇒ no SQL/XSS/path-traversal surface in the engine itself. | Statement (documented in RD-04) |
| AR-23 | **Performance** | Eager whole-object `safeParse` on every raw change is acceptable (sync Zod = microseconds for normal forms); **no debounce this slice** (that rides the async slice). No perf gate. | Statement (documented in RD-04) |
| AR-24 | **Error message source** | Zod **passthrough** — the schema author owns messages (`z.string().min(1, 'Required')`); the engine surfaces `issue.message` verbatim, never invents copy. | Low (obvious) |

## Gate status — PASSED (2026-07-14)

- [x] All grill decisions recorded as ✅ Resolved with explicit user decisions.
- [x] AR-18…AR-24 confirmed by the user (AR-18 typing contract; AR-19/20 low-stakes calls; AR-21–24 correctness/statements).
- [x] Zero deferred *within-scope* items — every in-scope ambiguity has a concrete answer.
- [x] User reviewed and confirmed the complete register.

---

## RD-09 — Styled Error Text & Input Placeholder (2026-07-15 extension)

> Appended for the reopened feature (see `00-roadmap.md`). Scope: two `@jsvision/ui`/`@jsvision/core`
> presentation primitives. AR-25/26/28/31 were explicit user decisions (2026-07-15); AR-27/29/30/32
> are recommendations derived from them, confirmed on RD review.

| AR | Decision | Resolution | Status |
|----|----------|------------|--------|
| AR-25 | Danger/advisory colour model | Add semantic **`dangerText` + `warningText`** roles to `@jsvision/core`'s `Theme`, derived from the existing `danger`/`warning` aliases (defaults `#ef4444`/`#f59e0b`); `createTheme` overrides flow through. Chosen over a hardcoded raw colour or reusing an existing role — themeable, and powers both error text and the showcase's amber advisories. Role names deliberately differ from the `danger`/`warning` **alias** names — preflight PF-003 found a `warning` role would collide with the `warning` alias (dup theme-designer row; breaks the no-role-name=alias-name invariant); user chose `dangerText`/`warningText` (2026-07-15). | ✅ Resolved (user) |
| AR-26 | Styled-error primitive shape | **Extend the existing `Text`** with an optional `severity` option (paints via the new role); no new widget class. Touched-gating stays app-composed. Chosen over a dedicated `ErrorText`/`StyledText`. | ✅ Resolved (user) |
| AR-27 | Severity option type | `Text`'s option is **`severity?: 'error' \| 'warning'`** (semantic, static) rather than a general `role`/`style` bag — purpose-built, avoids speculative surface; content is already reactive. The public value stays `'error'`/`'warning'` and is **decoupled from the role names**: `draw()` maps `'error'`→`dangerText`, `'warning'`→`warningText`, unset→`staticText` (PF-003). | ✅ Resolved (derived) |
| AR-28 | Placeholder visibility | `Input` placeholder shown muted **whenever the bound value is empty** (any focus state), hidden on the first character. Chosen over show-only-when-unfocused. | ✅ Resolved (user) |
| AR-29 | Placeholder styling | Rendered in a **muted style composed from existing roles** (`staticText` fg over `inputNormal` bg) — no new `inputPlaceholder` role — bounding the core change to the two severity roles; themeable by inheritance, reliable across colour depths. | ✅ Resolved (derived) |
| AR-30 | Placeholder propagation | Added to `Input` and forwarded only to Inputs that own a persistent field with a meaningful empty state — **`DatePicker` + `ComboBox` + the `inputBox()` modal prompt**. Preflight PF-003/PF-001 corrected the original "4 wrappers" list: `History` owns no `Input` (it decorates a caller-supplied field via `opts.link`), and `ColorPicker`'s hex `Input` is transient, `allowCustom`-gated, and a specialised `#rrggbb` editor — both excluded; `inputBox()` added. | ✅ Resolved (amended by preflight) |
| AR-31 | Per-field `field.reset()` | **Deferred** out of RD-09 — a store concern that would reopen the locked Field handle (AR-14). Remains in the GH #89 backlog / a later store RD. | ✅ Resolved (deferred) |
| AR-32 | Package span / layering | RD-09 spans `@jsvision/core` (roles) + `@jsvision/ui` (Text/Input) + `@jsvision/examples` (stories); **no `@jsvision/forms` change** — a `Field`-coupled widget can't live in `ui` (which `forms` depends on), so the styled primitive is generic and the touched-gated reveal stays app-composed. Core stays zero-dep. | ✅ Resolved (derived) |

### Gate status (RD-09) — ✅ PASSED (preflighted 2026-07-15)

- [x] The four semantically-pivotal items (AR-25/26/28/31) resolved by explicit user decision.
- [x] Derived items (AR-27/29/30/32) recorded with rationale.
- [x] User reviewed the RD-09 set via preflight (`00-preflight-report-rd-09.md`).
- [x] Preflight decisions applied: role names `dangerText`/`warningText` (PF-003, revises AR-25/27);
      propagation to `DatePicker` + `ComboBox` + `inputBox()` (PF-001, revises AR-30); theme-role
      integration surface corrected + MINOR items (PF-002/004/005/006/007). Report: BLOCKED → resolved.

---

## RD-06 — Async Validation (2026-07-15 extension)

> Appended for the async-validation slice (see `00-roadmap.md`; source design GH #85, scope fence
> GH #89). AR-33/36/40/44 are explicit user decisions (2026-07-15); the rest are recommendations
> derived from them and from the codebase, confirmed on RD review. The pivotal architecture call
> (AR-33) was hardened with an independent adversarial review that empirically confirmed the
> sync-parse-throws-on-async-refine landmine against the pinned zod 4.4.3.

| AR | Decision | Resolution | Status |
|----|----------|------------|--------|
| AR-33 | Async architecture | **Keep the synchronous whole-object `safeParse` for schema rules; add an opt-in per-field async validator layer beside it** (not a whole-object `safeParseAsync`). Chosen because per-field `validating()` — an RD-06 deliverable — cannot be derived from a whole-object async parse without reading `schema.shape` (banned), and a sync `safeParse` on an async-refine schema *throws* (verified, zod 4.4.3). Preserves instant sync `isValid()`. Accepted cost: no cross-field **async** (AR-43). | ✅ Resolved (user) |
| AR-34 | Async validator config surface | `CreateFormOptions` gains `asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> }` where `AsyncValidator<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<string \| null>`. Additive, typed, keyed by field name; the schema stays the sync source of truth; the flat `Object.keys(initial)` field model is untouched. | ✅ Resolved (derived) |
| AR-35 | Value passed to the validator | The validator receives the field's **raw** editing value (`I[K]`, what `field.value` holds), not the schema-coerced value. The coerced value only exists on whole-object success (`result.data` is `null` otherwise), so passing raw avoids a null-data trap and lets async run per-field; the author coerces inside the validator if needed. | ✅ Resolved (derived) |
| AR-36 | Trigger + gating | Async runs **debounced on value change, only when the field is sync-clean** (`fieldError(name) === null`, re-checked after the debounce), and is **force-run on submit**. Chosen over on-blur-only and on-submit-only for live "checking…" feedback while bounding request volume and never checking a malformed value. **Preflight PF-002:** one trigger effect **per async field**, each subscribing only to its own value (tracked) and reading the sync gate **untracked** — because `fieldError` reads the one shared parse, tracking it would make any field's edit re-run/abort every field's in-flight check. | ✅ Resolved (user; PF-002 refined) |
| AR-37 | Debounce | Form-level `asyncDebounceMs?: number`, default **300**; changes within the window coalesce to one run with the final value. Per-field override deferred (speculative until a use lands). | ✅ Resolved (derived) |
| AR-38 | Concurrency correctness | Per-field **monotonic generation counter** — a result is applied only if its generation is still current (a slow answer for an old value is dropped) — **plus an `AbortSignal`** handed to the validator and aborted when a run is superseded (or the form disposed), so cancellable work (`fetch`) can stop. Mirrors the `load({ signal })` idiom. | ✅ Resolved (derived) |
| AR-39 | `validating()` state | Per-field `field.validating(): boolean` (drives the row spinner) + form-level `form.validating(): boolean` = OR over fields (drives the global busy / Save-disabled state). Backed by signals the async runner sets. | ✅ Resolved (derived) |
| AR-40 | Async error surface | **Distinct `field.asyncError(): string \| null`**; `error(): ZodIssue \| null` stays sync-only and unchanged. Chosen over merging the async message into `error()` as a synthetic `ZodIssue` — honest (no fabricated `code`/`path`), back-compatible, and keeps the `ZodIssue`-passthrough guardrail (AR-20). The app composes `error()?.message ?? asyncError()`. | ✅ Resolved (user) |
| AR-41 | `isValid()` + submit gate | `form.isValid()` = whole-object sync-valid **AND** no field holds an async error; **sync-optimistic about pending** (a not-yet-run async check does not by itself flip `isValid()` false). `form.submit()` marks touched → **force-runs + awaits every async validator** (debounce-bypassing, stale-guarded) → re-checks `isValid()` → gates. Signature unchanged. RD-06 owns submit's async-awareness; the `formDialog` wiring is RD-08. **Preflight PF-003:** `submit()` cancels any pending debounce timers before force-running, so a queued debounced run cannot supersede the force-run mid-gate. | ✅ Resolved (derived; PF-003 refined) |
| AR-42 | In-schema async refine | The sync parse is guarded: a throwing `schema.safeParse` (Zod's `$ZodAsyncError` when the schema holds an async refine) is rethrown as a **named developer error** directing the author to `asyncValidators`, instead of crashing every accessor. In-schema async refinements are an unsupported input, documented as such. (`safeParse` never throws for ordinary failures — it returns `{ success: false }` — so a throw unambiguously means an async refinement.) | ✅ Resolved (derived) |
| AR-43 | Cross-field async — out of scope | **Deferred.** A per-field validator sees only its own field and writes only its own channel, so cross-field / object-level **async** validation is not expressible in this model; RD-06 forecloses it. Recorded tie-breaker: if cross-field async later becomes a hard requirement, the whole-object `safeParseAsync` architecture (AR-33 option b) must be revisited — it cannot be retrofitted. Cross-field **sync** validation via schema `.refine`/`.superRefine` is unchanged (AR-11). | ✅ Resolved (user, via AR-33) |
| AR-44 | Store lifecycle / `dispose()` | `createForm` gains **`dispose(): void`** that tears down the form's **whole reactive scope** — the standing async-trigger effects **and** the validation/field computeds — by exposing the disposer the existing `createRoot` already provides (currently discarded at `create-form.ts:64`). **Idempotent** (owner-disposed guard); **after `dispose()` the form must not be used**. It is **not** a "no-op without async validators" — it disposes the (lazy) scope regardless — but a sync-only form has no standing effect to leak, so calling it is optional there (preflight PF-001 corrected the original no-op wording; `createRoot`'s disposer and `effect`'s lack of an individual disposer, `owner.ts:163`/`effect.ts:9`, make whole-scope teardown the honest semantics). **Revises AR-15** — the store is no longer purely lazy once async validators are present. Chosen over keeping it owner-free because per-dialog forms (RD-08) must tear their scope down to avoid a leak. | ✅ Resolved (user; PF-001 refined) |
| AR-45 | Repo gates + `submitting()` deferral | A kitchen-sink async-validation **story** (a field with a simulated availability check: live "checking…" + async error) passing the headless smoke test is required. `form.submitting()` (submit-in-flight lifecycle) stays **deferred to RD-08**, where the submit-gate/dialog UX lives. | ✅ Resolved (derived) |

### Gate status (RD-06) — ✅ PASSED (2026-07-15)

- [x] The four semantically-pivotal items (AR-33 architecture, AR-36 trigger/gating, AR-40 async
      error surface, AR-44 lifecycle/`dispose`) resolved by explicit user decision.
- [x] AR-33 hardened with an independent adversarial review (empirically confirmed the sync-parse
      async-refine throw against zod 4.4.3; verdict: architecture (a) is the only guardrail-satisfying
      option, with three sharp edges — folded into AR-41/42/43).
- [x] Derived items (AR-34/35/37/38/39/41/42/43/45) recorded with codebase-grounded rationale.
- [x] Zero deferred *within-scope* items — every in-scope ambiguity has a concrete answer; cross-field
      async is an explicit, recorded **out-of-scope** decision (AR-43), not an unresolved gap.
- [x] User reviewed and confirmed the four pivotal decisions (AskUserQuestion, 2026-07-15).
