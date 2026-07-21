# 03-01 — `FileDialog` flex tree

> Implements RD-01 FR-1/FR-2/FR-5 for `packages/files/src/dialog/file-dialog.ts`. Arrangement is
> preserved per AR-1; container paddings are chosen so most children keep their current cells.

## 1. Constructor changes

- **Drop** `this.layout = { ...this.layout, padding: 0 }` (`:116`) and its comment block — the base
  `Dialog`'s `padding: 1` becomes the content box (AR-7).
- **Keep** `resizable = true`, `minWidth = 49`, `minHeight = 19` (AR-8).
- **Delete** the `growItems` field (`:108`), the `captureGrowItems([...])` call (`:186-193`), the
  `onResized()` override (`:196-201`), and the three grow imports (`:23-25`).
- **Remove** the per-child `layout = { position:'absolute', rect }` assignments at `:132`, `:142`,
  `:150`, `:152`, `:157-160`, `:162`, `:170`, `:236`.
- **Replace** the flat `this.add(...)` sequence (`:175-182`) with a single `this.add(body)`.
- `buttonLabels` and the `buttons` array keep being populated in construction order — load-bearing
  for tests (AR-11) and for tab order.

## 2. The tree

```ts
const inputRow = row(grow(this.fileInput), fixed(this.history, 3));

const leftCol = col(
  fixed(inputLabel, 1),
  fixed(inputRow, 1),
  fixed(spacer({ fixed: 1 }), 1),
  fixed(filesLabel, 1),
  grow(this.fileList),
  fixed(this.listBar, 1),
);

const buttonCol = col({ padding: { top: 1, right: 0, bottom: 0, left: 0 }, gap: 1 }, ...this.buttons);

const body = cover(
  col(
    grow(col({ padding: { top: 1, right: 2, bottom: 0, left: 2 } }, grow(row({ gap: 1 }, grow(leftCol), fixed(buttonCol, 11))))),
    fixed(this.fileInfoPane, 2),
  ),
);
this.add(body);
```

Every non-self-measuring child carries an explicit size (AR-15). The outer `col` has **no** padding
so the info pane can span the full frame interior, exactly as today; the inner `col` carries the
`left/right: 2` inset that the body content needs.

## 3. Geometry derivation

Dialog `49 × 19`, `padding: 1` ⇒ `cover()` content box = `{x:1, y:1, w:47, h:17}` (dialog-local).

Outer `col` (padding 0, vertical): `grow(inner)` → `h = 17 − 2 = 15` at `y:1`; `fixed(infoPane, 2)`
→ `y:16`, `x:1`, `w:47`.

Inner `col` at `{1,1,47,15}` with padding `{top:1, left:2, right:2}` ⇒ content `{x:3, y:2, w:43, h:14}`.

Inner `row` (`gap:1`, `w:43`): `grow(leftCol)` = `43 − 11 − 1 = 31` at `x:3`; `fixed(buttonCol, 11)`
at `x = 3 + 31 + 1 = 35`.

`leftCol` `{x:3, w:31, y:2, h:14}` — `1+1+1+1+1 = 5` fixed rows, so `grow(fileList)` = `14 − 5 = 9`.

`buttonCol` `{x:35, w:11, h:14}` with `padding.top:1` and `gap:1`; `Button.measure().height = 2`, and
`align:'stretch'` gives each button the full `11` width.

`inputRow` `{w:31}`: `grow(fileInput)` = `31 − 3 = 28`; `fixed(history, 3)` at `x = 3 + 28 = 31`.

### Resulting geometry vs today

| Child | Today | After | Δ |
|-------|-------|-------|---|
| `inputLabel` | `(2, 2, 3+len, 1)` | `(3, 2, 31, 1)` | x +1, stretched |
| `fileInput` | `(3, 3, 28, 1)` | `(3, 3, 28, 1)` | **none** |
| `history` | `(31, 3, 3, 1)` | `(31, 3, 3, 1)` | **none** |
| `filesLabel` | `(2, 5, 6, 1)` | `(3, 5, 31, 1)` | x +1, stretched |
| `fileList` | `(3, 6, 31, 8)` | `(3, 6, 31, 9)` | h +1 (absorbs dead row `y:15`) |
| `listBar` | `(3, 14, 31, 1)` | `(3, 15, 31, 1)` | y +1 |
| `fileInfoPane` | `(1, 16, 47, 2)` | `(1, 16, 47, 2)` | **none** |
| `buttons[i]` | `(35, 3+3i, 11, 2)` | `(35, 3+3i, 11, 2)` | **none** |

> **This derivation is a hypothesis to be falsified in the red step, not an assumption.** The
> execution plan asserts these values *before* implementing (RD-02 test-order discipline). If the
> solver disagrees, the plan records a deviation and the numbers — not the tree — are corrected.
>
> Two consequences ride on it: `history-files.spec.test.ts` **survives unedited** (AR-6), and the
> `fileInput`/`fileInfoPane`/button assertions in `file-dialog.spec.test.ts` survive too, leaving
> only the label / list / bar lines to re-baseline.

## 4. Resize

`onResized()` is deleted. On drag-resize the `Window` path updates the dialog's own `layout.rect`;
the flex pass then re-solves every descendant in one traversal. `grow(fileList)` and
`grow(leftCol)` absorb the new space, `fixed` children keep their extents, and the info pane stays
flush to the bottom interior row — reproducing grow-mode's intent without its machinery.

## 5. Tab order (invariant — RD-01 FR-3)

Focusable descendants, in tree order: `fileInput` → `history`(non-focusable, skipped) →
`fileList` → `listBar` → `buttons[0..n]`. The nested `col`/`row` Groups are traversed by the #122
tree-order `advance()`. `History` is not focusable and never was (it opens on click or Alt+Down).
