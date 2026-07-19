# 03-01 — ui widgets (#109)

Site inventory: [02-current-state.md §1](02-current-state.md#1-109--packagesuisrc-12-conversions-2-preserved).
This document specifies the target code shape and the risk at each file.

## `table/data-grid.ts`

Replace the constructor's build-then-assign sequence with a single nested expression. Target:

```ts
const inner = grow(
  col(
    fixed(row(grow(this.header), corner()), 1),
    grow(row(grow(this.rows), fixed(this.vbar, 1))),
    fixed(row(grow(this.hbar), corner()), 1),
  ),
);
this.add(inner);
```

`corner()` returns its cell already tagged `fixed(cell, 1)` (`:51`), so it needs no wrapper at the
call sites. The `fr` and `cell` consts (`:151-152`) become unreferenced and are deleted.

**Risk — the highest in #109.** `datagrid.spec.test.ts:12-15` documents the solved ratio
`[header 1 | body 10 | hbar 1]` and 22 golden cases depend on it. The conversion preserves nesting
depth exactly (one `inner` col over three rows, as today), so the solver sees an identical tree. Any
movement here means a descriptor was mistranscribed — fix the code, never the oracle (NFR-1).

## `tabs/tab-view.ts`

```ts
const inner = grow(col(fixed(this.strip, 1), this.body));
this.add(inner);
```

`this.body` is a `TabBody`, which self-assigns `{ direction:'col', size: fr 1, padding }` at its class
level (`tab-view.ts:137-141`). `col()` never touches a child's existing layout, so passing it
untagged preserves that descriptor exactly.

**`:254` is deliberately untouched.** `t.content.layout = { size: { kind: 'fr', weight: 1 } }` stays a
wholesale assignment. It is inside a `For(...)` reconciler over caller-supplied content views, and
per AR-1 the clobber is part of the observable contract of a barrel-exported API. Add a comment
saying so in plain language — no plan or issue IDs (CLAUDE.md documentation directive):

```ts
// Assigned wholesale rather than tagged: a caller's own layout on a tab's content view is
// intentionally discarded, so the tab body governs sizing no matter what the caller set.
```

## `app/application.ts`

```ts
const root = col(opts.menuBar, body, opts.statusLine, overlay);
```

#113's S7 falsy-child skip lets the optional `menuBar`/`statusLine` pass straight through as
`undefined`, replacing the two `if (…) root.add(…)` blocks.

**The two chrome-sizing statements must be relocated, not left alone.** `:347` and `:353` sit
*inside* those same `if` blocks (`:345-356`), so removing the blocks moves them by necessity. Lift
each into its own standalone guard with the assignment expression **byte-identical**:

```ts
if (opts.menuBar !== undefined) {
  opts.menuBar.layout = { ...opts.menuBar.layout, size: { kind: 'fixed', cells: CHROME_ROW_HEIGHT } };
}
```

That is the boundary with #117: the statement is preserved verbatim and merely re-guarded, so #117
still owns replacing the merge pattern itself. Note the old `:341-356` span also contained
`quitState` (`:343-344`), which is unrelated to layout and stays where it is.

**Load-bearing constraint.** The overlay must stay a **direct child** of `root` with its
`position:'absolute'` descriptor, because four test files locate it by scanning `root.children` for
that descriptor — two of them immutable oracles. `col(...)` adds its arguments as direct children, so
this holds; ST-W1 asserts it *before* the conversion so the guarantee is falsifiable rather than
assumed.

**`:330` is deliberately untouched**, same reasoning and same comment style as `tab-view.ts:254`
(`body` is `opts.content ?? new Desktop()`, and `createApplication` is public). AR-1/AR-9.

## What this file does not do

`:335`/`:435` (T-AO1 hidden-host overlay) and `:347`/`:353` (#117's merge pattern) are out of scope
per AR-2. Do not convert them opportunistically; T-AO1 records a full attempt-and-revert with the
reasoning.
