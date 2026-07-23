# Plan: Live-Example Remediation

> **Feature**: docs-website · **Type**: Remediation (post-ship follow-up to RD-03)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2
> **Status**: Plan Preflighted 🔬 — ✅ PASSED ([00-preflight-report.md](00-preflight-report.md), 4 findings applied); ready for `exec-plan live-example-remediation`

Fixes the **seven post-ship bugs** the user found in the shipped RD-03 live-example system. The bugs
cluster into four workstreams, landing in order Resize → Shell → Reopen → Source (AR-7). Grounded in
the code-verified triage `../_draft/live-example-bugs.md` (per-bug root cause with `file:line` + a
live browser reproduction of bug #3). Not a new RD — a remediation of RD-03.

## The four workstreams

| WS | Bugs | Doc |
|----|------|-----|
| **A** Play resize (terminal-driven) + wheel-leak + GridRows H-scroll golden | #1, #3 | [03-01](03-01-resize.md) |
| **B** Unify the demo shell (draggable-Window) | #4, #5, #6 | [03-02](03-02-unified-shell.md) |
| **C** Dialog reopen | #7 | [03-03](03-03-dialog-reopen.md) |
| **D** Source framing (build()-first) | #2 | [03-04](03-04-source-framing.md) |

## Documents

| Doc | What it covers |
|-----|----------------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — AR-1…AR-19 (✅ GATE PASSED; AR-1…8 user-decided, AR-9…18 batch-confirmed, AR-19 preflight-derived). |
| [00-preflight-report.md](00-preflight-report.md) | Preflight audit — ✅ PASSED (PF-001…PF-004 applied; independent-challenger verified). |
| [01-requirements.md](01-requirements.md) | The 7 bugs → 4 workstreams, FRs, scope, success criteria. |
| [02-current-state.md](02-current-state.md) | Where each bug lives today (`file:line`). |
| [03-01-resize.md](03-01-resize.md) | WS-A: terminal-driven viewport, wheel fix, GridRows golden. |
| [03-02-unified-shell.md](03-02-unified-shell.md) | WS-B: one Window shell, `kind` registry, menu/status. |
| [03-03-dialog-reopen.md](03-03-dialog-reopen.md) | WS-C: stage Window + "Open the dialog" button. |
| [03-04-source-framing.md](03-04-source-framing.md) | WS-D: `#region` build()-first + full-behind-a-toggle + drift oracle update. |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-A1…ST-D3 spec cases + the Manual browser checklist (M1–M8). |
| [99-execution-plan.md](99-execution-plan.md) | 5 phases / 27 tasks, spec-first, two-stage marks. |

## Key decisions (from the register)

- Shell = each demo a **draggable, non-closable Window** on the desktop; primary controls in the
  **menu** (not the footer); the desktop example uses the **shared** chrome (AR-1/5/12).
- Resize is **terminal-driven** (the terminal is the source of viewport truth; live, no remount)
  (AR-2/10).
- Dialogs reopen via an **on-stage button** (AR-3/14).
- Source shows **build() by default**, full module behind a toggle; the drift oracle is updated to
  region + full-file embeds — a user-authorized supersession of RD-03's whole-file-only convention
  (AR-4/9).
- Browser-only bugs (#1/#3/#4) are proven by **headless logic tests + a recorded manual checklist**;
  no new browser-e2e harness (AR-6/16).

## To begin

Use the exec-plan skill: `exec-plan live-example-remediation`.
