# 03-04 — Machinery deletion

> Implements RD-01 FR-5. This is the payoff the whole plan exists for: the coordinate-reflow engine
> is **removed**, not re-expressed.

## 1. What is deleted

| Artifact | Lines | Note |
|----------|-------|------|
| `packages/files/src/dialog/grow.ts` | 70 | `GrowMode` enum + `growRect` |
| `packages/files/src/dialog/grow-dialog.ts` | 50 | `GrowItem`, `captureGrowItems`, `applyGrowMode` |
| `FileDialog.growItems` + `captureGrowItems` call + `onResized()` | ~12 | `file-dialog.ts:108,186-193,196-201` |
| `ChDirDialog.growItems` + `captureGrowItems` call + `onResized()` | ~10 | `chdir-dialog.ts:82,125-130,146-151` |
| `packages/files/test/grow.spec.test.ts` | 88 | Unit test of the removed helper (RD-02 NFR-3: **delete**) |
| `packages/files/test/file-dialog-resize.spec.test.ts` | 75 | Asserts removed grow-mode rects (**delete**) |

Plus six now-unused import lines (`file-dialog.ts:23-25`, `chdir-dialog.ts:16-18`).

**Net source delta: −2 files, ≈ −140 source lines.**

## 2. Why nothing is lost

- **Resize reflow** — the flex pass re-solves every descendant from the dialog's new rect in one
  traversal. `applyGrowMode` replayed N per-child rect writes to achieve the same thing (RD-02
  NFR-5 expects this to be equal-or-better, never worse).
- **The min-size floor** — enforced by the `Window` resize path, which this plan does not touch.
  `captureGrowItems` recorded **no** per-child minimum, so no per-child floor is being dropped. This
  is why the `grow(v, { min })` support added in #113 is not needed here (RD-01 FR-5).
- **The public API** — neither file is re-exported; `packages/files/src/index.ts` is byte-unchanged
  (AC-2).

## 3. The done-criterion (RD-01 AC-5)

```bash
grep -r "grow-dialog\|captureGrowItems\|applyGrowMode\|GrowMode\|growRect" packages/*/src
```

Must return **zero matches**. Run it as an explicit task step, not as an afterthought — a stale
import is exactly the kind of residue that typechecks fine in one package and breaks another.

> Also confirm `dist/dialog/grow*.d.ts` disappears on the next build; the stale artifacts currently
> present under `packages/files/dist/` are from a previous build, not tracked sources.

## 4. Ordering constraint

The deletion **must** come after both dialog rebuilds (03-01, 03-02) are green. Deleting first
leaves both constructors referencing missing symbols and makes the intermediate state untypecheckable,
which would block the per-task verify the execution protocol requires.
