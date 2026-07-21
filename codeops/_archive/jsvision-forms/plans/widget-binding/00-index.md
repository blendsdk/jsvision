# Plan: widget-binding (@jsvision/forms Field ⇄ widget binding)

> **Implements**: jsvision-forms/RD-03
> **Type**: Feature · **Feature**: jsvision-forms
> **CodeOps Skills Version**: 3.7.0
> **Status**: Ready to execute

## Overview

The bridge from a `Field` (the RD-01/02 store, already shipped) to a jsvision widget. Three additive
helpers riding the existing `@jsvision/ui` signal seams — **no widget-architecture change, no new
dependency**:

- **Direct binding** (FR-3.1, no new code): hand `field.value` straight to a widget whose native
  type equals the domain type — `new Input({ value: field.value })` (`Signal<string>`),
  `new Switch({ value: field.value })` (`Signal<boolean>`).
- **`bindField(field, view)`** (FR-3.2): wire *touched-on-blur* for any `View` via its public
  `focusSignal()` + `state.focused`, in the view's own reactive scope (torn down with the view, so
  the store stays owner-free).
- **`bindRadio` / `bindCheck`** (FR-3.3/3.4): stateless lens `Signal`s that adapt a domain value
  (`z.enum`, `z.array(z.enum)`) to the index / flag shapes `RadioGroup`/`CheckGroup` consume — so
  the schema stays in domain terms, never in indices.

## Documents

- [00-ambiguity-register.md](00-ambiguity-register.md) — Zero-Ambiguity Gate (✅ PASSED)
- [01-requirements.md](01-requirements.md) — scope, in/out, source RD
- [02-current-state.md](02-current-state.md) — the store, widget, and focus seams this rides
- [03-01-bind-field.md](03-01-bind-field.md) — `bindField` + the touched-sink registry
- [03-02-choice-adapters.md](03-02-choice-adapters.md) — `bindRadio` / `bindCheck` lenses
- [07-testing-strategy.md](07-testing-strategy.md) — ST-01…ST-07 + impl tests
- [99-execution-plan.md](99-execution-plan.md) — phases + task checklist

## Key decisions (see the register)

- **Touched write seam** = a package-internal `WeakMap<object, () => void>` registry — the public
  `Field` surface stays exactly as RD-01 shipped; type-safe, no cast, no `any` (PA-1).
- The touched effect runs via the public `view.onMount(() => view.bind(...))` seam (PA-2).
- `bindRadio`/`bindCheck` are **pure lenses** — no stored state, no cleanup (FR-3.5); built like the
  stock `signal()` (`Object.assign(read, {peek,set,update})`).
- The kitchen-sink `forms/*` story stays deferred to RD-04 — RD-03 ships binding *helpers*, not
  visual components (PA-9).

## Verify

Per task: `yarn workspace @jsvision/forms test`. Phase gate: `yarn verify`. Prime directive:
`yarn lint:fix` before any PR-opening push, and commit its changes.
