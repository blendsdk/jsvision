# Editor family Implementation Plan

> **Feature**: The Turbo Vision editor family — `Editor`/`Memo`/`EditWindow`/`Indicator`/`Terminal` in `@jsvision/ui` + `FileEditor` in `@jsvision/files`
> **Status**: Planning Complete
> **Created**: 2026-07-06
> **Implements**: jsvision-ui/RD-08
> **CodeOps Skills Version**: 3.3.0

## Overview

RD-08 is the component map's **Phase 3 — Heavy** slice and its last unstarted RD — the XL item the
map flags as "as big as the rest combined". It delivers the Turbo Vision **editor family**: a
gap-buffer multiline `Editor` (selection, WordStar keymap, clipboard, search/replace, the AR-253
undo/redo extension, scrollbar + indicator sync), the dialog-embeddable `Memo`, the `EditWindow`
blue-window chrome, the `line:col` `Indicator`, the `Terminal` streaming log sink, and — in
`@jsvision/files` over its `FileSystem` seam — the `FileEditor` file binding (load/save/`.bak`
backups/save prompts). The acceptance oracle is a live **`tvedit` clone** (`demo:tvedit`).

Every component has a TV counterpart (`teditor1/2.cpp`, `edits.cpp`, `tmemo.cpp`, `tindictr.cpp`,
`teditwnd.cpp`, `textview.cpp`, `tfiledtr.cpp`, `tvedit2/3.cpp`), so the **GATE-1 BEFORE-decode +
GATE-2 AFTER-diff are mandatory** (NON-NEGOTIABLE TV-fidelity directive,
`codeops/tv-fidelity-gate.md`). The decode is already pinned: editor `0x1E`/`0x71`, memo
`0x30`/`0x2F`, indicator `0x1F`/`0x1A` (═ resting / ─ dragging), terminal `0x1E` (PA-8). Behavior
may extend TV where the RD says so (undo/redo stack, reactive binding, Unicode clusters, the OSC-52
mirror) — drawing may not.

Cross-package surface is **additive only**: 7 core theme roles (PA-8), `Commands.undo`/`redo`
(PF-003), reactive `Window.dragging` + `Window.active` signals (PA-3/PA-19), and 4 `FileSystem`
content methods (PA-6). The heavy logic lands as **view-free pure modules** (buffer, format,
keymap, undo, search, ring) so the XL core is spec-testable without a render root.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (PA-1…PA-19) |
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Scope delta view (Source: RD-08) |
| 02 | [Current State](02-current-state.md) | Reuse points, seams, and gaps |
| 03-01 | [Buffer core](03-01-buffer-core.md) | Gap buffer + segmentation + navigation + EOL (pure) |
| 03-02 | [Editor view](03-02-editor-view.md) | `formatLine` + keymap tables + the `Editor` view |
| 03-03 | [Undo, clipboard, search](03-03-undo-clipboard-search.md) | AR-253 stack + clipboard seam + search/replace + `editorDialog` + dialog builders |
| 03-04 | [Memo, Indicator, EditWindow](03-04-memo-indicator-editwindow.md) | The three chrome/dialog components + window seams |
| 03-05 | [Terminal](03-05-terminal.md) | The code-unit ring + `Terminal` view + `terminalWriter` |
| 03-06 | [FileEditor](03-06-file-editor.md) | `@jsvision/files`: seam additions + load/save/`.bak`/prompts |
| 03-07 | [Theme, packaging, demos](03-07-theme-packaging-demos.md) | Roles, exports, stories, `demo:editor`, `demo:tvedit` |
| 07 | [Testing Strategy](07-testing-strategy.md) | ST-1…ST-35 spec oracles ↔ AC-1…AC-20 |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and the task checklist |

## Quick Reference

### Usage Examples

```ts
import { Editor, Memo, EditWindow, Terminal, findDialog, EditorCommands } from '@jsvision/ui';
import { FileEditor, openFileInEditor } from '@jsvision/files';

// A bare fs-free editor sharing an app-owned clipboard editor (PA-2).
const clipboard = new Editor();
const ed = new Editor({ clipboard, editorDialog: myDialogHandler });
ed.setText('hello\nworld');

// A Memo bound two-way to a signal, inside a Dialog (Tab moves focus).
const notes = signal('');
dialog.add(new Memo({ value: notes }));

// The full TV chrome: editor + indicator + scrollbars in a tileable blue window.
// File hosting is the files-side factory (PF-001 — ui stays fs-free):
const { window: win } = openFileInEditor(app, { fs: nodeFileSystem, fileName: 'README.md', clipboard });
// A bare or clipboard-hosting window supplies its own editor:
const clipWin = new EditWindow({ editor: clipboard, clipboard }); // titles "Clipboard" (teditwnd.cpp:70-78)

// A streaming log sink.
const term = new Terminal({ capacity: 32000 });
term.writeLine('build started');
```

### Key Decisions

| Decision | Outcome | AR Ref |
|----------|---------|--------|
| Undo defaults | Depth 1000 (`undoDepth`), redo command-only | PA-1 |
| Clipboard default | Injectable, no implicit default (TV null-clipboard semantics) | PA-2 |
| Drag + active seams | Reactive `Window.dragging` + `Window.active`, Desktop-maintained | PA-3, PA-19 |
| v1 scope | All Must-Haves + all three Should-Haves | PA-4 |
| Segmentation | ui-local pure `segment.ts` on `Intl.Segmenter` | PA-5 |
| `FileSystem` additions | `readFile`/`writeFile`/`rename`/`unlink` | PA-6 |
| Seam message boxes | Exported `confirmBox`/`infoBox`/`replacePrompt` in `dialogs.ts` | PA-7, PA-11 |
| Theme roles | 7 roles, bytes decoded + frozen | PA-8 |
| Repaint | Whole-view invalidate, viewport-bounded formatting | PA-9 |
| Command surface | Internal `EditorAction`s + registry-level app commands (`EditorCommands` = find/replace/searchAgain/clear; files' `FileCommands` owns save/saveAs) | PA-15 (PF-004/PF-005) |
| Multi-click | Editor-local detection, injectable clock | PA-18 |
| EditWindow hosting | Caller-supplied `editor?: Editor` + files-side `openFileInEditor` factory (no ui→files cycle) | PF-001 |

## Related Files

**New — `@jsvision/ui`**: `src/editor/{buffer/{gap.ts,segment.ts,navigate.ts,eol.ts,index.ts},
format.ts,keymap.ts,undo.ts,search.ts,editor.ts,memo.ts,indicator.ts,edit-window.ts,dialogs.ts,
index.ts}` + `src/terminal/{ring.ts,terminal.ts,index.ts}`.
**New — `@jsvision/files`**: `src/editor/{file-editor.ts,commands.ts,index.ts}`.
**Modified (additive) — core**: `theme.ts` + role re-exports (7 roles, PA-8) + prior theme-guard allowlists (PA-14).
**Modified (additive) — ui**: `status/commands.ts` (`undo`/`redo`), `window/window.ts` (`dragging`/`active` signals), `desktop/desktop.ts` (signal writes), `src/index.ts` re-exports.
**Modified (additive) — files**: `src/fs/types.ts` + `node-fs.ts` (4 content methods), `src/index.ts`.
**New — examples**: `kitchen-sink/stories/{editor,memo,terminal}.story.ts`, `editor-demo/`,
`tvedit-demo/`, `test/{editor-demo,tvedit-demo}.e2e.test.ts` (+ registry lines, scripts).
