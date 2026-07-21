# RD-02: Non-Functional Requirements & Verification

> **Document**: RD-02-non-functional-and-verification.md
> **Status**: Draft
> **Created**: 2026-07-19
> **Project**: jsvision — `layout-dsl-adoption`
> **Depends On**: RD-01
> **CodeOps Skills Version**: 3.9.0

---

## Feature Overview

RD-01 decides *what* diverges from Turbo Vision. This RD defines *how the change is proven safe*: the behavior-invariant test strategy, the spec-oracle re-derivation protocol (the recorded exception to the immutable-spec-test rule), the kitchen-sink quality gate for the didactic conversions, and the performance / security posture. It is the mandatory non-functional RD for the feature.

---

## Functional Requirements

### Must Have

- [ ] **NFR-1 — Behavior-invariant test discipline.** Every geometry-changing PR keeps its *behavioral* tests unedited and green (they are the proof that FR-2 held). A behavioral test that fails after a conversion is a defect in the conversion, never a signal to edit the test. [AR-9]
- [ ] **NFR-2 — Traversal-order oracle per dialog.** Each FR-1 dialog gains a spec test asserting its exact keyboard focus/tab sequence (the ordered list of focusable descendants). It is written spec-first, from the pre-conversion sequence, and must stay green through the rebuild. [AR-4]
- [ ] **NFR-3 — Spec-oracle re-derivation protocol (the recorded exception).** Geometry oracles are classified per file into exactly one of {**survive**, **re-baseline**, **delete**} and handled per the table below. A re-baseline recomputes the asserted rects from the new flex tree and records, in the PR body, that it is a deliberate re-derivation citing RD-01. A delete is only for oracles that assert *removed machinery*. No third path (silently loosening an assertion) is allowed. [AR-2, AR-8]
- [ ] **NFR-4 — Kitchen-sink quality gate for Tier 3.** Every converted story passes the headless smoke test AND the CLAUDE.md kitchen-sink bar: no clipped text, faithful colors, keyboard + mouse working. The smoke test ("renders ≥1 cell") is necessary but not sufficient; a manual/visual showcase pass is required and recorded. [AR-12]
- [ ] **NFR-5 — Performance non-regression.** Flex reflow must be no worse than the machinery it replaces. No per-frame allocation is introduced on the resize path; the informational `yarn bench` 16 ms ceiling (off-CI) is not breached by the conversions. Removing grow-mode should *reduce* resize work (one flex pass vs a manual per-child rect replay). [Non-functional]
- [ ] **NFR-6 — Security tests unedited.** The security oracles covering the affected dialogs (input handling, file-path handling) pass without modification, proving the layout-only change touched no security surface. [AR-13]
- [ ] **NFR-7 — Verify gate per PR.** `yarn verify` (lint → typecheck → build → test → check:docs) is green on every PR; `yarn lint:fix` is run before each PR-bound push (repo prime directive). For the files PR, `check:deps` stays green (deleting files adds no deps). [Non-functional]

### Should Have

- [ ] **NFR-8 — Golden/emulator diff over the keep-absolute set.** Where a golden/emulator harness exists, a before/after diff over the FR-4 keep-absolute components is byte-identical, catching any accidental spill of the divergence outside its sanctioned scope.

### Won't Have (Out of Scope)

- New performance targets beyond non-regression — the work is a refactor, not a perf feature.
- Accessibility work beyond preserving focus/tab order (TUI; no screen-reader/WCAG surface).

---

## Technical Requirements

### Spec-oracle re-derivation protocol (NFR-3)

The per-file classification from the flex-refactor decode. **Delete** = the oracle only asserts removed machinery; **re-baseline** = recompute rects from the new flex tree (deliberate, PR-recorded, cites RD-01); **survive** = passes unedited and is retained as a witness.

| Package | Test file | Action | Note |
|---------|-----------|--------|------|
| files | `test/grow.spec.test.ts` | **delete** | Unit test of the removed `growRect`/`GrowMode`. |
| files | `test/file-dialog-resize.spec.test.ts` | **delete** | Asserts the removed grow-mode resize rects. |
| files | `test/file-dialog-resize.impl.test.ts` | **re-baseline** | Drop the exact grow rects; keep the real WM drag-resize gesture + the frame-containment invariant. |
| files | `test/file-dialog.spec.test.ts` | **re-baseline** | Composition block only (new child rects); behavioral asserts survive. |
| files | `test/chdir-dialog.spec.test.ts` | **re-baseline** | Composition block only; behavioral asserts survive. |
| files | `test/file-dialog.impl.test.ts` | **re-baseline** | One info-pane bounds line; the generic frame-containment loop survives. |
| files | `test/chdir-dialog.impl.test.ts` | **survive** | Behavioral (chdir/revert/valid/win32); one optional `{...layout, rect}` tidy is not a re-baseline. |
| files | `test/multiclick.file-dialog.spec.test.ts` | **survive** | Local-coord dispatch, no screen geometry. |
| files | file-list / dir-list / file-input / file-info-pane specs | **survive** | Widget-internal; no dialog geometry. |
| ui | `test/editor-dialogs.spec.test.ts` | **re-baseline (partial)** | Re-derive find/replace child rects; keep `bounds`, record round-trips, and the caret-anchored `replacePrompt` block. |
| ui | `test/message-box.spec.test.ts` / `.impl.test.ts` | **survive** | Assert the sizing formula + return values, not child rects. |
| ui | `test/dialog.centering.spec.test.ts` / `.impl.test.ts` | **survive (witness)** | `center(this)` reproduces `{position:'absolute', rect:{0,0,w,h}, centered:true}` exactly. |
| ui | `test/dialog.resize.impl.test.ts` | **survive (witness)** | Centered rect + commit-on-grab freeze unchanged. |
| ui | `test/dialog.spec.test.ts` / `.impl.test.ts` | **survive** | Frame/shadow glyphs on test-owned geometry. |
| forms | `test/form-dialog.impl.test.ts` | **re-baseline (partial)** | Button-placement block (buttons become flow/overlay, not `position:'absolute'`); `bodyGroup.bounds.width > 0` survives. |
| forms | `test/form-dialog.spec.test.ts` / `-security.spec.test.ts` | **survive** | Caller-owned body + sanitization asserts. |
| examples / docs-site | kitchen-sink + datagrid-showcase smoke, demo e2e | **survive** | Assert "registered + paints ≥1 cell" / content, never rects. |

**Net:** delete 2 test files + 2 source files (`grow-dialog.ts`, `grow.ts`); partial re-baseline ~5 test files; everything else survives.

### Test-order discipline

Spec-first per the CodeOps rule, with the RD-01 recorded exception applied only to the geometry oracles above: for a re-baseline, first update the oracle to the intended new geometry (red against the old code), then implement the flex tree to green. Behavioral and security oracles are never touched.

### Performance posture (NFR-5)

- Resize path: grow-mode replayed N per-child `applyGrowMode` rect writes on every `onResized`; flex does one layout pass. Expected equal-or-better; assert no new per-frame allocation on resize.
- `yarn bench` stays informational and un-gated; confirm no conversion pushes a hot widget past the 16 ms off-CI ceiling.

---

## Integration Points

### With RD-01
- Implements the verification side of RD-01's FR-2/FR-3/FR-6/FR-8. RD-01's acceptance criteria 3–8 are discharged by NFR-1…NFR-4 and NFR-6 here.

### With the CodeOps spec-first discipline
- This RD is the single place the immutable-spec-oracle exception is operationalized (the "recorded decision" of AR-2). Any exec plan under this feature cites NFR-3 when it edits a geometry oracle.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| How spec oracles are handled under the parity break | Re-derive w/ record / loosen assertions / delete broadly | Per-file {survive / re-baseline / delete} protocol | Bounded, auditable, keeps behavioral+security oracles immutable | AR-2 |
| Proof that behavior didn't change | Trust review / behavioral tests unedited | Behavioral + security tests must pass unedited | Makes FR-2 falsifiable, not asserted | AR-9, AR-13 |
| Quality bar for Tier-3 conversions | Smoke only / smoke + manual showcase pass | Smoke + manual showcase pass | Smoke can't see clipping/colors; showcase is a NON-NEGOTIABLE selling point | AR-12 |

> **Traceability:** see `00-ambiguity-register.md`.

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: unchanged — user text + file paths, as today.
- **Input validation**: NFR-6 requires the existing input-validation / validator / file-path security tests to pass **unedited**; that is the proof the layout-only change added no injection or path-traversal surface.
- **Authentication & authorization**: N/A (local TUI).
- **Injection risks**: none introduced — composition changes create no shell/eval/query/path sink; file-dialog path canonicalization via the `FileSystem` seam is untouched.
- **Encryption / rate limiting / infrastructure**: N/A; deleting `grow-dialog.ts`/`grow.ts` reduces surface.

---

## Acceptance Criteria

1. [ ] Every geometry-changing PR leaves its behavioral tests and security tests unedited and green; the only edited tests are the geometry oracles listed in the NFR-3 table, each PR-recorded as a deliberate re-derivation citing RD-01. (NFR-1, NFR-3, NFR-6)
2. [ ] Each FR-1 dialog has a spec test asserting an explicit ordered focusable-descendant list, equal to the pre-conversion order, green after the rebuild. (NFR-2)
3. [ ] `test/grow.spec.test.ts` and `test/file-dialog-resize.spec.test.ts` are deleted; `test/file-dialog.spec`, `chdir-dialog.spec`, `file-dialog.impl`, `file-dialog-resize.impl`, `editor-dialogs.spec`, and `form-dialog.impl` are re-baselined exactly as the NFR-3 table specifies; all other listed tests pass unedited. (NFR-3)
4. [ ] Every Tier-3 converted story passes the headless smoke test and a recorded manual showcase pass (no clipped text; theme colors match pre-conversion; keyboard + mouse work). (NFR-4)
5. [ ] No new per-frame allocation on the resize path; `yarn bench` reports no conversion breaching the 16 ms off-CI ceiling. (NFR-5)
6. [ ] `yarn verify` green per PR; `check:deps` green on the files PR; `yarn lint:fix` run before each PR-bound push. (NFR-7)
7. [ ] (If a golden/emulator harness exists) a before/after diff over the FR-4 keep-absolute components is byte-identical. (NFR-8)
8. [ ] Security requirements verified: input-validation, validator, and file-path security oracles pass unedited. (Security, NFR-6)
