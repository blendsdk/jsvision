# Async Modal Helpers (Proposal 4)

> **Document**: 03-03-modal-helpers.md
> **Parent**: [Index](00-index.md)

## Overview

Thin async wrappers over the existing `Dialog` for the three everyday modals — a message, a yes/no
question, a single-field prompt — so nobody hand-writes centering math or teardown. No new rendering.
They reuse the editor family's proven `runDialog` pattern, lifted into `dialog/` as shared code; the
editor's `infoBox`/`confirmBox` are refactored to delegate.

## Architecture

### Current Architecture
`editor/dialogs.ts` owns the modal-box pattern: `runDialog` (`:49`, add→`execView`→remove in a
`finally`), the `EditorDialogHost` seam (`:30-35`), and `infoBox`/`confirmBox`/`replacePrompt`. These
are scoped to the editor and named for its needs.

### Proposed Changes
Create `packages/ui/src/dialog/message-box.ts` exporting `messageBox`/`confirm`/`inputBox` and a
public `ModalDialogHost` type (the `{ loop, desktop }` seam). Move the `runDialog` add→run→remove
helper here as the shared engine. Refactor `editor/dialogs.ts` `infoBox`→`messageBox` delegation and
`confirmBox` to reuse the shared `runDialog`. `Application` satisfies `ModalDialogHost` directly (it
has `readonly loop`/`readonly desktop`).

> **Impact — moving `runDialog` touches every editor caller.** `runDialog` is currently a private
> helper in `editor/dialogs.ts:49` used by **five** builders: `findDialog:85`, `replaceDialog:139`,
> `confirmBox:166`, `infoBox:185`, and `replacePrompt:211`. Once it moves to `dialog/message-box.ts`,
> `infoBox` delegates to `messageBox` (no longer calls `runDialog`), but `findDialog`, `replaceDialog`,
> `confirmBox`, and `replacePrompt` all keep calling it — so each must `import { runDialog } from
> '../dialog/message-box.js'`. Keep `runDialog` **module-internal** (exported from `message-box.ts` for
> the editor to import, but NOT re-exported through `dialog/index.ts` or the `@jsvision/ui` barrel), so
> it stays a private engine and `check-jsdoc.mjs` does not demand an `@example` for it.

## Implementation Details

### New Types/Interfaces

```ts
// dialog/message-box.ts (AR-11)
/**
 * The minimal host a modal helper needs: an event loop to run the modal and a desktop to mount it
 * into. An `Application` from `createApplication()` satisfies this directly.
 */
export interface ModalDialogHost {
  loop: Pick<EventLoop, 'execView'>;
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;
}

export interface MessageBoxOptions {
  /** Title centered in the top border (required). */
  title: string;
  /** The message body; the box sizes itself to fit. */
  text: string;
  /** `'ok'` (default) shows one OK button; `'okCancel'` shows OK + Cancel. */
  buttons?: 'ok' | 'okCancel';
}

export interface InputBoxOptions {
  /** Title centered in the top border. */
  title: string;
  /** Label shown beside the field (supports `~X~` hotkey markup). */
  label: string;
  /** The two-way value signal the field reads and writes. */
  value: Signal<string>;
  /** Optional validator; OK is gated by the dialog's `valid()` sweep. */
  validator?: Validator;
}
```

### New Functions/Methods

```ts
/**
 * Show a modal message box and wait for the user to dismiss it.
 * @returns `'ok'` or (with `buttons: 'okCancel'`) `'cancel'`.
 * @example
 * await messageBox(app, { title: 'About', text: 'jsvision — Turbo Vision, reimagined' });
 */
export function messageBox(host: ModalDialogHost, o: MessageBoxOptions): Promise<'ok' | 'cancel'>;

/**
 * Ask a yes/no question modally.
 * @returns `true` on Yes; `false` on No, Esc, or closing the box.
 * @example
 * if (await confirm(app, 'Discard unsaved changes?')) discard();
 */
export function confirm(host: ModalDialogHost, text: string): Promise<boolean>;

/**
 * Prompt for a single line of text modally.
 * @returns the entered string on OK, or `null` if the user cancels.
 * @example
 * const name = await inputBox(app, { title: 'Rename', label: '~N~ew name', value: signal('') });
 * if (name !== null) rename(name);
 */
export function inputBox(host: ModalDialogHost, o: InputBoxOptions): Promise<string | null>;
```

Behavior (AR-12):
- `messageBox`: build a centered `Dialog({ title, width, height })` sized to the text, add a `Text`
  and `okButton()` (+ `cancelButton()` when `buttons==='okCancel'`), `runDialog`, map the terminating
  command → `'ok'` on OK, `'cancel'` on anything else. **Esc and the frame close-box are NOT inert on
  an OK-only box:** `Dialog` always resolves the modal to `Commands.cancel` on Esc (`dialog.ts:175-178`)
  and on the close-box (`:181-188`), and every dialog is `closable` by default (`window.ts:105`). So an
  OK-only `messageBox` can resolve `'cancel'` when the user presses Esc or clicks `[×]` — the box does
  NOT stay open. This matches today's `infoBox`, which is likewise closable and Esc-dismissible (it
  simply ignores the returned command and resolves `void` regardless).
- `confirm`: `Dialog({ title: 'Confirm', … })` with `yesButton()`/`noButton()`; map `'yes'`→`true`,
  anything else (`'no'`/`'cancel'`)→`false`.
- `inputBox`: `Dialog({ title, … })` with a `Label`(+link)/`Input({ value, validator })` and
  `okCancelButtons()`; on `'ok'` return `value.peek()`, else `null`. The `valid()` gate already vetoes
  OK on an invalid field and refocuses it (no new logic).

### Integration Points

```ts
// editor/dialogs.ts — refactor to delegate (AR-10), no behavior change
export async function infoBox(host: EditorDialogHost, message: string): Promise<void> {
  await messageBox(host, { title: '', text: message, buttons: 'ok' }); // same OK box
}
// confirmBox keeps its Yes/No/Cancel three-button contract; it is refactored only to reuse the
// shared runDialog (moved to dialog/message-box.ts and imported), NOT replaced by `confirm`.
```

`EditorDialogHost` and `ModalDialogHost` are the same structural shape; the executor either aliases
one to the other or has the editor import `ModalDialogHost` to avoid two identical interfaces.

### Sizing
Reuse the editor's proven sizing math (`infoBox`: `width = min(60, max(24, text.length+6))`,
`confirmBox`: `min(60, max(40, …))`) so the boxes look identical to today's. Recorded here so the
executor doesn't reinvent geometry (this is a port of shipped behavior, not a new design).

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| User cancels `inputBox` | Resolve `null` (not the current signal value) | AR-12 |
| Invalid field + OK in `inputBox` | Existing `Dialog.valid()` vetoes close, refocuses the field | AR-12 |
| `messageBox` OK-only, Esc or close-box | `Dialog` resolves the modal to `cancel` and closes (it is `closable` by default); `messageBox` returns `'cancel'`. Matches today's `infoBox` (closable, Esc-dismissible). The box does NOT stay open. | AR-12 |
| `runDialog` cleanup after a throw | `removeWindow` in `finally` (existing pattern) | AR-10 |

> **Traceability:** design per AR-10 (generalize + editor delegates), AR-11 (`{loop,desktop}` seam), AR-12 (`confirm` Yes/No boolean + titles).

## Testing Requirements
- Spec: ST-13…ST-19 (`07-testing-strategy.md`).
- Impl: sizing edge cases, `inputBox` validator veto path, editor `infoBox`/`confirmBox` regression.
