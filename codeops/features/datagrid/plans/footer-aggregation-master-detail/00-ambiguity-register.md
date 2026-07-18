# Ambiguity Register — Footer, Aggregation & Master-Detail

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-09
> **Status**: ✅ GATE PASSED — all 6 Section-A items resolved
> **Last Updated**: 2026-07-17 (preflight revisions applied — AR-9/AR-10/AR-12; see 00-preflight-report.md)
> **CodeOps Skills Version**: 3.8.0

The Zero-Ambiguity Gate for the footer-aggregation-master-detail plan. RD-09 is a preflighted
requirement whose top-level model is already locked (a footer band hosting column-aligned aggregates
+ free-form widget slots; loaded-set aggregates with labelled honesty; master-detail via reactivity;
no pivot / no inline tree-grid). This register records (A) the six plan-level forks the user confirmed
at the gate (two AskUserQuestion rounds, 2026-07-16), (B) design decisions grounded in the actual code
(single viable path each — no strawman alternatives), and (C) decisions inherited verbatim from
RD-09's own requirements register.

**Same-session note:** ⚠️ This plan was authored in the same session that would review it at
preflight. A fresh-session preflight is recommended for review independence.

**Grounding recon (2026-07-16):** three code-recon passes established the seams — (1) band
composition & the RD-07 pinned-panel geometry (`grid-panels.ts` `buildGridBody`, `apportionColumns`,
the `segs` loop, the fixed-band-steals-`fr`-body layout); (2) the reactive display/aggregate seams
(`grid.ts` private `display` derived at `:364`; `selectedKeys()` public at `:1104`; **no** public
`focusedRow()`/displayed-rows accessor; `createRoot`/`onCleanup` scope disposal); (3) the
widget/command/sanitize seams (`Text`/`Button`/`Group`, `Button.command`→`ev.emit`, the `StatusLine`
model, `sanitize` auto-applied at the `ctx.text` draw boundary). `grid.ts` is at **1198 lines**
against a hard `< 1200` impl-test guard (`grid-selection.impl.test.ts:182`).

---

## A. User-confirmed decisions (Zero-Ambiguity Gate)

| #    | Category | Ambiguity | Options presented | ✅ Decision | Status |
| ---- | -------- | --------- | ----------------- | ---------- | ------ |
| AR-1 | Scope | v1 scope & phasing line | (a) **Full Must-Have v1, phased** · (b) core only (defer honesty + N-of-M/selection widgets) · (c) aggregates-first minimal | **(a)** — ship the entire RD-09 Must-Have set (footer band · column aggregates over the displayed/loaded set · free-form widget slots · sticky footer · aggregate-honesty labelling · master-detail + `focusedRow()` · N-of-M & selection-count demo widgets), phased **data-plane-first** like RD-05…08. Phase B stays deferred per RD (server `source.aggregate()` hook · record navigator + pager · top toolbar band · drill-in). | ✅ Resolved |
| AR-2 | Behavioral | Aggregate-honesty mechanism when no windowed source exists until RD-11 | (a) **optional `source.complete?()` predicate now** · (b) named-defer to RD-11 · (c) always suffix "(loaded)" | **(a)** — add an **optional `complete?(): boolean`** to `GridDataSource`. Absent ⇒ treated as complete, so `fromRows` and every current source show a clean grand total; a source returning `false` gets the "(loaded)" partial qualifier. AC#4 is proven with a **test-double windowed source**. Mirrors the existing optional `setSort`/`setFilter`/`distinct` seams. Honors the Must-Have AC now without waiting for RD-11. | ✅ Resolved |
| AR-3 | Integration | Footer widget-slot layout + `Button` command dispatch | (a) **footer flow-row + generic `Button({command})`→`ev.emit`** · (b) `StatusLine`-style injected `emitCommand` seam · (c) caller-positioned absolute Views | **(a)** — the footer lays the caller's `widgets: View[]` in a **flow row** (`{direction:'row'}` + `spacer()` for right-align); a footer `Button` uses the standard `command`/`ev.emit` widget path (routed via the loop's command registry) or its `onClick`. Lightest; matches how the datagrid already embeds ui widgets (`ValueList`/`FilterPopup`). The `StatusLine` seam (b) is real but new plumbing the datagrid doesn't have; deferrable if disabled-greying/accelerators are ever wanted. | ✅ Resolved |
| AR-4 | Data & state | Master-detail detail-grid data contract + focus readout | (a) read-only-structural (computed-backed) · (b) **editable reactive write-through source** | **(b) — the no-shortcut path.** Add `fromReactiveRows<T>(read, { rowKey, insert?, remove? })` — the reactive **twin of `fromRows`**: `length`/`rowAt` read reactively from `read()`; `insert`/`remove` delegate to caller writers that mutate the master's **owned** collection (omitted ⇒ read-only-structural, graceful). Cell edits use the existing in-place + `version` path. Add `focusedRow(): T \| undefined` **and** `focusedKey(): Key \| undefined`. `masterDetail(master, buildDetail)` owns the `createRoot` scope and disposes it with the master. Rejected (a) — no detail insert/delete (a real gap for line-item editing) and it doesn't typecheck against today's `fromRows(Signal<T[]>)`. The "synced-`Signal`-via-effect" variant was **also** rejected during analysis (an effect resets the transient signal on focus change → inserted rows lost). | ✅ Resolved |
| AR-5 | Naming | Per-column aggregate descriptor shape | (a) **`{ fn, format?: (v)=>string, label?: string }`** · (b) RD-literal dual functions · (c) `{ fn, format? }` only | **(a)** — `format?` renders the number (e.g. a currency `Intl` formatter); `label?` is an **optional static prefix** string (e.g. `'Σ'`, `'Avg:'`). Cell text = `[label ][format(v) ?? String(v)]` (honesty qualifier appended when `complete()===false`, AR-2). A slight, documented divergence from the RD's literal dual-function sketch — the same kind of RD-faithful-behavior / cleaner-shape divergence RD-08 made for the null fields (RD-08 AR-15). Rejected (b) redundant `format`-vs-`label(v)` precedence; (c) forces every labelled total to reimplement "prefix + number". | ✅ Resolved |
| AR-6 | Edge cases | Fold semantics for non-numeric / null / empty inputs | (a) **skip non-finite; empty→blank/0** · (b) coerce `Number()` · (c) throw on non-numeric column | **(a)** — a numeric fold (`sum`/`avg`/`min`/`max`) includes a row only when `value(row)` is `typeof === 'number' && Number.isFinite(...)` (skips `null`/`undefined`/`NaN`/`±Inf`/non-number), mirroring the number-filter guard (`filter.ts:116`). `count` counts the displayed rows. `avg = sum / (count of numeric contributors)`. Empty contributor set: `sum→0`, `count→0`, `avg`/`min`/`max`→`undefined`, rendered as a **blank cell**. Rejected (b) one bad cell poisons the total to `NaN`; (c) brittle for mixed/nullable/dynamic columns. | ✅ Resolved |

---

## B. Grounded design decisions (single viable path — cited to code) · **User: accepted all (bulk)**

Single sensible realization given the existing seams; each recorded with its grounding (no strawman
alternatives per the grounded-options rule). The user accepted all Section-B decisions as recommended
at the gate (2026-07-16). Open to revisit at preflight.

| #     | Decision | Realization & grounding | Status |
| ----- | -------- | ----------------------- | ------ |
| AR-7  | Footer band architecture | A fixed-height band added to the `inner` col-group in `buildGridBody` **after** `inner.add(bodyRow)` (`grid-panels.ts:526`) and **before** the hbar `botRow` (`:528`); since `bodyRow` is the only `fr` child it auto-steals height and is **sticky-at-bottom for free** (outside the body's virtual-scroll window). The aggregate row mirrors the `segs` loop (one sub-view per left/center/right panel, same `layout`/`indent`/`dividers`, `FreezeDivider`s between, a trailing `corner()`) exactly like `freezeRowsRow` (`:519-524`), reusing `apportionColumns` + `alignCell` so cells align to columns across the frozen/scrolling split and re-flow on live resize via the shared `width` getters / `widthTick`. | ✅ Accepted |
| AR-8  | New public grid accessors | Add `displayedRows(): readonly T[]` (a one-liner over the existing private `display` derived, `grid.ts:364`), `focusedRow(): T \| undefined` (`this.display()[this.focused()]`, cursor at `:290`), and `focusedKey(): Key \| undefined`. `selectedKeys()` already exists (`:1104`). These are the reactive readouts aggregates fold over and master-detail binds to. | ✅ Accepted |
| AR-9  | Aggregate = lazy fold, view-bound repaint | A per-column aggregate is a **lazy** fold over `displayedRows()` using `column.value(row)` (typed `V`, `column.ts:37`). The `FooterController` holds **no** `computed` (matching `GridSelection`/`RowMutations`, which hold zero; the datagrid uses zero bare `computed`s package-wide and derives via the scope-owned `this.derived`). The `FooterBand` view **binds** the fold to its data deps (`displayedRows()`/`version`) for a memo-equivalent repaint, with a separate invalidate-only bind for `widthTick`. Recomputes on edit (`version` tick), insert/delete (`rows.set`), sort, and filter. Fold edge semantics per AR-6; honesty qualifier per AR-2. **Revised at preflight (PF-002).** | ✅ Accepted (revised) |
| AR-10 | Module decomposition (700-line target + the hard `<1200` grid.ts guard) | New pure **`aggregate.ts`** (the fold model + descriptor — twin of `sort.ts`/`filter.ts`/`selection.ts`), a new **`footer-band.ts`** (the passive `FooterBand` `View`, twin of `SyntheticBodyBand`), a new **`master-detail.ts`** (`fromReactiveRows` lives in `data-source.ts`; the `masterDetail` helper here), and a **`FooterController<T>`** (twin of `GridSelection`/`RowMutations`, in `grid-footer.ts`) owning the reactive aggregate computeds + widget wiring, so `grid.ts` keeps only thin delegators + the accessors and stays `< 1200`. The footer band is built inside `buildGridBody` so `rebuildBody` recreates it automatically. Headroom is made **first** (Phase 2 Step 2.0) by extracting the self-contained `EditorOverlay`/`PopupCatcher` (→ `overlay.ts`) and `devWarn` (→ `dev.ts`) — reclaims ~40 lines. If the irreducible public surface still crosses the guard, it is a *runaway* ceiling (impl test, not a spec oracle) and is re-based with rationale — never met by re-inlining logic. **Concrete extraction fixed at preflight (PF-001).** | ✅ Accepted (revised) |
| AR-11 | Naming of new symbols | `GridFooter<T>` (the RD **config interface** the caller passes to `footer?`, in `grid-footer.ts`), `FooterController<T>` (the internal controller, in `grid-footer.ts` — distinct name to avoid an interface/class collision), `footer?: GridFooter<T>` grid option, `AggregateFn = 'sum'\|'avg'\|'min'\|'max'\|'count'`, `AggregateSpec` (the descriptor), `foldAggregate`/`formatAggregate`/`isAggregateFn` (pure fns), `FooterBand` (the view), `fromReactiveRows`, `masterDetail(master, buildDetail)`, `focusedRow`/`focusedKey`/`displayedRows`. RD-faithful where the RD names a symbol; grounded where it does not. | ✅ Accepted |
| AR-12 | Sanitize + input validation | Footer text needs **no explicit `sanitize` call** — every `Text`/`Button`/`FooterBand` paints via `ctx.text`, which applies `sanitize` at the engine buffer-write boundary (`draw-context.ts:108`). Aggregate `fn` is validated against the `AggregateFn` enum; `aggregates` keys (`columnId`) are validated against the known columns (unknown key ⇒ ignored + `devWarn`, extracted to a shared `dev.ts` so the new `grid-footer.ts` can import it — PF-004). (RD Security.) | ✅ Accepted |
| AR-13 | Verify command | `yarn verify` (CLAUDE.md — `yarn lint` then `turbo run typecheck build test check:docs`). Fills every Verify line. | ✅ Accepted |
| AR-14 | Showcase coverage | One kitchen-sink story (+ smoke) **and** a datagrid-showcase "Footer, aggregation & master-detail" cluster replacing the RD-09 "coming soon" placeholder (`placeholders.ts`), re-basing the placeholder-count oracles to RD-10…RD-14 (as RD-07/RD-08 did). Keeps roadmap/showcase parity. | ✅ Accepted |

---

## C. Inherited from RD-09 (already user-decided at requirements time — cite, don't re-litigate)

| RD AR | Decision |
| ----- | -------- |
| RD AR #5  | Child grids via **master-detail** (+ drill-in Phase B); inline nested / tree-grid rows are **out of scope**. |
| RD AR #10 | The totals surface is a **footer band** hosting both column-aligned aggregates **and** free-form widget slots (not a totals-row-only). |
| RD AR #11 | **No pivot.** |
| RD AR #17 | Aggregates fold over the **loaded/in-memory** set in v1 (can't fold 100k client-side); a partial total is **labelled**, never presented as a whole-dataset grand total unless a server aggregate is supplied; the `source.aggregate()` server hook is **Phase B**. |
| RD (family) | ALL rendered/pasted/imported text passes the core `sanitize` boundary; custom callbacks run isolated. |

---

## D. Runtime decisions (discovered during exec_plan — recorded, not re-litigated)

| #      | Decision | Realization & grounding | Status |
| ------ | -------- | ----------------------- | ------ |
| AR-R1  | `GridFooter` is **non-generic** (not `GridFooter<T>` per AR-11) | The repo's `tsconfig` enables `noUnusedParameters`, so an unused type parameter fails typecheck (`TS6133` on `src/grid-footer.ts`). `GridFooter`'s shape (`sticky`/`aggregates: Record<string, AggregateSpec>`/`widgets: readonly View[]`) uses no `T`, so the generic is genuinely dead. Dropped to `GridFooter`; the grid option is `footer?: GridFooter`. Callers are unaffected (the arg was never used). `FooterController<T>` stays generic (it needs the typed columns). **Mechanical, forced by the compiler — one correct realization.** | ✅ Resolved (runtime) |
| AR-R2  | The `grid.ts` `<1200` line guard is **re-based to `<1250`** | The anticipated PF-001 outcome: Step 2.0 extractions reclaimed ~53 lines (grid.ts 1198→1145), but RD-09's irreducible public surface — the `footer` option, the three reactive readout accessors, and the footer-controller wiring — pushed grid.ts to 1204, past 1200. Per the reconciled AC#11/AR-10 the runaway-growth ceiling is re-based with this rationale (both impl-test guards: `grid-footer.impl.test.ts`, `grid-selection.impl.test.ts`), **never met by re-inlining logic** — all heavy footer logic lives in `aggregate.ts`/`footer-band.ts`/`grid-footer.ts`. | ✅ Resolved (runtime) |
| AR-R3  | Add a backward-compatible **`measure()` to `@jsvision/ui` `Text` and `Button`** (a `ui` touch) | AR-3's confirmed widget-row example lays raw `Text`/`Button`/`spacer()` in a flow row, but those widgets ship no `measure()` (they are built for absolute positioning: `draw()` fills its given box), so in a flex row `reflow.ts:80` gives them no natural size and they collapse to 0 cells and render blank (footer read-outs never appear). **User decision (AskUserQuestion, 2026-07-17):** add a natural-size `measure()` to `Text` (content display width × line count) and `Button` (`textW + 4` × 2, matching its face + shadow) so they self-size in a flow; absolute layouts are unaffected (they use an explicit rect and ignore `measure`). `spacer()` (fr) still absorbs the slack for right-alignment. Spec-first, `+ui` tests. Rejected: "callers must wrap each widget in `fixed()`/`grow()`" — contradicts AR-3's raw-widget example. | ✅ Resolved (runtime) |

---

## Gate status

✅ **GATE PASSED** — all Section-A items (AR-1…AR-6) Resolved with the user's explicit decisions
(two AskUserQuestion rounds, 2026-07-16). Section B (AR-7…AR-14) accepted in bulk as recommended.
Section C is inherited requirements decisions. Zero items deferred within this plan's scope (the RD's
own Phase-B forks stay deferred by RD AR #17 and the RD's Should-Have list).
