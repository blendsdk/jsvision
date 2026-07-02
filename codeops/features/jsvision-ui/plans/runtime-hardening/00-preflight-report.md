# Preflight Report: Runtime Hardening (RD-13)

> **Artifact**: `codeops/features/jsvision-ui/plans/runtime-hardening/` (implementation plan, 14 docs)
> **Implements**: jsvision-ui/RD-13
> **Date**: 2026-07-02
> **Reviewer**: preflight (CodeOps 3.1.0)
> **Review independence**: fresh session (plan authored in a prior session) — no same-session bias.
> **Outcome**: ✅ PASSED — all 6 findings (3 MAJOR, 2 MINOR, 1 OBSERVATION) resolved & applied 2026-07-02

## Codebase Context Summary

The plan cites ~62 defects (HR-01…HR-62), each with a `file:line`. Reconnaissance verified every
citation against the live tree via five parallel subsystem sweeps (core input, core render/safety,
reactive/view, event/shell, controls/containers) plus targeted spot-checks.

**Result: 60 of 62 citations are exactly accurate** — correct file, correct lines, defect present as
described. The plan is unusually well-grounded (it is itself the product of a five-agent audit). The
TV-source checkout at `/home/gevik/workdir/github/tvision` is present; all cited `t*.cpp` exist
**except** one (see PF-004). Cross-cutting primitives the plan depends on were confirmed present:
`runWithOwner` (reactive barrel), `LoggerConfigError` (safety/errors), `absoluteOrigin` (event),
`ScreenBuffer.set/text/box`, `DispatchEvent.setCapture/releaseCapture` (no `hasCapture` yet — HR-14
adds it, additive as claimed). HR-13's key open question resolved favorably: `addDynamic` takes a
callable `DynamicProducer` thunk, so the fix is a genuine one-liner, no signature change.

## Findings

### 🟠 PF-001 (MAJOR) — HR-24 fix targets the wrong file; the flush timer is in the host, not the decoder

- **Where**: 03-01 §HR-24; 02-current-state defect→file map (`input/decoder.ts` row); 99 task 5.2.2
  (files `input/keys.ts, input/decoder.ts`). Inherited from RD-13 HR-24 (`decoder.ts:114-122`).
- **Reality**: `decoder.ts:114-122` is unrelated purity-copy code (`let active = paste.active; …`).
  The `carry.length === 1 && carry[0] === ESC` flush-timer logic is in **`host/host.ts:114-122`**
  (`escTimer = adapter.setTimer(…, ESC_TIMEOUT_MS)`). The decoder is pure and holds no timers; the
  HR-24 fix ("arm the flush timer for any ESC-prefixed carry") is a **host** change.
- **Impact**: An executor following the file map edits the wrong file; `host.ts` is absent from the
  HR-24 change set entirely. HR-16 (Alt+Escape, `keys.ts`) and HR-04 (DCS carry, `decoder`) are
  correctly located — only HR-24's location is wrong.
- **Recommendation**: Correct the HR-24 citation to `host/host.ts:114-122` in 03-01, the
  02-current-state map, and task 5.2.2 (add `host/host.ts`, keep the timer-arming condition change
  there). One-line doc fix, no scope change.
- **Resolution**: ✅ Applied — 03-01 §HR-24 + Files line, 02-current-state map (HR-24 moved to the
  host.ts row, decoder.ts row now HR-04 only), and task 5.2.2 file list all point at `host/host.ts`.

### 🟠 PF-002 (MAJOR) — HR-07's glyph enablement is locale-gated, but the demos signal UTF-8 via override → the demo-golden/AC-10 assertion has no UTF-8 source

- **Where**: 03-03 §HR-07 + PA-9; 99 task 2.2.5; testing-strategy ST-2.4 demo clause, ST-10; AC-2/AC-10.
- **Reality**: PA-9 puts glyph enablement in `env.ts` keyed off `detectUtf8(env)`, which reads the
  **locale** (`LC_ALL > LC_CTYPE > LANG`, `capability/env.ts:119`). The three demos force UTF-8 via
  `override: { unicode: { utf8: true }, glyphs: {…} }` (kitchen-sink `main.ts:29-35`), **not** via a
  locale var. `resolveCapabilities` defaults `env = options.env ?? process.env` (`index.ts:76`).
  After dropping the glyph override, box-drawing depends on the ambient process locale — which in a
  non-UTF-8/`C`/empty CI environment yields `boxDrawing:false` → ASCII fallback. The kitchen-sink
  smoke resolves with `env: {}` (`kitchen-sink.smoke.spec.test.ts:20`), so it can never exercise the
  new path. **No demo-golden test exists yet** in `packages/examples/test/`.
- **Impact**: (a) The "demo golden keeps box chars with override removed" oracle (AC-2/AC-10, ST-2.4)
  has no specified UTF-8 locale source and cannot hold headlessly without one. (b) Real demo behavior
  changes: in a non-UTF-8 locale the shipped demos now render ASCII where they previously forced
  glyphs — a silent regression the plan treats as safe.
- **Recommendation**: In 03-03/HR-07 + task 2.2.5, specify that the new demo-golden test constructs
  caps with an explicit UTF-8 locale (`env: { LANG: 'en_US.UTF-8' }`) so the enablement fires
  deterministically, and state whether the demos keep an explicit locale/utf8 signal or accept
  locale-dependent glyphs. Consider whether env-layer enablement should also key off an explicit
  `unicode.utf8` signal (not just locale) so an app that forces utf8 gets glyphs — or document that it
  deliberately does not.
- **Resolution**: ✅ Applied — 03-03 §HR-07 now states the enablement is locale-gated (not
  `unicode.utf8`-gated), surfaces the locale-honest demo behavior change (→ CHANGELOG in Phase 10),
  and requires the demo-golden to resolve caps with an explicit `env:{ LANG:'en_US.UTF-8' }`. Task
  2.2.5, ST-2.4, and ST-10 updated to match. Design kept locale-only per PA-9 (env-layer only).

### 🟠 PF-003 (MAJOR) — `input.ts` (482/500 lines) will breach the AC-9 ≤500-line gate in Phase 8; no source split is budgeted

- **Where**: 99 Phase 8 (Session 8.2 stacks HR-46/47/48/54/59/55 onto `controls/input.ts`); AC-9.
- **Reality**: `packages/ui/src/controls/input.ts` is already **482 lines**. Phase 8 adds a drag-guard
  flag (HR-46), transient delete-revalidation across backspace/delete/cut (HR-47), word-wise
  Ctrl+Backspace/Del (HR-48), a double-click reset window (HR-54), full-selection clamp (HR-59), and
  JSDoc (HR-55) — realistically +40–60 lines → ~525–540. AC-9 gates "every touched file ≤ 500 lines"
  **every phase**. The testing strategy budgets splitting **test** files at ~300 lines but says nothing
  about splitting **source** files.
- **Impact**: Phase 8's per-phase gate fails as written; an executor must improvise a split mid-phase.
- **Recommendation**: Add an explicit Phase-8 task to split `input.ts` (the `input-clipboard.ts`
  sibling already establishes the pattern — e.g. extract the editing/deletion ops into
  `controls/input-editing.ts`). Cheap and mechanical; just needs to be planned. Spot-check `width.ts`
  (126 lines) too — HR-19's generated EAW table may want its own module rather than inlining.
- **Resolution**: ✅ Applied (user-directed lightweight form) — Phase 8 gains a conditional
  guard-rail note: if `input.ts` crosses 500, extract the HR-47 (transient-revert) + HR-48
  (word-boundary) helpers into a sibling `controls/input-editing.ts`, verify green before the gate.
  No mandatory upfront split (per user: additions expected to stay tight).

### 🟡 PF-004 (MINOR) — HR-35 GATE-1 cites a non-existent TV source file (`tmenuview.cpp`)

- **Where**: 03-07 §HR-35 TV decode; 99 task 7.1.1 ("BEFORE-decode `TMenuView` — `tmenuview.cpp`");
  testing-strategy ST-7.a; ambiguity register PA-17.
- **Reality**: `source/tvision/tmenuview.cpp` does **not** exist. `TMenuView::` is implemented in
  **`tmnuview.cpp`** (abbreviated spelling) in the checkout. All other cited `t*.cpp` exist
  (`tframe`, `tinputli`, `tbutton`, `tcluster`, `tstatict`, `tscrlbar`, `tlstview`, `tprogram`,
  `tgroup`, `tscrolle`, `tvtext1`).
- **Impact**: The GATE-1 BEFORE-decode task points an executor at a missing file; the fidelity gate
  stalls until the executor guesses the real filename.
- **Recommendation**: Correct `tmenuview.cpp` → `tmnuview.cpp` in 03-07, task 7.1.1, and ST-7.a.
- **Resolution**: ✅ Applied — corrected to `tmnuview.cpp` in 03-07 (×2), 99 task 7.1.1, the ambiguity
  register PA-17, and 00-index fidelity-gate list. (ST-7.a cites PA-17, not the `.cpp`, so unchanged.)

### 🟡 PF-005 (MINOR) — HR-26 (non-fidelity env rename) must edit foundation spec oracles, which the "spec files edited only under the fidelity exception" rule doesn't authorize

- **Where**: testing-strategy §"Specification test files" ("Existing spec files are edited only under
  the fidelity exception"); 99 task 5.2.9; HR-26/PA-4.
- **Reality**: `packages/core/test/safety-logger.spec.test.ts` encodes `BLENDTUI_DEBUG` in the ST-19
  and ST-20 spec oracles (lines 15, 24). Renaming to `JSVISION_DEBUG` (PA-4) forces edits to those
  spec oracles — a **non-fidelity** change the plan's stated exception (fidelity oracle corrections
  only) does not cover.
- **Impact**: Minor process ambiguity — an executor honoring the immutable-oracle rule literally is
  blocked from making a legitimate env-rename edit.
- **Recommendation**: Add a one-line carve-out: spec oracles that assert a deliberately-renamed
  contract (the `BLENDTUI_*`→`JSVISION_*` env vars, ST-19/ST-20) are updated for the rename, cited to
  PA-4 — distinct from the fidelity exception.
- **Resolution**: ✅ Applied — testing-strategy §"Specification test files" now names two carve-outs
  (fidelity exception + renamed-contract update); task 5.2.9 lists `test/safety-logger.spec.test.ts`.

### 🔵 PF-006 (OBSERVATION) — the kitchen-sink smoke test can't validate HR-07 (uses `env: {}`)

- **Where**: `kitchen-sink.smoke.spec.test.ts:20` (`resolveCapabilities({ env: {}, … })`); AC-10.
- **Reality/Impact**: With an empty env the smoke never enables glyphs post-HR-07, so it renders ASCII
  and provides zero HR-07 coverage — it just stays green (it doesn't assert box chars). AC-10's "still
  renders faithfully" is not actually exercised by the smoke. Ties to PF-002.
- **Recommendation**: Rely on the dedicated demo-golden (PF-002) for HR-07 coverage; optionally note in
  ST-10 that the smoke is a mount check, not a glyph-fidelity check.
- **Resolution**: ✅ Applied — ST-10 now states the smoke is mount-only (`env:{}`, no glyph assertion)
  and the HR-07 glyph coverage comes from the locale-supplied demo golden.

## Dimension scan summary

| Dimension | Result |
|-----------|--------|
| 1 Ambiguities | Clean — 19 register entries resolve every open fork |
| 2 Implicit Assumptions | PF-002 (locale⇒glyph assumption unstated) |
| 3 Logical Contradictions | PF-005 (spec-edit rule vs HR-26) |
| 4 Completeness Gaps | PF-001 (missing host.ts), PF-003 (no split task), PF-002 (no golden locale) |
| 5 Dependency Issues | PF-004 (phantom TV file) |
| 6 Feasibility | PF-003 (line budget) |
| 7 Testability | Strong — one oracle per HR, RED-first, fuzz/property for the trio |
| 8 Security Blind Spots | Clean — decoder totality, output boundary, logger device guard all covered |
| 9 Edge Cases | Clean — modal-in-modal, cascade-quit veto, mid-sweep removal all specified |
| 10 Scope Creep | Clean — additive-only, explicit Won't-Have table |
| 11 Ordering & Sequencing | Clean — HR-11→HR-10, HR-05→HR-17/43, HR-12→HR-31/34, HR-03→P3 all correct |
| 12 Consistency | PF-001, PF-004 (citation drift) |
| 13 Codebase Alignment | 60/62 citations exact; PF-001/PF-004 the only two misses |

## Verdict

**✅ PASSED** — all 6 findings resolved and applied to the plan docs (2026-07-02). No CRITICAL. The
three MAJORs were all doc/plan corrections (not design flaws): a mis-located citation (PF-001), an
under-specified test/behavior mechanism (PF-002), and a line-budget guard-rail (PF-003, applied in
the user-directed lightweight conditional form). The plan's design, scope, sequencing, and security
posture are sound and exceptionally well-grounded. Ready for `exec_plan runtime-hardening`.
