# Testing strategy: translated layout and multilingual QA

> **Status**: Ready for execution
> **CodeOps Artifact Schema**: 1

## Specification-first order

Every phase begins with requirements-derived `.spec.test.ts` expectations, runs them red against the
phase baseline, then implements production behavior. Implementation-only edges live in
`.impl.test.ts` files after the specifications turn green. Existing specifications are not weakened
to accommodate production output.

## Test layers

| Layer | Coverage |
|---|---|
| UI pure specifications | Width formula, empty/invalid options, accelerator exclusion, wide/combining labels, rows/columns/gaps, order, absolute bounds |
| UI integration | Dialog intrinsic dimensions, wrapped action height, focus/hit bounds, message/body cell width, existing English compatibility |
| Forms | Requested minima, expansion, wrapped pair, body click isolation, async submit sealing, Cancel behavior |
| Files | Shared vertical width, dialog minima, error/body cells, filesystem behavior regression |
| Calendar | All official month/Today labels, widest header, DatePicker parity, arrows/Today hit zones, wide/combining clipping |
| Datagrid | Desired filter width, right-edge clamp, between/value-list changes, all-action width, Personalize 5 and 3/2 arrangements |
| Examples | Registry completeness, all stories construct, fresh reconstruction identity/disposal, `demo:i18n` command |
| Docs/plugin | Executable examples, canonical skill assertions, generated-copy parity, impact mapping |

## Layout matrix

| Dimension | Values |
|---|---|
| Locales | `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, `sv` |
| Standard viewport | 80×24 |
| Narrow viewports | Each component's declared functional minimum and one explicitly infeasible hard-bound case |
| Captions | Official catalogs, long valid application overrides, malformed accelerator fallback |
| Unicode | Wide CJK/emoji captions and combining sequences |
| Arrangements | Single, pair, five-action one-row, 3/2 wrapped, vertical |
| Lifecycle | Same story/different locale, different story/same locale, repeated reconstruction |

## Core assertions

- `assigned button width >= natural measured width` whenever available width meets the functional
  minimum.
- Every logical sibling uses the complete-group shared width.
- Surface bounds stay inside the viewport; descendants stay inside the surface in feasible modes.
- In infeasible hard-bound mode, clipping is deterministic and no wide glyph is split.
- Every action remains in the focus traversal and its hit bounds match rendered bounds.
- Visual order, Tab order, accelerators, commands, and modal results remain stable.
- Old `I18n`, Application, View, Signal, focus, modal, and handler state is not reused after locale
  reconstruction.
- Caller-owned paths, values, source, and records remain byte-identical.

## Focused verification

Use package-local `typecheck`, `test`, and documentation checks during iteration. After every phase,
run the phase's affected package checks and `yarn verify` before committing, as required by project
policy. Phase 4 additionally runs:

```text
yarn plugin:update
yarn plugin:check
yarn docs:api
yarn verify
```

`node scripts/check-i18n-reviews.mjs` is evidence-only when digest-bound method-disclosed reviews are
missing; it must fail truthfully rather than being bypassed or falsified.
