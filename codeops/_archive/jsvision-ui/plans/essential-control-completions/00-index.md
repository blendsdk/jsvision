# Plan: Essential-Control Completions

> **Implements**: jsvision-ui/RD-07
> **Source**: [RD-07](../../requirements/RD-07-essential-control-completions.md) · [preflight](../../requirements/00-preflight-report-RD-07.md)
> **Status**: Plan Preflighted (2026-07-02 — 8 findings, all resolved; see [00-preflight-report.md](00-preflight-report.md))
> **CodeOps Skills Version**: 3.1.0
> **Last Updated**: 2026-07-01

The four capabilities that finish RD-06's leaf-control tier — faithfully ported from Turbo Vision
(`decode, don't design`), landing as **completions of existing `controls/`** plus one additive
`View`→host caret seam. Nothing here needs the overlay/virtual-scroll/multi-column machinery of the
later high-value controls (those are RD-12+).

## Scope (four capabilities)

| # | Capability | TV source | Where it lands |
|---|-----------|-----------|----------------|
| 1 | `Input` **text selection + logical caret** | `TInputLine` | edit `controls/input.ts` |
| 2 | `Input` **cut/copy/paste** (system clipboard) | `TInputLine` cmCut/Copy/Paste | edit `controls/input.ts` |
| 3 | `picture(mask)` **validator** | `TPXPictureValidator` | new `controls/validators/picture.ts` |
| 4 | `MultiCheckGroup` | `TMultiCheckBoxes` | new `controls/multi-check-group.ts` |
| 5 | **Hardware caret seam** | `TView::showCursor`/`setCursor` | additive `view/`+`event/`+`app/run.ts` |

Cross-package additive (core): the `inputSelection` Theme role (PA-4/PA-6) + `Commands.cut/copy/paste` (PA-7).
Additive **ui** seams (optional fields / read-only accessors only — no reshaped signatures, ST-15):
`View.desiredCaret()` + `RenderRoot.originOf(view)` + `EventLoop.onCaret?` (hardware caret, 03-04) and
`DispatchEvent.setClipboard?` + `EventLoop.writeClipboard?` (clipboard write, 03-01/03-04).

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | ✅ GATE PASSED — PA-1…PA-13 (4 user + 9 dominant/source) |
| [01-requirements.md](01-requirements.md) | Scope, ACs, dependencies (Source: RD-07) |
| [02-current-state.md](02-current-state.md) | The real code this extends (verified in the RD-07 preflight) |
| [03-01-input-selection-clipboard.md](03-01-input-selection-clipboard.md) | `Input` selection + clipboard + logical caret — **TV GATE-1 decode** + spec |
| [03-02-picture-validator.md](03-02-picture-validator.md) | `picture(mask)` — **TV GATE-1 decode** + spec |
| [03-03-multi-check-group.md](03-03-multi-check-group.md) | `MultiCheckGroup` — **TV GATE-1 decode** + spec |
| [03-04-visible-caret-seam.md](03-04-visible-caret-seam.md) | Hardware caret `View`→host seam (additive) |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases ST-01…ST-16 |
| [99-execution-plan.md](99-execution-plan.md) | Phases · sessions · task checklist (incl. the TV BEFORE/AFTER gates) |

## Dependencies (all done)

- **RD-06** (`Input`, `Cluster` base, `Validator` model, `cpGrayDialog` control roles) — the direct upstream.
- **RD-05/04/03** (`run()`/host, `EventLoop`/`onFrame`/`setCapture`, `RenderRoot` compose, `View`) — the caret seam threads their surfaces, additively.
- **`@jsvision/core`** — `setClipboard()`, bracketed `PasteEvent` (1 MiB cap), `cursor.*`, `Theme` — reused as-is.

## Approach

Spec-first per capability (spec oracles RED → implement → GREEN → impl tests). Every TV-derived
component carries a **BEFORE-decode (GATE-1)** and **AFTER-diff (GATE-2)** task per the NON-NEGOTIABLE
fidelity directive; the decodes already performed are recorded in the `03-*` docs and re-verified at
implementation time. One new visual component (`MultiCheckGroup`) ships a **kitchen-sink story** +
smoke test (NON-NEGOTIABLE showcase rule).

**To begin implementation:** use the exec_plan skill on `essential-control-completions`.
