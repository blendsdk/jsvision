# Current State: Global Clipboard & Selection

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

All line references verified against the current tree this session.

## Existing Implementation

### What Exists

The **key → command → focused-widget** path is fully wired and working:

1. `route()` translates a keymapped chord into a command and **swallows the raw key** — it never
   reaches a view: `event/dispatch.ts:121-128`.
2. The emitted command routes back through the 3-phase sweep to the **focused chain** (phase 2):
   `event/dispatch.ts:198-217` (`focusChain` clamped to `scopeRoot`).
3. Both editable widgets already honor clipboard **commands**: `Input.onEvent` handles
   `Commands.copy/cut/paste` via `clipboardCommand()` (`controls/input.ts:232-238`); `Editor` handles
   `Commands.cut/copy/paste/undo/redo` (`editor/editor-events.ts:65-79`).
4. Commands are **enabled by default** (only an explicit `enableCommand(name, false)` disables one):
   `event/commands.ts` (registry), `event/types.ts:108`.

Copy/cut **write** already works everywhere: `event-loop.ts:457-460` — the route-context
`setClipboard` calls core `setClipboard(text, caps)` (OSC-52) → `writeClipboard` host sink. It is a
no-op headlessly and in browsers is handled by `@jsvision/web`.

The `Editor` already achieves **functional in-app paste with no OS read** via an app-owned clipboard
editor (`EditorOptions.clipboard`): `editorCopy` fills it (and `ed.mirrorSink?.(text)` mirrors to the
OS clipboard), `editorPaste` reads it synchronously (`editor/editor-clipboard.ts:14-42`). This is the
template for the `Input` buffer.

### The two editable widgets diverge

| Widget | Copy / Cut / Paste | Select-all | Key files |
| --- | --- | --- | --- |
| **`Editor`** (`Memo`/`EditWindow`) | Modern `Ctrl+X/C/V` (+`Ctrl+Z/Y`) via a raw-key modern overlay, and `Commands.cut/copy/paste` | Modern `Ctrl+A` (raw-key overlay → `selectAll` action) **but no `Commands.selectAll`** | `editor/keymap.ts:107,181`, `editor/editor-events.ts:38,65-79`, `editor/editor-actions.ts:171` |
| **`Input`** (single-line) | Classic `Ctrl+Insert`=copy / `Shift+Insert`=paste / `Shift+Delete`=cut (`clipboardChord`), and `Commands.copy/cut/paste` | Modern `Ctrl+A` (raw key in `handleKey`, `input.ts:310`) **but no `Commands.selectAll`** | `controls/input-clipboard.ts:27-32`, `controls/input.ts:230-279,305-313` |
| Everything else | — none — | — none — | — |

`ComboBox`/`History` do **not** add a third implementation — their editable field **is** an `Input`,
so fixing `Input` fixes them.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/status/commands.ts` | `Commands` map + JSDoc | Add `Commands.selectAll`; rewrite the clipboard JSDoc (`:36-49`) — it documents only the classic chords |
| `packages/ui/src/event/default-keymap.ts` *(new)* | Default keymap + merge helper | Create `DEFAULT_CLIPBOARD_KEYMAP` + `buildKeymap(clipboardKeys, userKeymap)` |
| `packages/ui/src/event/event-loop.ts` | Loop constructor + route context | Merge default keymap (`:169`); own `clipboardText`; dual-sink `setClipboard` (`:457-460`); add `readClipboard` to `routeContext()` (`:435`) |
| `packages/ui/src/event/dispatch.ts` | `RouteContext` + `ev2` | Add `readClipboard` to `RouteContext` (`:27-67`); enrich onto `ev2` (`:180-190`) |
| `packages/ui/src/event/types.ts` | `EventLoopOptions` | Add `clipboardKeys?` |
| `packages/ui/src/view/types.ts` | `DispatchEvent` | Add `readClipboard?`; confirm `setClipboard?` (`:158`) |
| `packages/ui/src/controls/input.ts` | `Input.onEvent`/`runClipboard`/`handleKey` | Handle `Commands.selectAll`; `runClipboard('paste')` reads `ev.readClipboard()` (`:269-279`); selection-based enable of copy/cut |
| `packages/ui/src/controls/input-clipboard.ts` | Classic classifier | Retire `clipboardChord()` (`:27-32`) |
| `packages/ui/src/editor/editor-events.ts` | Editor command branch | Handle `Commands.selectAll` (`:65-79`) |
| `packages/ui/src/editor/editor-clipboard.ts` | Editor paste | `editorPaste` falls back to `readClipboard()` when the clipboard editor is empty |
| `packages/ui/src/app/application.ts` | App options → loop | Add `ApplicationOptions.clipboardKeys` (`:36`) → thread to loop (`:239`) |
| `packages/ui/src/index.ts` | Package barrel | Re-export any new public symbols |
| `packages/examples/kitchen-sink/stories/{clipboard.story.ts,index.ts}` | Showcase | New story + registration |
| `CHANGELOG.md` | Governance | Unreleased "Added" entry |

## Gaps Identified

### Gap 1: No default keymap
**Current:** `EventLoop.keymap` / `Application.keymap` default to `undefined` and pass straight through
(`event-loop.ts:169`, `application.ts:37,239`). No chord is bound framework-wide.
**Required:** A framework default keymap binds `Ctrl+A/C/X/V` (+ classic aliases) so the chords become
commands.
**Fix:** `event/default-keymap.ts` + merge in the loop constructor.

### Gap 2: `Commands.selectAll` does not exist
**Current:** Select-all is a **raw-key** handler in both widgets (`input.ts:310`; the editor's modern
overlay). Nothing routes a `selectAll` command.
**Required:** Because the default keymap swallows `Ctrl+A`, select-all must be a command both widgets
handle — otherwise it regresses.
**Fix:** Add `Commands.selectAll`; wire both widgets' command branch. Keep each widget's raw-key
`Ctrl+A` as a fallback for apps that set `clipboardKeys: 'none'`.

### Gap 3: `Input` in-app paste is a no-op
**Current:** `Input.runClipboard('paste')` returns immediately (`input.ts:270`); there is no
synchronous system-clipboard read.
**Required:** In-app `Ctrl+V` inserts previously-copied text.
**Fix:** A loop-owned app-local buffer + `readClipboard()` seam; `runClipboard('paste')` reads it and
inserts via the existing `applyPaste` path.

### Gap 4: No cross-widget shared clipboard
**Current:** The editor's clipboard is a private `Editor`; `Input` has no buffer at all.
**Required:** One logical app clipboard (Editor↔Input).
**Fix:** Dual-sink `setClipboard` fills the shared buffer on every copy (editor copy is free via the
already-wired `mirrorSink`); editor paste falls back to `readClipboard()`.

## Dependencies

### Internal Dependencies
- Core `setClipboard(text, caps)` + `Keymap`/`createKeymap` (`@jsvision/core`) — already imported in
  `event-loop.ts:11`.
- The 3-phase router + command registry + modal `scopeRoot` (all shipped).
- `Input`'s `applyPaste`/`mapPasteChar`/`selectAll`/`selStart`/`selEnd`; the `Editor`'s
  `execute('selectAll')`/`copy()`/`cut()`/`paste()`/`selectionText()`.

### External Dependencies
- None. Zero runtime deps; no new package.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Select-all regresses (raw `Ctrl+A` swallowed, no command handler) | High if missed | High | `Commands.selectAll` wired in both widgets is a Phase-1 gate + ST-7/ST-14/ST-20 |
| Classic/WordStar-mode Editor loses nav chords under a global keymap | Low (modern is default) | Medium | Modern-first; documented `clipboardKeys` opt-out (AR-8); ST covers modern parity only |
| `Ctrl+C` now consumed by a focused field | Certain (by design) | Low | Documented behavioral change (AR-2); `clipboardKeys` lets apps opt out |
| Retiring `clipboardChord()` breaks a hidden caller | Low | Medium | Grep confirms one caller (`input.ts:251`); classic behavior preserved via alias bindings (ST-16) |
| Dual-sink `setClipboard` double-writes / interferes with OS write | Low | Low | The in-memory sink is a plain assignment before/after the existing encode; ST-8 asserts OS write still fires |
