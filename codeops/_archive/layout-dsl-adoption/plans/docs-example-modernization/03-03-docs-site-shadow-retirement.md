# docs-site Shadow Retirement: docs-example-modernization

> **Document**: 03-03-docs-site-shadow-retirement.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-7, FR-8 · AR-3

## Overview

Seven files under `packages/docs-site/examples/` each declare a private `at()` helper that is
byte-identical to the one #114 retired from the two showcases. Between them they carry **38 call
sites**. This component deletes all seven and imports the blessed builder instead, then gives
`list-box.ts` the docs-site's one worked flex composition.

Unlike the JSDoc sweep, this is **real executable code** — these modules are compiled, mounted and
rendered by the docs site. It therefore gets the same audit-before-migration treatment #114 used,
and it has a genuine regression net.

## Architecture

### Current architecture

Each of the seven files carries:

```ts
/** Absolutely place a view within the example's box. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };   // REPLACE
  return view;
}
```

| File | `function at` at | Notes |
|---|---|---|
| `examples/containers/list-box.ts` | `:45` | also gets the FR-8 rewrite — its 3 call sites disappear |
| `examples/controls/button.ts` | `:14` | |
| `examples/controls/input.ts` | `:15` | 2-D form grid |
| `examples/controls/form-dialog.ts` | `:28` | 2-D form grid |
| `examples/files/file-dialog.ts` | `:16` | |
| `examples/table/data-grid.ts` | `:35` | |
| `examples/theming/preset-gallery.ts` | `:12` | |

*(Line numbers are the `function at<V …>` declarations. An earlier draft cited each helper's JSDoc
line, one above.)*

The blessed builder (`packages/ui/src/view/dsl/absolute.ts:42-50`) has a superset signature — four
numbers **or** a `Rect` — and writes through `setLayout()`, which **merges** and calls
`invalidateLayout()`.

### Proposed changes

Delete each helper; add `at` to the file's existing `@jsvision/ui` import. Drop the now-unused
`View` type import where the helper was its only consumer (it will be, in most of the seven —
`list-box.ts:7` imports `View` solely for the helper's generic).

No call site changes: the four-number overload is signature-compatible with all 38.

> **`list-box.ts` is the exception — do not add `at` to its import.** FR-8 removes all three of its
> `at()` calls in the very next task, so importing the builder there would leave an unused import
> that lint and success criterion 4 both reject. Six files gain the import; `list-box.ts` gains
> `cover`/`col`/`grow`/`fixed`/`spacer` instead. **After the retirement 35 call sites remain**, not
> 38 — the 38 figure describes the *pre*-conversion surface only.

## Implementation details

### The two behavioural deltas, and the audit that clears them

Identical in shape to #114's, on a much smaller surface. **The audit runs before any conversion**
and its table is filled in during execution — an empty table is not a pass.

**Delta A — replace → merge.** The shadow discards every pre-existing layout prop; the builder keeps
them. Observable only where the argument view already carries a layout prop when `at()` is called.

**Delta B — the added reflow.** `setLayout()` calls `invalidateLayout()`; the field write did not.
On an unmounted view (`host === null`) this is inert. Every docs example composes inside
`build(ctx)`, which the demo shell calls *before* mount — so this is expected to be empty, exactly
as it was repo-wide in #114. It is still queried rather than assumed.

| # | Query | Sites surfaced | Site | Prior layout state | Verdict |
|---|---|---|---|---|---|
| A1 | Prior `.layout =` / `.setLayout(…)` on the argument | **0** | — | — | ✅ |
| A2 | `override layout` field initializer in the argument's class | **1** | `containers/list-box.ts:60` — `at(list, …)`, `ListBox` → `ListView` (`list-view.ts:83`) | `{ direction: 'row' }` | ✅ inert |
| A3 | Argument also passes through another DSL tagger | **0** | — | — | ✅ |
| A4 | Argument is a `col(...)` / `row(...)` result (carries `direction`) | **0** | — | — | ✅ |
| B1 | `at()` reachable after mount (handler / effect / callback) | **6** | `controls/form-dialog.ts:50-55`, inside `openTheDialog()` | fresh, unadded views (`host === null`) | ✅ inert |

**Audit evidence (run before any conversion; all 38 pre-conversion call sites enumerated).**

- **A1 — clean.** The only `.layout =` writes in the seven files are the seven shadow bodies
  themselves. `controls/form-dialog.ts:67` writes `stage.layout.rect`, but `stage` is a receiver
  (`stage.add(at(…))`), never an `at()` argument.
- **A2 — one hit, inert.** `ListView` declares `{ direction: 'row' }`; the shadow discards it and the
  builder keeps it. The preserved value **equals the engine default** —
  `normalizeProps` resolves `props.direction ?? 'row'` (`layout/types.ts:213`) — so solver output is
  identical either way. *(This required checking: `mainOf`/`crossOf` compare `=== 'row'`, which would
  make `undefined` behave as `col`, but every consumer goes through `normalizeProps` first.)* The
  site is removed by the `list-box.ts` rewrite regardless.
- **B1 — six hits, inert.** `openTheDialog()` is reachable post-mount via
  `app.onCommand('demo.openDialog', …)`. It is still inert because `at()` runs on a **freshly
  constructed view before `dlg.add(…)` attaches it**, so `host` is `null` and
  `invalidateLayout()` → `this.host?.markRelayout()` (`view/view.ts:215-217`) is a no-op. Delta B
  would only bite if a site re-tagged an already-mounted view; none does.
- **No padding-carrying argument exists.** The only classes whose `override layout` carries
  `padding` are `Window` (`window/window.ts:81`) and the dropdown popup host
  (`dropdown/popup.ts:125`). `Window` appears in two examples as `stage` — always the receiver,
  never the argument. The remaining argument classes (`Group`, `Button`, `Text`, `Label`, `Input`,
  `CheckGroup`, `RadioGroup`, `ListBox`, `DataGrid`) declare no `padding`.

**Result: 7 surfaced sites, 7 ✅, 0 ⛔ — the conversion is cleared to proceed.**

**Which preserved props can even matter.** Under `position:'absolute'` the solver drops the child
from flex flow and places it by `rect` alone (`packages/ui/src/layout/layout.ts:94`), so a preserved
`size` is inert and a preserved `direction:'row'` is the engine default. The one genuinely
load-bearing prop is **`padding`**, which insets the content-box origin for the view's own children
(`layout.ts:137-147`). Hunt padding-carrying arguments specifically — this is the single most
valuable line carried over from #114's execution.

A ⛔ row is resolved one of three ways, in order of preference: (i) leave the site with an explicit
field write plus a comment saying why, (ii) neutralise the divergence before the swap, or (iii)
accept the resulting diff and record it as a deliberate fix. **Never absorbed silently.**

### What makes this safer than #114

`packages/docs-site/tsconfig.json` includes `examples/**/*.ts`, so the standing `yarn typecheck`
covers all seven files and all 38 call sites. #114 had to run a one-shot `tsc` sweep with a
temporary include because `packages/examples/tsconfig.json` excluded its targets. No such
scaffolding is needed here.

### FR-8 — `list-box.ts` composition

Current shape (`examples/containers/list-box.ts:55-72`): a `WIDTH × HEIGHT` group holding the list
at `(0,0,40,9)` and an echo `Text` at `(0,10,40,1)` — a column with a one-row gap, expressed as
absolute rects.

```ts
const list = new ListBox({ items, focused, selected, typeAhead: true });
const echo = new Text(() => { /* … unchanged … */ });
return cover(col(grow(list), spacer({ fixed: 1 }), fixed(echo, 1)));
```

Four points of care:

- **`spacer({ fixed: 1 })`, never `spacer(1)`.** `packages/ui/src/view/dsl/flex.ts:219-225` makes a
  *numeric* argument a flex **weight**, not a cell count — `spacer(1)` requests a 1fr share, so the
  gap would take roughly half the column height and the list the other half. The object form is the
  hard n-cell gap this example wants. The builder's own JSDoc spells out both forms; an earlier
  draft of this plan prescribed `spacer(1)` throughout and would have shipped a visibly broken
  example that `paint-smoke` (which asserts only `paintedCells > 0`) could never have caught.

- **The group must fill its host.** The example previously pinned itself to `WIDTH × HEIGHT` via
  `at(new Group(), 0, 0, WIDTH, HEIGHT)`. Composed with `col()` it must instead `cover()` — a
  container whose own extent is unset does not inherit the viewport. Getting this wrong collapses
  the example to nothing, which `paint-smoke.spec` catches.
- **`WIDTH`/`HEIGHT` become dead** once the composition is size-agnostic. Delete them; a leftover
  unused const is a lint failure and, worse, a false hint that the example is fixed-size.
- **Grow-vs-fixed asymmetry is the lesson.** `grow(list)` + `fixed(echo, 1)` is why this rewrite is
  worth doing at all: it makes the example responsive where the absolute version was not, and it
  gives the docs site one worked flex composition to point at.

The echo line is `fixed(echo, 1)` because the example wants exactly one row for it, regardless of
what the text measures to. *(An earlier draft justified this by claiming `Text` has no `measure()`
— it does, at `packages/ui/src/controls/text.ts:91`. The trap that claim was borrowed from is real
but applies to `Label`/`Input`/`CheckGroup`/`History`, which genuinely lack it; `fixed` is still the
right call here, for the plainer reason above.)*

**Expect a large, intended diff.** The old example pinned itself to a 40×12 box and ignored
`ctx.width`/`ctx.height` entirely; `cover()` makes it fill the demo shell's viewport, so at 80×24
the list becomes 80 wide and ~22 tall rather than 40×9. That is the point of FR-8 — but a reviewer
comparing 3.4.1's before/after should expect a full reflow, not a subtle shift.

## Integration points

- `packages/docs-site/examples/index.ts` registers the examples; the registry entries are unchanged.
- `examples/_contract.ts` requires every module to be SSR/headless-safe and to compose with
  `@jsvision/ui` only. Importing `at`/`col`/`grow`/`fixed`/`spacer`/`cover` from `@jsvision/ui`
  satisfies that unchanged.
- The existing docs-site suites all stay **unedited** (AC-7). Be precise about what they witness,
  because an earlier draft called them "the witness for FR-7/FR-8" and they are not:

  | Suite | What it actually exercises |
  |---|---|
  | `paint-smoke.spec.test.ts` | Builds **every** registered example at 80×24 and asserts `paintedCells > 0` (`:43`) — real coverage of all 7 files, but **liveness only** |
  | `dialog-reopen.spec.test.ts` | 2 of the 7 examples, structurally |
  | `a11y.spec.test.ts` | Asserts `PlayExample.vue` carries `aria-label` and each registry id has a `.md` page (`:34-47`) — **builds no example** |
  | `no-keyboard.spec.test.ts` | Three pure functions over a `matchMedia` stub (`:13-31`) — **builds no example** |
  | `deep-link.impl.test.ts` | A hard-coded `IDS` array (`:9`) — **imports no example** |
  | `file-dialog.spec.test.ts` | Imports only `HOME`/`seedFs` and builds its own `FileDialog` (`:14`) — the example's `build()`, which holds the `at()` calls, is **never invoked** |
  | `snippet-drift.spec.test.ts` | Markdown only; unaffected, must stay green |

  **The primary control for FR-7/FR-8 is therefore the rendered before/after at task 3.4.1**, not
  this net. `paint-smoke` is the backstop that catches a crash or a collapse; nothing here catches
  a merge-preserved `padding` shifting a child by one cell, which is the specific hazard §Delta A
  exists to hunt.

## Error handling

| Error case | Handling strategy | AR |
|---|---|---|
| A call site depends on the shadow's replace semantics to clear a prop | Surfaced by A1–A4; resolved by the three-way ⛔ rule, never silently | AR-3 |
| An `at()` call on a mounted view now triggers a reflow | Surfaced by B1. A reflow on a mounted view is the *correct* behaviour — the shadow's silence was the footgun. Accepted unless a rendered diff shows a change | AR-3 |
| The unused `View` type import fails lint after the helper is deleted | Dropped in the same edit | AR-3 |
| `list-box.ts` collapses to an empty frame after the `col()` rewrite | `paint-smoke.spec` fails on `paintedCells > 0`; the cause is a missing `cover()` | AR-3 |

## Testing requirements

- **ST-9…ST-11** ([07](07-testing-strategy.md)) pin the retired builder's contract from a docs-site
  example surface: merge preservation, the four-number form, and chainability.
- **The before/after rendered comparison of the seven examples (task 3.4.1) is the primary control**
  — captured at a fixed viewport into the session scratchpad, never committed. Zero diff expected
  for six; `list-box.ts` changes substantially by design under FR-8, and its diff is reviewed and
  recorded rather than required to be empty.
- The existing suites stay green **and unedited** — none may appear in `git diff --name-only` at any
  point (AC-7). They are a backstop, not the witness; see §Integration points for what each one
  actually covers.
- `yarn typecheck` covers every call site, before (38) and after (35) — see §What makes this safer
  than #114.
