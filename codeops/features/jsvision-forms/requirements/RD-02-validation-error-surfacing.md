# RD-02: Validation & Error Surfacing

- **Priority:** Must
- **Depends on:** RD-01
- **Status:** Drafted

## Summary

How the store validates against Zod and surfaces errors. Validation is **synchronous**, **eager**,
and runs the **whole object** through `schema.safeParse` in one lazy computed; per-field and
form-level errors derive from that single result. The engine is **unopinionated about visibility**:
`error()` is always the current result and `touched()` is exposed — the app composes the reveal.

## Functional requirements

### FR-2.1 — Single eager validation computed *(AR-02, AR-03)*
Validation is one lazy `computed` that runs `schema.safeParse(rawValues())` and recomputes whenever
any field's raw signal changes. Every derived accessor (`error()`, `errors()`, `isValid()`,
`values()`) reads this one result. Sync Zod only — a schema that returns a Promise is out of scope
(async slice).

### FR-2.2 — Per-field error extraction *(AR-04, AR-20)*
`field.error()` returns the **first** issue whose `path[0] === field.name`, as a `ZodIssue`, or
`null`. `ZodIssue` is passed through verbatim (no mapping); callers typically read `.message`.

### FR-2.3 — Form-level errors *(AR-11)*
`form.errors()` returns the array of issues with an empty/absent `path` (object-level `.refine`
failures that belong to no single field).

### FR-2.4 — Composable error timing *(AR-03, AR-05)*
- `field.error()` is **always live** — it reflects the current validation result even before the
  field is touched. The engine never hides it.
- `field.touched()` is exposed so the app can gate visibility, e.g.
  `Show(() => field.touched() && field.error() !== null, …)`.
- No `validateOn` mode, no engine-side reveal gating (that convenience is deferred, AR-17).

### FR-2.5 — Touched semantics *(AR-05)*
`touched` flips to `true` on the field's **first blur** (focus-leave after focus; wiring in RD-03),
and `submit()` marks **all** fields touched (RD-01 FR-1.10). Once true it stays true until `reset()`.

### FR-2.6 — `isValid()` *(AR-03)*
`isValid()` is `true` iff the single `safeParse` succeeds. Independent of `touched`.

### FR-2.7 — Coercion & typed output *(AR-10, AR-01)*
- `values()` returns `safeParse(...).data` (the coerced `z.output<S>`) when valid, else `null`.
- **Constraint (documented):** a non-string field edited through a string `Input` **must** use
  `z.coerce.*` (or a transform) in its schema; a bare `z.number()` rejects the string `"42"`. This is
  the contract that makes the raw-value / coerced-output split work.

### FR-2.8 — Cross-field rules & message source *(AR-11, AR-24)*
- Cross-field validation is expressed as schema `.refine`/`.superRefine`. An issue with
  `path: ['fieldName']` routes to that field's `error()`; a path-less issue routes to `form.errors()`.
- Error message text is **Zod passthrough** — whatever the schema author wrote
  (`z.string().min(1, 'Required')`); the engine never invents copy.

## Acceptance criteria

- [ ] One `safeParse` runs per raw change; `error()`/`errors()`/`isValid()`/`values()` all reflect it.
- [ ] `field.error()` returns the first `ZodIssue` for that field (by `path[0]`) or `null`, live even
      before touch.
- [ ] A path-less `.refine` failure appears in `form.errors()` and not in any field's `error()`.
- [ ] A `.refine({ path: ['port'] })` failure appears in `field('port').error()`.
- [ ] A `z.coerce.number()` field with raw `'42'` yields `values().thatField === 42`; with raw `'x'`
      it yields an `error()` and `values() === null`.
- [ ] `isValid()` tracks the `safeParse` success flag and ignores `touched`.
- [ ] Error messages surfaced are exactly the schema's messages.

## Out of scope
Async validation, plural per-field `errors()`, warning severity, engine-side reveal gating
(`validateOn`) — all AR-17. Touched-wiring mechanism → RD-03.

## Traceability
AR-02, AR-03, AR-04, AR-05, AR-10, AR-11, AR-20, AR-24.
