# Theme roles, packaging, stories, and the demos

> **Document**: 03-07-theme-packaging-demos.md
> **Parent**: [Index](00-index.md)
> **Files**: core `theme.ts` (+ re-exports); `ui`/`files` barrels; kitchen-sink stories;
> `packages/examples/{editor-demo,tvedit-demo}/`

## Overview

The cross-cutting tail: the 7 additive theme roles, explicit re-exports + packaging specs, the
three kitchen-sink stories, the headless `demo:editor`, and the acceptance oracle — the live
`demo:tvedit` clone (AR-260, NON-NEGOTIABLE gates).

## TV decode (GATE 1)

- **Roles** (PA-8, chains in the register; re-verified at exec GATE-1 2026-07-07): `editorNormal
  0x1E`, `editorSelected 0x71`, `memoNormal 0x30`, `memoSelected 0x2F`, `indicatorNormal 0x1F`,
  `indicatorDragging 0x1A`, `terminalNormal 0x1E`. **Mode-gate caveat (decode note):** these bytes
  hold under the default color palette `cpAppColor` (`app.h:142`); TV's B/W (`cpAppBlackWhite`,
  `app.h:153`) and monochrome palettes resolve the same chains to different attrs — out of scope
  for our `Theme` (a color-palette decode; depth adaptation is core's downsampler's job).
- **tvedit menus** (`examples/tvedit/tvedit3.cpp:36-73` — PF-009 path): **~F~ile** (Open F3, New
  Ctrl-N, Save F2, Save as…, ─, Change dir…, DOS shell†, Exit); **~E~dit** (Undo, ─, Cut
  Shift-Del, Copy Ctrl-Ins, Paste Shift-Ins, ─, Clear Ctrl-Del — the menu binds
  `EditorCommands.clear`; the keymap's Ctrl-Del resolves to `delWord` per the `firstKeys`
  first-match duplicate, PF-005); **~S~earch** (Find…, Replace…, Search again); **~W~indows**
  (Size/move Ctrl-F5, Zoom F5, Tile, Cascade, Next F6, Previous Shift-F6, Close Ctrl-W).
  † DOS shell is skipped (no analogue — a documented clone deviation). TV's File menu literally
  binds Exit to `kbCtrlQ` (`tvedit3.cpp:47`, exec-GATE-1) — our clone must NOT bind Ctrl-Q in the
  app keymap (PF-001), so Exit rides Alt-X/menu-pick only (the status line's quit, faithful to
  `tvedit3.cpp:81`; a recorded deviation). Second TV quirk (exec-GATE-1): the status item labeled
  `~Ctrl-W~ Close` is actually bound to `kbAltF3` (`tvedit3.cpp:84`) — our clone keeps the decoded
  label and binds the label's own Ctrl-W chord (the Windows-menu Close binding; the `kbAltF3`
  legacy alias is dropped, a documented simplification).
- **tvedit status line** (`tvedit3.cpp:76-93`): visible — `~F2~ Save`, `~F3~ Open`,
  `~Ctrl-W~ Close`, `~F5~ Zoom`, `~F6~ Next`, `~F10~ Menu`; hidden accelerators — Alt-X quit,
  Shift-Del cut, Ctrl-Ins copy, Shift-Ins paste, Ctrl-F5 resize.
- **doEditDialog** (`tvedit3.cpp:106-193`): the seam wiring the clone reproduces via
  `wireEditorDialogs` + `FileDialog` (03-03/03-06).

## Implementation Details

### Theme (additive, PA-8/PA-14)

`Theme` interface + `defaultTheme` gain the 7 roles under a `// --- jsvision-ui RD-08 editor
family ---` banner (house convention, `theme.ts:333-435`); `editor-theme.spec` byte-freezes them.
Prior closed-set guards use **two mechanisms** (PF-008): extend `LATER_ADDITIVE_ROLES` in
`tabs-theme.spec`/`feedback-theme.spec`/`date-theme.spec` **and** the inline `knownKeys` Set in
`color-theme.spec.test.ts:118` (`table-theme` and files' `files-theme` have no closed-set guard —
nothing to extend); all byte assertions untouched.

### Packaging (AC-19)

Explicit named re-exports: `ui` — `Editor`, `Memo`, `EditWindow`, `Indicator`, `Terminal`,
`terminalWriter`, `findDialog`, `replaceDialog`, `confirmBox`, `infoBox`, `replacePrompt`,
`wireEditorDialogs`, `defaultEditorDialog`, `EditorCommands`, and the option/seam types
(`EditorOptions`, `MemoOptions`, `EditWindowOptions`, `TerminalOptions`, `EditorDialogHandler`,
`EditorDialogRequest`/`Result`, `EditorDialogHost` (PF-002), `EditorAction`, `IndicatorTarget`
(PF-003), `FindRec`, `ReplaceRec`, `LineEnding`); `files` — `FileEditor`, `FileEditorOptions`,
`FileCommands`, `openFileInEditor` + `OpenFileInEditorOptions` (PF-001) (+ the 4 seam methods
ride the existing `FileSystem` type). Pure-internal stay internal: `gap.ts`/`segment.ts`/`navigate.ts`/`format.ts`/
`keymap.ts` internals, `ring.ts` (`LineRing` internal; `Terminal` is the API). `editor.packaging.spec` +
`files` packaging spec assert presence + ≤ 500 lines + `check:deps` clean.

### Kitchen-sink stories (AR-260, `kitchen-sink-gate.md`)

- `stories/editor.story.ts` — id `editor/editor`, category `Editor`, `rd:'RD-08'`: a live `Editor`
  pre-loaded with sample text inside a mini `EditWindow`-style frame + `Indicator`, interaction
  hints (WordStar keys, F-less: select/cut/paste), a bound `line:col` echo.
- `stories/memo.story.ts` — id `editor/memo`: a `Memo` in a form beside an `Input`, with the bound
  `Signal<string>` echoed live (Tab moves focus — the AC-10 proof made visible).
- `stories/terminal.story.ts` — id `editor/terminal`: a `Terminal` + a "log a line" `Button`
  (+ a small auto-writer), showing eviction at a tiny demo capacity.

All three registered in `stories/index.ts`; all pass `kitchen-sink.smoke.spec` (AC-18).

### `demo:editor` (headless walkthrough, house pattern)

`packages/examples/editor-demo/main.ts` + script `"demo:editor": "tsx editor-demo/main.ts"` +
`test/editor-demo.e2e.test.ts`: type → select (word/line) → cut/paste → undo/redo → find/replace →
the indicator tracking `line:col` — one ASCII frame per step (AC-18).

### `demo:tvedit` (the live clone — the Phase-3 acceptance oracle)

`packages/examples/tvedit-demo/main.ts` + `"demo:tvedit": "tsx tvedit-demo/main.ts"`: real-TTY app
composing the decoded menu bar + status line, multiple `EditWindow`s (file windows via the
files-side `openFileInEditor` factory — PF-001; open/new/save/save-as via `FileDialog` +
`ChDirDialog`), the **Clipboard window** (an `EditWindow` hosting the shared clipboard editor via
`editor:`, title "Clipboard"), find/replace through `wireEditorDialogs`, cascade/tile.
Menu key chords (Ctrl-N, F2, F3, F5, F6, Ctrl-W, Shift-Del, Ctrl-Ins, Shift-Ins) bind through the
app keymap + status-line accelerators — **never Ctrl-Q/Ctrl-K** (PF-001). **Quit sweep
(PF-012):** the clone binds Exit/Alt-X to a demo-local command (`'exitRequest'`) whose handler
awaits the `valid('quit')` sweep across open editors and only then emits `Commands.quit` — the
app's hidden quit sink ends `run()` immediately, and `valid()` is async (PA-17), so quit must not
race the sweep; no new framework surface. Smoke-covered by
`tvedit-demo.e2e.test.ts` (launch + first-frame assertions via the house child-process pattern;
full interactivity is the manual oracle).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Story canvas smaller than the scene | Canvas-fit representative scene (no clipped text — the files PF-005 precedent) | AR-260 |
| Demo run without a TTY (`demo:tvedit`) | The RD-08 essentials gate path (host refuses cleanly) | RD §Security |
| Clone quit with modified buffers | Demo-local `'exitRequest'` command awaits the `valid('quit')` sweep (Yes/No/Cancel per editor), then emits `Commands.quit` (PF-012) | AC-13 |

## Testing Requirements

- Spec: ST-32…ST-34 (`editor-theme.spec`, `editor.packaging.spec` + files packaging additions,
  `kitchen-sink.smoke` registration cases).
- E2E: `editor-demo.e2e`, `tvedit-demo.e2e`.
