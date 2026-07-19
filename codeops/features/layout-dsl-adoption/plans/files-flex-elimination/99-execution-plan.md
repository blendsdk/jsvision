# Execution Plan — files-flex-elimination

> **Implements**: layout-dsl-adoption/RD-01 (Tier 2, files) · **GitHub**: [#120](https://github.com/blendsdk/jsvision/issues/120)
> **CodeOps Skills Version**: 3.10.0
> **Progress**: 20/22 tasks (91%)
> **Last Updated**: 2026-07-19
> **Branch**: `feat/files-flex-elimination` (cut from `feat/dsl-adoptation`; PR retargets to `develop` once #123 lands)
> **Verify**: `yarn verify`
> **Routing**: complex → runs inline on the session model (Opus)

## Phase 1 — Traversal witnesses (green-first, NFR-2)

> **Phase ref**: 7598913fdbf330e70f09dacef1ce2374c8044afe

Captures the pre-conversion focus order so the rebuild is falsifiable. These pass immediately; that
is intended (AR-10).

- [x] 1.1 ST-FE01 — `file-dialog-traversal.spec.test.ts`: ordered focusables + full Tab cycle ✅ (completed: 2026-07-19 18:52)
- [x] 1.2 ST-FE02 — `chdir-dialog-traversal.spec.test.ts`: same for `ChDirDialog` ✅ (completed: 2026-07-19 18:52)
- [x] 1.3 ST-FE03 — `error-dialog.spec.test.ts`: OK is the sole tab stop ✅ (completed: 2026-07-19 18:52)
- [x] 1.4 Verify — all three green against **unmodified** source; commit as the pre-conversion baseline ✅ (completed: 2026-07-19 18:52)

## Phase 2 — `wrapText` export (AR-4)

> **Phase ref**: d6d95f3f

- [x] 2.1 Move `wrapText` from `controls/text.ts` to `controls/measure.ts` verbatim; re-import in `text.ts` ✅ (completed: 2026-07-19 19:20)
- [x] 2.2 Add public JSDoc (lead sentence, `@param`/`@returns`, `@example`) + barrel export ✅ (completed: 2026-07-19 19:20)
- [x] 2.3 ST-FE09 — barrel export + wrap-parity table ✅ (completed: 2026-07-19 19:20)
- [x] 2.4 `yarn plugin:sync --fix` (API-ref regen) · verify green ✅ (completed: 2026-07-19 19:20)

## Phase 3 — `errorBox` (03-03)

> **Phase ref**: 5c2f89b0

- [x] 3.1 ST-FE06 + ST-FE07 spec tests for the new sizing → **red** ✅ (completed: 2026-07-19 19:40)
- [x] 3.2 Implement wrap-aware height + `cover(col(grow(text), fixed(row(...), 2)))` → green ✅ (completed: 2026-07-19 19:40)
- [x] 3.3 Verify; confirm ST-FE03 still green ✅ (completed: 2026-07-19 19:40)

## Phase 4 — `FileDialog` (03-01)

> **Phase ref**: 0e400ce8

- [x] 4.1 ST-FE04 — re-baseline `file-dialog.spec.test.ts` composition block to the 03-01 §3 table → **red** ✅ (completed: 2026-07-19 20:15)
- [x] 4.2 Implement the flex tree; drop the `padding: 0` override and the per-child rects → green ✅ (completed: 2026-07-19 20:15)
- [x] 4.3 Re-baseline the info-pane line in `file-dialog.impl.test.ts:66` ✅ (completed: 2026-07-19 20:15)
- [x] 4.4 Confirm ST-FE01 still green (tab order survived the nesting); `history-files.spec` values unchanged, read mechanism corrected — see D-4 ✅ (completed: 2026-07-19 20:15)
- [x] 4.5 Verify ✅ (completed: 2026-07-19 20:15)

## Phase 5 — `ChDirDialog` (03-02)

> **Phase ref**: 5f076910

- [x] 5.1 ST-FE05 — re-baseline `chdir-dialog.spec.test.ts` composition block → **red** ✅ (completed: 2026-07-19 20:35)
- [x] 5.2 Implement the flex tree → green ✅ (completed: 2026-07-19 20:35)
- [x] 5.3 Confirm ST-FE02 green; `chdir-dialog.impl.test.ts` unedited, `history-files.spec` values unchanged (D-4) ✅ (completed: 2026-07-19 20:35)
- [x] 5.4 Verify ✅ (completed: 2026-07-19 20:35)

## Phase 6 — Machinery deletion (03-04)

Ordered last by construction — deleting earlier leaves both constructors untypecheckable.

- [ ] 6.1 Delete `grow.ts`, `grow-dialog.ts`, the `growItems` fields, both `onResized()` overrides, and the six imports
- [x] 6.2 Delete `test/grow.spec.test.ts`; replace `test/file-dialog-resize.spec.test.ts` with ST-FE08 (invariant oracle) — ST-FE08 landed in Phase 4 (forced by ordering, see D-5); `grow.spec.test.ts` deletion still pending ⏳
- [x] 6.3 Re-baseline `file-dialog-resize.impl.test.ts` — done in Phase 4 (D-5) ✅ (completed: 2026-07-19 20:15)
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
| D-5 | Machinery-deletion test work is Phase 6 | Converting `FileDialog` in Phase 4 immediately invalidates `file-dialog-resize.{spec,impl}.test.ts`, so 6.2's ST-FE08 replacement and 6.3's re-baseline had to land in Phase 4 | Ordering correction, not a scope change. ST-FE08 covers **both** dialogs from the start, so it stays green across Phase 5 too. |
| D-4 | AR-6: `history-files.spec.test.ts` survives **unedited** | The geometry derivation was exactly right — `history` solves to `(31,3,3,1)`, every value in 03-01 §3 confirmed. But `View.bounds` is **parent-relative** (`view/view.ts:64`), so a child nested in flex groups no longer *reads* as dialog-local. | The asserted values are byte-identical; only the measuring instrument changed, from raw `.bounds` to the `renderRoot.originOf` composition already used by the sibling ui plan. Not a re-baseline and not a loosened assertion — the oracle now reads the coordinate it always meant. RD-02's NFR-3 table needs no amendment. |
| D-3 | Phase 2 was a behavior-neutral verbatim move | The JSDoc written around it over-promised on astral characters (AR-16) | Docs corrected, behavior pinned by a spec case, real fix filed as GH #124. The move itself remains verbatim. |
| D-2 | ST-FE09 asserts no wrapped line exceeds the requested width | A glyph wider than the whole width (2-column CJK at width 1) is emitted alone, so the wrap always terminates | Real pre-existing contract detail, not a defect. The oracle now states it explicitly and the promoted public JSDoc documents it. |
| D-1 | 03-01 §5 / 03-02 §4: focusables are `fileList` / `dirList` and `listBar` | Focus is leaf-only, so the Tab stop is `fileList.rows` / `dirList.rows`; `listBar` (a `ScrollBar`) is **not** focusable at all | Mechanical correction — the *user-visible* traversal order is unchanged, so ST-FE01/ST-FE02 assert the real ring. No behavior impact on the conversion. |

> **Watch item (AR-6):** if `history-files.spec.test.ts` goes red in 4.4 or 5.3, the geometry
> derivation was wrong. Reclassify that file as **re-baseline**, amend RD-02's NFR-3 table, and log
> it above — do **not** quietly edit the oracle.
