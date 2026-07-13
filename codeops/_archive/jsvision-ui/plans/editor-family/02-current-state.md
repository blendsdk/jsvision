# Current State: Editor family

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists (reuse points, verified 2026-07-06)

- **View spine + reactivity** — `View`/`Group`/`RenderRoot` with per-view dirty granularity
  (`render-root.ts:207,255`; partial recompose is subtree-level, no line damage — grounds PA-9);
  `View.desiredCaret(): Point | null` (`view.ts:144-146`); `bind`/`onMount`/`focusSignal`.
- **Event loop** — 3-phase dispatch; key events are `{ key: string (lowercase name), ctrl, alt,
  shift }` (`core events.ts:16-25`); `PasteEvent {text, truncated}` reaches the focused view's
  `onEvent` directly (1 MiB cap upstream); `ev.setCapture/releaseCapture/hasCapture`;
  `ev.setClipboard` → core OSC-52 `setClipboard()` → output stream, already wired end-to-end
  (`event-loop.ts:317`, `osc.ts:49-53`). The TabView scoped-`preProcess` idiom
  (`tab-view.ts:311-336`) is the shipped PF-001 mechanism.
- **App shell** — `Window` (`title: Signal<string>` `window.ts:61`, `WindowManager` seam,
  `drawFrame`/`frameZoneAt`); `Desktop` gestures (`gesture` field `desktop.ts:53`, begin* at
  `:171-197`, cleared at mouse-up `:220-224` + stale-capture abort `:209-212`); `MenuBar`/
  `StatusLine`; `Commands` = quit/close/zoom/next/prev/cascade/tile/ok/cancel/yes/no/cut/copy/paste
  (`commands.ts:12-45` — **no undo/redo**, PF-003).
- **Containers** — `ScrollBar` (`value: Signal<number>`, `setRange(min,max,pageStep?,arrowStep?)`
  `scroll-bar.ts:131-136` — exactly the shape TV's `setParams` push needs); `Dialog` + button
  helpers; `openAnchoredPopup` (not needed here).
- **Controls** — `Input` word hops (`input-editing.ts` — a *different* decode from the editor's,
  kept separate per PF-014); validators; the `parseTilde`/`tildeSegments` menu utilities.
- **Core** — width engine (`WIDTH_MODE='wcwidth'`); write-time `sanitize` in `ScreenBuffer.set`;
  `Theme` + role convention (camelCase family blocks, byte-pinned by `*-theme.spec`,
  `theme.ts:333-435`); host caret plumbing (RD-07).
- **`@jsvision/files`** — the `FileSystem` seam (`fs/types.ts:41-68`) + `FileDialog`/`ChDirDialog`
  + `openFile`/`changeDir` openers + the in-memory test fs (`test/helpers/memory-fs.ts`).
- **TV source** — `/home/gevik/workdir/github/tvision`; the full RD-08 decode table
  (RD-08 §GATE-1) + this plan's supplementary decode (register §How-the-gate-was-run, PA-8/10/11/16).

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/ui/src/editor/**` (new) | The editor family | Create (03-01…03-04) |
| `packages/ui/src/terminal/**` (new) | The log sink | Create (03-05) |
| `packages/files/src/editor/**` (new) | `FileEditor` | Create (03-06) |
| `packages/core/src/engine/color/theme.ts` | Theme roles | +7 additive roles (PA-8) |
| `packages/ui/src/status/commands.ts` | Command constants | +`undo`/`redo` (PF-003) |
| `packages/ui/src/window/window.ts` | Window state | +`dragging`/`active` signals (PA-3/PA-19) |
| `packages/ui/src/desktop/desktop.ts` | Gesture lifecycle | Write the two signals (PA-3/PA-19) |
| `packages/files/src/fs/types.ts` + `node-fs.ts` | FS seam | +4 content methods (PA-6) |
| `packages/ui/src/index.ts`, `packages/files/src/index.ts` | Barrels | Explicit named re-exports |
| `packages/ui/test/*-theme.spec.test.ts` (prior families) | Closed-set guards | Extend allowlists (PA-14) |
| `packages/examples/**` | Stories + demos | 3 stories, `editor-demo/`, `tvedit-demo/` |

## Gaps Identified

### Gap 1: No text-editing primitive anywhere
**Current:** `Input` is single-line only; nothing multiline. **Required:** the full gap-buffer
family. **Fix:** 03-01…03-04.

### Gap 2: `FileSystem` has no content methods
**Current:** listing/stat/path only (`fs/types.ts:41-68`). **Required:** read/write/rename/unlink
for load/save/`.bak`. **Fix:** PA-6, 03-06.

### Gap 3: No reactive window drag/active state
**Current:** gesture is a private Desktop field; `active` computed at draw time. **Required:** the
Indicator ═/─ swap + the gadget-visibility rule need reactive sources. **Fix:** PA-3/PA-19, 03-04.

### Gap 4: No undo/redo commands, no message boxes, no multi-click
**Current:** `Commands` lacks undo/redo; no `messageBox` primitive (files built a local
`errorBox`); the decoder emits no click counts. **Fix:** PF-003 additive commands; PA-7 exported
`confirmBox`/`infoBox`/`replacePrompt`; PA-18 editor-local multi-click.

## Dependencies

### Internal
RD-01…RD-05, RD-11 (`ScrollBar`/`Dialog`), RD-06/07 (controls + caret/clipboard/paste seams),
files-package RD-09 (`FileSystem`, `FileDialog`) — all DONE. RD-13 hardening (hostile UTF-8) — the
HR-01 rule applies to buffer navigation.

### External
None (zero runtime deps). `Intl.Segmenter` is built into Node ≥ 20 (engines floor) — no dependency.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gap-buffer index bugs (the XL make-or-break core) | Med | High | Pure module, exhaustive ST oracles + the AC-16 cluster suite + RD-13-style hostile-UTF-8 impl tests, before any view code (Phase 2 first) |
| Keymap precedence regressions (Ctrl-Q/K vs menus) | Med | Med | The shipped TabView idiom (PF-001); ST oracle for prefix consume + the app-keymap constraint documented |
| Mis-decode of colours/geometry | Low | High | GATE-1 already re-verified this session (PA-8); GATE-2 AFTER-diff tasks per component |
| Cross-package seam regressions (`Window` signals, FS methods, guard allowlists) | Low | Med | Additive-only + full prior-suite runs in Phase 1 (plan-local AC-1) |
| 1 MB perf NFR misses 16 ms | Low | Low | Informational only (AC-20); PA-9 keeps draw viewport-bounded; bench-style spec skipped on CI |
