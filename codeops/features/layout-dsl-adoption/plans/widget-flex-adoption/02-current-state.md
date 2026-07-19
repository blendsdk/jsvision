# Current State — widget-flex-adoption

Verified against `feat/dsl-adoptation`, 2026-07-19, and **re-verified during preflight** — the
counts and citations below are the corrected ones.

## 1. `#109` — `packages/ui/src` (12 conversions, 2 preserved)

### `table/data-grid.ts` — 9 conversions, all locally constructed

Composition lives in the constructor (`:119-181`):

```
DataGrid (this) → inner(col, fr) → [ topRow(row, fixed 1) → [header(fr), corner(fixed 1)]
                                     body  (row, fr)      → [rows(fr),   vbar(fixed 1)]
                                     botRow(row, fixed 1) → [hbar(fr),   corner(fixed 1)] ]
```

| Line | Current | Target |
|------|---------|--------|
| `:51` | `cell.layout = { size: fixed 1 }` (in `corner()`) | `fixed(cell, 1)` |
| `:153` | `this.header.layout = fr` | `grow(this.header)` |
| `:154` | `this.rows.layout = fr` | `grow(this.rows)` |
| `:155` | `this.vbar.layout = cell` | `fixed(this.vbar, 1)` |
| `:156` | `this.hbar.layout = fr` | `grow(this.hbar)` |
| `:159-161` | `topRow` + 2 `add()` | `fixed(row(this.header, corner()), 1)` |
| `:164-166` | `body` + 2 `add()` | `grow(row(this.rows, this.vbar))` |
| `:169-171` | `botRow` + 2 `add()` | `fixed(row(this.hbar, corner()), 1)` |
| `:176-179` | `inner` + 3 `add()` | `grow(col(topRow, body, botRow))` |

The shared `fr`/`cell` consts (`:151-152`) become unreferenced and are deleted. `DataGrid`'s own
`this.layout` is never assigned — deliberate per its class JSDoc (`:6-11`), and that stays true.

### `tabs/tab-view.ts` — 2 conversions, 1 preserved

| Line | Current | Target |
|------|---------|--------|
| `:244` | `this.strip.layout = { size: fixed 1 }` | `fixed(this.strip, 1)` |
| `:254` | `t.content.layout = { size: fr 1 }` | **PRESERVED** — caller-supplied; `Tab`/`TabViewOptions` exported at `ui/src/index.ts:219`. AR-1. |
| `:264-266` | `inner` + 2 `add()` | `grow(col(this.strip, this.body))` |

`:254` also sits inside a `For(...)` reconciler, so it has no static builder form regardless.

### `app/application.ts` — 1 conversion, 1 preserved, 4 excluded

| Line | Current | Disposition |
|------|---------|-------------|
| `:330` | `body.layout = { size: fr 1 }` | **PRESERVED** — `opts.content ?? new Desktop()`; `createApplication` is public. AR-1/AR-9. |
| `:335`, `:435` | `overlay.layout = { position:'absolute', rect }` | **EXCLUDED** — T-AO1 hidden host (RD-01 FR-4) |
| `:341` + the `add()` sites at `:348,350,354,356` | `root.layout = { direction:'col' }` + 2 conditional + 2 plain `add()` | `col(opts.menuBar, body, opts.statusLine, overlay)` via #113's S7 falsy-child skip |
| `:347`, `:353` | `{ ...opts.X.layout, size: fixed }` | **EXCLUDED (#117)** — but they sit *inside* the `if` blocks being removed, so each is **relocated verbatim** into a standalone `if (opts.X !== undefined) { … }` guard. The assignment expression is byte-identical; that is the boundary with #117. |

**Load-bearing constraint.** Four test files locate the overlay by scanning
`root.children.find((c) => c.layout.position === 'absolute')` — `app-shell.menu.spec.test.ts:59` and
`app-shell.lifecycle.spec.test.ts:90` (**immutable oracles**), plus `app-shell.menu.impl.test.ts:60,225,273`
and `app-shell.lifecycle.impl.test.ts:43`. The overlay must remain a **direct child of `root`** with
its descriptor intact. `col(...)` adds arguments as direct children (verified, no intermediate
wrapper), so this holds — ST-W1 asserts it *before* the conversion.

## 2. `#116` — `packages/datagrid/src` (35 conversions across 6 modules)

| File | In scope | Shape | Target |
|------|----------|-------|--------|
| `grid-panels.ts` | **15 of 23** | pure flex | 13 size tags + `:255` → `fixed(row(), 1)` + `:674` → `grow(col(bodyStack))` |
| `value-list-popup.ts` | 5 (`:230,232,238,240,257`) | size-only, local | taggers |
| `grid-lifecycle.ts` | 5 (`:76,80,89,96,100`) | 4 size-only + **`:76` carries `direction:'col'`** | taggers, except `:76` → `grow(col(...))` |
| `filter-popup.ts` | 4 (`:47,48,189,238`) | size-only; `:47/48` are `labelledField` params | taggers (internal — AR-1) |
| `button-row.ts` | 3 (`:81,84,87`) | flex; `:84` is the caller's button | `row(...)` + taggers (internal — AR-1) |
| `grid.ts` | 3 (`:508,511,1417`) | `position:'fill'` | `cover()` (AR-8) — locally constructed |

**`grid-panels.ts` — the 15 in scope:** `:208, 255, 517, 522, 527, 536, 540, 544, 566, 567, 591,
619, 625, 658, 674`.
**The 8 excluded (AR-3):** `:441, 445, 448, 578` accumulate children across ~230 lines of interleaved
loops and conditionals (and `bodyStack` *aliases* `inner` when lifecycle is off, `:577`), so only a
degenerate empty-builder substitution is possible — zero payoff for real risk. `:549, 553, 557, 637`
take `segLayout(seg)` (`:475-476`), which returns `fixed(panelBandWidth(...))` **or** `fr` depending
on `seg.fixed`; no single tagger expresses a runtime branch.

**Watch items inside the in-scope set** (preflight PF-002/PF-003): `:255` is `bandRow()`'s
`{ direction:'row', size: fixed 1 }` — a bare `fixed()` would drop the direction and survive only
because `'row'` is the engine default; and `grid-lifecycle.ts:76` is `{ direction:'col', size: fr 1 }`,
where a bare `grow()` genuinely flips the placeholder shells to horizontal.

**Dropped/excluded elsewhere:** `quick-filter-row.ts:155`, `personalize-dialog.ts:391` (AR-7),
`overlay.ts:125` (preserved, AR-11), `editing.ts:230` (preserved, AR-13 — its `e` is a caller's
custom-editor factory return, so AR-1 applies), `filter-popup.ts:272` (reactive self-resize). Full list:
[01-requirements.md §Residue allowlist](01-requirements.md#residue-allowlist).

`grid-panels.ts` detail: `buildGridBody()` (`:267-681`) assembles up to eight horizontal bands over a
`FreezePartition`. It is called twice (`grid.ts:665`, `:744`) for rebuilds with the **same**
`_bodyDeps`, so `deps.vbar`/`hbar`/`messageBand` are reused instances — verified that tagger merges
are idempotent across passes and no field accumulates.

## 3. Oracle exposure

**Defused by the tagger property.** `grow`/`fixed`/`cover` do `{ ...view.layout, … }` and return the
same view, so no tag conversion changes nesting depth or solved geometry.

| Test | Kind | Exposure |
|------|------|----------|
| `ui/test/datagrid.spec.test.ts` | spec | Header `:12-15` encodes `[header 1 \| body 10 \| hbar 1]`, column starts `0,7,13`, dividers `6,12,22`; 22 golden buffer cases |
| `ui/test/tabs.spec.test.ts` | spec | Focus order ST-7/8/37/38 (`:227,243,472,480`) + 8 golden reads |
| `ui/test/tab-strip.spec.test.ts` | spec | 11 golden buffer reads |
| `ui/test/app-shell.{menu,lifecycle}.{spec,impl}.test.ts` | spec + impl | The overlay locator (§1) |
| `datagrid/test/golden-screen.spec.test.ts` | spec | 2 full-screen `serialize()` goldens |
| `datagrid/test/a11y-golden.spec.test.ts` | spec | 2 full-screen `serialize()` goldens |
| `datagrid/test/cell-editor.spec.test.ts` | spec | `overlay.children[0].children[0]` — nested two levels |
| `datagrid/test/editing.spec.test.ts` | spec | `overlay.children[0]` + `.bounds` |
| `datagrid/test/filter-customization.spec.test.ts` | spec | `:96` builds a custom popup that sets its own layout; `:105-106` asserts only `rect` w/h — the gap behind AR-11 |
| `datagrid/test/{security,ui controls.completions.security}.spec.test.ts` | spec | Geometry-**independent** (whole-frame `serialize()` scans); listed so the omission is not read as an oversight (NFR-6) |

`quick-filter-row.impl.test.ts` holds 17 `.layout.rect?.…` reads — no longer relevant, since
`:155` is now out of scope.

**Coverage gaps** driving the Phase-1 witnesses: `application.ts` root child order and chrome sizing;
`grid-lifecycle`, `value-list-popup` and `button-row` composition; `grid-panels` band structure;
the `mountCellOverlay` caller-layout contract.

## 4. Corrections to the 2026-07-19 sweep memo

1. **"grid-panels: only 3 of 23 convertible"** — the *count* of 23 was **right**; every site is a
   pure flex descriptor (no `position:'absolute'` in the file). But the memo's underlying reason —
   imperative band assembly the DSL's expression sugar does not fit — was substantially correct, and
   AR-3 now honors it: 15 convert, 8 do not.
2. **"#109 application ~6 sites, the one real new structural port"** — written before T-AO1 was
   attempted and reverted. Four are excluded and one preserved, leaving **one** conversion.
