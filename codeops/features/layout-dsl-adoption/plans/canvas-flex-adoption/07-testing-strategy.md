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
| `event-demo`, `controls-demo`, `router-demo`, `editor-demo` | **frame snapshot** — each already prints its whole composed buffer (`printFrame`, or a local `frame()` helper in `editor-demo`) and each is already spawned by an existing `*.e2e.test.ts` | A geometry oracle on the running demo at **zero source change**. A lost `padding`/`gap` moves the printed cells. |
| `drill-down.story.ts` | **the exported `drillDownStory`** (`:50`) — drive `build(ctx)` headlessly | Already an exported artifact; no new seam needed. |
| `chrome-bars-demo` | **a new sibling module `chrome-bars-demo/tree.ts`** exporting the window build, which `main.ts` imports | The only file that neither prints a frame nor exports anything. A sibling module — **not** an export from `main.ts`, which calls `main().then(code => process.exit(code))` at module scope (`:118-124`): importing it would run the demo and kill the vitest worker. |
| `roles-panel`, `preview-panel`, `app.ts` | **`createDesignerApp({ caps, viewport, requireTty:false })`** — the real app tree, as `app.spec.test.ts:38` already builds | See §ST-C10 — the only seam where green-first and detection are compatible. |

**Green-first (NFR-2).** Every witness is authored against unmodified source and passes immediately —
recording what the artifact does today, so a later red proves the conversion moved something.

**Non-vacuity (NFR-3) — two admissible forms.** A *frame* witness asserts **literal row strings**;
position and count are inherent in the characters, so no separate clause is needed. An *importing*
witness asserts an **exact child count and at least one literal absolute rect**. In both forms a
relation between two solved values is never the only assertion — it holds when both operands
collapse — and the literals are captured from the green-first run, never paraphrased back into
relations.

**Flush before reading `bounds`.** `createDesignerApp` adds the workspace to the desktop after the
shell mounts (`app.ts:316-321`), and `View.bounds` only refreshes on the next layout pass. An
importing witness that reads `bounds` without forcing `app.loop.renderRoot.flush()` first captures
`{0,0,0,0}`, writes the zeros in as its "literal rect", and is permanently green and blind — the
exact class this rule exists to prevent. Every importing witness flushes first and asserts each
captured rect is non-degenerate.

> This rule is not theoretical. The sibling plan shipped `scrollBar.x === list.x + list.width` as a
> sole assertion and had it caught in review — and the first draft of *this* document then repeated
> the same shape at ST-C3, in the very file that bans it.

**Placement.** The importing witnesses are `*.impl.test.ts`; the frame snapshots extend the existing
`*.e2e.test.ts` files as **new** test cases (never edits to existing ones — AC-6).

## Specification test cases

### Frame-snapshot witnesses — appended as **new cases** to the existing `*.e2e.test.ts` files

Each demo prints several titled frames (`event-demo` 5, `controls-demo` 8, `router-demo` 4,
`editor-demo` 9). **Every witness names the frame it asserts by its printed title** and locates its
rows by scanning forward from that title line — otherwise "the printed frame" is ambiguous.

A single new `test/spawn-demo.ts` helper carries the spawn/collect boilerplate. That is a **new**
module, not an edit to an existing case, so AC-6 holds; one spawn serves all the assertions for a
demo.

| # | Demo · frame | Asserted |
|---|---|---|
| ST-C1 | `event-demo`, first frame | Exact row strings for the composed desktop: the `padding:1` inset as a blank first column and row; header and status on their rows; the dialog block spanning 2 rows |
| ST-C2 | `event-demo`, same frame | The button row as an exact string — the two faces separated by exactly **2 blank cells** (the `gap`). A dropped gap shifts every character after the first button |
| ST-C3 | `event-demo`, the dialog-open frame | The dialog's two rows: `dialogLabel` on the first, `btnClose` on the second. **Covers `:119`**, whose `direction:'col'` no other witness can see |
| ST-C4 | `controls-demo`, first frame | Exact row strings: the `padding:1` inset, each control on its own row, no blank row between (`gap:0`) |
| ST-C5 | `router-demo`, list frame | Exact row strings: `padding:1` inset, title on the first content row, list filling beneath |
| ST-C6 | `router-demo`, detail frame | Exact row strings: title, blank, hint, blank, back — the `gap:1` visible as the blank rows |
| ST-C7 | `editor-demo`, first frame | Exact row strings: the editor occupying the upper rows and the indicator strip as the **last** row, full width. A dropped `direction:'col'` at `:67` turns the indicator into a 1-cell column and moves `1:1` off the bottom row |

### Importing witnesses — `packages/examples/test/demo-composition.impl.test.ts`

| # | Subject | Asserted |
|---|---------|----------|
| ST-C8 | `chrome-bars-demo/tree.ts`'s exported builder | The window's child count and the body's **full literal rect** inside the 48×9 frame (`main.ts:88`) — the subject is the `Window`'s content box, not the app chrome |
| ST-C9 | `drillDownStory.build(ctx)` — the **real exported story** | **List screen:** the list child's full literal rect **and** the screen's solved `direction` (a lone `fr` child fills identically under `row` and `col`, so the rect alone cannot see `drill-down:69`), plus `screen.background === 'window'`. **Detail screen:** reached by navigation — mount through `createEventLoop`, focus the `ListView`, dispatch `enter`, re-solve, then assert 3 children and each child's absolute y (the `gap:1`). `DetailScreen` is not exported, so reconstructing one in the test would violate the seam rule |

### Designer witnesses — `packages/theme-designer/test/panel-composition.impl.test.ts`

Driven through `createDesignerApp({ caps, viewport, requireTty:false })` at the 90×30 viewport
`app.spec.test.ts:22` already uses — walking `app.desktop` to the workspace and its three panes.

| # | Subject | Asserted |
|---|---------|----------|
| ST-C10a | roles panel, in the real app tree | 2 children; title's **full literal rect** (1 row, 28 wide); list filling beneath it — vertical stacking, the assertion that sees a lost `direction:'col'` — plus `rail.view.background === 'dialog'`, the only oracle for that fold |
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
| No existing test **case** edited; frame snapshots are appended as new cases, and their spawn boilerplate lives in a **new** `test/spawn-demo.ts` | `git diff` on `**/test/**` per phase; AC-6 |
| The 4 demo e2e tests + walkthrough e2e green, their existing cases unedited | AC-6 |
| `kitchen-sink.smoke.spec` green and unedited | NFR-5 |
| **No locator edit is permitted.** FR-5 forbids nesting changes, so a broken locator is a mis-transcription — it halts the phase and is fixed in source, never in the test | NFR-1; task 4.2 |
| ST-C1…C10 are the detectors and may not be weakened at all | NFR-1 |
| `chrome-bars-demo` is the one exception to green-first: its seam edits the file before its witness exists, so ST-C8 is green-first relative to the **post-extraction** state. Task 1.1 is therefore a pure move with no reordering, guarded by review and the task-4.5 TTY run | NFR-2 |

## Verification

Per phase: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e` (AR-11).

**The second command is load-bearing, not belt-and-braces.** `yarn verify` runs `turbo run test`,
which for `@jsvision/examples` is `vitest run --project unit` — and that project *excludes*
`test/**/*.e2e.test.ts` (`vitest.config.ts:14-15`). Seven of the ten witnesses live in e2e files, so
without the second command an executor can finish every phase with a green verify while every frame
snapshot sits unrun, and learn about a dropped `padding` only from CI after the PR opens.

At close-out additionally: `yarn check:deps`, the
kitchen-sink smoke test (NFR-5), the grep audit against the residue allowlist (AC-8), and a
`git diff --stat` confirming no other package's `src/` was touched (AC-9, NFR-6).

**Manual check (not automatable, not a gate).** Both issues ask for a live run — `yarn designer` on a
TTY and at least one `demo:*` — because these artifacts are didactic and "renders identically"
includes reading well. Every acceptance criterion has an automatable oracle independent of it.
