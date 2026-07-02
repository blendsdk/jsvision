# Discovery Notes — RD-12+ High-value controls (make_requirements)

> **Feature**: jsvision-ui · **Started**: 2026-07-02 · **Mode**: Full Discovery
> **Resume**: `make_requirements --continue`

## Confirmed scope (Phase 1)
- **AR-125** Full set of ~6 sibling RDs drafted now, MVP-phased inside (not a thin slice).
- **AR-126** Sliced **by mechanism** (~6 RDs).
- **AR-127** tvdemo = **aspirational north-star**; acceptance = per-control TV-parity + kitchen-sink story.

## The bucket (component-map §6, Tier-2)
History (THistory) · ComboBox (new) · Tree (TOutlineViewer) · Tabs (new) · Table/DataGrid
(multi-col TListViewer + RD-11 deferred numCols, AR-103/104) · ProgressBar/Spinner (new) ·
Surface/SurfaceView (TDrawSurface/TSurfaceView).

## LOCKED sibling-RD skeleton (AR-126/128/129)
- **RD-14 — Input dropdowns** (History + ComboBox) — **MVP**. Shared anchored-popup + Input binding.
- **RD-15 — Tree** (TOutlineViewer expand/collapse virtual list) — **MVP**.
- **RD-16 — Table/DataGrid** (multi-column grid; realizes RD-11 deferred numCols) — **MVP**.
- **RD-17 — Tabs** (new tabbed layout container) — Later.
- **RD-18 — Feedback** (ProgressBar + Spinner) — Later.
- **RD-19 — Surface** (Surface + SurfaceView; offscreen cell buffer + viewport) — Later.
Numbering: contiguous RD-14…RD-19 (AR-128). MVP = RD-14/15/16 (AR-129).

## Foundation (done, reused): RD-01 reactive · RD-02 layout · RD-03 view/group · RD-04 event/focus/modal ·
## RD-05 app-shell (overlay + capture seams) · RD-06/07 controls (Input/Cluster/validators/caret) ·
## RD-11 containers (ListView/Scroller/ScrollBar/Dialog). Core: ScreenBuffer, theme.

## Open (next): RD numbering scheme · per-RD scope in/out · sibling dependency order · MVP phasing ·
## per-RD Zero-Ambiguity gates (AR-128+).

## AR ledger: AR-125..161 recorded. Next free: AR-162.
## RD-14 (Input dropdowns) AUTHORED ✅ → RD-14-input-dropdowns.md (AR-130..140; GATE-1 History decode).
## RD-15 (Tree) AUTHORED ✅ 2026-07-02 → RD-15-tree.md (AR-141..150; GATE-1 TOutlineViewer decode — graphChars "\x20\xB3\xC3\xC0\xC4\xC4+\xC4", ←→ collapse/expand override).
## RD-16 (Table/DataGrid) AUTHORED ✅ 2026-07-02 → RD-16-table.md (AR-151..161). GATE-1 finding: TV has NO table class; TListViewer::numCols is a newspaper-flow single-field list (item=j*size.y+i+topItem), NOT a grid. RD-16 = real DataGrid<T> as a documented TV-extension on the TListViewer spine — rows/│-divider(getColor5=listDivider)/cpListViewer row colours/virtual-scroll FAITHFUL; header + heterogeneous Column<T>[] + click-sort the flagged extension. Typed Column<T> {title,accessor,width,align?,compare?}; sizing fixed|fr|auto via RD-02 solveTrack + HScroll; sticky header + ▲▼ sort (reuse RD-11 sorted); row-granular select; Signal<T[]>; new src/table/; ONE additive header theme role @ plan GATE-1 (row/divider roles already exist theme.ts:222-225). This is the LAST MVP sibling (AR-129).
## Next step: RD-17 (Tabs — new tabbed layout container) — GATE-1 decode + AR block (AR-162+). Then RD-18 Feedback (ProgressBar+Spinner), RD-19 Surface. MVP set (RD-14/15/16) COMPLETE after RD-16; RD-17..19 are the Later phase.
