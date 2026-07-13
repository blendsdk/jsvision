# Requirements: Runtime Hardening (RD-13)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-13](../../requirements/RD-13-runtime-hardening.md)

## Feature Overview

A **hardening plan, not a widget plan**. RD-13 is the tracked remediation backlog from the
2026-07-02 five-agent deep audit: **3 critical + 12 major + ~20 minor confirmed defects** across
`@jsvision/core` (input decoder, render/serialize, safety, capability, host) and `@jsvision/ui`
(reactive, layout, view, event, desktop/window/menu/status, controls, scroll/list/dialog). Every
item repairs already-shipped code; **no new features, no new subsystems** are added.

The RD is unusually complete: each HR-NN carries the defect (`file:line`), a concrete failure
scenario, a test recipe, and a post-fix oracle. This plan sequences those fixes, pins the forks the
RD left open (per the [Ambiguity Register](00-ambiguity-register.md)), and encodes every oracle as
a spec-first regression test.

## Functional Requirements

### Must Have — Critical (Phase 1, first)

- [ ] **HR-01** Decoder totality: hostile/overlong/surrogate/out-of-range UTF-8 never throws, emits zero keys, resyncs.
- [ ] **HR-02** Modal mouse hit-testing is offset-correct at any ancestor depth (`absoluteOrigin(scopeRoot)`).
- [ ] **HR-03** Disposal is final: no computation runs after its owner is disposed; no re-subscription/resurrection.

### Must Have — Major (Phases 2–4)

- [ ] **HR-04** Chunk-split DCS reply → `incomplete` carry; zero keystroke leak.
- [ ] **HR-05** `\t`/`\n`/C0 never enter a cell or the serialized stream — each stored as one space (PA-5).
- [ ] **HR-06** Logger can never write onto the UI device: `'auto'` degrades to ring, explicit `stderr` throws (PA-6).
- [ ] **HR-07** UTF-8 locale ⇒ `glyphs.boxDrawing`+`halfBlocks` at the env layer; all three demos drop overrides (PA-9).
- [ ] **HR-08** `Commands.close` closes the active window (Desktop `handleCommand`); tvision-demo F3 works.
- [ ] **HR-09** Inactive-window close/zoom/grip zones are select-only on first click (TV `sfActive` gating, GATE-1/2).
- [ ] **HR-10** Removing the focused child heals `current`: re-home to next focusable, else null (PA-10).
- [ ] **HR-11** `isFocusable` false for detached views; `focusView(detached)` is a genuine no-op.
- [ ] **HR-12** `flush()` snapshots+clears `needsReflow`/dirty **before** work (PA-12); mid-flush invalidations survive.
- [ ] **HR-13** `addDynamic(Show/For)` runs under the group's owner scope; no post-unmount reconcile/leak.
- [ ] **HR-14** Stale drag gesture cleared on capture loss via the `ev.hasCapture(view)` guard (PA-13).

### Should Have — Minor (Phases 5–9, grouped by subsystem)

- [ ] **Core engine**: HR-15 restart diff baseline · HR-16 `ESC ESC`→Alt+Escape (PA-3) · HR-17 combining marks ·
      HR-18 wide fallback `'? '` (PA-11) · HR-19 EAW WIDE table (PA-18) · HR-20 continuation re-emits lead (PA-14) ·
      HR-21 clipboard exact bytes (PA-7) · HR-22 passthrough re-injection · HR-23 `KEY_NAMES`/`PasteState` exports ·
      HR-24 flush timer for any ESC carry · HR-25 width-aware `box()` centering · HR-26 `JSVISION_*` branding (PA-4).
- [ ] **Reactive core**: HR-27 throwing computed re-evaluable · HR-28 compute-cycle → `ReactiveCycleError` ·
      HR-29 batch body error not masked (PA-15).
- [ ] **View/draw**: HR-30 draw-context width-aware centering + combining marks · HR-31 `invalidate()` honors
      visibility flips (PA-8) · HR-32 `View.onCleanup` binds to the view scope · HR-33 `naturalSize` excludes
      absolute children · HR-34 shadow-aware occlusion (PA-16).
- [ ] **Event/shell**: HR-35 bare top-level menu item emits+closes (PA-17) · HR-36 catcher tracks resize ·
      HR-37 `modalHost` cleared post-modal · HR-38 TV-faithful cascade quit (PA-2) · HR-39 disable evicts focus ·
      HR-40 one-click menu-title switch · HR-41 zoom re-maximizes on resize · HR-42 no delivery to unmounted views.
- [ ] **Controls/containers (TV fidelity, GATE-1/2 each)**: HR-43…HR-62 per the RD (paste control-char mapping,
      cluster dialog-wide hotkeys, picture caret/validator/maxLength fixes, drag guard, word delete, scrollbar
      jump-to-position, list highlight/`<empty>`/page-step/click-clamp, disabled hot-glyph color, button col-0
      exclusion, `Text` verbatim whitespace, selection clamp, floored modulo, scroller corner, docs fix HR-55).

### Won't Have (Out of Scope)

Per RD-13's Won't Have table — absent TV-parity features, **not** defects: `Ins` overwrite mode (DEF-20),
Ctrl+Y clear-line, OSC-52 clipboard read (DEF-25), a command drain-loop runaway guard (defensible as-is),
grapheme-cluster caret stepping (DEF-21). No new deferrals are added by this plan.

## Technical Requirements

### Compatibility / API surface
- **Additive-only public surface**: new exports (HR-23) + bug-for-bug corrections only; no signature reshaped.
  The intra-ui `ev.hasCapture(view)` helper (PA-13) is additive, mirroring the existing capture seam.
- Env-var rename `BLENDTUI_DEBUG`/`BLENDTUI_LOG` → `JSVISION_DEBUG`/`JSVISION_LOG` with **no alias** (PA-4;
  publish still deferred per DEF-1, so no external consumers exist).
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`yarn check:deps` holds), files ≤ 500 lines.

### Security
- stdin is untrusted: the decoder must be **total** (HR-01/04/16/24) — no byte sequence throws, no reply
  leaks as keystrokes.
- Output boundary: no raw control byte enters a cell or the ANSI stream (HR-05); the OSC-52 payload is the
  app's exact bytes, base64-framed (HR-21/PA-7).
- Screen safety: device-identity (`{dev,ino}`) guard, never fd-number (HR-06/PA-6).
- Allowlist posture preserved throughout: validate/normalize at entry, drop what doesn't parse, never throw
  on hostile input.

### TV-fidelity gate (NON-NEGOTIABLE)
Every fidelity item (HR-09, HR-35, HR-38's cascade semantics, HR-43…HR-62) carries a GATE-1 decode section
in its component spec and BEFORE-decode/AFTER-diff tasks in the execution plan, per
[`codeops/tv-fidelity-gate.md`](../../../../tv-fidelity-gate.md). The C++ outranks our spec oracles: a
conflicting `*.spec.test.ts` is corrected against the cited `.cpp`.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Plan shape | single plan / core+ui split | Single `runtime-hardening` plan | One RD → one plan → one roadmap row; critical trio spans both packages | PA-1 |
| Quit during modal (HR-38) | cascade quit / documented-blocked | TV-faithful `endModal(quit)` cascade, `valid()` may veto | Matches TV `cmQuit`; no dangling modal promises | PA-2 |
| `ESC ESC` (HR-16) | Alt+Escape / two escapes | Alt+Escape (same chunk); flush path still yields two bare escapes | Consistent with the Alt-prefix model + xterm `altSendsEscape` | PA-3 |
| Env branding (HR-26) | `JSVISION_*` / `BLENDTUI_*` | `JSVISION_*`, no alias | Matches the `@jsvision/*` package brand; unpublished | PA-4 |
| C0 at the grid (HR-05) | space-replace / strip | One space per C0 char | Caller column math preserved; trivially total | PA-5 |
| Logger stderr guard (HR-06) | split by intent / always throw / always no-op | `'auto'`→ring fallback, explicit→throw | Debugging keeps working; explicit misconfig fails loudly | PA-6 |
| Clipboard sanitize (HR-21) | drop / lossless-only | Drop the pre-encode sanitize | base64 cannot break the OSC frame; exact round-trip | PA-7 |
| Visibility invalidation (HR-31) | fix `invalidate()` / document `invalidateLayout()` | `invalidate()` honors flips both directions | Least surprise; no secret second API required | PA-8 |
| Glyph capability layer (HR-07) | env only / env+table | Env layer only; all 3 demos drop overrides | Locale is the honest signal; table would overpromise | PA-9 |
| Focus re-home (HR-10) | next focusable / always null | Re-home, else null | Keyboard stays alive; matches `Desktop.removeWindow` | PA-10 |
| Wide fallback shape (HR-18) | `'? '` / `'??'` | `'? '` | One char = one marker; columns stay 2 | PA-11 |
| Flush flag timing (HR-12) | clear-first / re-check-after | Snapshot-and-clear-first | Mid-flush invalidations land in the next tick | PA-12 |
| Gesture guard (HR-14) | notification / query guard | `ev.hasCapture(view)` guard | Additive read-only seam; StatusLine gets it too | PA-13 |
| Continuation damage (HR-20) | re-emit lead / lead-in-run | Pull the lead into the damage run | Never an empty styled run | PA-14 |
| Batch error policy (HR-29) | aggregate / precedent | Body rethrown; flush error via multi-throw drain | Consistent with reactive PA-2 precedent | PA-15 |
| Shadow occlusion (HR-34) | margin / re-cast pass | Rects grow by `shadowSize {2,1}` | No second paint pass | PA-16 |
| Bare menu item (HR-35) | emit+close / disallow | TV-faithful emit+close (decode pins it) | Fidelity directive | PA-17 |
| WIDE table source (HR-19) | hand-list / generated constant | Dev-script-generated checked-in constant from Unicode EAW | Complete + zero runtime deps | PA-18 |
| Slug + phase order | — | `runtime-hardening`; RD's ordering | Convention + the RD's closing note | PA-19 |

> **Traceability:** every scope decision references the Ambiguity Register entry (PA-N) that resolved it.

## Acceptance Criteria

Mirrors RD-13 AC-1…AC-10 verbatim (the immutable oracles):

1. [ ] **AC-1** Critical trio: HR-01/02/03 each pass a spec + fuzz/property/regression oracle; all three reproduce RED before the fix.
2. [ ] **AC-2** Core majors: HR-04/05/06/07 each pass a spec oracle (incl. one demo's golden frame keeping box chars with its override removed).
3. [ ] **AC-3** Lifecycle majors: HR-10/11/12/13/14 each pass a spec oracle.
4. [ ] **AC-4** Shell majors + fidelity: HR-08/09 pass; HR-09's GATE-2 diff against `tframe.cpp` recorded.
5. [ ] **AC-5** Minor batch — core: HR-15…HR-26 each pass; HR-19 table-driven against Unicode EAW; HR-21/HR-05 assert no raw controls in output.
6. [ ] **AC-6** Minor batch — reactive/view: HR-27…HR-34 each pass.
7. [ ] **AC-7** Minor batch — event/shell: HR-35…HR-42 each pass.
8. [ ] **AC-8** Minor batch — controls/containers: HR-43…HR-62 each pass with GATE-1 decode + GATE-2 diff cited; conflicting oracles corrected against the `.cpp`.
9. [ ] **AC-9** After every phase: `yarn verify`, `yarn test:e2e`, `yarn check:deps`, `yarn lint`, `yarn gate` green; files ≤ 500 lines with JSDoc; CHANGELOG records the previously-unlogged core `Theme` additions + RD-13's changes.
10. [ ] **AC-10** Kitchen-sink smoke stays green; demos that dropped glyph overrides still render faithfully.
