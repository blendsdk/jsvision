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

## AR ledger: AR-125..150 recorded. Next free: AR-151.
## RD-14 (Input dropdowns) AUTHORED ✅ → RD-14-input-dropdowns.md (AR-130..140; GATE-1 History decode).
## RD-15 (Tree) AUTHORED ✅ 2026-07-02 → RD-15-tree.md (AR-141..150; GATE-1 TOutlineViewer decode — graphChars "\x20\xB3\xC3\xC0\xC4\xC4+\xC4", ←→ collapse/expand override).
## Next step: RD-16 (Table/DataGrid — multi-column TListViewer + RD-11 numCols) — GATE-1 decode + AR block (AR-151+). Then RD-17 Tabs, RD-18 Feedback, RD-19 Surface.
