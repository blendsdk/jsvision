# Requirements — files-flex-elimination

> **Source**: [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md) (Tier 2, files) ·
> [RD-02](../../requirements/RD-02-non-functional-and-verification.md)
> **GitHub**: [#120](https://github.com/blendsdk/jsvision/issues/120)

## In scope

1. **`FileDialog`** (`packages/files/src/dialog/file-dialog.ts`) — children rebuilt as a flex tree;
   `padding: 0` override dropped; `growItems` + `onResized()` removed. (03-01)
2. **`ChDirDialog`** (`packages/files/src/dialog/chdir-dialog.ts`) — same treatment. (03-02)
3. **`errorBox`** (`packages/files/src/dialog/error-dialog.ts`) — children flexed **and** the dialog
   height derived from the wrapped message. (03-03)
4. **Machinery deletion** — `grow-dialog.ts` and `grow.ts` removed outright. (03-04)
5. **`wrapText` promoted to public ui API** — moved to `packages/ui/src/controls/measure.ts` beside
   `stringWidth` and exported from the barrel. (03-03, AR-4)
6. **Oracle handling** per the RD-02 NFR-3 table, plus the new invariant oracles. (07)

## Out of scope

- Any behavior change: entries, signals, keyboard + mouse, validation, focus/tab order, theme roles
  and glyphs, `minWidth`/`minHeight` floors, and public return values are invariant (RD-01 FR-2).
  The single sanctioned exception is the errorBox **height**, per AR-2/AR-3.
- The `FileList` / `DirList` / `FileInput` / `FileInfoPane` widget internals — untouched; they are
  only re-parented. Verified to carry no self-width dependency (02 §4).
- The keep-absolute set (RD-01 FR-4) — the dialogs themselves stay absolutely placed `Window`s on
  the desktop; only their *children* are flexed.
- Datagrid (#116) and `setLayout` (#117).
- New kitchen-sink stories — both already exist (AR-12).

## Acceptance criteria

| # | Criterion | Source |
|---|-----------|--------|
| AC-1 | `grow-dialog.ts` and `grow.ts` no longer exist, and `grep -r "grow-dialog\|captureGrowItems\|applyGrowMode\|GrowMode\|growRect" packages/*/src` returns zero matches. | RD-01 AC-5 |
| AC-2 | The `@jsvision/files` barrel (`src/index.ts`) is byte-unchanged. | RD-01 AC-5 |
| AC-3 | Every behavioral and security test in `packages/files/test` passes **unedited**. | RD-02 NFR-1, NFR-6 |
| AC-4 | Each of the three dialogs has a traversal-order spec test asserting an explicit ordered focusable list equal to the pre-conversion order. | RD-02 NFR-2 |
| AC-5 | Geometry oracles are handled exactly per the 07 disposition table — no assertion is silently loosened. | RD-02 NFR-3 |
| AC-6 | A resize *invariant* spec oracle asserts containment, list growth, and the min-size floor after a real drag-resize. | AR-5 |
| AC-7 | `errorBox` shows a >54-character message in full (no clipping), and its OK button remains the sole tab stop. | AR-3, AR-9 |
| AC-8 | Both kitchen-sink stories still pass the headless smoke test. | AR-12, CLAUDE.md |
| AC-9 | `yarn verify` green; `check:deps` green; `yarn lint:fix` run before the PR-bound push. | RD-02 NFR-7 |
| AC-10 | `wrapText` carries public JSDoc with an `@example` and `check:docs` passes; the plugin API-ref snapshot is regenerated. | CLAUDE.md |
| AC-11 | No new per-frame allocation on the resize path; `yarn bench` breaches no ceiling. | RD-02 NFR-5 |

## Security

Layout-only composition change. No new input, path, shell, or query sink is introduced; the
`FileSystem` seam and all validators are untouched. AC-3 is the falsifiable proof — the existing
file-path and validation oracles must pass without edit (RD-02 NFR-6).
