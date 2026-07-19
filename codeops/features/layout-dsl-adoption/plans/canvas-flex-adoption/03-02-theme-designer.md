# 03-02 — theme-designer panels + workspace (#111)

Site inventory: [02-current-state §2](02-current-state.md). **7 conversions across 3 files**, plus 1
preserved site.

## The ordering constraint — read this first

Today each panel's `direction:'col'` is applied **from `app.ts`**, not from the panel's own builder:

```ts
rail.view.layout = { size: { kind: 'fixed', cells: 28 }, direction: 'col' };   // app.ts:288
preview.layout   = { size: { kind: 'fr', weight: 1 },   direction: 'col' };   // app.ts:290
```

The conversion moves that responsibility into the builders, where `col()` sets it for free. **The
panel builders must therefore be converted before `app.ts` drops the direction.** Converting `app.ts`
first leaves both panels flowing horizontally, and — per
[02-current-state §4](02-current-state.md) — nothing in the existing suite would notice. The phase
order in the execution plan enforces this, and ST-C10a/b/c are green before either step.

## `view/roles-panel.ts`

Tail (`:69-76`) becomes:

```ts
const view = col({ background: 'dialog' }, fixed(title, 1), grow(list));
```

This absorbs three things: the two child descriptors (`:72`, `:73`), the separate
`view.background = 'dialog'` line (`:70`, per AR-12/AR-15 — ST-C10a asserts it), and the `direction:'col'` that used to arrive
from `app.ts:288`.

**The comment above it becomes false and must be rewritten.** It currently reads:

> `// A column [title, list-fills]; the app sizes the panel's width and sets direction: 'col'.`

The app no longer sets the direction. Replace with something that describes the new division —
the panel owns its stacking, the app owns only its width.

`list` stays a local binding: the function returns `{ view, focused, targets, rows: list.rows }`.

## `view/preview-panel.ts`

Tail becomes:

```ts
return col(fixed(title, 1), grow(scroller));
```

No props object needed — this panel sets no background and needs only the default column direction.

## `app.ts`

```ts
const workspace = row(fixed(rail.view, 28), grow(preview), fixed(inspector, 32));
```

Each `size` half becomes a tagger; each `direction:'col'` half **disappears** — two of them because
the panel builders now own their direction, and the third because it was never load-bearing:

**`inspector`'s `direction:'col'` (`:303`) is vestigial and is dropped (AR-7).** Verified: every one
of the inspector's 17 children is placed through `inspector-panel.ts`'s local `at()` helper
(`:55-58`), the file's only `add()` path, which writes `position:'absolute'` with an explicit rect.
Nothing in that container flows, so its direction has no effect on anything. Only its width is
load-bearing.

**`sizeWorkspace` is deliberately untouched (AR-4).** It re-assigns `workspace.layout` wholesale on
every resize (`:308-312`), and it re-writes `direction:'row'` itself each time — so the builder's
direction being overwritten a moment later is harmless, and the resize path stays exactly as it is
today. Converting it to `at()` would trade a clobber for a merge on the one code path here that runs
repeatedly rather than once, which is precisely the semantic shift that produced this feature's most
recent defect. Add a comment saying why it stays, in plain language with no plan or issue
identifiers:

```ts
// Re-assigned wholesale on every resize rather than merged: this is the one layout write that runs
// repeatedly, and restating the row direction here keeps the workspace independent of how its
// children were composed.
```

## Verification note

`preview-panel.ts` has **no test file at all** today, and `app.spec`/`app.impl` contain zero
assertions about layout, direction, rects, children or the workspace. ST-C10a/b/c are the first oracle any of this composition has ever had, which is why they are written
and green before Phase 2 begins — and why they must be solved through the real `createDesignerApp`
tree rather than by mounting a panel standalone (07 §ST-C10).

Also note `preview-panel.ts:16`'s `@returns` already claims the panel is "laid out as a column" —
false today, true after task 2.2. Task 2.2 leaves it correct rather than needing an edit, but the
symmetric comment at `roles-panel.ts:68` does need rewriting (task 2.1).
