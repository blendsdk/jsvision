# 07 — Testing Strategy

> Operationalises RD-02 NFR-1…NFR-3 and NFR-6 for this plan. Verify command: `yarn verify` (AR-14).

## 1. Oracle disposition (RD-02 NFR-3)

Exactly one of {**survive** / **re-baseline** / **delete**} per file. Silently loosening an
assertion is not a permitted third path.

| File | Type | Action | Rationale |
|------|------|--------|-----------|
| `grow.spec.test.ts` | spec | **delete** | Unit-tests the removed `growRect`/`GrowMode`. |
| `file-dialog-resize.spec.test.ts` | spec | **delete** | Asserts removed grow-mode rects via `.layout.rect` on children (14 sites) + direct `onResized()` calls. Replaced by ST-FE08. |
| `file-dialog.spec.test.ts` | spec | **re-baseline (partial)** | Composition block only (`:61-68`). Per 03-01 §3, `fileInput`, `fileInfoPane` and both button lines should survive; only `fileList` height and `listBar` y change. Behavioral tests (`:72,89,112,130,144`) untouched. |
| `chdir-dialog.spec.test.ts` | spec | **re-baseline (partial)** | Composition block only (`:47-52`). Per 03-02 §3, `pathInput` and all button lines survive; only `dirList` w/h change. Behavioral tests (`:56,70,86,96`) untouched. |
| `history-files.spec.test.ts` | spec | **survive** | Asserts `history` bounds `(31,3,3,1)` / `(42,3,3,1)`; both derivations preserve them exactly (AR-6). **If the red step falsifies this, it becomes a re-baseline and RD-02's NFR-3 table is amended** — recorded as a plan deviation. |
| `file-dialog.impl.test.ts` | impl | **re-baseline (1 line)** | The exact info-pane bounds at `:66`; the generic frame-containment loop (`:57-64`) survives. |
| `file-dialog-resize.impl.test.ts` | impl | **re-baseline** | Drop the exact grow rects; keep the real WM drag gesture + the containment loop. |
| `chdir-dialog.impl.test.ts` | impl | **survive** | Behavioral only (reactive path field, validation, win32). |
| `multiclick.file-dialog.spec.test.ts` | spec | **survive** | Local-coordinate dispatch, no screen geometry. |
| `files.packaging.spec.test.ts` | spec | **survive** | Export surface + line counts. Watch the line-count assertion — deleting two files may move it. |
| `files-theme.spec.test.ts`, `openers.*`, `file-list.*`, `dir-list.*`, `file-input.*`, `file-info-pane.*`, `scan.*`, `tree.*`, `wildcard.*`, `fs-*`, `file-editor.*` | both | **survive** | Behavioral / widget-internal; no dialog geometry. |
| `docs-site/test/file-dialog.spec.test.ts`, `dialog-reopen.spec.test.ts` | spec | **survive** | Behavioral only. |
| `examples/test/files-demo.e2e.test.ts`, kitchen-sink smoke | e2e/spec | **survive** | Assert "registered + paints ≥1 cell". |

**Net:** delete 2 test files; partially re-baseline 4; everything else passes unedited (AC-3).

## 2. New specification tests

Written spec-first. ST-FE01…ST-FE03 are **green-first witnesses** — NFR-2 requires them to capture the
*pre*-conversion order, so they are authored and passed against today's code, then must stay green
through the rebuild (AR-10). ST-FE04…ST-FE09 are **red-first**.

| ID | File | Assertion | Traces |
|----|------|-----------|--------|
| ST-FE01 | `file-dialog-traversal.spec.test.ts` | Ordered focusable descendants of a mounted `FileDialog` = `[fileInput, fileList, listBar, ...buttons]`; a full Tab cycle visits exactly that sequence and wraps. | AC-4, NFR-2 |
| ST-FE02 | `chdir-dialog-traversal.spec.test.ts` | Same for `ChDirDialog` = `[pathInput, dirList, ...buttons]`. | AC-4, NFR-2 |
| ST-FE03 | `error-dialog.spec.test.ts` | `errorBox`'s only focusable descendant is the OK button; Tab returns to it. | AC-4, AC-7, AR-9 |
| ST-FE04 | `file-dialog.spec.test.ts` | Re-baselined composition rects per 03-01 §3. | AC-5 |
| ST-FE05 | `chdir-dialog.spec.test.ts` | Re-baselined composition rects per 03-02 §3. | AC-5 |
| ST-FE06 | `error-dialog.spec.test.ts` | A 17-char message yields a 5-row dialog; a 120-char message yields a dialog tall enough that `wrapText(msg, width-2).length` rows are all inside the frame — i.e. nothing clips. | AC-7, AR-3 |
| ST-FE07 | `error-dialog.spec.test.ts` | `width` still equals `min(60, max(24, len+6))` — the unchanged half of the sizing contract. | AR-2 |
| ST-FE08 | `file-dialog-resize.spec.test.ts` (new content) | After a real drag-resize: (a) every child's bounds stay inside the frame ring; (b) `fileList.bounds.height` and `.width` strictly increased; (c) resizing below the floor leaves bounds at `49×19`. Properties, not coordinates. | AC-6, AR-5 |
| ST-FE09 | `ui` test | `wrapText` is exported from the barrel and wraps identically to the pre-move private function (a table of message/width → lines). | AC-10, AR-4 |

## 3. Behavior-invariance proof (NFR-1)

AC-3 is the falsifiable claim: **every behavioral and security test passes unedited.** If one fails,
the conversion is wrong — the test is never edited to accommodate it. The highest-value witnesses:

- `chdir-dialog.impl.test.ts` — chdir / revert / validation / win32 paths.
- `file-dialog.spec.test.ts:72-144` — resolve, cancel, wildcard re-filter, error box, save mode.
- `multiclick.file-dialog.spec.test.ts` — double-click activation through the new nesting.
- `files-theme.spec.test.ts` — resolved theme roles unchanged (RD-01's colors-invariant axis).

## 4. Verification gates

- `yarn verify` green per phase (AC-9).
- `grep` gate from 03-04 §3 returns zero matches (AC-1).
- `git diff --exit-code packages/files/src/index.ts` — barrel unchanged (AC-2).
- `yarn workspace @jsvision/examples test` — kitchen-sink smoke for both stories (AC-8).
- `yarn plugin:sync --fix` after the `wrapText` JSDoc lands (AC-10).
- `yarn bench` informational; confirm no ceiling breach (AC-11).

> **Known flake:** `TUI_SKIP_PERF=1` does not propagate through turbo, so `editor-perf.spec.test.ts`
> can fail spuriously on a loaded machine. Re-run it alone before treating it as a regression.
