# Current State — setlayout-primitive

Every count and line number below was measured against the working tree on 2026-07-20, after the
widget adoption plan landed. Where the issue body and the code disagreed, the code won — see §5.

> **How the counts were measured.** A bare `grep "\.layout = "` is wrong twice over: it counts the
> ~64 `.layout = …` lines that live inside JSDoc `@example` blocks as if they were code, and it
> **misses** a wrapped assignment whose line ends at the `=` (`dsl/flex.ts:217` is exactly that). The
> numbers here come from:
>
> ```bash
> # writes (field assignment) — 82
> grep -rnE "\.layout[[:space:]]*=" packages/*/src --include=*.ts \
>   | grep -vE "\.layout[[:space:]]*==" \
>   | grep -vE ":[0-9]+:[[:space:]]*(\*|//)"
>
> # reads — 17
> grep -rnE "\.layout\b" packages/*/src --include=*.ts \
>   | grep -vE "\.layout(\.[a-zA-Z]+)?[[:space:]]*=([^=]|$)" \
>   | grep -vE ":[0-9]+:[[:space:]]*(\*|//)"
> ```
>
> Re-run those before trusting any figure below. Every count in this document has a command that
> reproduces it — a figure without one cannot be re-checked, and this plan has already been bitten
> once by an unreproducible count.

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
coalesced** — per-call invalidation inside a loop costs a flag write, not a reflow.

One further property, load-bearing for §3 and for the migration's safety: `flush()` clears
`scheduled` (`render-root.ts:333`) and snapshots-then-clears `needsReflow` (`:342-343`) **before**
composing. A `markRelayout()` raised *during* a draw therefore lands in the next frame rather than
extending the current one — it can never re-enter synchronously.

## 2. The DSL is the heaviest consumer of the idiom being replaced — 14 sites

| File | Line | Statement | Shape |
|---|---|---|---|
| `dsl/absolute.ts` | `:44` | `view.layout = { ...view.layout, position:'absolute', rect }` | merge |
| | `:70` | `view.layout = { ...view.layout, position:'fill' }` | merge |
| | `:94` | `view.layout = { ...view.layout, position:'absolute', rect: {…} }` | merge |
| `dsl/flex.ts` | `:96` | `group.layout = toLayout(props, direction)` | fresh `Group` |
| | `:100` | `group.layout = { direction }` | fresh `Group` |
| | `:172` | `view.layout = { ...view.layout, size }` | merge |
| | `:191` | `view.layout = { ...view.layout, size: { kind:'fixed', cells:n } }` | merge |
| | `:217` | `view.layout = …` (ternary, **wrapped over two lines**) — `spacer()` | fresh `Empty` |
| `dsl/stack.ts` | `:149` | `view.layout = { ...view.layout, rect }` | merge, **inside a loop, at draw time** |
| | `:192` | `overlay.layout = layout` | fresh `Stack` |
| | `:196` | `overlay.layout = { size: { kind:'fr', weight:1 } }` | fresh `Stack` |
| | `:208` | `layer.layout = { ...layer.layout, position:'fill' }` | merge |
| | `:216` | `layer.layout = { ...layer.layout, position:'absolute', rect }` | merge |
| | `:225` | `layer.layout = { ...layer.layout, position:'absolute', rect }` | merge |

**Nine of the fourteen** are the exact `{ ...<receiver>.layout, … }` spread `setLayout` exists to
absorb. **Five** write a freshly constructed `Group`/`Stack`/`Empty`, where replace and merge are
indistinguishable.

Note the three distinct receivers — `view.layout`, `group.layout`/`overlay.layout`, `layer.layout`.
Any grep audit written against `{ ...view.layout` alone is blind to `stack.ts:208,216,225` and to all
five fresh-object writes; §8 gives the patterns that actually work.

`stack.ts:149` is the one site where invalidation batching is visible: it sits in a loop that tracks
a `changed` flag and calls `this.invalidateLayout()` once afterwards (`:153`). Under `setLayout` the
invalidation happens per layer instead — which, given `markRelayout`'s O(1) coalescing above, is a
flag write per layer and no extra reflow. It is also inside a **change-gated** branch
(`stack.ts:142-148` only writes when the recomputed rect actually differs), so a settled frame makes
no calls at all, and the settle loop's termination does not depend on the trailing invalidate.

## 3. The self-layout sites (the issue's P2) — 7, plus 2 handed over from #109

The column that matters most is the last one: **whether the view is mounted when the write runs.**
That, not the spread-vs-replace shape, is what determines whether auto-invalidation is observable.

| File | Line | Statement | Base class | Shape | Mounted at call time? |
|---|---|---|---|---|---|
| `ui/src/status/statusline.ts` | `:83` | `this.layout = { direction:'row' }` | `Group` | replace ≡ merge | no — constructor |
| `ui/src/color/color-picker.ts` | `:220` | `this.layout = { direction:'row' }` | `Group` | replace ≡ merge | no — constructor |
| `ui/src/dialog/dialog.ts` | `:109` | `this.layout = { padding: 1 }` | **`Window`** | **replace ≠ merge** — see §4 | no — constructor |
| `ui/src/window/window.ts` | `:161` | `this.layout = { ...this.layout, rect: {…} }` | `Group` | already a merge | **yes** — `commitPlacement()`, at gesture start on a live window |
| `ui/src/editor/edit-window.ts` | `:77` | `this.layout = { ...this.layout, padding: 0 }` | `Window` | already a merge | no — constructor |
| `forms/src/form-dialog.ts` | `:82` | `this.layout = { ...this.layout, padding: 0 }` | `Dialog` | already a merge | no — constructor |
| `datagrid/src/filter-popup.ts` | `:285` | `this.layout = { ...this.layout, rect: {…} }` | `Group` | already a merge | **yes** — inside a `bind(…, { relayout: true })` |
| `ui/src/app/application.ts` | `:343` | `opts.menuBar.layout = { ...opts.menuBar.layout, size: {…} }` | — (foreign receiver) | already a merge | no — `root` is assembled at `:357` and mounted after |
| | `:347` | `opts.statusLine.layout = { ...opts.statusLine.layout, size: {…} }` | — (foreign receiver) | already a merge | no — same |

`Group` does **not** initialize `layout`, so a `Group` subclass sees `{}` from `View` and a replace
is indistinguishable from a merge. Three sites start from a non-empty object — `dialog.ts:109`,
`edit-window.ts:77` and `form-dialog.ts:82`, all three inheriting `Window`'s
`{position:'absolute', padding:1}` (`window.ts:81`) — but only `dialog.ts:109` performs a **replace**
from one. The other two are already spreads, so replace-vs-merge is moot there.

**`window.ts:161` is the one conversion that changes behaviour on its own current path.**
`commitPlacement()` writes `this.layout` and does **not** call `invalidateLayout()`, and its only
callers are `desktop.ts:213,222,235` — on a live, mounted window at gesture start. Converting it
therefore adds a `markRelayout()` that does not happen today. See §3a.

### 3a. The invalidation delta — which conversions actually change behaviour

FR-4's auto-invalidation is only observable where the write runs on a **mounted** view *and* nothing
on that path already requests a reflow. Three sites are mounted; they are not equivalent:

| Site | Mounted | Already reflows today? | Converting adds a reflow? |
|---|---|---|---|
| `filter-popup.ts:285` | yes | **yes** — inside `bind(…, { relayout: true })`, and `View.bind` (`view.ts:243-245`) invalidates after every apply | no — redundant |
| `split-view.ts:186-190` (`grow()` caller) | yes | **yes** — same mechanism, `split-view.ts:170-171` | no — redundant |
| `grid-panels.ts:563-564` (`fixed`/`grow` callers) | yes | **yes, but by a different mechanism** — its bind (`grid.ts:689`) has **no options object** and is therefore repaint-only; the reflow comes from `Group.add`/`Group.remove` inside `rebuildBody()` (`group.ts:93,115`) | no — redundant |
| **`window.ts:161`** | **yes** | **no** — `commitPlacement()` does not invalidate, and the reflow only arrives later from `gestures.ts:44,60,78` | **yes** — a new, earlier, coalesced reflow request |

The `window.ts:161` delta is benign — `commitPlacement` writes `bounds` back into `layout.rect`, so
the extra reflow recomputes identical geometry, and no window/desktop suite counts frames. But it is
a real behaviour change and must be recorded as one rather than absorbed into "no site observes it".

**The two `application.ts` rows are not composition writes that wandered in.** The completed
widget-adoption plan excluded them *to this issue by name* — `plans/widget-flex-adoption/01-requirements.md:88`
("excluded — #117 owns the merge pattern") and `03-01-ui-widgets.md:69-70` ("That is the boundary
with #117") — and the issue that owned them, #109, is now closed. Nothing else claims them.

**Do not sweep the neighbouring `application.ts:333`** (`body.layout = { size: … }`). That one is an
intentional wholesale replace, preserved deliberately by the sibling plan: a caller's own layout on
the content view is meant to be discarded (`application.ts:331-332`).

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
without passing through one of them. **The end state is identical.**

The trace was attacked four ways and held: the two statements are adjacent inside `Dialog`'s own
constructor, so no subclass can interleave (a subclass field initializer runs *after* `super()`
returns); no `Dialog`/`Window` subclass in the repo declares an `override layout`; nothing reads
`this.layout.position` between the two lines; and `Window`'s initializer contributes only `position`
and `padding`, both of which the merge preserves and the tagger re-asserts. Existing coverage already
pins the end state — `dialog.dsl-shape.impl.test.ts:14-17` asserts the whole object with `toEqual`
across all four constructor branches, and `toEqual` is key-order agnostic, so it stays green.

This is the worked example for the P3 audit: the question is never "is this a replace?" but
"does anything downstream depend on the replace having cleared something?".

## 5. Corrections to the issue body

1. **"29 reads vs 225 writes"** — the issue's figures are stale *and* were counted with a pattern
   that conflates JSDoc examples with code. Measured today over `packages/*/src`, executable only:
   **82 field-assignment writes and 17 reads.** By package: `ui` 43, `datagrid` 13,
   `spike-data-studio` 13, `theme-designer` 11, `forms` 1, `docs-site` 1, `files` 0, `core` 0,
   `web` 0. A further **~64** `.layout = …` lines exist inside JSDoc `@example` blocks — real for
   documentation purposes, but not call sites.
2. **P1's "add `setLayout` (+ the getter internally)"** is not implementable as written. Introducing
   `get layout()` breaks the **10** `override layout: LayoutProps = {…}` field initializers
   immediately — a class field cannot override an accessor. The getter belongs to P4 (AR-7).
3. **The issue does not mention the 10 field initializers at all**, yet they are P4's real blocker:
   `color-picker.ts:112,136` · `list-view.ts:84` · `combo-box.ts:64` · `date-picker.ts:33` ·
   `menu/popup.ts:56` · `dropdown/popup.ts:125` · `window.ts:81` · `tree.ts:96` · `tab-view.ts:138`.
4. **P2 is far smaller than the issue implies.** The issue reads as though P2 is the bulk of the
   migration. Measured, it is the 7 self-layout sites of §3 (plus the 2 inherited from #109), and 4
   of the 7 are already merges that convert mechanically. Throughout this plan **"P2" means those
   self-layout sites only** — never the combined 23-site migration, which this plan calls "the
   migration".
5. **There is a third write shape the issue never mentions: in-place property mutation.** Nine
   executable sites mutate a property of the existing object rather than assigning the field —
   `desktop/gestures.ts:42,57,75` · `desktop/arrange.ts:18` · `window/window.ts:188,190,205` ·
   `editor/edit-window.ts:78` · `docs-site/src/demo-shell.ts:216`. They match no `.layout =` grep,
   they each hand-call `invalidateLayout()` afterwards, and they are **not** defects today. They
   matter because **a read-only getter alone would not stop them** — closing that shape needs a
   frozen or cloned `LayoutProps`. See §6 for what that means for P4.
   `edit-window.ts:78` sits directly under a site this plan converts; the two do not conflict —
   `setLayout` produces a fresh object which `:78` then mutates, and `Window`'s initializer object is
   per-instance.

## 6. What remains after this plan — P4's real starting position

This plan converts **23** of the 82 executable writes (14 DSL + 7 self-layout + 2 from #109), leaving
**59**: `ui` 22, `datagrid` 12, `spike-data-studio` 13, `theme-designer` 11, `docs-site` 1, `forms` 0.
Thirteen of those 59 are the throwaway spike, which is slated for deletion — so P4's real remaining
field-assignment surface is about **46 sites**, not the "~118" an earlier count suggested.

P4 additionally needs, and this is the part no prior count captured:

- the **10 field initializers** (a class field cannot override an accessor);
- the **9 in-place property mutations** (§5.5) — a getter does not close these;
- the `.layout` writes throughout `packages/*/test` and `packages/examples`, which are inside the
  typecheck graph and would all break on a read-only field;
- `packages/spike-data-studio` deleted or migrated.

## 7. Existing coverage

`View`'s layout field has no direct test, and **nothing today asserts that a layout write requests a
reflow** — that is the gap ST-S3/ST-S5 fill.

The converted sites, however, are better covered than an earlier reading of this suggested. These
existing files are the migration's real oracles and **must stay green and unedited**:

| Existing file | What it pins |
|---|---|
| `packages/ui/test/dsl-absolute.spec.test.ts:20-33` | `at()` merge-preservation — `v.layout={direction:'col'}` then `at(v,3,4,20,2)` → whole-object `toEqual`, both overloads |
| `packages/ui/test/dsl-hardening.impl.test.ts:120-128` | merge-preservation across the taggers, incl. `fill`→`absolute` overwrite |
| `packages/ui/test/dialog.dsl-shape.impl.test.ts:14-36` | the `Dialog` end state (§4) across all four constructor branches |
| `packages/ui/test/dialog.centering.impl.test.ts:74-91` | the solved `Dialog` bounds + re-centering on resize |
| `packages/ui/test/layout-dsl-stack.spec.test.ts` | the `Stack` settle loop's frame counts |
| `packages/ui/test/app-shell.composition.spec.test.ts:107-122` (ST-W1) | the solved effect of `application.ts:343`/`:347` — menu and status each exactly one row, body absorbing the rest |
| `packages/ui/test/app-shell.composition.spec.test.ts:151-160` (ST-W4) | **the `application.ts:333` clobber contract** — `expect(content.layout).toEqual({size:{kind:'fr',weight:1}})`. This is a mechanical, immutable guard that goes red the moment `:333` is converted to a merge, which is exactly why `:333` must not be swept |

**Genuinely unwatched:** `statusline.ts:83` and `color-picker.ts:220`. No existing test asserts
`layout.direction` on either, and the ColorPicker suites overwrite the constructor's layout wholesale
(`color-picker.spec.test.ts:74`, `color-picker.impl.test.ts:54,144`), so `:220`'s effect is invisible
today. That is the only place a new migration witness earns its keep (ST-I5).

**But be honest about what such a witness can prove.** `direction:'row'` is the engine's *default*
(`layout/types.ts:213`: `direction: props.direction ?? 'row'`), and nothing in `packages/*/src` reads
`layout.direction` outside JSDoc prose. So at these two sites the solved geometry is identical whether
the write is a replace, a merge, or deleted outright. ST-I5 is therefore an **object-shape** witness —
it pins that the write still happens and still lands `direction:'row'` — and **not** a rendered-geometry
oracle. AC-6's real geometry oracles are the `dialog.centering.*` and `dsl-*` suites above.

## 8. The grep patterns that actually work

Written out because the obvious ones do not (§2): the DSL uses three receivers, five sites are
fresh-object writes, and `flex.ts:217` wraps.

```bash
# DSL — currently exactly 14, must return 0 after the migration.
# Statement-anchored, so the three JSDoc prose hits (absolute.ts:18, flex.ts:5, dsl/index.ts:4)
# are excluded.
grep -rnE "^\s*[A-Za-z_.]+\.layout\s*=([^=]|$)" packages/ui/src/view/dsl/

# self-layout — currently exactly 7, must return 0 after the migration.
# No false positives: field initializers read `override layout: …`, which never matches `this.layout`.
grep -rnE "this\.layout\s*=([^=]|$)" packages/{ui,forms,datagrid}/src
```

**The `([^=]|$)` tail is not decoration.** Write it as `[^=]` — the obvious form — and the pattern
silently drops `flex.ts:217`, because that assignment's line *ends* at the `=` with no following
character, so there is nothing for `[^=]` to match. The alternation with `$` catches the wrapped
form while still excluding `==`/`===`. Verified: `([^=]|$)` returns 14 and 7 respectively; the
`[^=]`-only form returns 13 and 7. An audit oracle that cannot see the site it is auditing is worse
than no oracle, so re-verify these counts before trusting a green audit.
