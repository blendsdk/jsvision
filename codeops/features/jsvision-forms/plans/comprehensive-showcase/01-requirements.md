# 01 — Requirements

> **Implements**: jsvision-forms/RD-05 — Comprehensive Forms Showcase
> **Source**: no standalone RD (planned directly — AR-PL1). Scope of record = this doc +
> [00-ambiguity-register.md](00-ambiguity-register.md). Roadmap row:
> [`../../00-roadmap.md`](../../00-roadmap.md) (RD-05).

## Summary

Add one flagship kitchen-sink story, **`forms/showcase`**, that demonstrates the whole shipped
`@jsvision/forms` engine on one realistic server-connection form. It is the curation of the Forms
suite — the four existing stories are focused single-capability demos; this is the end-to-end tour a
developer reads to see how `createForm` + Zod + the stock widgets compose. Example code only.

## Actors / context

A developer browsing the kitchen-sink showcase (`demo:kitchen`) opens **Forms → Comprehensive
showcase**, edits the form, watches the live inspector and the amber advisory react, flips the
error-layout toggle, loads defaults, and opens the same schema as a modal dialog.

## Acceptance criteria

| AC | Requirement | AR |
|----|-------------|-----|
| **AC-1** | A new story `forms/showcase` (category `Forms`, non-empty title/blurb, `rd: 'RD-05'`) is registered in `stories/index.ts` and passes the smoke test. | AR-PL2 |
| **AC-2** | The story builds a live form (`name` · `port` · `tls` · `mode` · `features`) bound to the stock widgets (`Input`/`Switch`/`RadioGroup`/`CheckGroup`) with **no bespoke glue** — direct value binds + `bindRadio`/`bindCheck` lenses + `bindField` touched-on-first-blur; sync Zod validation is live and errors are touched-gated. | AR-PL3 |
| **AC-3** | A live **state inspector** panel echoes, reactively as the form is edited: `rawValues()`, `values()` (or `— (invalid)` when `null`), the `errors()` count, `isValid()`, `dirty()`, `validating()`, `loading()`. | AR-PL3 |
| **AC-4** | An **amber advisory** (`Text.severity: 'warning'`) appears when the port is a valid privileged port (`1 ≤ port < 1024`) and is absent otherwise. Valid input; **no `@jsvision/forms` change**. | AR-PL4, AR-PL7 |
| **AC-5** | An **errors-layout toggle** ("Errors: right │ below", a `RadioGroup`) reflows each field's error placement between beside-the-field and below-the-field, built with the `col`/`row` DSL. | AR-PL5 |
| **AC-6** | The story wires the async/load/dialog tour inline: (a) one **async-validated** field (debounced availability check via `asyncValidators`, `checking…` / async-error surface); (b) a **_Load defaults_** button (`form.load()` → `Loading…` swap → pristine baseline rebase); (c) an **_Open as dialog…_** button (`formDialog()` on the same schema) using the no-op-desktop host shim. | AR-PL3 |
| **AC-7** | Submit is gated by `form.submit()`: an invalid submit reveals every error; a valid submit echoes the coerced `values()`. | AR-PL3 |
| **AC-8** | Headless (no `ctx.execView`) the story degrades gracefully (the dialog affordance shows a hint) and the ST-SS1 oracle finds its characteristic strings within the 72×16 smoke canvas (via always-painted hint literals — AR-PL8). | AR-PL6, AR-PL8 |
| **AC-9** | `yarn verify` is green; `@jsvision/core`/`@jsvision/ui` stay zero-dep; `zod` stays the only forms peer dep; `packages/examples` gains no new dependency. | AR-PL7 |

## Out of scope

- Any change to `@jsvision/forms`, `@jsvision/ui`, or `@jsvision/core` (AR-PL7) — the engine is
  complete; this is demo composition only.
- Any change to the four existing forms stories (`forms/form`, `forms/async`, `forms/load`,
  `forms/dialog`) — they remain focused single-capability demos (AR-PL2).
- A warning-severity **engine tier**, plural per-field `errors()`, `disabled`/`readonly`,
  nested/array fields, runtime schema introspection — the GH #89 backlog (unchanged).
- A persistent navigator/sidebar change — the shell already groups stories by category.

## Non-functional

- **Consistency**: reuse the sibling stories' idioms verbatim — the `sleep(ms, signal)` abortable
  delay, the `asyncValidators` shape, the `form.load` loader, and the `formDialog` no-op-desktop host
  shim (see [02-current-state.md](02-current-state.md) for the source anchors).
- **Responsiveness**: lay out with the `col`/`row` DSL so the frame reflows with the canvas; target
  `Math.max(64, ctx.width - 2)` (AR-PL8).
- **File size**: one story file, target 200–400 lines (example-code budget).
- **Docs**: the exported `formsShowcaseStory` carries a JSDoc lead + an `@example` (example code
  follows the shipped-code documentation spirit); no CodeOps/TV process IDs in code comments (the
  `rd: 'RD-05'` metadata field is data, not a comment, and `examples/` is out of `check-jsdoc` scope).
