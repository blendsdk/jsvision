# 03-02 — datagrid widgets (#116)

Site inventory: [02-current-state.md §2](02-current-state.md#2-116--packagesdatagridsrc-35-conversions-across-6-modules).
**35 conversions across 6 modules**, plus two preserved sites. Scope narrowed after preflight
(AR-3, AR-7, AR-11).

## The rule that governs every conversion here

A tagger writes **only the props it owns** and merges the rest. `fixed(v, n)` writes `size`;
`grow(v)` writes `size`; `cover(v)` writes `position`; a bare `row()`/`col()` writes only
`direction`. **Anything else in the literal being replaced is silently dropped unless it is
re-established.** Check each site's full descriptor before substituting.

In this plan's scope that bites at **four** sites, and not only for `direction`:

| Site | Extra props beyond `size` | Target |
|------|---------------------------|--------|
| `grid-panels.ts:255` | `direction:'row'` | `fixed(row(), 1)` |
| `grid-lifecycle.ts:76` | `direction:'col'` | `grow(col(...))` |
| `button-row.ts:81` | `direction:'row'`, **`gap: BUTTON_GAP`** | `fixed(row({ gap: BUTTON_GAP }), BUTTON_HEIGHT)` |
| `button-row.ts:87` | `direction:'row'`, **`justify:'center'`** | `grow(row({ justify: 'center' }, button))` |

`Flex` is `Omit<LayoutProps, 'direction'>` (`flex.ts:41`), so both `gap` and `justify` are expressible
through the builder's props object. `BUTTON_GAP = 1` and `buttonRowMinWidth` (`button-row.ts:16,32`)
reserves room for that gap — dropping it shifts every button after the first.

## Group A — `grid-panels.ts` (15 of 23 sites)

`buildGridBody()` assembles up to eight horizontal bands over a `FreezePartition` in loops, so most
conversions are **tag-in-place**, not expression rewrites.

**Pass 1 — 13 pure size-tag sites** (`:208, 517, 522, 527, 536, 540, 544, 566, 567, 591, 619, 625,
658`). Provably depth-neutral: `golden-screen.spec` and `a11y-golden.spec` must stay green with zero
diff. If either moves, stop — the transcription is wrong. Note `:619` is an inline size literal
rather than one of the named consts, so a grep for `fixed1`/`fr` will miss it.

**Pass 2 — 2 sites that are not bare tags:**
- `:255` — `bandRow()`'s `{ direction:'row', size: fixed 1 }` → **`fixed(row(), 1)`**. A bare
  `fixed(g, 1)` drops `direction:'row'` and survives only because that is the engine default. Do not
  rely on the coincidence.
- `:674` — `host` → `grow(col(bodyStack))`. The only container here whose children can be passed
  inline to the builder; `:255` also becomes a builder, but an empty one (its callers `add()` later).
  An empty builder is accepted at `:255` because it is the cheapest way to re-establish the dropped
  `direction`; at `:441/445/448/578` it would buy nothing, which is why those stay excluded.

**Eight sites are out of scope (AR-3)** — see 02-current-state §2 for the line list and reasoning.
Do not convert them opportunistically: `:441/445/448/578` accumulate children across branching
control flow with `bodyStack` aliasing `inner`, and `:549/553/557/637` take a descriptor that is
`fixed(...)` or `fr` depending on `seg.fixed`.

`deps.vbar`/`deps.hbar`/`deps.messageBand` are container-supplied but **internal** (`grid.ts:529-530`,
`:554`, no prior `.layout`), so taggers are safe (AR-1). `buildGridBody` runs again on rebuild with
the same deps instances — verified idempotent, since re-tagging sets the same size over the same
layout.

Issue #116 flags a local `spacer` const at `:617-620` shadowing the DSL's `spacer()`. This plan does
not rename it — the shadow is #114's to clean up, and `fixed(spacer, pw)` needs no `spacer()` import.

## Group B — pure-flex modules (17 sites)

`value-list-popup.ts` (5), `grid-lifecycle.ts` (5), `filter-popup.ts` (4), `button-row.ts` (3).

Direct tagger substitution, plus `row(...)` for `button-row.ts:81` and `:87`'s centered cell — **with
one exception**: `grid-lifecycle.ts:76` is `{ direction:'col', size: fr 1 }` in `placeholderShell()`.
A bare `grow(g)` drops the direction and the loading / spinner / error shells flow horizontally.
Convert it as **`grow(col(...))`**. The other four `grid-lifecycle` sites and all five
`value-list-popup` sites genuinely are size-only.

`filter-popup.ts:47-48` (`labelledField`'s params) and `button-row.ts:84` (the caller's button) are
caller-supplied but **module-internal** — `labelledField` is module-private (`:46`) and `buttonRow`
is not exported from the datagrid barrel — so taggers are safe (AR-1).

`filter-popup.ts:272` is **excluded**: a reactive self-resize (`this.layout` rewritten inside a
`bind` on `contentHeight()`), not composition. `at(this, …)` would technically work; the exclusion is
a scope ruling, not a DSL limitation.

## Group C — `position:'fill'` → `cover()` (3 sites)

`grid.ts:508`, `:511` and `:1417`.

**Why this is safe:** all three are **locally constructed** (`EditorOverlay`, `PopupCatcher`, neither
of which sets `layout` in its constructor), so `view.layout` is empty and `cover()` writes a
byte-identical descriptor. The engine ignores `size` on a fill box
(`ui/src/layout/layout.ts:104-107`). It is a literal one-for-one rewrite.

**`editing.ts:230` is NOT in this group** — post-phase review found it. Its `e` comes from
`createCellEditor`, which for `kind:'custom'` returns `spec.create(field, host)` — a **caller's**
factory. `createCellEditor`/`CellEditorSpec` are barrel-exported and `GridColumn.editor` documents
the route, so it is a public receiver and AR-1 applies: the wholesale assignment stays (AR-13). The
"all four already carry `position:'fill'`" justification was true of the three `grid.ts` sites and
was never checked against this one.

The T-AO1 hidden-host question **does not arise here** — and could not be answered the way an earlier
draft of this document claimed. `grid.ts:508`/`:511` *are* hidden hosts (`EditorOverlay` sets
`visible:false` at construction, `overlay.ts:142-145`). That is irrelevant, because nothing about this
conversion depends on the layout pass reaching the view: the descriptor it writes is the one already
there. Do not gate the conversion on host liveness.

## Group D — anchored placement

**Empty.** All three candidates left scope after preflight: `quick-filter-row.ts:155` and
`personalize-dialog.ts:391` were dropped (issue #116 out-scoped both, and `:391` carries a
`direction:'col'` that `at()` cannot express), and `overlay.ts:125` is **preserved**, not converted.

`overlay.ts:125` gets the same treatment as the two ui public receivers (AR-11): the wholesale
assignment stays, gains an explaining comment, and is pinned by ST-W7. `mountCellOverlay` is
barrel-exported and reachable through the public `filterPopup` grid option, and it reads the caller's
pre-set layout at `:106-108` before clobbering it — so the clobber is observable contract.

## Cross-cutting: build order

`packages/datagrid` tests import `@jsvision/ui` by name → built `dist`. Rebuild `ui` after Phase 2
before trusting any datagrid result (NFR-4). Turbo's `test → dependsOn build` covers turbo-routed
runs; the rebuild task guards direct `vitest` invocations.
