# 01 — Requirements & Scope: Live-Example Remediation

> **Feature**: docs-website · **Type**: Remediation (post-ship follow-up to RD-03)
> **Source**: user bug report 2026-07-10 + code-verified triage `../_draft/live-example-bugs.md`
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

## Context

RD-03 shipped the live-example system: every docs code sample runs live in an xterm.js terminal via
`@jsvision/web`'s `mountApp`. In use, the user found **seven bugs**. They cluster into four
workstreams. This plan fixes all seven; it adds no new examples and no new RD.

## The seven bugs → four workstreams

| Workstream | Bugs | One-line goal |
|-----------|------|---------------|
| **A — Play resize** | #1 (resize breaks the app), #3 (DataGrid garble), + the #3 latent H-scroll golden, + the wheel-leak | The Play modal is genuinely resizable and the app stays functional; the DataGrid H-scroll render path is covered and correct. |
| **B — Unify the demo shell** | #4 (shadow on dots), #5 (commands in footer), #6 (inconsistent shells) | One consistent shell: every demo is a titled Window on the desktop; primary controls in the menu; the desktop example uses the shared chrome. |
| **C — Dialog reopen** | #7 (closed dialog is dead) | Dialog demos have an on-stage "Open dialog" button that reopens the modal. |
| **D — Source framing** | #2 (Source is confusing) | The Source block leads with `build()`; the full module is behind a toggle. |

## Functional requirements

Each requirement traces to an Ambiguity-Register decision.

- **FR-A1** The Play modal is resizable and the composed app viewport always matches the terminal's
  actual `cols/rows` — no desync, input stays functional at any size (AR-2, AR-10).
- **FR-A2** Resizing is live (no remount); the terminal is the single source of viewport truth; a
  minimum size (40×12) floors the fit (AR-10).
- **FR-A3** Mouse-wheel over the terminal never scrolls/zooms the underlying page (AR-11).
- **FR-A4** The GridRows horizontal-scroll render path (cells + dividers at `indent>0`, including a
  wide-glyph cell straddling the left clip) is correct and covered by a headless golden (AR-6, AR-8).
- **FR-B1** Every example runs inside ONE consistent shell: a titled, movable/zoomable, **non-closable**
  Window hosting the component on the desktop; menu bar = System (About) / View (Theme, Depth); the
  status line carries hotkey hints only (AR-1, AR-5, AR-12, AR-13).
- **FR-B2** A component demo's cells sit on the Window surface, not the desktop dot pattern — flat
  shadows read correctly (#4) (AR-1, AR-17).
- **FR-B3** The desktop example uses the shared menu bar (+ a Window menu) instead of its own; its
  Theme/Depth controls are reachable (fixes the unreachable-handler defect) (AR-1, AR-12).
- **FR-C1** The `controls/form-dialog` and `files/file-dialog` examples present an "Open the dialog"
  button on their stage Window that (re)opens the modal every time (AR-3, AR-14).
- **FR-D1** Each example page's Source section shows the `build()` region by default (captioned,
  tied to the Play window) with the full module behind a toggle; the drift oracle is updated to
  assert region + full-file embeds, both directive-based (AR-4, AR-9).

## Success criteria (definition of done)

- All four workstreams land; `yarn verify` green (AR-15).
- New headless coverage green: the controller viewport-tracking test (FR-A1/A2), the GridRows
  overflow golden at `indent>0` (FR-A4), the DemoShell non-closable-Window test (FR-B1), the updated
  drift oracle (FR-D1) (AR-6, AR-9, AR-17).
- The docs-build gate (`check-docs-build.mjs`) stays green with the updated Source-embed convention.
- The **manual browser-verification checklist** (07-testing-strategy §Manual) is executed and
  recorded for #1 resize, #3 garble, #4 surface (AR-6).

## Out of scope (AR-16)

No new browser-e2e harness; no engine/`@jsvision/ui` theming redesign; no change to the eight-example
set; the deeper web-host damage-diff investigation is deferred unless #3 still garbles after #1.

## Security (AR-18)

No new input/injection/data surface. Examples still paint through the existing `sanitize` boundary;
the resize path only changes viewport sizing; the wheel fix is a DOM `preventDefault`.
