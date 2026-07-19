# Testing Strategy — canvas-flex-adoption

## Why this plan is witness-heavy

There is no new behaviour to specify — but unlike the sibling plans, there is also **no existing
oracle to lean on**. Every harness over these 9 files is a stdout-content smoke test
([02-current-state §4](02-current-state.md)); none asserts geometry, child order, or a solved rect.
A converted panel could flow sideways and every existing test would still pass.

So the witnesses are not a supplement here — they *are* the safety net, and the conversion is the
cheap half of the work.

**Green-first (NFR-2).** Every witness is written against unmodified source and passes immediately.
That is the point: a green-first witness records what the artifact does today, so a later red proves
the conversion moved something.

**Non-vacuity (NFR-3).** Each witness asserts an exact child count and at least one **absolute**
rect per container. A relation between two solved values is never the only assertion — the sibling
plan's review found exactly that defect in its own witnesses, where `scrollBar.x === list.x +
list.width` held even with both collapsed to zero.

**Placement.** All nine are `*.impl.test.ts`. They capture internal demo/panel composition, which
later epic work (#112's docs modernization, #114's shadow cleanup) may legitimately reshape;
freezing it in an immutable spec oracle would obstruct the feature's own direction.

## The shared helper

`solveTree(view, w, h)` — mounts `view` under a render root at `w × h`, flushes once, and returns a
plain snapshot of each container's children as `{ x, y, width, height }`. A near-identical copy lives
in each package's `test/` directory (AR-10): cross-package test imports need a `tsconfig.typecheck`
exclude, and the repo already sets this precedent with `ui/test/app-shell.fixtures.ts`, a deliberate
local copy of core's host doubles.

Because these demos are `main()` scripts rather than exported builders, each witness reconstructs the
same view tree the demo builds. That duplication is deliberate and is the reason the witness is an
`impl` test: it asserts *this composition*, and it must be updated in lockstep when the composition
is intentionally changed.

## Specification test cases

### `packages/examples/test/demo-composition.impl.test.ts`

| # | Subject | Asserted |
|---|---------|----------|
| ST-C1 | `editor-demo` root | 2 children; editor absorbs the slack, indicator is exactly 1 row at the bottom; both full width |
| ST-C2 | `event-demo` root | 4 children stacked in order (header, body, dialog, status); **`padding:1` visible as a 1-cell inset on x and y**; header/status 1 row, dialog 2 rows |
| ST-C3 | `event-demo` body row | 2 buttons side by side; **the second button's x is the first's right edge + 2**, the `gap` — the assertion that catches a dropped gap |
| ST-C4 | `controls-demo` form | exact child count; **`padding:1` inset**; each row's height matches its declared cell count; `gap:0` means no inter-row space |
| ST-C5 | `router-demo` list screen | 2 children (title, listView) stacked; `padding:1` inset; listView absorbs the slack |
| ST-C6 | `router-demo` DetailScreen | 3 children (title, hint, back) stacked with a 1-cell `gap` between each; back is 2 rows |
| ST-C7 | `chrome-bars-demo` window body | body fills the window's content box below the chrome |
| ST-C8 | `drill-down.story` list + detail screens | list screen: 1 child filling; detail screen: 3 children stacked with `gap:1` |

### `packages/theme-designer/test/panel-composition.impl.test.ts`

| # | Subject | Asserted |
|---|---------|----------|
| ST-C9 | roles panel, preview panel, and the 3-pane workspace | each panel: 2 children stacked vertically, title exactly 1 row, body absorbing the slack — **the assertion that catches a lost `direction:'col'`**; workspace: 3 panes side by side at x-offsets 0 / 28 / (width − 32), with the rail 28 wide, the inspector 32 wide, and the preview taking the remainder |

ST-C9 is the highest-value witness in the plan: it is the only thing standing between
`app.ts:288`/`:290` dropping their `direction:'col'` and a silently horizontal panel, and it must be
green **before** Phase 2 touches either panel builder.

## The zero-edit contract

| Rule | Enforcement |
|------|-------------|
| No existing test edited | `git diff --stat` on `**/test/**` per phase; AC-6 |
| The 5 demo e2e tests + walkthrough e2e green and unedited | AC-6 |
| `kitchen-sink.smoke.spec` green and unedited | NFR-5 |
| No nesting change is expected, so a broken locator is a mis-transcription first | NFR-1 |
| ST-C1…C9 are exempt from any locator allowance — they are the detectors | NFR-1 |

## Verification

Per phase: `TUI_SKIP_PERF=1 yarn verify` (AR-11). At close-out additionally: `yarn check:deps`, the
kitchen-sink smoke test (NFR-5), the grep audit against the residue allowlist (AC-8), and a
`git diff --stat` confirming no other package's `src/` was touched (AC-9, NFR-6).

**Manual check (not automatable).** Both issues ask for a live run — `yarn designer` on a TTY and at
least one `demo:*` — because these artifacts are didactic and "renders identically" includes reading
well. Recorded as a close-out task, not a gate.
