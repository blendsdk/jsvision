# Clipboard Buffer & Seam: Global Clipboard & Selection

> **Document**: 03-02-clipboard-buffer-seam.md
> **Parent**: [Index](00-index.md)

## Overview

The middle layer: a loop-owned in-memory **app-local clipboard buffer** plus the two event seams that
read and write it. This is what makes `Ctrl+V` functional on every terminal with **no** OSC-52 read
and no core-decoder change — the same model the `Editor` already uses, lifted to the loop so every
widget shares one buffer.

## Architecture

### Current Architecture

The loop exposes exactly one clipboard seam on each event: `setClipboard(text)` (`view/types.ts:158`,
enriched in `dispatch.ts:187`, provided in `event-loop.ts:457-460`). It writes **only** the OS
clipboard (core `setClipboard(text, caps)` → host `writeClipboard`). There is **no read seam** and no
in-app buffer — `Input.runClipboard('paste')` is a no-op (`input.ts:270`).

### Proposed Changes

- The loop owns `private clipboardText = ''`.
- Extend the route-context `setClipboard` to write **both** sinks: the OS clipboard (as today) **and**
  `this.clipboardText` (dual sink).
- Add `readClipboard(): string` returning `this.clipboardText`, exposed on each event as
  `ev.readClipboard`.

## Implementation Details

### New loop state (`event-loop.ts`)

```ts
/** The app-local clipboard buffer: the last text copied/cut within the app. In-memory only. */
private clipboardText = '';
```

### Dual-sink `setClipboard` (`event-loop.ts:457-460`)

```ts
setClipboard: (text) => {
  this.clipboardText = text;               // app-local buffer (NEW) — powers in-app paste
  const seq = setClipboard(text, this.caps); // OS clipboard (existing) — OSC-52 write
  if (seq !== '') this.writeClipboard?.(seq);
},
```

Order note: the buffer assignment is unconditional and independent of terminal capability, so in-app
paste works even when the OS write is a headless no-op. *(AR-4)*

### `readClipboard()` seam (additive across four sites)

1. **`RouteContext`** (`dispatch.ts:27-67`) — add:
   ```ts
   /** Read the app-local clipboard buffer. Exposed as `ev.readClipboard`. */
   readClipboard(): string;
   ```
2. **`ev2` enrichment** (`dispatch.ts:180-190`) — add `readClipboard: ctx.readClipboard,`.
3. **`routeContext()`** (`event-loop.ts:435`) — add `readClipboard: () => this.clipboardText,`.
4. **`DispatchEvent`** (`view/types.ts`, near `setClipboard` at `:158`) — add:
   ```ts
   /**
    * Read the application's in-app clipboard buffer (the last text copied/cut within the app). Used by
    * editable controls to implement in-app paste without reading the external OS clipboard. Returns
    * `''` when nothing has been copied yet. `undefined` on an event that was not routed through the
    * loop.
    */
   readonly readClipboard?: () => string;
   ```

The `setClipboard?` field already exists on `DispatchEvent` (`view/types.ts:158`) — confirm only; no
change there.

## Integration Points

- **Write side (copy/cut):** widgets already call `ev.setClipboard?.(text)` (`input.ts:273`;
  `editor` via `mirrorSink` set from `ev.setClipboard` at `editor-events.ts:25`). With the dual sink,
  every existing copy/cut now also fills `clipboardText` — so cross-widget copy (Editor→shared buffer)
  is free. *(AR-6)*
- **Read side (paste):** `Input.runClipboard('paste')` and `editorPaste` read `ev.readClipboard()` —
  see [03-03](03-03-widget-integration.md).
- **Modal scope:** the seam is loop-global, so a copy inside a modal `Dialog` and a paste after it
  closes share the buffer. *(AR-15)*

## Code Examples

```ts
// Inside a control's onEvent (paste path):
const text = ev.readClipboard?.() ?? '';
if (text !== '') this.insertViaValidator(text); // existing applyPaste path
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Paste before any copy | `readClipboard()` returns `''`; the paste path early-returns (no-op) | AR-4 |
| Event not routed through the loop (unit-constructed) | `ev.readClipboard` is `undefined`; the `?.() ?? ''` guard yields a no-op | AR-4 |
| Untrusted/control characters in the buffer | Sanitized on **insert** by the existing `mapPasteChar` + validator + `maxLength` (Input) / `convertNewEdit` (Editor); the buffer itself is never rendered directly | AR-16 |
| OS write fails / unsupported terminal | Independent of the buffer; `writeClipboard?.` is optional and a no-op headlessly; in-app paste still works | AR-4 |

> **Traceability:** see [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements

- `setClipboard` fills the buffer **and** still emits the OS write sequence — ST-8.
- `readClipboard()` returns the last copied text; `''` before any copy — ST-11, ST-12.
- The buffer is loop-global across a modal boundary — ST-19 (paste inside/after a dialog).
- Packaging: `readClipboard` present on `DispatchEvent`; `ClipboardKeys`/`buildKeymap` barrel-exported
  as decided — ST-7 packaging.
