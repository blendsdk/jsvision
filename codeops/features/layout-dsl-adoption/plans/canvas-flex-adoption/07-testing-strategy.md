# Testing Strategy — canvas-flex-adoption

> Revised after preflight. The original strategy prescribed witnesses that **reconstructed** each
> demo's view tree inside the test file. Both auditors independently found the same defect: a
> reconstruction never executes a line of the converted file, so it passes after the conversion **by
> construction** — whatever the conversion did. That is recorded as PF-001/PF-002 and is why the
> witness seam is now chosen per file rather than assumed.

## Why this plan is witness-heavy

There is no new behaviour to specify, and — unlike the sibling plans — no existing oracle to lean
on. Every harness over these 9 files is a stdout-content smoke test
([02-current-state §4](02-current-state.md)); none asserts geometry, child order, or a solved rect.
A converted panel could flow sideways and every existing test would still pass.

So the witnesses are the safety net, and Phase 1 is the larger half of the work.

## The seam rule — a witness must observe the real artifact

**A witness may never assert a tree it built itself.** Each converted file gets the cheapest seam
that reaches its actual composition:

| File | Seam | Why |
|---|---|---|
| `event-demo`, `controls-demo`, `router-demo` | **frame snapshot** — the demo already prints its whole composed buffer via `printFrame`, and the e2e harness already spawns it | A geometry oracle on the running demo at zero source change. A lost `padding`/`gap` moves the printed cells. |
| `drill-down.story.ts` | **the exported `drillDownStory`** (`:50`) — drive `build(ctx)` headlessly, as `kitchen-sink.smoke.spec` already does | Already an exported artifact; no new seam needed. |
| `editor-demo`, `chrome-bars-demo` | **a new exported `buildRoot()`** that `main()` calls; the witness imports it | Neither prints a frame. A ~3-line extraction, in-scope, and itself a didactic improvement. |
| `roles-panel`, `preview-panel`, `app.ts` | **`createDesignerApp({ caps, viewport, requireTty:false })`** — the real app tree, as `app.spec.test.ts:38` already builds | See §ST-C9 — this is the only seam where green-first and detection are compatible. |

**Green-first (NFR-2).** Every witness is authored against unmodified source and passes immediately —
recording what the artifact does today, so a later red proves the conversion moved something.

**Non-vacuity (NFR-3).** Each witness asserts an exact child count **and at least one literal
absolute rect**. A relation between two solved values is never the only assertion — it holds when
both operands collapse. The literals are captured from the green-first run and written in as
constants; do not paraphrase them as relations afterwards.

> This rule is not theoretical. The sibling plan shipped `scrollBar.x === list.x + list.width` as a
> sole assertion and had it caught in review — and the first draft of *this* document then repeated
> the same shape at ST-C3, in the very file that bans it.

**Placement.** The importing witnesses are `*.impl.test.ts`; the frame snapshots extend the existing
`*.e2e.test.ts` files as **new** test cases (never edits to existing ones — AC-6).

## Specification test cases

### Frame-snapshot witnesses — `packages/examples/test/*-demo.e2e.test.ts` (new cases)

| # | Subject | Asserted |
|---|---------|----------|
| ST-C1 | `event-demo` root frame | The printed frame's **exact row strings** for the composed desktop: the `padding:1` inset shows as a blank first column and first row; header/status occupy their rows; the dialog block spans 2 rows. Captured verbatim from the green-first run. |
| ST-C2 | `event-demo` button row | The row containing both buttons, as an exact string — **the two button faces separated by exactly 2 blank cells** (the `gap`). A dropped gap shifts every character after the first button. |
| ST-C3 | `event-demo` dialog column | The dialog's two rows: `dialogLabel`'s text on the first, `btnClose` on the second. **Covers `event-demo:119`**, whose `direction:'col'` no other witness could see (the root-level "dialog is 2 rows tall" holds in either direction). |
| ST-C4 | `controls-demo` form frame | Exact row strings showing the `padding:1` inset and each control on its own row with `gap:0` (no blank row between). |
| ST-C5 | `router-demo` list screen frame | Exact row strings: `padding:1` inset, title on the first content row, list filling beneath. |
| ST-C6 | `router-demo` DetailScreen frame | Exact row strings: title, blank (the `gap:1`), hint, blank, back — the gap is visible as the blank rows. |

Each asserts the frame lines as literal strings, so a count and absolute positions are inherent —
NFR-3 is satisfied structurally rather than by a separate clause.

### Importing witnesses — `packages/examples/test/demo-composition.impl.test.ts`

| # | Subject | Asserted |
|---|---------|----------|
| ST-C7 | `editor-demo`'s exported `buildRoot()` | Root has exactly 2 children; the indicator's **full literal rect** (1 row, at the bottom, full width) and the editor's full literal rect above it |
| ST-C8 | `chrome-bars-demo`'s exported `buildRoot()` | The window's child count and the body's **full literal rect** inside the 48×9 frame (`main.ts:88`) — note the subject is the `Window`'s content box, not the app chrome |
| ST-C9 | `drillDownStory.build(ctx)` — the **real exported story** | List screen: the list child's full literal rect **and** the screen's solved `direction`, since a single `fr` child fills identically under `row` and `col` so the rect alone cannot see `drill-down:69`. Detail screen: 3 children, each child's absolute y, showing the `gap:1` |

### Designer witnesses — `packages/theme-designer/test/panel-composition.impl.test.ts`

Driven through `createDesignerApp({ caps, viewport, requireTty:false })` at the 90×30 viewport
`app.spec.test.ts:22` already uses — walking `app.desktop` to the workspace and its three panes.

| # | Subject | Asserted |
|---|---------|----------|
| ST-C10a | roles panel, in the real app tree | 2 children; title's **full literal rect** (1 row, 28 wide); list filling beneath it — vertical stacking, the assertion that sees a lost `direction:'col'` |
| ST-C10b | preview panel, in the real app tree | 2 children; title's full literal rect; scroller filling beneath |
| ST-C10c | the 3-pane workspace | 3 panes; each pane's **full literal rect** — rail 28 wide at x 0, preview filling, inspector 32 wide at the right edge |

**Why the app seam is mandatory here (PF-002).** Neither panel builder sets `direction` today; it
arrives only from `app.ts:288`/`:290`, and `normalizeProps` defaults to `'row'`
(`ui/src/layout/types.ts:213`). So a witness that mounts `buildRolesPanel(model).view` standalone
solves it as a **row** and is red-first, violating NFR-2 — while a witness that supplies the
direction itself keeps supplying it after task 2.4 removes it, and detects nothing. Only the real app
tree is green today *and* genuinely red if task 2.1/2.2 fails to move the direction into the builder.

## The zero-edit contract

| Rule | Enforcement |
|------|-------------|
| No existing test **case** edited; frame snapshots are appended as new cases | `git diff` on `**/test/**` per phase; AC-6 |
| The 4 demo e2e tests + walkthrough e2e green, their existing cases unedited | AC-6 |
| `kitchen-sink.smoke.spec` green and unedited | NFR-5 |
| **No locator edit is permitted.** FR-5 forbids nesting changes, so a broken locator is a mis-transcription — it halts the phase and is fixed in source, never in the test | NFR-1; task 4.2 |
| ST-C1…C10 are the detectors and may not be weakened at all | NFR-1 |

## Verification

Per phase: `TUI_SKIP_PERF=1 yarn verify` (AR-11). At close-out additionally: `yarn check:deps`, the
kitchen-sink smoke test (NFR-5), the grep audit against the residue allowlist (AC-8), and a
`git diff --stat` confirming no other package's `src/` was touched (AC-9, NFR-6).

**Manual check (not automatable, not a gate).** Both issues ask for a live run — `yarn designer` on a
TTY and at least one `demo:*` — because these artifacts are didactic and "renders identically"
includes reading well. Every acceptance criterion has an automatable oracle independent of it.
