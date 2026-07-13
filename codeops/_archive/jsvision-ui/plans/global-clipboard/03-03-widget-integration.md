# Widget Integration: Global Clipboard & Selection

> **Document**: 03-03-widget-integration.md
> **Parent**: [Index](00-index.md)

## Overview

The inner layer: wiring `Input` and `Editor` to handle the globalized commands, plus the cross-widget
shared clipboard, selection-based enable-gating, the retirement of the classic classifier, and the
mandatory kitchen-sink story. This is where the **swallow-the-raw-chord invariant** is satisfied — the
default keymap converts `Ctrl+A/C/X/V` into commands, so every editable widget must handle them as
commands or existing behavior regresses.

## Architecture

### Current behavior (grounded)

- `Input.onEvent` (`controls/input.ts:230-258`): command branch handles `copy/cut/paste` via
  `clipboardCommand()`; a key branch runs the classic `clipboardChord()`; `handleKey` handles raw
  `Ctrl+A` (`:310`). `runClipboard('paste')` is a no-op (`:270`).
- `Editor` command branch (`editor/editor-events.ts:65-79`): handles `cut/copy/paste/undo/redo` + the
  editor find/replace/clear commands; **no** `selectAll`. The editor already sets
  `ed.mirrorSink = ev.setClipboard` (`:25`).
- `editorPaste` (`editor/editor-clipboard.ts:35-42`): reads only the injected clipboard `Editor`; a
  no-op with no clipboard editor.

### Proposed changes (per widget)

## Input (`controls/input.ts`, `controls/input-clipboard.ts`)

1. **Handle `Commands.selectAll`** in the command branch (`:232-238`): map `Commands.selectAll` →
   `this.selectAll(true)` and set `ev.handled`. Reuse the existing `clipboardCommand` result plus a
   `selectAll` check (either extend `clipboardCommand` to return `'selectAll'`, or add a sibling guard
   — chosen: a small dedicated check in `onEvent`, keeping `ClipboardAction` = copy/cut/paste).
2. **Functional paste** — `runClipboard('paste')` (`:269-279`): read `ev.readClipboard?.() ?? ''`; if
   non-empty, replace the selection and insert via the existing `pasteText`/`applyPaste` path
   (validator + `maxLength` enforced). Empty → no-op.
3. **Keep raw `Ctrl+A`** in `handleKey` (`:310`) as a fallback for `clipboardKeys: 'none'` apps. (No
   change; it simply no longer fires when the global keymap swallows `Ctrl+A`.)
4. **Retire `clipboardChord()`** — remove the classic-chord classifier call at `:251-256` and delete
   `clipboardChord()` from `input-clipboard.ts:27-32`. The classic chords now arrive as commands via
   the alias bindings. Confirm no other caller (grep: only `input.ts:251`). *(AR-5)*
5. **Selection-based enable-gating (Should-Have)** — expose the current selection state so the app can
   grey `copy`/`cut`. Chosen: add a public `Input.hasSelection(): boolean` accessor **and** a reactive
   `hasSelection: Signal<boolean>` the app binds to, and let the enable-gating be driven where commands
   are enabled (the app), mirroring how the `Editor` greys via `enableCommand`. *(AR-7 — see the note
   below.)*

> **Enable-gating mechanism — resolved during authoring, corrected during preflight.** The `Editor`
> greys copy/cut from its own **update** path (`editor/editor-draw.ts` — an imperative push after each
> edit/cursor move, not the paint path) and maintains a reactive `hasSelection` signal
> (`editor/editor.ts`). `Input` has no loop back-reference and — unlike the Editor — **no** selection
> signal today: its `selStart`/`selEnd` are plain fields, and `View.focusSignal()` fires on focus flips
> only, never on a pure selection change. So `Input` must **add** a reactive `hasSelection:
> Signal<boolean>`, updated wherever the selection changes (`selectAll`, shift-extend, drag/double-click
> select, `collapseSelection`/`deleteSelect`) — the mirror of the Editor's `hasSelection` — plus the
> `hasSelection(): boolean` accessor. The app binds that signal and makes the `enableCommand` call from
> whoever owns the command's menu/status item; the kitchen-sink story demonstrates it. This keeps
> `Input` loop-agnostic (no new loop coupling) while making live greying react to selection-only
> gestures. *(AR-7)*

## Editor (`editor/editor-events.ts`, `editor/editor-clipboard.ts`)

1. **Handle `Commands.selectAll`** in the command branch (`:65-79`): add
   `else if (c === Commands.selectAll) ed.execute('selectAll');` before the trailing `return`, then
   set `ev.handled = true`. `execute('selectAll')` runs the shipped selectAll action
   (`editor-actions.ts:171` — anchor at 0, extend to `buf.length`). *(AR-9)*
2. **Cross-widget copy is already covered** — `ed.mirrorSink = ev.setClipboard` (`:25`) + dual-sink
   `setClipboard` means `editorCopy` fills the shared buffer with no edit here. *(AR-6)*
3. **Cross-widget paste fallback** — `editorPaste` (`editor-clipboard.ts:35-42`): when the injected
   clipboard `Editor` is absent or empty, fall back to the loop buffer. Because `editorPaste` has no
   `ev`, thread the shared text in: the editor already stores `mirrorSink`; add a symmetric
   `ed.clipboardRead?: () => string` set from `ev.readClipboard` in `handleEditorEvent` (mirror of
   `:25`), and have `editorPaste` consult it when the clipboard editor yields `''`. Insert via the
   existing `insertRaw(convertNewEdit(text, ed.eolKind), false)` path. *(AR-6)*

## Retire path & barrel

- Delete `clipboardChord()` and its now-unused `ClipboardAction`-vs-key plumbing; keep
  `clipboardCommand()` (still used for copy/cut/paste command routing) and the `applyPaste` family.
- Re-export any new public symbols from `packages/ui/src/index.ts` as decided (`ClipboardKeys`,
  `buildKeymap` if public; `Commands.selectAll` flows through the existing `Commands` re-export).
  Whether `buildKeymap`/`ClipboardKeys` are public or internal: **public** (an app embedding a bare
  `EventLoop` may want to build the same keymap) — barrel-export both. *(AR-9)*

## Kitchen-sink story (`packages/examples/kitchen-sink/stories/clipboard.story.ts`)

- New `Story` `{ id: 'controls/clipboard', category: 'controls', title: 'Global Clipboard', blurb,
  build(ctx) }` returning a `Group` of absolutely-positioned children within `ctx.width × ctx.height`:
  two `Input` fields and a `Memo`, with a live bound-state echo, demonstrating copy from one → paste
  into another, cut, and select-all, keyboard + mouse, faithful TV colors, and interaction hints.
- Register one line in `stories/index.ts` (import + array entry, grouped under controls).
- Must pass `test/kitchen-sink.smoke.spec.test.ts` (mounts headlessly, paints, unique id, required
  metadata). *(AR-12)*

## Integration Points

- Commands arrive via the default keymap ([03-01](03-01-keymap-and-commands.md)).
- The buffer/seam comes from [03-02](03-02-clipboard-buffer-seam.md) (`ev.setClipboard` dual-sink,
  `ev.readClipboard`).
- `ComboBox`/`History` wrap `Input` — no code change; covered by ST-17.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `selectAll` command on an `Input` with empty value | `selectAll(true)` selects the empty range — harmless | AR-9 |
| Paste command but `ev.readClipboard` undefined (unit-constructed event) | `?.() ?? ''` → no-op | AR-4 |
| Non-editable focused widget receives copy/cut/paste/selectAll command | No handler consumes it → command unhandled, no-op | AR-14 |
| Classic-mode Editor gets `selectAll`/copy/cut/paste commands instead of WordStar nav | Documented; app sets `clipboardKeys: 'classic'`/`'none'` | AR-8 |
| Retiring `clipboardChord()` leaves a dangling import | Remove the import in `input.ts`; lint/typecheck catches any miss | AR-5 |

> **Traceability:** see [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements

- `Input`: copy/cut/select-all via commands; paste from the buffer through the validator/maxLength;
  empty-selection no-op; classic aliases still work — ST-8..ST-12, ST-16.
- `Editor`: `Commands.selectAll` selects all; cross-widget copy/paste both directions — ST-21,
  ST-22, ST-23.
- `ComboBox`/`History` inherit — ST-17. Non-editable no-op — ST-18. Modal scope — ST-19.
- Enable-gating: `hasSelection()` false → app disables copy/cut — ST-24.
- Kitchen-sink smoke — ST-25.
