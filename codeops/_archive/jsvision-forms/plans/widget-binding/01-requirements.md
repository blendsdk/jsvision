# Requirements — widget-binding

> **Source**: [RD-03](../../requirements/RD-03-widget-binding.md)
> Implements `jsvision-forms/RD-03`. Full functional detail lives in the RD; this restates the plan's
> scope and in/out boundaries. Every decision traces to the plan register (PA-n) or the requirements
> register (AR-n).

## Goal

Bind an RD-01/02 `Field` to jsvision widgets with three additive helpers, with no change to the
widget framework and no new package dependency.

## In scope

- **FR-3.1** Direct text/boolean binding — `Input({ value: field.value })` (`Signal<string>`),
  `Switch({ value: field.value })` (`Signal<boolean>`). No new code; a documented usage proven by
  tests (AR-01).
- **FR-3.2** `bindField(field, view)` — set touched on first focus-leave; view-scoped and disposed
  with the view; never on mount; idempotent per (field, view) (AR-05, AR-09; PA-1…PA-4, PA-8).
- **FR-3.3** `bindRadio(field, options)` → a stateless `Signal<number>` lens over `field.value`
  (AR-08).
- **FR-3.4** `bindCheck(field, options)` → a stateless `Signal<boolean[]>` lens; domain value is
  `Signal<T[]>` (the selected values) (AR-08).
- **FR-3.5** Adapters are pure lenses — no stored state; disposing a bound widget leaves the field
  untouched; touched is wired separately via `bindField`.
- The internal touched-write seam FR-3.2 needs (PA-1) and its registration in `create-form.ts`.

## Out of scope (AR-17)

Widget-factory sugar (`fieldInput`/`fieldSwitch`), `Input` placeholder, `disabled`/`readonly`
propagation, the kitchen-sink `forms/*` story (RD-04; PA-9), and anything async.

## Success criteria

- RD-03 AC-1…AC-5 pass as **ST-01…ST-07** (see 07).
- `yarn verify` green; `yarn workspace @jsvision/forms check:docs` green — every new export
  (`bindField`/`bindRadio`/`bindCheck`) carries a copy-pasteable `@example`, and no shipped comment
  references a process ID, plan path, or Turbo Vision provenance.
- Core/UI stay zero-dep; `@jsvision/forms` gains **no** new dependency (the `View` import is
  type-only and `@jsvision/ui` is already a dependency).
