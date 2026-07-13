# Current State: Files package reuse points

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

RD-09 is **composition-first**: it stands up a new package on top of shipped, tested `@jsvision/ui` +
`@jsvision/core` facilities. This doc records what exists (verified in-repo, `file:line`), so the specs
reference rather than re-derive. The RD's passed preflight already re-verified every reuse claim against
primary sources; this confirms the exact construction surfaces the plan depends on.

## Reuse surface — `@jsvision/ui` (all exported from `src/index.ts`)

| Facility | Where | Used by | Notes |
|----------|-------|---------|-------|
| `Dialog` (+ `valid()` gate, `execView` modality, `ModalHostAware`) | `dialog/dialog.ts:53` (`DialogOptions` `:38`) | `FileDialog`, `ChDirDialog`, the local error dialog | `extends Window`; `resizable=false`/`zoomable=false`; `valid(cmd)` = child-invalid sweep + refocus; `postProcess` catches button commands; Esc/`[×]`→`cancel`. Gray `dialog` frame role. |
| `ListView<T>` / `ListBox` | `list/list-view.ts:43` / `list/list-box.ts` | `FileList` (extends `ListView<DirEntry>`), `DirList` (extends `ListBox`) | `ListViewOptions<T>` (`:21`): `items: Signal<T[]>`, `getText`, `focused`/`selected` signals, `onSelect`, `command`, `sorted`, `typeAhead`, `roles`. `[rows fr \| bar 1]`; **hard-owns a vertical right-edge `ScrollBar`** (no injection/orientation seam); `rows` is the focus target. **Single-column today** — PA-14 adds `numCols` **and** an injectable/orientable-bar seam (FileList takes the decoded bottom bar). |
| `ScrollBar` | `scroll/scroll-bar.ts` | dialogs' list/tree scrollbars | Passive `TScrollBar` chrome; value = the shared `focused` signal. |
| `Input` (+ `filter` validator) | `controls/input.ts` (`InputOptions`) | `FileInput` (extends `Input`), `ChDirDialog` path field | Single-line editor over a two-way `Signal<string>`; `valid()`; `filter('charset')` live-reject; protected editing fields. |
| `Label`, `Button`, `Text` | `controls/{label,button,text}.ts` | dialog labels/buttons | `Label` = postProcess hotkey linked to a control; `Button` = `[ text ]` + shadow, `activate→ev.emit(command)`. |
| `History` | `dropdown/` (`dropdown/index.ts`, exported `index.ts:100`) | Should-Have dropdown on both inputs (PA-9) | RD-14 `THistory` decode; composes its own internal `openAnchoredPopup` (which stays **internal** to `dropdown/` — not re-exported). No `dropdown/` edit needed. |
| `okButton`/`cancelButton` + `Commands` | `dialog/buttons.ts`, `status/commands.ts` | error dialog OK, dialog buttons | `Commands.ok`/`cancel`/… constants. |

## Reuse surface — `@jsvision/core` (exported from `engine/index.ts`)

| Facility | Where | Used by |
|----------|-------|---------|
| `sanitize` | `engine/index.ts:122` (`safety/sanitize.ts`) | AC-14 — every name drawn through it (the `DrawContext`/`ScreenBuffer.set` boundary already applies it, `buffer.ts:193`) |
| `ScreenBuffer` (+ `.clone()`) | `engine/index.ts:56` | via `DrawContext` in the view draws |
| `defaultTheme` / `Theme` | `engine/index.ts:157` | the 0-or-1 `fileInfo` role branch (PA-6); the reused `dialog`/`input`/`list*`/`staticText`/`label`/`button` roles |
| `Color`, `encode()` | `color/` | role/attr resolution; the `fileInfo` byte if added |

## Packaging mechanics (verified)

- **Workspaces** — root `package.json:12` globs `packages/*`; a new `packages/files/` is picked up
  automatically (no root edit). **Turborepo** — `turbo.json` pipeline (`build`/`typecheck`/`test`/
  `test:e2e`/`check:deps`) applies per package; no edit.
- **Version sync (PA-5)** — `scripts/sync-versions.mjs:71` skips `pkg.private === true`; `"private": true`
  in the new `package.json` excludes `@jsvision/files` with **no skip-list edit**.
- **Package scaffold template** — mirror `packages/ui/`: `package.json` (`"private": true`, `type:module`,
  `exports` → `dist/index.js`, scripts `build`/`typecheck`/`test`/`test:e2e`/`check:deps`, deps
  `@jsvision/ui: "*"` + `@jsvision/core: "*"`), `tsconfig.json` (`extends ../../tsconfig.base.json`,
  `rootDir:src`/`outDir:dist`), `vitest.config.ts` (the two-project unit/e2e split, copied verbatim).
- **`check:deps`** — `node ../../scripts/check-no-native-deps.mjs .` per package; the default `node:fs`/
  `node:path`/`node:os` impl uses only built-ins ⇒ passes.

## The gap PA-14 closes

`ListRows` (`list/list-rows.ts`) draws a **single** column (`getText(item)` at column 1, one item per
row) and `ListView` (`list/list-view.ts:75`) **hard-owns a vertical right-edge `ScrollBar`** with no
injection/orientation seam. `TFileList` is `TSortedListBox(bounds, 2, sb)` (`tfillist.cpp:64`) — **2
columns** with the dialog-supplied bar drawn **horizontally at the bottom** `(3,14,34,15)`. So PA-14 adds
**two** additive, non-breaking seams to `ListRows`/`ListView`: (1) `numCols` (default 1) — `TListViewer`'s
column-major flow + `│` divider (decoded against `tlstview.cpp`); (2) an injectable/orientable-`ScrollBar`
seam (default = today's owned vertical bar) so `FileList` takes the decoded bottom bar. **Scroll model
stays vertical** — the passed bar is `TListViewer`'s vScrollBar (`tlistbox.cpp:30`), `numCols` only
reshapes the *draw* + the bar *step*; not a horizontal-paging model. This is the `numCols` work RD-11
reserved for "→ RD-07 (AR-104)"; the "single column only" JSDoc in `list-view.ts`/`list-rows.ts` is
corrected when the seams land.

## Fidelity source of truth

The original C++ is checked out at `/home/gevik/workdir/github/tvision`. GATE-1/GATE-2 decode/diff the
files named in the RD decode table: `tfildlg.cpp`, `tfillist.cpp`, `tfilecol.cpp`, `stddlg.cpp`,
`tdirlist.cpp`, `tchdrdlg.cpp`, `tlstview.cpp`, glyphs `tvtext1.cpp:119-124`, palette `dialogs.h:80-92` +
`cpAppColor`, wildcard `source/platform/findfrst.cpp:162-186`.
