# 03-05: History · openers · `fileInfo` role · `numCols` · packaging · showcase

> **Parent**: [Index](00-index.md) · **Covers**: AC-15/AC-16/AC-17 + Should-Haves · **AR**: PA-5/PA-6/PA-8/PA-9/PA-12/PA-14

---

## History dropdown (Should-Have, PA-9) — no `dropdown/` edit

Construct `new History({ link, historyId })` (the RD-14 `HistoryOptions` API — **no rect/coords ctor**;
its popup anchors to the linked `Input`) on the `FileInput` (FileDialog) and the path `Input`
(ChDirDialog), **positioned via absolute layout** at the decoded rects `(31,3,34,4)` / `(42,3,45,4)`,
each with a per-dialog recent-paths id. `History` composes its own internal `openAnchoredPopup` —
**internal to `dropdown/`, not re-exported, not edited**. The RD-14 `history.*`/`combo-box.*` suites must
stay green.

## Convenience openers (Should-Have, PA-8) — `src/openers.ts`

Thin async wrappers over the dialogs (a `Promise` over `execView`):

```ts
// `host` = an `execView`-capable app handle exposing modal open + desktop mounting — e.g. the
// `createApplication` result (`{ loop, desktop }`) or the kitchen-sink `StoryContext.execView` seam.
// NOT `ModalHost` (which has only `endModal`/`isCommandEnabled`, no `execView`; preflight PF-002).
type ExecHost = { execView<R>(view: View): Promise<R>; /* + a desktop to mount into */ };
export function openFile(opts: {
  host: ExecHost; wildcard?: string; directory?: string; fs?: FileSystem; save?: boolean;
}): Promise<string | null>;                       // resolved absolute path, or null (cancel)
export function changeDir(opts: {
  host: ExecHost; directory?: string; fs?: FileSystem;
}): Promise<string | null>;
```
`fs` defaults to `nodeFileSystem`; `save:true` selects the save-mode button set. Because `execView` does
**not** mount the view (`event-loop.ts:193` — "caller has added `view` to the tree"), each opener runs the
shipped modal lifecycle — **add the dialog to `host`'s desktop → `await host.execView(dialog)` → remove in
`finally`** (`kitchen-sink/shell.ts:195-205`) — reusing RD-04 `execView`/`endModal`; no new modality
mechanism.

## `filter` hook (Should-Have, PA-10)

An optional `filter(entry: DirEntry) => boolean` on `FileList`, AND-ed with the wildcard in the scan
`computed` (see [03-01](03-01-fs-seam-and-cores.md)). Never replaces the faithful wildcard.

## The `fileInfo` theme-role branch (PA-6, AC-15) — 0-or-1 additive

At **GATE-1 (Phase 1)** resolve `cpInfoPane`'s `getColor(1) = 0x1E` (`stddlg.cpp:67`) through the
gray-dialog → `cpAppColor` chain to a raw attribute:
- **If already covered** by a shipped role → reuse it; **0 new roles**.
- **If distinct** → add **exactly one** additive core role `fileInfo` (byte-frozen) in
  `packages/core/src/engine/color/theme.ts` + re-export path, and **append `fileInfo` to the closed-set
  theme-guard allowlists** (the RD-21 `colorMarker`/PA-14 pattern — `grep -rn "ONLY\|additive" packages/ui/test/*theme*`),
  keeping every existing byte assertion. Additive + non-breaking either way; `encode()` must not throw.

## `numCols` + injectable-bar seam on `@jsvision/ui` `ListRows`/`ListView` (PA-14, additive) — AC per PA-14

Two additive, non-breaking seams generalizing `ListView`/`ListRows` toward `TListViewer`:
1. **`numCols?: number`** (default `1`) on `ListRowsOptions`/`ListViewOptions` — `TListViewer`'s
   column-major flow (`item = j*size.y + i + topItem`, colWidth = `size.x/numCols + 1`) + `│` interior
   dividers (`getColor(5)`) in `ListRows.draw()`, decoded against `tlstview.cpp:draw`. 1-column calls
   unchanged.
2. **An injectable/orientable `ScrollBar` seam** — default unchanged (ListView owns a vertical
   right-edge bar); an override lets a caller supply/position the bar (mirroring `TListViewer`'s
   bar arguments), so `FileList` is handed the decoded **horizontal-rendered bottom** bar at
   `(3,14,34,15)`. The override is **bind-to-external-bar** — the `FileDialog` owns + places the bar as
   an absolute sibling; ListView shares `focused` + drives `setRange` and does **not** lay it out
   internally (its default bar is a `[rows fr\|bar 1]` child at the right edge). **Scroll model stays
   vertical** — that bar is the vScrollBar (`tlistbox.cpp:30`),
   driving `topItem`/`focused` with step `pgStep=size.y*numCols`/`arStep=size.y`; `numCols` reshapes
   only the draw, not the scroll model.

This lands the `numCols` work RD-11 reserved for "→ RD-07 (AR-104)"; when the seams land, **update the
"single column only" JSDoc** in `list-view.ts` + `list-rows.ts` so it no longer reads as
single-column-only (Phase 1 task 1.9). **Regression guard:** RD-11 `listview`/`listbox`/`scroller`/
`fidelity`/`containers.packaging` suites stay green (both seams default to today's behaviour). `FileList`
passes `numCols: 2` + the bottom bar.

## Packaging (AC-16, PA-5) — new `packages/files/`

- `package.json` (`"name": "@jsvision/files"`, **`"private": true`**, `type:module`, `exports` →
  `dist/index.js`, scripts `build`/`typecheck`/`test`/`test:e2e`/`check:deps`, deps
  `@jsvision/ui: "*"` + `@jsvision/core: "*"`, devDeps `@types/node`/`vitest`), `tsconfig.json`
  (`extends ../../tsconfig.base.json`), `vitest.config.ts` (the two-project unit/e2e split) — mirroring
  `packages/ui/` verbatim ([02](02-current-state.md)).
- **Barrel `src/index.ts`** — **explicit named re-exports**: the six components (`FileDialog`,
  `FileList`, `FileInput`, `FileInfoPane`, `DirList`, `ChDirDialog`) + the `FileSystem` seam
  (`FileSystem`, `DirEntry`, `FileStat`, `nodeFileSystem`) + `openFile`/`changeDir` + the option types.
- Auto-included by the `packages/*` workspaces glob + the Turbo pipeline (no root/`turbo.json` edit);
  auto-excluded from `sync-versions` via `private:true` (PA-5). `check:deps` passes (built-ins only);
  every file ≤ 500 lines.

## Showcase (AC-17, PA-12) — NON-NEGOTIABLE kitchen-sink

- **Stories (category `Files`)** — `kitchen-sink/stories/file-dialog.story.ts` (id `files/file-dialog`,
  `rd:'RD-09'`) + `chdir-dialog.story.ts` (id `files/chdir-dialog`), both over an **in-memory
  `FileSystem`** (a fixed fake tree, PA-11): render → list/tree nav → focus (info pane updates) → enter a
  dir → echo the resolved path. The leaf components are shown within them. Both pass
  `kitchen-sink.smoke.spec.test.ts`.
- **Canvas note (PF-005)** — the headless smoke canvas is **72×16** (`kitchen-sink.smoke.spec:22-23`),
  but `FileDialog` is 49×**19** and `ChDirDialog` 48×**18** (taller than 16). Each story therefore
  presents a **canvas-fit representative scene** (e.g. the `FileList`+`FileInfoPane` trio, or a
  height-reduced dialog) — **no clipped text** (the kitchen-sink polish rule) — while the **full-size**
  dialog is exercised in the specs + `demo:files`. The smoke's `paintedCells>0` check passes either way.
- **`demo:files`** — `examples/files-demo/main.ts`, headless, ASCII frame per step (render → list-nav →
  focus → enter a dir → type a wildcard → select a file → resolve), matching `demo:color`/`demo:date`;
  `"demo:files"` script + `files-demo.e2e.test.ts`. `packages/examples/package.json` gains a
  `@jsvision/files` dependency.
