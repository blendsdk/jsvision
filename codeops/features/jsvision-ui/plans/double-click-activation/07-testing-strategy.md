# 07 — Testing Strategy

> Spec-first: write the ST oracles (RED), implement, GREEN, then impl edges. Verify: **`yarn verify`
> + `yarn lint`** (AR-12; `TUI_SKIP_PERF=1` prefix allowed for the editor-perf budget).

## Test tiers & the injected-clock seam (AR-14)

- **Loop-integration tests** (`event.*.test.ts`) — construct `createEventLoop(vp, { caps, now })`
  with a controllable `now`, dispatch two real mouse-`down`s, and assert `clickCount` / activation.
  This is where the *timing* behavior is pinned.
- **Widget-unit tests** (`list-rows`/`grid-rows`/`tree-rows` specs) — the detector lives in the loop,
  so a bare widget test builds the envelope directly with `clickCount: 2` (no clock) and asserts the
  widget's reaction. This is where the *consumer* behavior is pinned.

## Specification test cases (immutable oracles)

| ST | Requirement | Input → Expected |
|----|-------------|------------------|
| **ST-1** | FR-1/FR-2 | Loop with injected `now`. Two `down`s on cell (5,5) at t=0 and t=100ms → the 2nd delivered envelope has `clickCount === 2`. A 3rd at t=150ms → `clickCount === 3`. |
| **ST-2** | FR-1/AR-13 | The stamped `clickCount` **propagates** to the view: a leaf recording `ev.clickCount` in `onEvent` sees `2` on the 2nd same-cell down (proves the `route()`/`hit-test` spread chain carries it). |
| **ST-3** | FR-2 (reset by time) | Two `down`s on the same cell at t=0 and t=600ms (> 500) → the 2nd has `clickCount === 1` (window elapsed). |
| **ST-4** | FR-2 (reset by cell) | `down` on (5,5) then `down` on (5,6) within 100ms → the 2nd has `clickCount === 1` (different cell). |
| **ST-5** | FR-3 | `ListRows` receives a `down` envelope with `clickCount === 2` on a valid row → `onSelect` called once **and** `command` emitted once. With `clickCount === 1` → focus+select only, **no** `onSelect`/emit. |
| **ST-6** | FR-4 | `GridRows` with `clickCount === 2` on a row → `onSelect`/emit once; `clickCount === 1` → no activate. |
| **ST-7** | FR-5 (tree) | `TreeRows`: a **text** `down` with `clickCount === 1` → focus only, **no emit**; the same with `clickCount === 2` → activate (emit once); a **graph-zone** `down` (x < graphWidth) with `clickCount === 1` → toggles expand (unchanged); a **graph-zone** `down` with `clickCount === 2` → toggles (no activate/emit) — the accepted AR-15 deviation. |
| **ST-8** | FR-6 (file dialog) | Through the File dialog: a double-click (`clickCount === 2`) on a directory entry calls `openEntry` (enters it); on a file entry resolves + closes like OK. (Driven via the loop or a direct `clickCount:2` envelope into `FileList`.) |
| **ST-9** | FR-7 (no regression) | `ComboBox` popup: a single click (`clickCount === 1`) still sets `selected` → picks + closes. A subsequent `clickCount === 2` envelope does not double-fire / reopen. |

Each ST derives from the FR/AR + the TV decode (02-current-state GATE-1), never from imagined
implementation behavior. ST-5/ST-7 encode the TV fidelity oracle (double-click activates; tree
single text click does **not** emit; the tree graph-zone double-click toggles rather than activates —
the accepted AR-15 deviation, pinned so it can't silently change).

## Implementation / edge tests (`*.impl.test.ts`)

- Count wraps naturally past 3 (no cap) — a 4th same-cell down → `clickCount === 4` (row widgets
  still only act on `=== 2`).
- A `down` between two same-cell downs but on a **different** cell resets the run.
- Move/drag/up/wheel/key envelopes carry `clickCount === undefined`.
- Capture path: a captured target still receives `clickCount` on its down (spread through the
  capture branch).
- `now` defaults to `Date.now` when unset (smoke: two fast real downs → `clickCount === 2`; kept
  tolerant / not timing-flaky, or omitted in favor of the injected-clock ST-1).

## Kitchen-sink (AR-11)

- Extend the `listview.story.ts` (id `containers/listview`), `data-grid.story.ts`, `tree.story.ts`,
  and `file-dialog.story.ts` **blurbs** to state "double-click a row to activate / open".
- The `kitchen-sink.smoke.spec` keeps its mount-and-paint role (no timing). No new story needed.

## Regression surface to keep green

- `controls`/`containers`/`listview`/`listbox`/`datagrid`/`tree`/`combo-box`/`history` suites
  (single-click focus+select, Enter/Space activate).
- `event.*` dispatch/mouse/modal suites (the envelope spread + hit-test).
- `files` file-dialog suite.
- The **editor** and **input** suites — untouched (their local detectors remain; AR-6).
