# Component: Bounded Paste Text and Empty-event Parity

> **Implements**: RD-01 R1.10, R1.11, R1.13
> **Status**: Ready for execution
> **CodeOps Artifact Schema**: 1

## Responsibility

Give direct host strings the same 1 MiB UTF-8 safety boundary as terminal-decoded paste and make an
empty `PasteEvent` non-destructive in every editable widget.

## Core contract

```ts
export interface BoundedPasteText {
  readonly text: string;
  readonly truncated: boolean;
}

export function boundPasteText(
  text: string,
  capBytes?: number,
): BoundedPasteText;
```

- Default `capBytes` is `PASTE_CAP_BYTES`.
- Negative, non-finite, or non-integer custom caps are rejected consistently with core validation
  conventions.
- If input fits, return the original string reference and `truncated: false`.
- Otherwise allocate exactly the allowed byte capacity, call `TextEncoder.encodeInto`, decode only
  the completed bytes, and return `truncated: true`.
- Never split a surrogate pair/Unicode scalar or return a decoder replacement caused by the cap.
- Do not log, normalize line endings, trim, inspect, or otherwise transform clipboard content.

## Widget parity

The loop must still route a successful empty value so canonical state becomes `""`. Each editable
widget then returns handled/no-op before selection deletion, undo creation, value change,
validation, or repaint side effects. Non-empty paste behavior remains byte-for-byte compatible.

## Planned files

| Area | Delta |
|---|---|
| Core events/input utility and barrel exports | Add documented result type/helper beside the shared cap. |
| Core specifications and implementation tests | ASCII boundary, multibyte boundary, exact fit, empty, invalid caps, large input. |
| UI editable controls | Add explicit empty-event guard at the insertion boundary. |
| UI specifications | Prove empty native/bracketed events do not mutate selections or history. |

## Invariants

1. `TextEncoder.encode(result.text).byteLength <= capBytes`.
2. `truncated` is true exactly when the full input does not fit.
3. The result is a valid prefix of the original text.
4. Bounding work and memory are `O(capBytes)`, not `O(input bytes)` beyond encoder traversal.
5. Empty delivery updates canonical state but creates no widget mutation.

## Verification

Run core and affected UI specification/implementation tests, package typechecks, then `yarn verify`.
