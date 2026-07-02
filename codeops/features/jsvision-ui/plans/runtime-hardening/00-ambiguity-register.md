# Ambiguity Register: Runtime Hardening (RD-13)

> **Status**: ✅ GATE PASSED — all 19 items resolved (11 user choices PA-1…PA-11 resolved interactively; dominants PA-12…PA-19 batch-confirmed; user final confirmation given 2026-07-02)
> **Last Updated**: 2026-07-02
> **Feature**: jsvision-ui · **Implements**: jsvision-ui/RD-13
> **CodeOps Skills Version**: 3.1.0

RD-13 is itself the product of a five-agent verified audit, so most behavior is pinned by the RD's
per-HR "Expected result" text or governed by the TV C++ source (fidelity directive — the `.cpp`
outranks all our oracles, so HR-43…HR-62 carry no register rows: GATE-1/GATE-2 decide them).
This register covers only the genuine forks the RD left open, plus the plan-level structure and
mechanism decisions.

## User decisions (PA-1…PA-11) — resolved interactively 2026-07-02

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| PA-1 | Scope/structure | One plan or split core/ui? | Single `runtime-hardening` plan / two plans | **Single plan** `codeops/features/jsvision-ui/plans/runtime-hardening/`, phases mirror the RD's AC groups | ✅ Resolved |
| PA-2 | Behavioral (HR-38) | Quit while a modal is open (root sink unreachable via the scope clamp, `event-loop.ts:230-232`) | TV-faithful cascade quit / documented quit-blocked | **TV-faithful cascade**: quit ends the modal stack via `endModal(quit)` (a `Dialog.valid()` gate may veto, per the TV `cmQuit`/`valid(cmQuit)` chain), then quits. Exact veto semantics pinned by a GATE-1 decode of `tprogram.cpp`/`tgroup.cpp` | ✅ Resolved |
| PA-3 | Behavioral (HR-16) | Same-chunk `ESC ESC` decode (the RD's "two escapes" test conflicts with its "Alt+Escape decodes" expectation) | Alt+Escape / two escape events | **Alt+Escape** — one `escape` event with `alt:true` (matches the `keys.ts:117-126` Alt-prefix model + xterm `altSendsEscape`); a human double-Esc still yields two escapes via the lone-ESC flush path. HR-16's spec oracle is written to this decision | ✅ Resolved |
| PA-4 | Naming (HR-26) | Env-var brand split: `BLENDTUI_DEBUG`/`BLENDTUI_LOG` (`logger.ts:47,53,172,217`) vs `JSVISION_ASCII` (`host.ts:72`) | JSVISION_* / BLENDTUI_* | **JSVISION_\*** everywhere: rename → `JSVISION_DEBUG`, `JSVISION_LOG`; no back-compat alias (publish still deferred, DEF-1) | ✅ Resolved |
| PA-5 | Behavioral (HR-05) | What a C0 control becomes at the grid boundary (`ScreenBuffer.text`/`set`) | Replace with one space / zero-width strip | **Replace each C0 (incl. `\t`/`\n`) with a single space cell** — caller column math preserved (1 input char = 1 cell); no raw control byte can enter a cell or the ANSI stream | ✅ Resolved |
| PA-6 | Behavioral (HR-06) | Logger stderr sink sharing the UI device | auto→fallback + explicit→throw / always throw / always no-op | **Split by intent**: sink resolved via `'auto'` degrades silently to the ring sink; an explicit `sink:'stderr'` throws `LoggerConfigError` (mirrors the file sink's `assertFileNotUiStream` contract) | ✅ Resolved |
| PA-7 | Behavioral (HR-21) | Clipboard pre-encode sanitize | Drop it / lossless-only sanitize | **Drop the pre-encode sanitize** — base64 output cannot break the OSC frame; the payload decodes to the exact input bytes | ✅ Resolved |
| PA-8 | API contract (HR-31) | `invalidate()` vs visibility flips | Make invalidate() sufficient / document invalidateLayout() required | **`invalidate()` honors visibility flips** both directions (shown→hidden repaints the vacated region; hidden→shown composes fresh). Mechanism for the missing compose-cache entry pinned in the view/render spec doc | ✅ Resolved |
| PA-9 | Technical (HR-07) | Which capability layer implies glyphs; how many demos drop overrides | Env layer only / env + table | **Env layer only**: UTF-8 locale ⇒ `glyphs.boxDrawing = true` + `halfBlocks = true` (`ambiguousWide` stays false per DEF-23); `table.ts` untouched. **All three** demos (kitchen-sink, controls-live, tvision-demo) drop their hand-overrides | ✅ Resolved |
| PA-10 | Behavioral (HR-10) | Focus destination after removing the focused child | Re-home to next focusable, else null / always null | **Re-home** to the nearest remaining focusable sibling in Tab order; clear to `null` only when none remains (matches the `Desktop.removeWindow` precedent) | ✅ Resolved |
| PA-11 | UX (HR-18) | Wide-glyph two-cell ASCII fallback shape | `'? '` / `'??'` | **`'? '`** — `?` lead + space pad: one unknown char reads as one marker, column count stays 2 | ✅ Resolved |

## Dominant decisions (PA-12…PA-19) — planner-recommended mechanisms, batch-confirmed by the user

| # | Category | Ambiguity / Gap | Decision (dominant) | Status |
|---|----------|-----------------|---------------------|--------|
| PA-12 | Technical (HR-12) | "Clear flags before work or re-check after" | **Snapshot-and-clear-first**: `flush()` snapshots + clears `needsReflow`/`dirty` before reflow/compose so mid-flush invalidations land in the *next* tick's sets (no same-tick re-loop) | ✅ Resolved |
| PA-13 | Technical (HR-14) | Stale-gesture guard mechanism | **Capture-ownership guard**: additive envelope helper `ev.hasCapture(view)` (mirrors the existing `setCapture`/`releaseCapture` seam on `DispatchEvent`); the Desktop's gesture branch no-ops **and clears `gesture`** when it no longer holds capture. `StatusLine.holding` gets the same guard | ✅ Resolved |
| PA-14 | Technical (HR-20) | Continuation-cell damage emission | **Pull the lead into the run**: a changed continuation cell with an unchanged lead extends the damage run left to include (re-emit) the lead glyph — never an empty styled run | ✅ Resolved |
| PA-15 | Error policy (HR-29) | Batch body-throw + flush-throw aggregation | **Follow the reactive PA-2 precedent**: the body's exception is rethrown; the flush's exception is routed through the existing multi-throw drain policy (`console.error`), never replacing the in-flight error | ✅ Resolved |
| PA-16 | Technical (HR-34) | Shadow-aware partial recompose | **Expand rects by the shadow margin**: occlusion/dirty rects for shadow-casting views include the `shadowSize {2,1}` overhang (2 cols right, 1 row bottom); no separate re-cast pass | ✅ Resolved |
| PA-17 | Behavioral (HR-35) | Bare top-level menu `item` semantics | **TV-faithful emit+close** — selection of a submenu-less top-level command item emits its command and closes the bar; pinned by a GATE-1 decode of `tmnuview.cpp` (if TV disagrees, the C++ wins). Esc always closes regardless | ✅ Resolved |
| PA-18 | Technical (HR-19) | How the WIDE table gets completed | **Script-generated constant** from Unicode EAW `W`/`F` ranges, checked in as source (dev-time generation; zero runtime deps preserved); table-driven spec samples the RD's listed code points | ✅ Resolved |
| PA-19 | Structure | Plan slug + phase ordering | Slug **`runtime-hardening`** (mirrors the RD slug, per every prior plan's convention). Phase order per the RD's closing note: critical trio → core input/render/safety majors → reactive/view lifecycle majors → event/shell majors → minor batches by subsystem (core engine · reactive/view · event/shell · controls/containers, the last behind GATE-1/GATE-2) → governance + final gate. Spec-first (RED→GREEN→impl) per HR | ✅ Resolved |

### Resolution Notes

- **PA-2:** The cascade must resolve every open modal promise (no dangling `execView` awaits). If
  `Dialog.valid(quit)` vetoes at any level, the cascade stops there and the app does not quit —
  exact TV semantics recorded at GATE-1 in the event/shell spec doc.
- **PA-3:** HR-16's "how to test" in RD-13 is superseded on this one cell: the spec oracle asserts
  `decode([0x1b,0x1b])` (same chunk) → one `escape` with `alt:true`, and Esc → flush → Esc → two
  bare escapes. The RD's core intent — zero swallowed bytes — is unchanged.
- **PA-6:** The stderr sink stats fd 2 and compares `{dev, ino}` device identity against the UI
  stream — the same mechanism `assertFileNotUiStream` already uses for the file sink.
- **PA-8:** A hidden view has no compose-cache entry (`render-root.ts:118` skips `!visible`), so the
  hidden→shown partial path must fall back to composing via the parent's cached context (or a full
  recompose of the parent subtree); the exact mechanism is specified in the view/render spec doc and
  tested by the HR-31 oracle in both directions.
- **PA-13:** `hasCapture` is intra-package additive (a read-only query beside `setCapture` on the
  envelope/route context) — consistent with RD-13's additive-only public-surface constraint.
- **PA-18:** Generation is a dev-side script producing a checked-in `const` (like the existing
  fixtures); no runtime dependency, no build step change.

**Fidelity items carry no rows.** HR-09, HR-43…HR-62 (and PA-17's decode) are governed by the
NON-NEGOTIABLE TV-fidelity gate: the original C++ decides every glyph/color/geometry/hit-zone
question, each fix carries a GATE-1 decode citation and a GATE-2 diff, and a conflicting spec
oracle is corrected against the `.cpp`.
