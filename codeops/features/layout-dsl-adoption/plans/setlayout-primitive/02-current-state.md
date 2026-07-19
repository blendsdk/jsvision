# Current State — setlayout-primitive

Every count and line number below was measured against the working tree on 2026-07-20, after the
canvas and widget adoption plans landed. Where the issue body and the code disagreed, the code won
— see §5.

## 1. The primitive today

`packages/ui/src/view/view.ts:69`

```ts
layout: LayoutProps = {};
```

A plain, public, mutable field. Two consequences, both of which the issue names:

1. **Whole-object replace silently drops sibling props.** `view.layout = { size }` wipes any existing
   `direction`/`padding`/`position`. Correct code must write `{ ...view.layout, … }` — which is why
   every merge-preserving helper in the DSL hand-rolls that spread (§2).
2. **No auto-invalidation.** Assigning `.layout` does not reflow. `invalidateLayout()`
   (`view.ts:211`) must be called separately:

```ts
invalidateLayout(): void {
  this.host?.markRelayout();
}
```

`markRelayout()` (`render-root.ts:321-324`) sets `needsReflow = true` and calls `scheduleFlush()`,
which early-returns when a flush is already scheduled (`:326-327`). **So an invalidation is O(1) and
coalesced** — per-call invalidation inside a loop costs a flag write, not a reflow. This is the fact
that makes AR-5 cheap.

## 2. The DSL is the heaviest consumer of the idiom being replaced — 13 sites

| File | Line | Statement | Shape |
|---|---|---|---|
| `dsl/absolute.ts` | `:44` | `view.layout = { ...view.layout, position:'absolute', rect }` | merge |
| | `:70` | `view.layout = { ...view.layout, position:'fill' }` | merge |
| | `:94` | `view.layout = { ...view.layout, position:'absolute', rect: {…} }` | merge |
| `dsl/flex.ts` | `:96` | `group.layout = toLayout(props, direction)` | fresh Group |
| | `:100` | `group.layout = { direction }` | fresh Group |
| | `:172` | `view.layout = { ...view.layout, size }` | merge |
| | `:191` | `view.layout = { ...view.layout, size: { kind:'fixed', cells:n } }` | merge |
| `dsl/stack.ts` | `:149` | `view.layout = { ...view.layout, rect }` | merge, **inside a loop** |
| | `:192` | `overlay.layout = layout` | fresh `Stack` |
| | `:196` | `overlay.layout = { size: { kind:'fr', weight:1 } }` | fresh `Stack` |
| | `:208` | `layer.layout = { ...layer.layout, position:'fill' }` | merge |
| | `:216` | `layer.layout = { ...layer.layout, position:'absolute', rect }` | merge |
| | `:225` | `layer.layout = { ...layer.layout, position:'absolute', rect }` | merge |

Eight of the thirteen are the exact `{ ...view.layout, … }` spread `setLayout` exists to absorb.
Five write a **freshly constructed** Group/Stack, where replace and merge are indistinguishable.

`stack.ts:149` is the one site where invalidation batching is visible: it sits in a loop that tracks
a `changed` flag and calls `this.invalidateLayout()` once afterwards (`:153`). Under `setLayout` the
invalidation happens per layer instead — which, given `markRelayout`'s O(1) coalescing above, is a
flag write per layer and no extra reflow.

## 3. The 7 self-layout sites (the issue's P2)

| File | Line | Statement | Base class | Shape |
|---|---|---|---|---|
| `ui/src/status/statusline.ts` | `:83` | `this.layout = { direction:'row' }` | `Group` | replace ≡ merge |
| `ui/src/color/color-picker.ts` | `:220` | `this.layout = { direction:'row' }` | `Group` | replace ≡ merge |
| `ui/src/dialog/dialog.ts` | `:109` | `this.layout = { padding: 1 }` | **`Window`** | **replace ≠ merge** — see §4 |
| `ui/src/window/window.ts` | `:161` | `this.layout = { ...this.layout, rect: {…} }` | `Group` | already a merge |
| `ui/src/editor/edit-window.ts` | `:77` | `this.layout = { ...this.layout, padding: 0 }` | `Window` | already a merge |
| `forms/src/form-dialog.ts` | `:82` | `this.layout = { ...this.layout, padding: 0 }` | `Dialog` | already a merge |
| `datagrid/src/filter-popup.ts` | `:285` | `this.layout = { ...this.layout, rect: {…} }` | `Group` | already a merge, **at runtime** |

`Group` does **not** initialize `layout`, so a `Group` subclass sees `{}` from `View` and a replace
is indistinguishable from a merge. Only `dialog.ts:109` has a non-empty starting object.

`filter-popup.ts:285` is the single site that re-tags an already-mounted view, and therefore the only
one where AR-5's auto-invalidation is observable.

## 4. The one site where replace ≠ merge — traced, not assumed

`Dialog extends Window`, and `Window` carries a field initializer (`window.ts:81`):

```ts
override layout: LayoutProps = { position: 'absolute', padding: 1 };
```

Field initializers in the base run during the `super()` chain, so by the time `Dialog`'s constructor
body reaches `:109` the object is `{ position:'absolute', padding:1 }` — and
`this.layout = { padding: 1 }` **clears `position:'absolute'`**. The surrounding comment confirms the
intent ("Seed the padding first so the merge-preserving builders retain it").

**It is nonetheless safe to convert**, because both branches immediately restore the property:

| | after `:109` | after `center()` / `at()` |
|---|---|---|
| today (replace) | `{padding:1}` | `{padding:1, position:'absolute', rect}` |
| under `setLayout` (merge) | `{position:'absolute', padding:1}` | `{position:'absolute', padding:1, rect}` |

`center()` (`absolute.ts:94`) and `at()` (`absolute.ts:44`) both write `position:'absolute'`, and the
whole block is guarded by `width !== undefined && height !== undefined`, so no path leaves `:109`
without passing through one of them. **The end state is identical.** ST-S7 pins it.

This trace is the worked example for the P3 audit: the question is never "is this a replace?" but
"does anything downstream depend on the replace having cleared something?".

## 5. Corrections to the issue body

1. **"29 reads vs 225 writes"** — measured today: **24 reads, 138 writes** across `packages/*/src`.
   The adoption epic has removed 39% of the writes since #117 was filed. By package: `ui` 98,
   `datagrid` 15, `spike-data-studio` 13, `theme-designer` 4, `files` 4, `forms` 3, `docs-site` 1.
2. **P1's "add `setLayout` (+ the getter internally)"** is not implementable as written. Introducing
   `get layout()` breaks the 11 `override layout: LayoutProps = {…}` field initializers immediately —
   a class field cannot override an accessor. The getter belongs to P4 (AR-7).
3. **The issue does not mention the 11 field initializers at all**, yet they are P4's real blocker:
   `color-picker.ts:112,136` · `list-view.ts:84` · `combo-box.ts:64` · `date-picker.ts:33` ·
   `menu/popup.ts:56` · `dropdown/popup.ts:125` · `window.ts:81` · `tree.ts:96` · `tab-view.ts:138`.
4. **P2 is far smaller than the issue implies.** It reads as the bulk of the migration; it is 7 sites,
   4 of which are already merges and convert mechanically.

## 6. Existing coverage

`View`'s layout field has no direct test. The DSL builders are covered by the adoption plans' spec
suites (merge-preservation is asserted for `at`/`cover`/`fixed`/`grow` through solved rects), and the
layout engine has its own oracles. **Nothing today asserts that a layout write requests a reflow** —
which is why AR-5's bug fix needs ST-S5 rather than an existing test.
