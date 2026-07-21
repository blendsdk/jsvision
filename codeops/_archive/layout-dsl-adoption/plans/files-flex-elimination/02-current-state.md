# Current State — `@jsvision/files` dialogs

All facts below are verified against the working tree at plan time, with `file:line` citations.

## 1. The grow-mode import graph (verified)

```
grow.ts  ──────────────► grow-dialog.ts ──┬──► file-dialog.ts
  (GrowMode, growRect)   (GrowItem,        └──► chdir-dialog.ts
                          captureGrowItems,
                          applyGrowMode)
```

- `file-dialog.ts:23-25`, `chdir-dialog.ts:16-18` are the **only** source importers.
- `grow-dialog.ts:12` imports `growRect` from `grow.js`.
- **Neither file is re-exported** from `packages/files/src/index.ts` — the barrel has no grow entry.
- The only other reference anywhere is `test/grow.spec.test.ts:17`, a unit test of the helper.

⇒ Both files are private implementation detail. Deleting them is not a public API change (AC-2).

## 2. `layout.rect` readers — the T-AO1 landmine check

A full sweep of `packages/*/src` for `.layout.rect` found exactly two readers inside `files`:

| Site | What it reads | Fate |
|------|---------------|------|
| `file-dialog.ts:198-199` | `this.layout.rect` — the **dialog's own** rect | Deleted with `onResized()` |
| `chdir-dialog.ts:148-149` | same | Deleted with `onResized()` |

Neither reads a *child's* rect, and neither is an `x.layout.rect ?? FALLBACK` silent-fallback site.
The dialogs themselves remain absolutely-placed `Window`s (RD-01 FR-4), so their own rect keeps
existing. **This conversion carries no T-AO1-class hidden-host or silent-fallback risk.**

## 3. Current absolute geometry

**`FileDialog`** — `49 × 19`, `padding: 0` override at `file-dialog.ts:116`, `minWidth/Height 49/19`:

| Child | Rect | Source |
|-------|------|--------|
| `inputLabel` | `(2, 2, 3+len, 1)` | `:157-160` |
| `fileInput` | `(3, 3, 28, 1)` | `:150` |
| `history` | `(31, 3, 3, 1)` | `:152` |
| `filesLabel` | `(2, 5, 6, 1)` | `:162` |
| `fileList` | `(3, 6, 31, 8)` | `:142` |
| `listBar` | `(3, 14, 31, 1)` | `:132` |
| `fileInfoPane` | `(1, 16, 47, 2)` | `:170` |
| `buttons[i]` | `(35, 3 + 3i, 11, 2)` | `:236` |

Row `y:15` is dead space. Add-order (⇒ tab order): inputLabel, fileInput, history, filesLabel,
fileList, listBar, fileInfoPane, buttons… (`:175-182`).

**`ChDirDialog`** — `48 × 18`, `padding: 0` at `chdir-dialog.ts:93`, `minWidth/Height 48/18`:

| Child | Rect | Source |
|-------|------|--------|
| `nameLabel` | `(2, 2, 15, 1)` | `:106` |
| `pathInput` | `(3, 3, 39, 1)` | `:102` |
| `history` | `(42, 3, 3, 1)` | `:104` |
| `treeLabel` | `(2, 5, 15, 1)` | `:111` |
| `dirList` | `(3, 6, 30, 10)` | `:109` |
| `buttons[i]` | `(35, 6 + 3i, 10, 2)` | `:173` |

**`errorBox`** — `width = min(60, max(24, len+6))`, `height = 7`, `centered`; `text` at
`(2, 2, width-4, 1)`, `ok` at `(centred, height-3, 10, 2)` (`error-dialog.ts:39-49`).

> **Latent bug:** the text rect is height 1, but `Text.draw` word-wraps to the view width
> (`text.ts:160`). A message longer than ~54 chars wraps to ≥2 lines and everything past line 1 is
> clipped. AR-3 fixes this.

## 4. Widget self-sizing (drives every `fixed`/`grow` choice)

`measure()` is implemented **only** by `Text` (`ui/controls/text.ts:145`) and `Button`
(`ui/controls/button.ts:117`, returning `{ width: labelWidth + 4, height: 2 }`).

**Not implemented** by `Label`, `Input`, `History`, `ScrollBar`, `FileList`, `DirList`,
`FileInfoPane`, or a bare `col()`/`row()` Group. Each of those collapses to `{0,0}` as an `auto`
flex child and must be given an explicit size (AR-15).

Verified clean: none of `FileList`, `DirList`, `FileInfoPane` reads its own `bounds` or `layout.rect`
for internal geometry — `FileInfoPane` uses `ctx.size.width` at draw time
(`file-info-pane.ts:74`), which is the clipped paint context and is correct under flex.

## 5. Layout-engine semantics relied on

- `LayoutProps`: `direction`, `justify`, `align` (**default `'stretch'`** — cross-axis children fill
  the container width), `gap`, `padding` (uniform or per-side), `position` (`layout/types.ts:66-85`).
- `cover(v)` sets `position:'fill'` → resolves to the **parent's content box**, i.e. inside the
  parent's padding (`view/dsl/absolute.ts:69-72`).
- `grow(v, n, { min })` supports a cell floor as of #113 (`view/dsl/flex.ts:170`). Not needed here —
  grow-mode captured no per-child minimum, so no floor is lost (RD-01 FR-5).
- A flex child carries **no** `layout.rect`; geometry must be read from solved `bounds` after a
  `flush()`.

## 6. Test surface

Full inventory in [07-testing-strategy.md](07-testing-strategy.md). Two facts shape the plan:

- **No test uses `dlg.children[i]` / `.find` / `.filter`** anywhere in `packages/files/test`.
  Geometry is reached through named fields (`dlg.fileInput`, `dlg.buttons[0]`), so deeper nesting
  breaks no locator (AR-11).
- **`errorBox` has zero geometry tests** — the only reference is an export-surface check at
  `files.packaging.spec.test.ts:31,57,64`. Its resize is therefore oracle-free.
