# 07 — Testing Strategy

> **Feature**: docs-website · **CodeOps Skills Version**: 3.3.2 · **Verify**: `yarn verify` (AR-15).

Spec-first per phase: **spec tests → red → implement → green → impl tests → verify**. Automated
coverage is deterministic + headless (AR-6); the pixel-level xterm behaviours that no headless
harness can see are proven by the **Manual browser checklist** below (also AR-6). Each ST cites its
FR / AR and the home doc.

## Specification test cases

### Workstream A — resize + GridRows (03-01)

- **ST-A1** (FR-A1/A2, AR-2/10) — *controller viewport tracks the terminal.* Drive a fake terminal
  through the play-controller: after `open()`, `app.loop`'s viewport equals the terminal's
  `cols × rows`; a `resize(cols', rows')` updates the loop viewport to `cols' × rows'`. No hardcoded
  preset drives the app. (`packages/docs-site/test/*`, `test/helpers/play-harness.ts` `HarnessTerminal`
  gains `cols/rows` + `resize`.)
- **ST-A2** (FR-A4, AR-8) — *overflow grid renders correctly at `indent>0`.* Three width-12 fixed
  columns in a 24-wide grid; set `indent` mid-range; the rendered `ScreenBuffer` shows each column's
  correct left-panned substring, each `│` at `starts[c]+widths[c]−indent`, and no stray cell at the
  left clip. (`packages/ui/test/datagrid.hscroll.spec.test.ts`.)
- **ST-A3** (FR-A4) — *wide-glyph left-clip.* A cell with a 2-col glyph whose lead falls at `x=−1`
  → column-0 renders blank (no orphan continuation cell).
- **ST-A4** (FR-A4) — *header lockstep.* `GridHeader` at the same `indent` pans titles + sort arrow
  identically to the rows.

### Workstream B — unified shell (03-02)

- **ST-B1** (FR-B1, AR-5/17) — a `component` example is wrapped in a `Window` with
  `closable === false`, titled with the example's title.
- **ST-B2** (FR-B2, AR-17) — a sampled interior cell of a component demo sits on the window surface
  (window/background role), not the desktop pattern glyph (`role.pattern`).
- **ST-B3** (FR-B3, AR-1/12) — the `apps/desktop` example returns an `Application` carrying the shared
  menu (a `Window` menu item exists) + the shared About handler; emitting `demo.theme.<n>` changes the
  theme (Theme/Depth reachable — the unreachable-handler defect is gone).
- **ST-B4** (FR-B1, #5) — the status line exposes only hint items; no `demo.theme.*`/`demo.depth.*`
  primary command lives in it.
- **ST-B5** (registry) — every `EXAMPLES` entry has `kind ∈ {component, app}`; module↔entry parity holds.

### Workstream C — dialog reopen (03-03)

- **ST-C1** (FR-C1, AR-3/14) — for `controls/form-dialog` and `files/file-dialog`: after `build()` a
  modal is active; ending it leaves the stage `Window` + its "Open the dialog" `Button` alive;
  emitting `demo.openDialog` re-activates a modal.

### Workstream D — source framing (03-04)

- **ST-D1** (FR-D1, AR-9) — every example page embeds the `#example` region (`<<< @/<sourcePath>#example`)
  AND the full file (`<<< @/<sourcePath>`); no pasted `defineExample(` in a fenced ts block.
- **ST-D2** (FR-D1) — every example module contains a matching `// #region example` /
  `// #endregion example` pair.
- **ST-D3** (FR-D1, build gate) — `check-docs-build.mjs` asserts the built HTML for each live-example
  page contains both the region snippet and the full-module details block.

## Manual browser checklist (AR-6) — run in `yarn docs:dev`, record pass/fail

| # | Bug | Check | Result |
|---|-----|-------|--------|
| M1 | #1 | Open the DataGrid Play; drag-resize the modal small→large; input works + the grid stays aligned at each size (no desync). | ✅ 2026-07-10 — grid stays aligned, app functional after grow |
| M2 | #1 | The size preset button changes size live — no blank/half-painted frame, input still works after. | ✅ 2026-07-10 — 80×24→100×30 live, no remount blank |
| M3 | wheel | Mouse-wheel over the terminal does NOT scroll or zoom the underlying doc page. | ◑ 2026-07-10 — wiring verified live (capture wheel listener fires, app still scrolls, `<html>` scroll-lock sets on open + restores on close); the page-scroll-STOP under a **real hardware wheel** still needs a human eyeball (CDP force-scrolls past `preventDefault` + `overflow`, so automation can't assert it) |
| M4 | #3 | The DataGrid does not garble at any size or during nav/sort. | ✅ 2026-07-10 — crisp at 80×24 and 100×30, no garble |
| M5 | #4 | A Button demo's flat block-shadow reads correctly on the window surface (not on the desktop dots). | ✅ 2026-07-10 — button in a titled non-closable Window, block-shadow on the clean window surface, component centered |
| M6 | #6 | Every example (incl. `apps/desktop`) shows the same System/View menu; Theme + Depth switch works everywhere, desktop included. | ✅ 2026-07-10 — consistent `≡ View` menu + hints-only status everywhere; desktop app now shows `≡ View Window` (Theme reachable; ST-B3 confirms the command repaints) |
| M7 | #7 | Close a dialog (OK/Cancel/Esc), then click "Open the dialog" — it reopens; repeat. | ✅ 2026-07-10 — form-dialog: Esc closes → "Form dialog" stage window + green "Open the dialog" button revealed → Enter reopens a fresh Person dialog (fields reset) |
| M8 | #2 | The Source section shows `build()` by default; the full module is in the collapsible details. | ✅ 2026-07-10 — default code block is the `#example` region (data + `build()`, no JSDoc/imports); full module in a collapsed "Full module" details |

## Notes

- RD-03 spec oracles are edited only where the requirement changed, each a user-authorized
  supersession (the deliberate, narrow exception to spec-test immutability): the drift oracle
  (ST-3 → ST-D1, AR-9), and the demo-shell/play-controller chrome oracles (**ST-4 superseded**,
  ST-5/ST-9/ST-7 rewritten, AR-19). The full affected-file list is in 03-02 §Test migration.
- The ui GridRows golden (ST-A2/A3/A4) is a new spec oracle. Preflight confirmed `draw-context.ts`
  already clips negative-`x` + straddling wide glyphs (`:91-92`), so it is **expected green as
  written** — meaning #3's browser garble is downstream of #1/wheel and **M4 (manual) is the real
  gate for #3**, to be re-confirmed after Phase 1. Recorded, not hand-waved.
