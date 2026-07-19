# 03-01 — example demos (#110)

Site inventory: [02-current-state §1](02-current-state.md). **25 conversions across 6 files**, plus 2
preserved sites.

## The rule that governs every conversion here

A tagger writes **only the props it owns** and merges the rest. `fixed(v, n)` and `grow(v)` write
`size`; a bare `row()`/`col()` writes only `direction`. **Everything else in the literal being
replaced is dropped unless re-established through the builder's props object.**

In this file's scope that bites at **six** sites:

| Site | Extras beyond `size` | Target |
|------|----------------------|--------|
| `editor-demo:67` | `direction:'col'` | `col(...)` |
| `event-demo:109` | `direction:'row'`, **`gap: 2`** | `fixed(row({ gap: 2 }, …), 1)` |
| `event-demo:119` | `direction:'col'` | `fixed(col({ background:'dialog' }, …), 2)` |
| `event-demo:128` | `direction:'col'`, **`padding: 1`** | `col({ padding:1, background:'desktop' }, …)` |
| `controls-demo:95` | `direction:'col'`, **`padding:1`, `gap:0`** | `col({ padding:1, gap:0, background:'window' })` |
| `router-demo:101` | `direction:'col'`, **`padding:1`, `gap:0`** | `col({ padding:1, gap:0, background:'window' }, …)` |
| `drill-down:69` | `direction:'col'` | `col({ background:'window' }, …)` |

`Flex` is `Omit<LayoutProps,'direction'> & { grow?, fixed?, fill?, background? }` (`flex.ts:41-53`),
so `padding`, `gap` and `background` all ride on the props object. `toLayout` strips `background`
back onto the Group (`flex.ts:58-60`), so `col({ background:'x' }, …)` is exactly equivalent to the
separate `.background = 'x'` line it replaces (AR-12).

## `editor-demo/main.ts` — the cleanest port

```ts
const root = col(grow(ed), fixed(ind, 1));
```

Replaces `:66-71` entirely (construct, three assignments, two `add()`s).

## `event-demo/main.ts` — the largest

```ts
const body = fixed(row({ gap: 2 }, grow(btnOk), grow(btnOpen)), 1);
const dialog = fixed(col({ background: 'dialog' }, fixed(dialogLabel, 1), fixed(btnClose, 1)), 2);
const root = col({ padding: 1, background: 'desktop' },
  fixed(header, 1), body, dialog, fixed(status, 1));
```

The `for (const b of [btnOk, btnOpen]) b.layout = …` loop at `:107` collapses into the two inline
`grow()` calls above — the loop existed only to apply one shared descriptor.

**`printFrame`'s `for (const row of rows)` at `:91` must be renamed** to `line` (AR-5): this file now
imports the `row` builder, and leaving the shadow means a reader has to reason about which `row` is
in scope inside that helper.

## `controls-demo/main.ts` — keep the data-driven loop

```ts
const form = col({ padding: 1, gap: 0, background: 'window' });
for (const [view, rows] of [...] as const) form.add(fixed(view, rows));
```

The loop is the demo's subject — it shows a form built from data. Only the descriptor moves.

## `router-demo/main.ts`

The `list` route's `build()` closure:

```ts
const screen = col({ padding: 1, gap: 0, background: 'window' }, fixed(title, 1), grow(listView));
```

`listView` is declared `let` at `:92` and assigned inside the closure; the tag goes on the
assignment, not the declaration.

**`:59` is deliberately untouched.** `this.layout = { direction:'col', padding:1, gap:1 }` sits in
`class DetailScreen extends Group`'s constructor. `this` already exists, so no builder can produce
it, and expressing the merge would need the `setLayout(partial)` primitive that is a separate issue's
subject. Its three children still convert. Add a comment saying so in plain language — no plan or
issue identifiers (CLAUDE.md documentation directive):

```ts
// Assigned directly rather than built: this view is the container itself, so there is no builder
// call that could produce it — only its children are composed with the DSL below.
```

**`printFrame`'s `for (const row of rows)` at `:45` is renamed** to `line` for consistency with
`event-demo`, even though this file does not import the `row` builder (AR-5).

## `chrome-bars-demo/main.ts`

```ts
win.add(grow(body));
```

One line. The file already imports `fixed` and `spacer` and uses them for the status line, so this
removes the last hand-written descriptor in the file.

## `kitchen-sink/stories/drill-down.story.ts`

Mirrors `router-demo`: the `list` route's closure becomes
`col({ background:'window' }, grow(list))`, and `DetailScreen`'s three children become
`fixed(title, 1)` / `fixed(meta, 1)` / `fixed(back, 2)`. `:29` is preserved with the same comment as
`router-demo:59`.

**Do not import the DSL's `at` into this file.** It already imports a local `at` from `../story.js`
that takes the same arguments but **clobbers** where the DSL's merges (`story.ts:70` vs
`absolute.ts:44`). Swapping them is a behaviour change at every story call site and belongs to the
shadow-cleanup issue. This plan needs only `col`/`grow`/`fixed` here, so no collision arises (AR-8).

## What this file does not do

`view-demo/main.ts` and `kitchen-sink/stories/layout.story.ts` are out of scope (AR-2). Both exist to
teach the *raw* View/Group spine and the *raw* cell-native flex engine; converting them changes what
the lesson teaches, which is a product decision rather than a refactor. Do not convert them
opportunistically.
