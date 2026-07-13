# Preflight Report — RD-07 (Essential-Control Completions)

> **Artifact**: `requirements/RD-07-essential-control-completions.md`
> **Type**: Requirement doc (single RD)
> **Date**: 2026-07-01
> **CodeOps Skills Version**: 3.1.0
> **Iteration**: 1
> **Scope reviewed**: RD-07 + its Ambiguity Register entries AR-115…AR-124, cross-checked against the
> real `@jsvision/core` / `@jsvision/ui` code and the Turbo Vision source at `/home/gevik/workdir/github/tvision`.

> ⚠️ **SAME-SESSION REVIEW** — RD-07 was authored earlier in the same session that ran this preflight.
> Same-agent blind spots are likely, so every codebase and TV-fidelity claim was verified against the
> actual files (not from memory) via six independent reconnaissance agents + one adversarial challenger
> on the single high-stakes finding. Consider a fresh-session re-scan for full independence.

---

## Outcome

**✅ PASSED WITH NOTES** — 0 CRITICAL, 0 MAJOR, 3 MINOR, 2 OBSERVATION.

RD-07 is unusually well-grounded. Every infrastructure-existence claim it makes (`setClipboard`, bracketed
`PasteEvent` + 1 MiB cap, `cursor.*`, the `Validator` model, the `Cluster` base, the DispatchEvent seams,
`ThemeRoleName = keyof Theme` auto-flow, the missing `cut`/`copy`/`paste` commands) verified **exact**, and
the pivotal feasibility question — **can the core decoder emit Shift+arrows / Ctrl+Shift+arrows / Ctrl+A /
Ctrl-Shift+Ins/Del?** — is **YES**, test-backed. The hardware-caret seam is feasible and additive with **no
core change** (challenger-confirmed). The findings below are doc-quality corrections, none blocking.

---

## Codebase Context Summary (what was verified)

| Claim in RD-07 | Verified against | Result |
|---|---|---|
| `setClipboard(text,caps)` OSC-52, `caps.osc.clipboard52`, base64+sanitize, no-op when unsupported | `core/render/osc.ts:47-49`, `capability/profile.ts:39`, `index.ts:62` | ✅ exact |
| Bracketed `PasteEvent` (`type:'paste'`, `text`, `truncated`) + 1 MiB cap | `core/input/events.ts:46,45-49,131` | ✅ exact |
| `cursor.show()/to()` (+`hide()`), exported | `core/render/cursor.ts:14-29` | ✅ exact |
| Decoder emits Shift/Ctrl-Shift arrows, Shift+Home/End, Ctrl+A, Ctrl/Shift+Ins/Del | `core/input/keys.ts:176-193,225-235,246-252` + `input-keyboard.impl.test.ts` | ✅ feasible |
| Keymap binds those chords; `KEY_NAMES` has insert/delete/home/end/arrows | `core/input/keymap.ts:40-87`, `events.ts:137-165` | ✅ |
| `Input` `curPos/firstPos/maxLength/value/validator`; no caret/paste today; 212 lines | `ui/controls/input.ts:38-46,100-140,182` | ✅ (headroom) |
| `Validator {isValidInput,isValid,error?}` + filter/range/lookup | `ui/controls/validators/*` | ✅ |
| `Cluster` base (mark/press/box/movedTo), 5-cell box; MultiCheckGroup fits | `ui/controls/cluster.ts:17-57` | ✅ |
| DispatchEvent `emit/focusView/setCapture/releaseCapture` seams | `ui/view/types.ts:107-120`, `event-loop.ts:206-239` | ✅ |
| New core Theme role auto-flows to UI; existing `inputSelected` is field-focus (no collision) | `ui/view/types.ts:29`, `draw-context.ts:131-138`, `core/color/theme.ts:88-93` | ✅ |
| `Commands` lacks cut/copy/paste (additive add) | `ui/status/commands.ts:12-37` | ✅ |
| View caret-request + RenderRoot absolute-translate additive; EventLoop `onCaret` beside `onFrame` | `ui/view/view.ts`, `render-root.ts:95-142`, `event-loop.ts:53,176` | ✅ additive |
| Hardware caret via existing `run()`/host wiring, **no core primitive** | `ui/app/run.ts:34-35,50-55`, `core/host/types.ts:76-85` — run() co-owns the stream, writes `cursor.*` after `render()` | ✅ (challenger-confirmed) |

---

## Findings

### 🟡 PF-071 (MINOR — Completeness / Edge case) — caret behavior across suspend/resume is unspecified
**Where**: RD-07 §"Visible caret — logical + real hardware cursor" (lines 101-116); AR-121.
**What**: The hardware-caret design is sound and additive (challenger-confirmed): `run()` co-owns the output
stream and, after `host.render(buffer)`, writes `cursor.to()/show()/hide()` to it. But on **SIGCONT
(resume)** the core host re-asserts modes (cursor hidden) and full-repaints `lastBuffer`
(`core/host/signals.ts:110-124`) — it does **not** re-apply the app's caret. The RD's caret section doesn't
mention this, so a resumed app would lose its blinking caret until the next frame that happens to move it.
Also implicit: run() must keep a *reference* to the output stream (two-writer arrangement with the host) —
worth stating so the plan doesn't assume `host.render` alone suffices.
**Recommendation**: Add one clause to the caret requirement: *"on resume (`onResume`) the caret is
re-applied; `run()` co-owns the output stream to emit the cursor escape after each `host.render`."* Keeps the
zero-core-change design; just closes the edge case. *(No AR change needed; a completeness clause.)*

### 🟡 PF-072 (MINOR — Codebase/Source alignment · TV fidelity) — TV source line citations have drifted
**Where**: RD-07 lines 27-30, 43-116, AC-6…AC-11; AR-116/117/119/120/121/122.
**What**: Against the current `/home/gevik/workdir/github/tvision` checkout, the cited **function names are
all correct**, but line numbers drift and **two are materially wrong locations**:
- `tvalidat.cpp:181-195` cited for **autoFill** actually lands on `isSpecial()`/`numChar()` — autoFill is at
  **`tvalidat.cpp:572-585`** inside `picture()`.
- `tvalidat.cpp:102-544` cited for the "full state machine" is loose — `process/scan/group/iteration/
  checkComplete` span **264-517**; line 544 is inside `syntaxCheck` (itself correctly cited at `:519`).
- Off-by-1–2 (harmless, right function): `:479`→478 (`TClipboard::setText`), `:497`→496 (`selectAll`),
  `tmulchkb.cpp:66`→67 (`" [ ] "` box), `:86-101`→88-103 (`press` cycle), `tinputli.cpp:145-156`→~147-157.
**Why it matters**: The TV-fidelity directive is NON-NEGOTIABLE and mandates exact `file:line`; these
citations seed the plan's GATE-1 decode and the AC oracles. Mitigant: names are correct and GATE-1 re-decodes.
**Recommendation**: Correct the two wrong-location cites (autoFill → 572-585; state machine → 264-517) and,
optionally, replace exact ranges with **function-name anchors** (e.g. "`TPXPictureValidator::picture` autoFill
loop") so they don't re-drift. Fold the minor off-by-ones in the same pass.

### 🟡 PF-073 (MINOR — Ambiguity) — "Depends On" line reads as if the caret seam already exists
**Where**: RD-07 line 7 — *"RD-05/RD-04/RD-03 (done; the caret seam threads View → RenderRoot → EventLoop →
createHost)"*.
**What**: Parsed literally, "done" appears to scope the *caret seam* as already built in RD-05/04/03. It is
not — RD-07 builds it (body lines 101-116 + AR-121 are unambiguous; the RD-06 preflight PF-002 explicitly
deferred it here). A reader skimming the header could mis-map the dependency.
**Recommendation**: Reword so "done" scopes only the subsystems: *"RD-05/RD-04/RD-03 (done) — the new caret
seam threads through their View → RenderRoot → EventLoop → host surfaces (all additive)."*

### 🔵 PF-074 (OBSERVATION — Naming clarity) — "selection" role name vs existing `inputSelected`
**Where**: RD-07 lines 54-57, AR-122; core `theme.ts:91` `inputSelected`.
**What**: The existing `inputSelected` role is the **focused-field** color (white-on-green), not text
selection. RD-07 adds a *text-selection* highlight role and also refers to the field keeping "the RD-06
`inputSelected`" role — two different meanings of "selected." Not a defect (no collision; the auto-flow
works), but the new role deserves an unambiguous name.
**Recommendation**: At plan GATE-1, name the new role distinctly (e.g. `inputHighlight` / `inputSelection`)
rather than anything close to `inputSelected`.

### 🔵 PF-075 (OBSERVATION — Consistency / feasibility detail) — "grapheme" vs the Input index unit
**Where**: RD-07 AC-1 / line 44 ("extends … by one grapheme"); AR-116.
**What**: RD-07 says selection extends "by one grapheme," but the RD-06 `Input` tracks `curPos` as a string
index and measures with `wcwidth` (`controls/measure.ts`), not grapheme clusters. TV's `TInputLine` uses
`TText::next/prev` (multibyte, not full grapheme clustering). "Grapheme" may over-promise vs. the actual
index unit.
**Recommendation**: At plan time, confirm the `curPos` unit and state selection motion in those terms (code
point vs. grapheme cluster) so AC-1 matches the implementation and TV's `TText::next`.

---

## Dimensions scanned (13)

Ambiguities (PF-073), Implicit Assumptions (caret host-wiring — verified OK), Contradictions (none),
Completeness (PF-071), Dependencies (verified — all upstream done/exact), Feasibility (decoder chords +
caret seam — verified feasible), Testability (ACs are concrete, oracle-backed; AC-12 testable via the
`onCaret` payload headlessly), Security (paste bounded 1 MiB + validator/maxLength + sanitize; setClipboard
base64+sanitize; bounded mask parser — AC-15 solid), Edge Cases (PF-071 suspend/resume), Scope Creep (none —
tight slice, deferrals tracked as DEF-20 + unassigned OSC-52 read), Ordering (clean; depends only on done
RDs), Consistency (PF-075), Codebase Alignment (PF-072 citations; everything else exact).

## Adversarial checklist (same-session safeguard)

- **Biggest infeasibility risk** (decoder cannot produce modified chords) → explicitly tested: **CAN emit**.
- **Biggest "it's all additive" risk** (hardware caret needs a core host change) → challenged independently:
  **REFUTED** — clean zero-core path via run()-owned stream; residual suspend/resume edge → PF-071.
- **External-standard claims** (TV `file:line`) → verified against the actual checkout → PF-072.
