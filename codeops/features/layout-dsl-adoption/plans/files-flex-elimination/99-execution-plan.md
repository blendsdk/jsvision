# Execution Plan — files-flex-elimination

> **Implements**: layout-dsl-adoption/RD-01 (Tier 2, files) · **GitHub**: [#120](https://github.com/blendsdk/jsvision/issues/120)
> **CodeOps Skills Version**: 3.10.0
> **Progress**: 0/18 tasks (0%)
> **Last Updated**: 2026-07-19
> **Branch**: `feat/files-flex-elimination` (cut from `feat/dsl-adoptation`; PR retargets to `develop` once #123 lands)
> **Verify**: `yarn verify`
> **Routing**: complex → runs inline on the session model (Opus)

## Phase 1 — Traversal witnesses (green-first, NFR-2)

Captures the pre-conversion focus order so the rebuild is falsifiable. These pass immediately; that
is intended (AR-10).

- [ ] 1.1 ST-01 — `file-dialog-traversal.spec.test.ts`: ordered focusables + full Tab cycle
- [ ] 1.2 ST-02 — `chdir-dialog-traversal.spec.test.ts`: same for `ChDirDialog`
- [ ] 1.3 ST-03 — `error-dialog.spec.test.ts`: OK is the sole tab stop
- [ ] 1.4 Verify — all three green against **unmodified** source; commit as the pre-conversion baseline

## Phase 2 — `wrapText` export (AR-4)

- [ ] 2.1 Move `wrapText` from `controls/text.ts` to `controls/measure.ts` verbatim; re-import in `text.ts`
- [ ] 2.2 Add public JSDoc (lead sentence, `@param`/`@returns`, `@example`) + barrel export
- [ ] 2.3 ST-09 — barrel export + wrap-parity table
- [ ] 2.4 `yarn plugin:sync --fix` (API-ref regen) · verify green

## Phase 3 — `errorBox` (03-03)

- [ ] 3.1 ST-06 + ST-07 spec tests for the new sizing → **red**
- [ ] 3.2 Implement wrap-aware height + `cover(col(grow(text), fixed(row(...), 2)))` → green
- [ ] 3.3 Verify; confirm ST-03 still green

## Phase 4 — `FileDialog` (03-01)

- [ ] 4.1 ST-04 — re-baseline `file-dialog.spec.test.ts` composition block to the 03-01 §3 table → **red**
- [ ] 4.2 Implement the flex tree; drop the `padding: 0` override and the per-child rects → green
- [ ] 4.3 Re-baseline the info-pane line in `file-dialog.impl.test.ts:66`
- [ ] 4.4 Confirm ST-01 still green (tab order survived the nesting) and `history-files.spec` **unedited**
- [ ] 4.5 Verify

## Phase 5 — `ChDirDialog` (03-02)

- [ ] 5.1 ST-05 — re-baseline `chdir-dialog.spec.test.ts` composition block → **red**
- [ ] 5.2 Implement the flex tree → green
- [ ] 5.3 Confirm ST-02 green, `chdir-dialog.impl.test.ts` + `history-files.spec` **unedited**
- [ ] 5.4 Verify

## Phase 6 — Machinery deletion (03-04)

Ordered last by construction — deleting earlier leaves both constructors untypecheckable.

- [ ] 6.1 Delete `grow.ts`, `grow-dialog.ts`, the `growItems` fields, both `onResized()` overrides, and the six imports
- [ ] 6.2 Delete `test/grow.spec.test.ts`; replace `test/file-dialog-resize.spec.test.ts` with ST-08 (invariant oracle)
- [ ] 6.3 Re-baseline `file-dialog-resize.impl.test.ts` — drop exact grow rects, keep the WM drag gesture + containment loop
- [ ] 6.4 AC-1 grep gate returns zero matches; AC-2 barrel diff is empty
- [ ] 6.5 Verify

## Phase 7 — Close out

- [ ] 7.1 Kitchen-sink smoke for both stories (AC-8); `yarn bench` sanity (AC-11)
- [ ] 7.2 `yarn lint:fix`, commit anything it changes (repo prime directive)
- [ ] 7.3 Full `yarn verify` + `check:deps`; open the PR citing RD-01 for every re-derived oracle

## Deviation log

Record here if the red step falsifies a derivation.

| # | Expected (plan) | Actual (solver) | Resolution |
|---|-----------------|-----------------|------------|
| — | — | — | — |

> **Watch item (AR-6):** if `history-files.spec.test.ts` goes red in 4.4 or 5.3, the geometry
> derivation was wrong. Reclassify that file as **re-baseline**, amend RD-02's NFR-3 table, and log
> it above — do **not** quietly edit the oracle.
