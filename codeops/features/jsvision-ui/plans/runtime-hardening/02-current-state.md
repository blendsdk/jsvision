# Current State: Runtime Hardening (RD-13)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The full jsvision stack is shipped and green: `@jsvision/core` (capability, input, render, host,
safety, color — the archived foundation RD-01…RD-10) and `@jsvision/ui` (reactive, layout, view,
event, app shell, controls, containers — jsvision-ui RD-01…RD-07/RD-10/RD-11), 500+ tests,
acceptance gate passing. RD-13's defects are **runtime paths the suite does not exercise**: tests
mount at the origin, feed well-formed input, and never dispose scopes mid-flush.

### Evidence provenance

All `file:line` claims below originate from the 2026-07-02 five-agent audit that produced RD-13
(each verified against live source; items marked *(reproduced)* in the RD were executed). During
planning, these decision-relevant sites were **independently re-verified** in the working tree:

| Verified during planning | What was confirmed |
|--------------------------|--------------------|
| `packages/core/src/engine/safety/logger.ts:47,53,172,217` | `BLENDTUI_DEBUG`/`BLENDTUI_LOG` gating (HR-26/PA-4) |
| `packages/core/src/engine/host/host.ts:72` | `JSVISION_ASCII` switch — the branding split is real |
| `packages/ui/src/event/event-loop.ts:230-232` | `scopeRoot()` clamps all dispatch to the modal subtree → root quit sink unreachable (HR-38/PA-2) |
| `packages/core/src/engine/input/keys.ts:106-127` | Alt-prefix branch re-enters escape decoding on inner `ESC` → `ESC ESC` swallowed (HR-16/PA-3) |
| `packages/core/src/engine/render/osc.ts:47-51` | `setClipboard` sanitizes **before** base64 (HR-21/PA-7) |
| `packages/core/src/engine/capability/env.ts` | env layer sets only `unicode.utf8`/`multiplexer`; no glyph field anywhere (HR-07/PA-9) |
| `packages/ui/src/view/render-root.ts:118-123` | compose skips `!visible` views; hidden views get no compose-cache entry (HR-31/PA-8) |

### Relevant Files (by subsystem — the full defect→file map)

| File | Defects | Changes Needed |
|------|---------|----------------|
| `packages/core/src/engine/input/keys.ts` | HR-01, HR-16 | UTF-8 post-assembly validation (overlong/surrogate/>U+10FFFF → drop); `ESC ESC` → Alt+Escape |
| `packages/core/src/engine/input/decoder.ts` | HR-04, HR-24 | carry in-progress DCS; arm flush timer for any ESC-prefixed carry |
| `packages/core/src/engine/capability/responses.ts` | HR-04 | `matchResponse` reports incomplete DCS distinctly from "not a response" |
| `packages/core/src/engine/capability/{query.ts,index.ts}` | HR-22 | re-inject passthrough bytes into the decoder |
| `packages/core/src/engine/input/index.ts` + `engine/index.ts` | HR-23 | export `KEY_NAMES`, `PasteState` |
| `packages/core/src/engine/render/buffer.ts` | HR-05, HR-17, HR-25 | C0→space at `text`/`set`; combining marks attach to the previous cell; width-aware `box()` title |
| `packages/core/src/engine/render/{glyphs.ts,serialize.ts}` | HR-18, HR-20 | wide fallback emits `'? '` (2 cols); continuation damage pulls in the lead |
| `packages/core/src/engine/render/width.ts` | HR-19 | complete the WIDE table from Unicode EAW (generated constant) |
| `packages/core/src/engine/render/osc.ts` | HR-21 | drop pre-encode sanitize in `setClipboard` |
| `packages/core/src/engine/safety/logger.ts` | HR-06, HR-26 | stderr sink `{dev,ino}` guard; `JSVISION_DEBUG`/`JSVISION_LOG` rename |
| `packages/core/src/engine/capability/env.ts` | HR-07 | UTF-8 locale ⇒ `glyphs.boxDrawing`+`halfBlocks` |
| `packages/core/src/engine/host/host.ts` | HR-15 | reset diff baseline + decoder carry on restart |
| `packages/ui/src/reactive/{owner.ts,scheduler.ts}` | HR-03, HR-27, HR-28, HR-29 | disposed flag honored by execute/flush; throwing computed re-evaluable; compute-cycle detection; batch error policy |
| `packages/ui/src/reactive/{for.ts,show.ts}` + `view/group.ts` | HR-13 | `addDynamic` runs the combinator under the group's owner |
| `packages/ui/src/view/render-root.ts` | HR-12, HR-31, HR-34 | snapshot-and-clear-first; visibility flips via `invalidate()`; shadow-aware occlusion |
| `packages/ui/src/view/{view.ts,draw-context.ts}` | HR-32, HR-30 | `onCleanup` binds to the view scope; width-aware centering/marks |
| `packages/ui/src/layout/measure.ts` | HR-33 | `naturalSize` filters absolute children |
| `packages/ui/src/event/hit-test.ts` | HR-02 | modal branch uses `absoluteOrigin(scopeRoot)` |
| `packages/ui/src/event/focus.ts` | HR-11, HR-39 | mounted-check in `isFocusable`; disable evicts focus; `advance()` position recovery |
| `packages/ui/src/event/dispatch.ts` | HR-42 | sweep delivery skips unmounted views |
| `packages/ui/src/event/event-loop.ts` + `modal.ts` | HR-38, HR-14 | cascade quit through the modal stack; `hasCapture` seam |
| `packages/ui/src/view/group.ts` | HR-10 | `remove`/`unmountDynamicChild` heal `current` |
| `packages/ui/src/desktop/desktop.ts` | HR-08, HR-14 | handle `close`; clear stale gesture on capture loss |
| `packages/ui/src/window/{window.ts,frame.ts}` | HR-09, HR-41 | `sfActive`-gate frame zones; zoom re-maximize + restore-rect clamp |
| `packages/ui/src/menu/controller.ts` | HR-35, HR-36, HR-40 | bare-item emit+close; catcher tracks resize; one-click title switch |
| `packages/ui/src/status/statusline.ts` | HR-14 | `holding` capture guard |
| `packages/ui/src/dialog/dialog.ts` | HR-37 | clear `modalHost` at modal end |
| `packages/ui/src/controls/input.ts` + `input-clipboard.ts` | HR-43, HR-45…HR-48, HR-54, HR-55, HR-58, HR-59 | paste mapping, caret math, validator-on-delete, word delete, drag guard, double-click reset, maxLength clamp, selection clamp, JSDoc fix |
| `packages/ui/src/controls/{cluster.ts,button.ts,text.ts,multi-check-group.ts}` | HR-44, HR-52, HR-56, HR-57, HR-60 | dialog-wide hotkeys, disabled hot color, col-0 exclusion, verbatim whitespace, floored modulo |
| `packages/ui/src/scroll/{scroll-bar.ts,scroller.ts}` | HR-49, HR-61 | track click jump-to-position+drag; corner cell reserved |
| `packages/ui/src/list/list-rows.ts` | HR-50, HR-51, HR-53, HR-62 | unfocused highlight, `<empty>` at col 1, page step `size.y-1`, click-clamp |
| `packages/examples/{kitchen-sink,controls-live,tvision-demo}/main.ts` | HR-07 | drop manual glyph overrides (all three, PA-9) |
| `CHANGELOG.md` | AC-9 | backfill unlogged core `Theme` additions + RD-13 entries |

## Gaps Identified

The tier structure (full detail per HR in RD-13 — not duplicated here):

- **Critical**: a 4-byte stdin write kills the app (HR-01, reproduced); every modal click is off by
  the ancestor offset in the flagship pattern (HR-02); disposal resurrection makes `Show`/`For`
  teardown a permanent leak (HR-03).
- **Major**: input/render/safety/capability boundary breaches (HR-04…07) and focus/lifecycle/gesture
  corruption (HR-08…14) — all user-visible in shipped demos.
- **Minor**: ~20 narrow-trigger correctness/fidelity gaps, dominated by TV-fidelity deltas in
  controls/containers (HR-43…62) that each require GATE-1/GATE-2 against the cited `t*.cpp`.

## Dependencies

### Internal
- Fix order matters inside phases: HR-11 (`isFocusable` mounted-check) underpins HR-10's re-home
  logic; HR-14's `hasCapture` seam (PA-13) is used by both Desktop and StatusLine; HR-05's grid
  boundary interacts with HR-17 (combining marks) in `buffer.ts`.
- The TV source checkout at `/home/gevik/workdir/github/tvision` (GATE-1/2 for HR-09, HR-35, HR-38,
  HR-43…62).

### External
- None. Zero runtime deps preserved; HR-19's EAW table is a dev-script-generated checked-in constant (PA-18).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HR-31/HR-34 render-root changes regress partial recompose | Med | High | Both directions covered by new spec oracles + the existing view.render/scheduler suites run per phase (AC-9) |
| HR-03 disposed-flag change alters flush semantics for live effects | Med | High | Phase-1 fuzz/property oracle (dispose-finality) + full reactive suite; the flag is checked, never repurposes `NodeState.CLEAN` |
| Fidelity fixes contradict existing spec oracles | High (by design) | Med | The fidelity exception applies: correct the oracle against the cited `.cpp`, record in commit (AC-8) |
| HR-38 cascade quit interacts with Dialog `valid()` veto | Med | Med | GATE-1 decode of `tprogram.cpp`/`tgroup.cpp` before implementation (PA-2); modal promises asserted resolved in the oracle |
| HR-07 capability change alters golden-screen expectations | Med | Low | Golden tests pass explicit caps today; only the env-resolution spec + demo goldens change (AC-2/AC-10) |
| Env-var rename breaks local workflows | Low | Low | PA-4: no external users (publish deferred); docs updated in the same commit |
