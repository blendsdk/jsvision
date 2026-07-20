# 03-02 — migration + the replace-semantics audit (P2/P3)

Implements [FR-4, FR-5, FR-6](01-requirements.md). Site inventory:
[02 §2 and §3](02-current-state.md). **23 conversions**: 14 DSL + 7 self-layout + 2 inherited from
the closed #109.

## The audit comes first — P3 before P2

The issue orders these P2 (migrate) then P3 (audit). **This plan inverts that**, because an audit run
after the migration cannot change the migration's outcome; it can only ratify it. Every site is
audited *before* it converts, and a site whose audit says "this replace is load-bearing" does not
convert at all — it stays a wholesale assignment with a plain-language comment, exactly as this
feature's earlier plans handled their preserved sites.

**The question is never "is this a replace?"** — that is trivially greppable. It is **"does anything
downstream depend on the replace having cleared a prop?"** A replace is only meaningful where the
object was non-empty, and only *load-bearing* where nothing later restores what it cleared.

**And there is a second question, which the first draft of this plan did not ask: is the view mounted
when the write runs, and does anything on that path already request a reflow?** That is what decides
whether the auto-invalidation is observable at all — the **invalidation delta**. Omitting it produced
two separate errors, in opposite directions: it let the first draft claim `filter-popup.ts:285` as an
un-invalidated site when it sits inside a `bind(…, { relayout: true })` that already reflows, and it
let `window.ts:161` — a site that genuinely does gain a reflow — go unenumerated. Shape alone cannot
surface either. The column is mandatory, and it is filled from the **call path**, not the statement.

The full delta analysis is [02 §3a](02-current-state.md); its conclusion is that exactly one
conversion, `window.ts:161`, adds a reflow that does not happen today, and that the addition is
benign.

## The audit table — one row per site, filled before any conversion

Recorded here, not in shipped source (AR-8). **Three rows are pre-filled** from
[02 §3–§4](02-current-state.md) because they were individually traced; every other row's verdict is
**deliberately blank** and is completed during task 2.1. No collapsed rows: a lumped row is where a
misclassification hides.

### DSL sites (FR-4)

Taggers are library code — "mounted?" is a property of the *caller*, so the column records what the
call path can be, not what it always is.

| # | Site | Starting object | Replace clears | Restored downstream? | Mounted at call time? | Verdict |
|---|---|---|---|---|---|---|
| 1 | `absolute.ts:44` (`at`) | caller's | nothing — already a spread | n/a | caller-dependent — reachable mounted via `split-view`/`grid-panels` | ✅ convert — replace ≡ merge |
| 2 | `absolute.ts:70` (`cover`) | caller's | nothing — already a spread | n/a | caller-dependent | ✅ convert — replace ≡ merge |
| 3 | `absolute.ts:94` (`center`) | caller's | nothing — already a spread | n/a | caller-dependent | ✅ convert — replace ≡ merge. The adjacent `view.centered = true` is a separate field and is untouched |
| 4 | `flex.ts:96` (`container`) | `{}` — fresh `Group` | nothing | n/a | no — freshly constructed | ✅ convert — the whole `toLayout(props, direction)` result becomes the patch |
| 5 | `flex.ts:100` (`container`) | `{}` — fresh `Group` | nothing | n/a | no — freshly constructed | ✅ convert — replace ≡ merge over `{}` |
| 6 | `flex.ts:172` (`grow`) | caller's | nothing — already a spread | n/a | **yes** — `split-view.ts:188` per drag frame | ✅ convert — no delta: that path already reflows through its own `bind(…, {relayout:true})` (`split-view.ts:170-171`) |
| 7 | `flex.ts:191` (`fixed`) | caller's | nothing — already a spread | n/a | **yes** — `grid-panels.ts:563` per `rebuildBody()` | ✅ convert — no delta, but **not** via its bind: `grid.ts:689` passes no options object, so the reflow comes from the `Group.add`/`remove` inside `rebuildBody()` |
| 8 | `flex.ts:217` (`spacer`) | `{}` — fresh `Empty` | nothing | n/a | no — freshly constructed | ✅ convert — the ternary moves inside the call: `view.setLayout(typeof arg === 'number' ? … : …)` |
| 9 | `stack.ts:149` (`Stack.draw`) | the layer's | nothing — already a spread | n/a | **yes** — at draw time, change-gated | ✅ convert — safe on both counts: the write is change-gated (`:142-148`) so a settled frame makes no calls, and `flush()` snapshots `needsReflow` before composing (`render-root.ts:333,342-343`) so a draw-time `markRelayout` lands next frame and cannot re-enter. Keep the trailing `:153` |
| 10 | `stack.ts:192` (`stack`) | `{}` — fresh `Stack` | nothing | n/a | no — freshly constructed | ✅ convert — the local `layout` object (already mutated at `:191` to default `size`) becomes the patch |
| 11 | `stack.ts:196` (`stack`) | `{}` — fresh `Stack` | nothing | n/a | no — freshly constructed | ✅ convert — replace ≡ merge over `{}` |
| 12 | `stack.ts:208` (`stack`) | the layer's | nothing — already a spread | n/a | no — during stack assembly | ✅ convert — replace ≡ merge |
| 13 | `stack.ts:216` (`stack`) | the layer's | nothing — already a spread | n/a | no — during stack assembly | ✅ convert — the adjacent `layer.centered = true` is a separate field and is untouched |
| 14 | `stack.ts:225` (`stack`) | the layer's | nothing — already a spread | n/a | no — during stack assembly | ✅ convert — replace ≡ merge. `overlay.track(layer, placement)` on the next line reads no layout prop |

### Self-layout sites (FR-5)

| # | Site | Starting object | Replace clears | Restored downstream? | Mounted at call time? | Verdict |
|---|---|---|---|---|---|---|
| 15 | `dialog.ts:109` | `{position:'absolute', padding:1}` (from `Window`'s field initializer) | `position:'absolute'` | **Yes** — every path passes through `center()` (`absolute.ts:94`) or `at()` (`:44`), both of which write `position:'absolute'`; the block is guarded by `width && height` | no — constructor | ✅ convert — end state identical, pinned by the existing `dialog.dsl-shape.impl.test.ts` |
| 16 | `statusline.ts:83` | `{}` (`Group` initializes nothing) | nothing | n/a | no — constructor | ✅ convert — replace ≡ merge |
| 17 | `color-picker.ts:220` | `{}` | nothing | n/a | no — constructor | ✅ convert — replace ≡ merge |
| 18 | `window.ts:161` | the window's | nothing — already a spread | n/a | **yes** — `commitPlacement()` at gesture start (`desktop.ts:213,222,235`), and **nothing on that path invalidates today** | ⚠️ convert — but note the invalidation delta (FR-4a): this is the one conversion that adds a reflow. Benign (it writes `bounds` into `layout.rect`, so geometry is unchanged), but it must be recorded, not absorbed |
| 19 | `edit-window.ts:77` | inherits `Window`'s `{position:'absolute', padding:1}` | nothing — already a spread | n/a | no — constructor | ✅ convert — but **`:78` is the ordering trap**: the very next line mutates `this.layout.rect` in place. `setLayout` assigns a *fresh* object first, so `:78` mutates the new one and the write survives. It would NOT survive the reverse order |
| 20 | `form-dialog.ts:82` | inherits `Dialog`'s | nothing — already a spread | n/a | no — constructor | ✅ convert — replace ≡ merge. `padding: 0` here is deliberate and stays (a `formDialog` places children at explicit frame offsets) |
| 21 | `filter-popup.ts:285` | the popup's | nothing — already a spread | n/a | **yes** — inside `bind(…, {relayout:true})`, which already invalidates | ✅ convert — no delta. Also already change-gated by `rect.height !== h` |
| 22 | `application.ts:343` | `opts.menuBar`'s | nothing — already a spread | n/a | no — `root` assembled at `:357`, mounted after | ✅ convert — replace ≡ merge; the existing "merge, not replace" comment becomes true by construction rather than by spread |
| 23 | `application.ts:347` | `opts.statusLine`'s | nothing — already a spread | n/a | no — same | ✅ convert — replace ≡ merge |

**Audit outcome: 23 ✅, 0 ⛔.** Every site is either already a spread (18 of 23) or writes a
freshly-constructed view whose starting object is `{}` (5). Not one replace turned out to be
load-bearing, so no site is preserved and the phase proceeds. Two rows carry an ordering or mechanism
note that the shape alone would not have surfaced — row 19 (the in-place `rect` mutation on the very
next line) and row 7 (the reflow comes from `Group.add`/`remove`, not from the bind).

**Any row that comes out ⛔ halts the phase** and becomes a preserved site with a comment, plus an
entry in the register as a runtime addition. Nothing is converted on the assumption that a replace
was incidental.

## The DSL sites (FR-4)

Nine of the fourteen are literally `<receiver>.layout = { ...<receiver>.layout, … }` and become
`<receiver>.setLayout({ … })` — the spread was always emulating this method.

The five that write a **freshly constructed** `Group`/`Stack`/`Empty` (`flex.ts:96`, `:100`, `:217`,
`stack.ts:192`, `:196`) are indistinguishable either way, since the object is `{}`. They convert for
consistency: a reader should not have to work out which of two idioms a builder uses, and a future
edit that adds a prop before one of these lines would silently lose it under replace.

`flex.ts:217` (`spacer()`) deserves a note because it was missed entirely in the first draft: its
assignment **wraps across two lines**, so the line ends at `=` and no `.layout = ` grep can see it.
That is also why the audit greps in [02 §8](02-current-state.md) end with `([^=]|$)` rather than the
more obvious `[^=]`.

**`stack.ts:149` is the one site where invalidation batching is visible.** It sits inside a loop that
tracks a `changed` flag and calls `this.invalidateLayout()` once afterwards (`:153`). Under
`setLayout` each layer invalidates as it is written. That is correct and free — `markRelayout` sets a
flag and `scheduleFlush()` early-returns when a flush is pending ([02 §1](02-current-state.md)) — so
the trailing batched call becomes redundant. **Leave it.** It is harmless, it keeps the loop readable,
and removing it would couple this file to an implementation detail of `setLayout`. There is also a
non-obvious reason to keep it: `setLayout` invalidates through the **layer's** host, which is `null`
if that layer is unmounted, whereas `:153` invalidates through the **Stack's**.

Two further facts make the draw-time conversion safe, and both are worth stating because "invalidate
inside a draw" reads alarming: the write is **change-gated** (`stack.ts:142-148` writes only when the
recomputed rect actually differs, so a settled frame makes no calls), and `flush()` clears
`scheduled` and snapshots `needsReflow` *before* composing (`render-root.ts:333,342-343`), so a
`markRelayout` raised during a draw lands in the next frame and can never re-enter synchronously.
Settle termination depends on the rect comparison, not on the trailing invalidate.

## The behaviour change, stated plainly (AR-5)

Converting the taggers means `at`, `cover`, `center`, `fixed`, `grow` and the `stack` placement
helpers now request a reflow when applied to an **already-mounted** view. Today they do not, and a
caller must remember to invalidate — the "set and forget silently doesn't repaint" defect the issue
opens with.

- At build time (the overwhelming majority of calls) `host` is `null` and nothing changes.
- **No tagger site observes the change today** — but for two different reasons, and the distinction
  matters because a wrong rationale can leak into a code comment (AR-8):
  - `split-view.ts:186-190` (`grow()` per pane on every splitter drag) already reflows through its
    own `bind(…, { relayout: true })` (`split-view.ts:170-171`).
  - `grid-panels.ts:563-564` (`fixed`/`grow` on retained scroll bars, re-run from `grid.ts:740`)
    already reflows too — but **not** through its bind. `grid.ts:689` passes **no options object**,
    so that bind is repaint-only; the reflow comes from the `Group.add`/`Group.remove` inside
    `rebuildBody()` (`group.ts:93,115`).
- `filter-popup.ts:285` is **not** an example of this. It is a self-layout site, not a tagger call,
  and it already reflows via `bind(…, {relayout:true})`. The first draft of this plan claimed it as
  the motivating defect; that claim was wrong and is withdrawn.
- **`window.ts:161` is the exception in the other direction** (FR-4a). It is a self-layout
  conversion, not a tagger, and nothing on its path invalidates today — so it genuinely gains a
  reflow. Benign, but real. See [02 §3a](02-current-state.md).

So for the taggers the change is retained not as a repair but as a **correctness default for future
callers**. The alternative — a conditional invalidate — re-opens precisely the footgun FR-1 exists to
close.

ST-S5 pins the new behaviour so it cannot regress. It is a **specification** of new behaviour, not a
witness of a fixed bug; it is still genuinely red before the conversion, because `fixed(v, 2)` on a
mounted view really does not invalidate today.

Merge-preservation cannot regress through the conversion either, and needs no new test to say so:
`dsl-absolute.spec.test.ts:20-33` and `dsl-hardening.impl.test.ts:120-128` already assert it with
whole-object `toEqual`. They must stay green **and unedited**.

## Ordering within the phase

1. Complete the audit table (task 2.1) — **no code changes**.
2. Convert the 14 DSL sites. They are the highest-traffic and best-covered by the existing adoption
   suites, so a mistake surfaces immediately.
3. Convert the 8 straightforward self-layout sites (including the two `application.ts` sites).
4. Convert `dialog.ts:109` last — the only one whose safety rests on a traced argument rather than an
   empty starting object.
