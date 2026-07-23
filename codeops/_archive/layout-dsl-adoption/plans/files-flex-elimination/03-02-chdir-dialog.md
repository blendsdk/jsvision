# 03-02 — `ChDirDialog` flex tree

> Implements RD-01 FR-1/FR-2/FR-5 for `packages/files/src/dialog/chdir-dialog.ts`. Same approach as
> [03-01](03-01-file-dialog.md); only the derivation differs.

## 1. Constructor changes

- **Drop** `this.layout = { ...this.layout, padding: 0 }` (`:93`) and its comment (AR-7).
- **Keep** `resizable = true`, `minWidth = 48`, `minHeight = 18` (AR-8).
- **Delete** the `growItems` field (`:82`), `captureGrowItems([...])` (`:125-130`), the `onResized()`
  override (`:146-151`), and the grow imports (`:16-18`).
- **Remove** the per-child rect assignments at `:102`, `:104`, `:106`, `:109`, `:111`, `:173`.
- **Replace** the `this.add(...)` sequence (`:115-120`) with `this.add(body)`.
- The `onMount` directory→path binding (`:133-138`) is untouched.

## 2. The tree

```ts
const pathRow = row(grow(this.pathInput), fixed(this.history, 3));
const buttonCol = col({ gap: 1 }, ...this.buttons);

const body = cover(
  col({ padding: { top: 1, right: 2, bottom: 0, left: 2 } },
    fixed(nameLabel, 1),
    fixed(pathRow, 1),
    fixed(spacer({ fixed: 1 }), 1),
    fixed(treeLabel, 1),
    grow(row({ gap: 1 }, grow(this.dirList), fixed(buttonCol, 10))),
  ),
);
this.add(body);
```

Unlike `FileDialog` this needs no outer unpadded wrapper — ChDir has no full-width bottom band, so a
single padded `col` suffices.

## 3. Geometry derivation

Dialog `48 × 18`, `padding: 1` ⇒ content box `{x:1, y:1, w:46, h:16}`. With
`padding {top:1, left:2, right:2}` ⇒ inner content `{x:3, y:2, w:42, h:15}`.

Vertical: four `fixed(…, 1)` rows at `y:2,3,4,5`, then `grow(row)` = `15 − 4 = 11` at `y:6..16`.

`pathRow` `{w:42}`: `grow(pathInput)` = `42 − 3 = 39`; `fixed(history, 3)` at `x = 3 + 39 = 42`.

Bottom `row` (`gap:1`, `w:42`): `grow(dirList)` = `42 − 10 − 1 = 31` at `x:3`;
`fixed(buttonCol, 10)` at `x = 3 + 31 + 1 = 35`.

`buttonCol` `{x:35, w:10, h:11}`, `gap:1`, four buttons × height 2 + three gaps = **exactly 11** — so
no top padding is needed here (contrast `FileDialog`, whose button column starts one row lower).

### Resulting geometry vs today

| Child | Today | After | Δ |
|-------|-------|-------|---|
| `nameLabel` | `(2, 2, 15, 1)` | `(3, 2, 42, 1)` | x +1, stretched |
| `pathInput` | `(3, 3, 39, 1)` | `(3, 3, 39, 1)` | **none** |
| `history` | `(42, 3, 3, 1)` | `(42, 3, 3, 1)` | **none** |
| `treeLabel` | `(2, 5, 15, 1)` | `(3, 5, 42, 1)` | x +1, stretched |
| `dirList` | `(3, 6, 30, 10)` | `(3, 6, 31, 11)` | w +1, h +1 |
| `buttons[i]` | `(35, 6+3i, 10, 2)` | `(35, 6+3i, 10, 2)` | **none** |

> Same falsification caveat as 03-01 §3 — asserted in the red step before implementing.
> `history` landing unchanged at `(42,3,3,1)` is what keeps `history-files.spec.test.ts` intact (AR-6).

## 4. Tab order (invariant — RD-01 FR-3)

Focusable descendants in tree order: `pathInput` → `dirList` → `buttons[0..3]`
(OK, Chdir, Revert, Help). `History` and both `Label`s are non-focusable.
