# Current State — widget-flex-adoption

Every line reference below was verified against `feat/dsl-adoptation` on 2026-07-19. **This audit
supersedes the 2026-07-19 sweep memo**, which recorded two claims the source disproves — see
§4.

## 1. `#109` — `packages/ui/src` (12 conversions, 2 preserved)

### `table/data-grid.ts` — 9 conversions, all locally constructed

Composition lives entirely in the constructor (`:119-181`). Current shape:

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

The shared `fr`/`cell` consts become dead once the taggers land and are deleted with them.
`DataGrid`'s own `this.layout` is never assigned — the class JSDoc (`:6-11`) states that is
deliberate, so the parent can place it. That stays true.

### `tabs/tab-view.ts` — 2 conversions, 1 preserved

| Line | Current | Target |
|------|---------|--------|
| `:244` | `this.strip.layout = { size: fixed 1 }` | `fixed(this.strip, 1)` |
| `:254` | `t.content.layout = { size: fr 1 }` | **UNCHANGED** — caller-supplied; `Tab`/`TabViewOptions` are barrel-exported (`ui/src/index.ts:219`). AR-1. |
| `:264-266` | `inner` + 2 `add()` | `grow(col(this.strip, this.body))` |

`:254` additionally sits inside a `For(...)` dynamic reconciler passed to `body.addDynamic` — the
child set is reconciled reactively, not composed statically, so it has no static builder form even
setting AR-1 aside.

### `app/application.ts` — 1 conversion, 1 preserved, 4 excluded

| Line | Current | Disposition |
|------|---------|-------------|
| `:330` | `body.layout = { size: fr 1 }` | **UNCHANGED** — `body = opts.content ?? new Desktop()`; `createApplication` is public. AR-1/AR-9. |
| `:335`, `:435` | `overlay.layout = { position:'absolute', rect }` | **EXCLUDED** — T-AO1 hidden host, closed won't-do (RD-01 FR-4) |
| `:341-356` | `root.layout = { direction:'col' }` + 2 conditional + 2 plain `add()` | `col(opts.menuBar, body, opts.statusLine, overlay)` using #113's S7 falsy-child skip |
| `:347`, `:353` | `{ ...opts.X.layout, size: fixed }` | **EXCLUDED** — the merge pattern #117 owns |

**Load-bearing constraint.** Four test files locate the overlay by scanning
`root.children.find((c) => c.layout.position === 'absolute')` — `app-shell.menu.spec.test.ts:59`,
`app-shell.lifecycle.spec.test.ts:92` (both **immutable oracles**), plus the two `.impl` siblings
(`app-shell.menu.impl.test.ts:41-44,60,225,273`, `app-shell.lifecycle.impl.test.ts:43,51,59`). The
overlay must remain a **direct child of `root`** with its `position:'absolute'` descriptor intact.
`col(...)` places its arguments as direct children, so this holds — but it is the single thing most
likely to break and must be asserted before the conversion (ST-W1).

## 2. `#116` — `packages/datagrid/src` (48 conversions)

| File | Sites | Shape | Target |
|------|-------|-------|--------|
| `grid-panels.ts` | 24 | all pure flex, **no `position:'absolute'` anywhere** | `col`/`row` + `grow`/`fixed` |
| `value-list-popup.ts` | 5 (`:230,232,238,240,257`) | pure flex, local | taggers |
| `grid-lifecycle.ts` | 5 (`:76,80,89,96,100`) | pure flex, local | taggers |
| `filter-popup.ts` | 4 (`:47,48,189,238`) | pure flex; `:47/48` are `labelledField` params | taggers (internal — AR-1) |
| `button-row.ts` | 3 (`:81,84,87`) | pure flex; `:84` is the caller's button | `row(...)` + taggers (internal — AR-1) |
| `grid.ts` | 3 (`:508,511,1417`) | `position:'fill'` | `cover()` (AR-8) |
| `editing.ts` | 1 (`:230`) | `position:'fill'` | `cover()` (AR-8) |
| `quick-filter-row.ts` | 1 (`:155`) | absolute, scroll-indent x | `at()` (AR-7) |
| `personalize-dialog.ts` | 1 (`:391`) | absolute, computed height | `at()` (AR-7) |
| `overlay.ts` | 1 (`:125`) | absolute, popup anchor | `at()` (AR-7) |

**Excluded:** `filter-popup.ts:272` (`this.layout` self-config — #113 S6 deferral, AR-7) and three
JSDoc `@example` blocks (`grid.ts:293`, `editable-grid-rows.ts:208`, `button-row.ts:63` — #112,
AR-10).

`grid-panels.ts` detail: `buildGridBody()` (`:267-681`) assembles header / freeze-rows / body /
quick-filter / footer / message / scrollbar bands from a `FreezePartition`. Every site is a **wholesale
replacement** with a **pure flex descriptor**; the only run-time inputs are counts (`freezeRows`,
`prefixWidth`) and summed column widths (`panelBandWidth`/`segLayout`) — all selecting a flex *size*,
never a screen coordinate. It is called twice (`grid.ts:665`, `:744`) for rebuilds, so tagger merges
are idempotent across passes.

## 3. Oracle exposure

**Defused by the tagger property.** `grow`/`fixed`/`at`/`cover` do `{ ...view.layout, … }` and return
the same view, so no tag-site conversion can change nesting depth or solved geometry.

**Live exposure — container conversions only:**

| Test | Kind | Exposure |
|------|------|----------|
| `ui/test/datagrid.spec.test.ts` | spec | Header `:12-15` hard-codes `[header 1 \| body 10 \| hbar 1]` and derived column starts `0,7,13` / divider x `6,12,22`; 22 golden buffer cases built on it |
| `ui/test/tabs.spec.test.ts` | spec | Focus order ST-7/8/37/38 + 8 golden buffer reads |
| `ui/test/tab-strip.spec.test.ts` | spec | 11 golden buffer reads |
| `ui/test/app-shell.{menu,lifecycle}.{spec,impl}.test.ts` | spec + impl | The `layout.position === 'absolute'` overlay locator (see §1) |
| `datagrid/test/golden-screen.spec.test.ts` | spec | 2 full-screen `serialize()` goldens |
| `datagrid/test/a11y-golden.spec.test.ts` | spec | 2 full-screen `serialize()` goldens |
| `datagrid/test/quick-filter-row.impl.test.ts` | impl | **15** `.layout.rect?.x/width` descriptor reads — heaviest single file |
| `datagrid/test/cell-editor.spec.test.ts` | spec | `overlay.children[0].children[0]` — nested two levels, doubly depth-sensitive |
| `datagrid/test/editing.spec.test.ts` | spec | `overlay.children[0]` + `.bounds` |
| `datagrid/test/{filter-popup,frozen-panels,filter-entry-point,filter-customization}` | mixed | popup/editor anchor positions vs hard-coded columns |

**Coverage gaps** (drive the Phase-1 witnesses): `application.ts` root child order and chrome sizing
have no direct oracle; neither does `grid-lifecycle`, `value-list-popup` or `button-row` composition.

## 4. Corrections to the 2026-07-19 sweep memo

1. **"grid-panels: only 3 of 23 convertible"** — wrong. There are 24 sites and **all** are pure flex
   descriptors; the file contains no `position:'absolute'` at all (AR-3).
2. **"#109 application ~6 sites, the one real new structural port"** — written before T-AO1 was
   attempted and reverted. Four of the six are now excluded; one more is preserved under AR-1,
   leaving **one** conversion.
