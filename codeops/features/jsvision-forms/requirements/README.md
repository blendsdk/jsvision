# Requirements — jsvision-forms (first slice)

An **enterprise-grade forms engine** for jsvision TUI apps, delivered as a new package
`@jsvision/forms`. This requirements set covers the **first slice**: a headless form/field store,
**synchronous** Zod validation, and binding to the existing widget signal seams. Later capabilities
(async validation, async loading, a `formDialog` helper, `Input` placeholders) are named follow-on
slices and are explicitly out of scope here.

The design was fully disambiguated in a grill session (see `../plans/_draft/grill-notes-forms-first-slice.md`)
and every semantically-weighted decision is captured in `00-ambiguity-register.md`.

## What this slice delivers

A developer writes a Zod schema and a small amount of UI, and gets: two-way value binding, live
sync validation (per-field + cross-field), `touched`/`dirty` tracking, an `isValid()`-gated submit,
and a schema-coerced typed `values()` — with **no** `onChange`/`onBlur` handlers, manual error
state, or hand-rolled parsing.

## Scope

**In scope**
- Headless `createForm` store over jsvision's Solid-style signals (owner-free).
- Zod-direct validation (`schema.safeParse`), eager, with per-field and form-level error surfacing.
- Composable error timing (`error()` always-live + `touched()`; the app composes the reveal).
- Value model: raw editing signal per field + schema-coerced `values()`.
- Widget binding: direct for `Input`/`Switch`; domain-valued adapters for `RadioGroup`/`CheckGroup`;
  `bindField` for touched-on-blur wiring.
- `dirty`/`reset`/`isValid`/`submit`.

**Out of scope (named follow-on slices)**
- Async validation · async loading + baseline rebase · `formDialog()` + submit-as-modal-gate ·
  `Input` placeholder + wrapper propagation · plural `errors()` per field · warning severity ·
  `disabled`/`readonly` · per-field reset · nested/array-of-object fields · runtime schema introspection.

## Glossary

| Term | Meaning |
|------|---------|
| **Field** | A named entry in the form; exposes `value` (raw signal), `error()`, `touched()`, `dirty()`. |
| **Raw value** | What the widget edits — a `string` for text, native for choice widgets; held in `field.value`. |
| **Coerced value** | The schema output for a field (e.g. a `number` from `z.coerce.number()`); surfaced via `form.values()`. |
| **Domain value** | For a choice field, the meaningful value (`'info'`) rather than the widget-native index/bool[]. |
| **Adapter** | A stateless lens (`bindRadio`/`bindCheck`) mapping a field's domain value ⇄ the widget's native signal. |
| **Touched** | A field has been visited and left (first blur), or the form was submitted. Gates error visibility. |
| **Dirty** | The field's raw value differs from its baseline (`initial`). |
| **Baseline** | The `initial` values a field resets to; immutable in this slice. |
| **Issue** | A Zod validation issue (`ZodIssue`) — carries `message`/`path`. |

## RD index

| RD | Title | Priority | Depends on |
|----|-------|----------|------------|
| [RD-01](RD-01-form-field-store.md) | Form & Field Store | Must | — |
| [RD-02](RD-02-validation-error-surfacing.md) | Validation & Error Surfacing | Must | RD-01 |
| [RD-03](RD-03-widget-binding.md) | Widget Binding | Must | RD-01, RD-02 |
| [RD-04](RD-04-non-functional.md) | Non-Functional (packaging, security, testing, gates) | Must | RD-01…03 |

**Suggested implementation order:** RD-01 → RD-02 → RD-03 → RD-04. The whole set is the MVP for the
forms engine; follow-on slices build on it.

## Traceability

Every requirement back-references its `AR-NN` entry in `00-ambiguity-register.md`. No RD contains an
AI-assumed default — every decision traces to an explicit user resolution.
