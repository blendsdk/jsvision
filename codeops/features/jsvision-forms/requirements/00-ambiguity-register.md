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
