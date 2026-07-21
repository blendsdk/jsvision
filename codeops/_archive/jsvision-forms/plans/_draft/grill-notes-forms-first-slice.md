# Grill notes — @jsvision/forms (first slice)

- **Topic:** Forms engine first slice — headless form/field store + synchronous Zod v4 validation + binding to existing Input/Switch/RadioGroup/CheckGroup widget Signal seams.
- **Date:** 2026-07-13/14
- **Git ref:** branch feat/forms; HEAD a5d79943
- **Source issue:** GH #85 (settled grounding + residual decisions)
- **Scope OUT:** async validation, async loading, formDialog helper, Input placeholder (follow-on slices).

## Grounding verified against code
- Signal API (reactive/types.ts): `signal<T>()` callable getter + `.set()`/`.update()`/`.peek()`; reactivity via effect/computed/View.bind; no `.subscribe`.
- Widget seams: Input→Signal<string>, Switch→Signal<boolean>, RadioGroup→Signal<number> (index), CheckGroup→Signal<boolean[]>.
- View.focusSignal(): Signal<void> (view.ts:136) + state.focused (view.ts:67) both public.
- Zod NOT installed anywhere; this slice adds it (peer dep of forms; devDep for tests/examples).
- reactive barrel exports: signal/computed/effect/batch/untrack/createRoot/onCleanup/runWithOwner/getOwner/Show/For + Owner.

## Design tree — ALL RESOLVED
1. Value model — RESOLVED
2. Validation library & per-field extraction — RESOLVED (USE ZOD DIRECTLY; standard-schema abstraction dropped)
3. Validation orchestration (sync) — RESOLVED
4. State lifecycle — RESOLVED
5. Widget binding contract — RESOLVED
6. Package skeleton & gates — RESOLVED

## Resolved decisions
| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Value model | Raw editing signal + schema-coerced form.values() | One coercion source (schema); widgets bind field.value directly. |
| 2 | Validation lib | **Use Zod directly** — param = Zod object schema; schema.safeParse(raw); zod = REQUIRED peer dep; forms imports zod. NO standard-schema/inline. | Simplest; committed to Zod; all TS devs know it. Field names/types from z.input/z.output<S>. |
| 3 | Error timing | Composable: error() always-live + touched() exposed; app composes | Most primitive; matches #85; validation eager; isValid()=actual validity. |
| 3a | Error surface | error() = first issue (ZodIssue\|null); errors() deferred | One-line TUI row. |
| 3b | Touched trigger | First blur; submit marks all | Validate silently, reveal on blur. |
| 4a | values() invalid | z.output<S> \| null; rawValues() always raw | No throw in reactive read. |
| 4d | Submit gate | form.submit(onValid:(v)=>void\|Promise<void>): Promise<boolean> — marks touched, validates, awaits onValid if valid | Forward-compat with dialog slice; reads identically for sync; submitting() deferred. |
| 5 | Choice binding | bindRadio/bindCheck adapters, domain-valued raw; text/switch direct; bindField(field,view) wires touched via focusSignal | Schema stays z.enum; one wiring primitive covers all widgets. |
| 6 | Packaging | @jsvision/forms: dep @jsvision/ui + peer zod; ESM/NodeNext; barrel; owner-free createForm; forms kitchen-sink story + smoke; spec-first | Convention; zero-dep preserved for core/ui. |

## Confirmed assumptions
- A1.1 field.value = same Signal<T> the store owns (two-way, no copy).
- A1.2 [REVISED] text=string, switch=boolean bind DIRECT; radio/check raw = DOMAIN value via bindRadio/bindCheck.
- A1.4 `initial` = z.input<S> raw representation (age: '' string), not z.output.
- A2.2 one schema.safeParse(rawSnapshot) per raw change (eager computed): success→.data=values(); fail→.error.issues; field error = issues.find(path[0]===name); path-less → form.errors().
- A2.4 CONSTRAINT: string-edited numeric/date field must use z.coerce/transform.
- A2.5 flat top-level fields; nested/array-of-object deferred. field(name) typed via keyof z.output<S>.
- A2.6 no RUNTIME schema introspection this slice (auto required/enum); type-level keyof is fine.
- A3.1 validation eager (one computed).
- A3.2 error() = first ZodIssue (message via .message) | null; errors() deferred.
- A3.3 touched = first blur; submit marks all.
- A3.4 warnings deferred.
- A3.5 cross-field via schema .refine/.superRefine only; path-less → form.errors() (array).
- A3.7 isValid() = actual validity, touched-independent.
- A4.1 dirty = raw≠baseline; baseline=initial (immutable this slice); eq: === primitives, element-wise boolean[].
- A4.2 reset() restores baseline (batch), clears touched+submit-attempted; per-field reset deferred.
- A4.3 field handle = value/error()/touched()/dirty()/name; disabled/readonly deferred.
- A4.4 submit forward-compat signature (dec 4d); submitting() deferred. [LOCKED 2026-07-14]
- A5.1 bindRadio/bindCheck = stateless lenses over field.value; indexOf -1 passes through (app seeds valid initial).
- A5.2 check domain = Signal<T[]> selected values (vs Record map). [LOCKED 2026-07-14]
- A5.3 bindField(field,view) wires touched via focusSignal()+state.focused (grounded view.ts:136/67).
- A6.1 createForm OWNER-FREE (pure signals + lazy computeds, no dispose); only touched effects live in view scope.

## Deferred (follow-on slices)
- async validation; async loading + rebase baseline; formDialog() + submit-as-modal-gate; Input placeholder + 4 wrappers; errors() plural; warnings severity; disabled/readonly; per-field reset; nested/array fields; runtime schema introspection.

## Status: all branches resolved → ready for cross-branch check + shared understanding → make_requirements.
